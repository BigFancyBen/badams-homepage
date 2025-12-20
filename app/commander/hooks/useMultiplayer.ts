"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useChannel, usePresence, usePresenceListener, useConnectionStateListener } from 'ably/react';
import { GameAction, SlotOwner } from '../types';

interface PresenceData {
  clientId: string;
  name: string;
  playerSlot: number | null;
  isCreator: boolean;
}

interface UseMultiplayerProps {
  roomCode: string;
  localClientId: string;
  playerName: string;
  isCreator: boolean;
  onGameAction: (action: GameAction) => void;
}

interface UseMultiplayerReturn {
  isConnected: boolean;
  isHost: boolean;
  slotOwners: (SlotOwner | null)[];
  localPlayerSlot: number | null;
  connectedCount: number;
  latencyMs: number | null;
  sendGameAction: (action: GameAction) => void;
  claimSlot: (slotIndex: number) => void;
  leaveSlot: () => void;
}

// Debounce delay for rapid actions
const DEBOUNCE_MS = 50;

export function useMultiplayer({
  roomCode,
  localClientId,
  playerName,
  isCreator,
  onGameAction,
}: UseMultiplayerProps): UseMultiplayerReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [localPlayerSlot, setLocalPlayerSlot] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  // Track slot ownership: who owns each slot (persists even if disconnected)
  // Store base info without isConnected - we compute that from presence
  const [slotOwnersBase, setSlotOwnersBase] = useState<({ clientId: string; name: string } | null)[]>([null, null, null, null]);

  // Track pending slot claims with timestamps for conflict resolution
  const slotClaimTimestamps = useRef<(number | null)[]>([null, null, null, null]);

  // Debounce queue for rapid actions
  const pendingActions = useRef<Map<string, { action: GameAction; timeout: NodeJS.Timeout }>>(new Map());

  // Track if we've attempted auto-reclaim
  const hasAttemptedReclaim = useRef(false);

  // Channel ref for accessing inside callback
  const channelRef = useRef<ReturnType<typeof useChannel>['channel'] | null>(null);

  // Monitor connection state
  useConnectionStateListener('connected', () => {
    setIsConnected(true);
  });

  useConnectionStateListener('disconnected', () => {
    setIsConnected(false);
  });

  // Subscribe to game actions channel
  const { channel } = useChannel(`commander:${roomCode}`, (message) => {
    if (message.name === 'game-action') {
      const action = message.data as GameAction;

      // Handle slot claims with conflict resolution
      if (action.type === 'CLAIM_SLOT') {
        const claimTime = (action as GameAction & { timestamp?: number }).timestamp || Date.now();
        const existingClaim = slotClaimTimestamps.current[action.slotIndex];

        // If slot already claimed, only accept if this claim is earlier (first wins)
        if (existingClaim && claimTime > existingClaim) {
          // Reject this claim - it came after
          return;
        }

        slotClaimTimestamps.current[action.slotIndex] = claimTime;

        setSlotOwnersBase((prev) => {
          const newOwners = [...prev];
          newOwners[action.slotIndex] = {
            clientId: action.clientId,
            name: action.name,
          };
          return newOwners;
        });
        // Update local slot if it's us
        if (action.clientId === localClientId) {
          setLocalPlayerSlot(action.slotIndex);
        }
      }

      // Handle full state sync (includes slot owners)
      if (action.type === 'FULL_STATE_SYNC') {
        // Convert SlotOwner to base format (without isConnected)
        setSlotOwnersBase(action.slotOwners.map(owner =>
          owner ? { clientId: owner.clientId, name: owner.name } : null
        ));
        // Reset claim timestamps from synced state
        action.slotOwners.forEach((owner, idx) => {
          slotClaimTimestamps.current[idx] = owner ? Date.now() : null;
        });
        // Find our slot (auto-reclaim on sync)
        const ourSlot = action.slotOwners.findIndex(
          (owner) => owner?.clientId === localClientId
        );
        if (ourSlot !== -1) {
          setLocalPlayerSlot(ourSlot);
        }
      }

      // Handle ping for latency measurement
      if (action.type === 'PING' && (action as GameAction & { targetClientId?: string }).targetClientId === localClientId) {
        // Respond with pong via ref
        channelRef.current?.publish('game-action', {
          type: 'PONG',
          senderId: localClientId,
          originalTimestamp: (action as GameAction & { timestamp?: number }).timestamp,
          targetClientId: action.senderId,
        });
        return; // Don't propagate ping to game
      }

      if (action.type === 'PONG' && (action as GameAction & { targetClientId?: string }).targetClientId === localClientId) {
        const originalTime = (action as GameAction & { originalTimestamp?: number }).originalTimestamp;
        if (originalTime) {
          setLatencyMs(Math.round((Date.now() - originalTime) / 2));
        }
        return; // Don't propagate pong to game
      }

      onGameAction(action);
    }
  });

  // Keep channel ref in sync
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  // Track presence for lobby
  const { updateStatus } = usePresence<PresenceData>(
    `commander:${roomCode}`,
    {
      clientId: localClientId,
      name: playerName,
      playerSlot: null,
      isCreator,
    }
  );

  // Listen for presence updates from all clients
  const { presenceData } = usePresenceListener<PresenceData>(`commander:${roomCode}`);

  // Connected count
  const connectedCount = presenceData.length;

  // Compute connected client IDs from presence data
  const connectedClientIds = useMemo(
    () => new Set(presenceData.map((member) => member.data.clientId)),
    [presenceData]
  );

  // Compute slotOwners with connection status from presence data
  const slotOwners = useMemo<(SlotOwner | null)[]>(
    () => slotOwnersBase.map((owner) => {
      if (!owner) return null;
      return {
        ...owner,
        isConnected: connectedClientIds.has(owner.clientId),
      };
    }),
    [slotOwnersBase, connectedClientIds]
  );

  // Compute host status from presence data (derived state)
  const isHost = useMemo(() => {
    const creatorPresent = presenceData.find((member) => member.data.isCreator);
    if (creatorPresent) {
      return creatorPresent.data.clientId === localClientId;
    } else if (presenceData.length > 0) {
      // Sort by timestamp, first one is host
      const sorted = [...presenceData].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      return sorted[0]?.data.clientId === localClientId;
    }
    return isCreator; // Fallback to initial value
  }, [presenceData, localClientId, isCreator]);

  // Auto-reclaim slot on reconnect
  useEffect(() => {
    if (isConnected && !hasAttemptedReclaim.current) {
      hasAttemptedReclaim.current = true;

      // Check if we already own a slot
      const existingSlot = slotOwnersBase.findIndex(
        (owner) => owner?.clientId === localClientId
      );

      if (existingSlot !== -1) {
        // Reclaim our slot from Ably presence data on reconnect
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external Ably state
        setLocalPlayerSlot(existingSlot);
        // Note: isConnected will be computed automatically from presence data

        // Update presence with our slot
        updateStatus({
          clientId: localClientId,
          name: playerName,
          playerSlot: existingSlot,
          isCreator,
        });
      }
    }
  }, [isConnected, slotOwnersBase, localClientId, playerName, isCreator, updateStatus]);

  // Measure latency periodically (every 30 seconds)
  useEffect(() => {
    if (!isConnected) return;

    const measureLatency = () => {
      // Pick a random other client to ping
      const otherClients = presenceData.filter(p => p.data.clientId !== localClientId);
      if (otherClients.length > 0) {
        const target = otherClients[Math.floor(Math.random() * otherClients.length)];
        channel.publish('game-action', {
          type: 'PING',
          senderId: localClientId,
          targetClientId: target.data.clientId,
          timestamp: Date.now(),
        });
      }
    };

    // Measure immediately and then every 30 seconds
    measureLatency();
    const interval = setInterval(measureLatency, 30000);
    return () => clearInterval(interval);
  }, [isConnected, presenceData, localClientId, channel]);

  // Send a game action with debouncing for rapid actions
  const sendGameAction = useCallback(
    (action: GameAction) => {
      // Debounce life/poison updates - combine rapid changes
      if (action.type === 'UPDATE_LIFE' || action.type === 'UPDATE_POISON') {
        const key = `${action.type}-${action.playerIndex}`;
        const pending = pendingActions.current.get(key);

        if (pending) {
          // Cancel previous timeout and combine changes
          clearTimeout(pending.timeout);
          const prevAction = pending.action as typeof action;
          const combinedAction = {
            ...action,
            change: prevAction.change + action.change,
          };

          const timeout = setTimeout(() => {
            channel.publish('game-action', combinedAction);
            pendingActions.current.delete(key);
          }, DEBOUNCE_MS);

          pendingActions.current.set(key, { action: combinedAction, timeout });
        } else {
          // First action - set timeout
          const timeout = setTimeout(() => {
            channel.publish('game-action', action);
            pendingActions.current.delete(key);
          }, DEBOUNCE_MS);

          pendingActions.current.set(key, { action, timeout });
        }
        return;
      }

      // Non-debounced actions go immediately
      channel.publish('game-action', action);
    },
    [channel]
  );

  // Claim a player slot
  const claimSlot = useCallback(
    (slotIndex: number) => {
      // Check if slot is already taken
      if (slotOwnersBase[slotIndex]) {
        return;
      }

      const claimTimestamp = Date.now();
      slotClaimTimestamps.current[slotIndex] = claimTimestamp;

      // Update local state immediately
      setLocalPlayerSlot(slotIndex);
      setSlotOwnersBase((prev) => {
        const newOwners = [...prev];
        newOwners[slotIndex] = {
          clientId: localClientId,
          name: playerName,
        };
        return newOwners;
      });

      // Update presence
      updateStatus({
        clientId: localClientId,
        name: playerName,
        playerSlot: slotIndex,
        isCreator,
      });

      // Broadcast to others with timestamp for conflict resolution
      channel.publish('game-action', {
        type: 'CLAIM_SLOT',
        slotIndex,
        clientId: localClientId,
        name: playerName,
        senderId: localClientId,
        timestamp: claimTimestamp,
      });
    },
    [slotOwnersBase, localClientId, playerName, isCreator, updateStatus, channel]
  );

  // Leave current slot (become spectator)
  const leaveSlot = useCallback(() => {
    if (localPlayerSlot === null) return;

    slotClaimTimestamps.current[localPlayerSlot] = null;

    setSlotOwnersBase((prev) => {
      const newOwners = [...prev];
      newOwners[localPlayerSlot] = null;
      return newOwners;
    });
    setLocalPlayerSlot(null);

    updateStatus({
      clientId: localClientId,
      name: playerName,
      playerSlot: null,
      isCreator,
    });
  }, [localPlayerSlot, localClientId, playerName, isCreator, updateStatus]);

  return {
    isConnected,
    isHost,
    slotOwners,
    localPlayerSlot,
    connectedCount,
    latencyMs,
    sendGameAction,
    claimSlot,
    leaveSlot,
  };
}
