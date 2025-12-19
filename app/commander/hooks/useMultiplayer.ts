"use client";

import { useCallback, useEffect, useState } from 'react';
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
  sendGameAction: (action: GameAction) => void;
  claimSlot: (slotIndex: number) => void;
  leaveSlot: () => void;
}

export function useMultiplayer({
  roomCode,
  localClientId,
  playerName,
  isCreator,
  onGameAction,
}: UseMultiplayerProps): UseMultiplayerReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [localPlayerSlot, setLocalPlayerSlot] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(isCreator);
  // Track slot ownership: who owns each slot (persists even if disconnected)
  const [slotOwners, setSlotOwners] = useState<(SlotOwner | null)[]>([null, null, null, null]);

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

      // Handle slot claims internally
      if (action.type === 'CLAIM_SLOT') {
        setSlotOwners((prev) => {
          const newOwners = [...prev];
          newOwners[action.slotIndex] = {
            clientId: action.clientId,
            name: action.name,
            isConnected: true,
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
        setSlotOwners(action.slotOwners);
        // Find our slot
        const ourSlot = action.slotOwners.findIndex(
          (owner) => owner?.clientId === localClientId
        );
        if (ourSlot !== -1) {
          setLocalPlayerSlot(ourSlot);
        }
      }

      onGameAction(action);
    }
  });

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

  // Update slot connection status when presence changes
  useEffect(() => {
    const connectedClientIds = new Set(presenceData.map((member) => member.data.clientId));

    // Update isConnected for all slot owners
    setSlotOwners((prev) =>
      prev.map((owner) => {
        if (!owner) return null;
        return {
          ...owner,
          isConnected: connectedClientIds.has(owner.clientId),
        };
      })
    );

    // Determine host (creator, or first connected player if creator left)
    const creatorPresent = presenceData.find((member) => member.data.isCreator);
    if (creatorPresent) {
      setIsHost(creatorPresent.data.clientId === localClientId);
    } else if (presenceData.length > 0) {
      // Sort by timestamp, first one is host
      const sorted = [...presenceData].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setIsHost(sorted[0]?.data.clientId === localClientId);
    }
  }, [presenceData, localClientId]);

  // Send a game action to all players
  const sendGameAction = useCallback(
    (action: GameAction) => {
      channel.publish('game-action', action);
    },
    [channel]
  );

  // Claim a player slot
  const claimSlot = useCallback(
    (slotIndex: number) => {
      // Check if slot is already taken
      if (slotOwners[slotIndex]) {
        return;
      }

      // Update local state immediately
      setLocalPlayerSlot(slotIndex);
      setSlotOwners((prev) => {
        const newOwners = [...prev];
        newOwners[slotIndex] = {
          clientId: localClientId,
          name: playerName,
          isConnected: true,
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

      // Broadcast to others
      sendGameAction({
        type: 'CLAIM_SLOT',
        slotIndex,
        clientId: localClientId,
        name: playerName,
        senderId: localClientId,
      });
    },
    [slotOwners, localClientId, playerName, isCreator, updateStatus, sendGameAction]
  );

  // Leave current slot (become spectator)
  const leaveSlot = useCallback(() => {
    if (localPlayerSlot === null) return;

    setSlotOwners((prev) => {
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
    sendGameAction,
    claimSlot,
    leaveSlot,
  };
}
