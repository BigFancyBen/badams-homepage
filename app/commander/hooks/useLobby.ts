"use client";

import { useCallback } from "react";
import {
  useStorage,
  useMutation,
  useMyPresence,
  useOthers,
  useSelf,
  useBroadcastEvent,
  useEventListener,
  LivePlayerState,
} from "../liveblocks.config";

export function useLobby() {
  // Get players as a regular array (useStorage returns immutable data)
  const players = useStorage((root) => {
    if (!root.players) return null;
    // useStorage already returns immutable plain objects
    return root.players as unknown as LivePlayerState[];
  });

  // Get settings
  const settings = useStorage((root) => {
    if (!root.settings) return null;
    return root.settings as { playerCount: 2 | 3 | 4; startingLife: number };
  });

  // Get showQrOverlay
  const showQrOverlay = useStorage((root) => root.showQrOverlay);

  const others = useOthers();
  const self = useSelf();
  const [myPresence, updateMyPresence] = useMyPresence();
  const broadcast = useBroadcastEvent();

  // Get connected players with their slots
  const connectedPlayers = others.map((other) => ({
    id: other.connectionId.toString(),
    name: other.presence.name,
    slot: other.presence.slot,
    isHost: other.presence.isHost,
    isConnected: true,
  }));

  // Add self to connected players if we have presence
  if (self && myPresence) {
    connectedPlayers.push({
      id: self.connectionId.toString(),
      name: myPresence.name,
      slot: myPresence.slot,
      isHost: myPresence.isHost,
      isConnected: true,
    });
  }

  // Get occupied slots
  const occupiedSlots = connectedPlayers
    .filter((p) => p.slot !== null)
    .map((p) => ({
      slot: p.slot as number,
      name: p.name,
      id: p.id,
    }));

  // Update player life
  const updateLife = useMutation(
    ({ storage }, slotIndex: number, delta: number) => {
      const playersLive = storage.get("players");
      const player = playersLive.get(slotIndex);
      if (player) {
        const currentLife = player.get("life");
        player.set("life", Math.max(0, currentLife + delta));
      }
    },
    []
  );

  // Update commander damage
  const updateCommanderDamage = useMutation(
    ({ storage }, slotIndex: number, sourceIndex: number, delta: number) => {
      const playersLive = storage.get("players");
      const player = playersLive.get(slotIndex);
      if (player) {
        const commanderDamage = player.get("commanderDamage");
        const currentDamage = commanderDamage[sourceIndex];
        const newDamage = Math.max(0, Math.min(21, currentDamage + delta));
        const actualDelta = newDamage - currentDamage;

        if (actualDelta !== 0) {
          const newCommanderDamage = [...commanderDamage] as [
            number,
            number,
            number
          ];
          newCommanderDamage[sourceIndex] = newDamage;
          player.set("commanderDamage", newCommanderDamage);

          const currentLife = player.get("life");
          player.set("life", Math.max(0, currentLife - actualDelta));
        }
      }
    },
    []
  );

  // Update poison
  const updatePoison = useMutation(
    ({ storage }, slotIndex: number, delta: number) => {
      const playersLive = storage.get("players");
      const player = playersLive.get(slotIndex);
      if (player) {
        const currentPoison = player.get("poison");
        player.set("poison", Math.max(0, currentPoison + delta));
      }
    },
    []
  );

  // Update player name
  const updatePlayerName = useMutation(
    ({ storage }, slotIndex: number, name: string) => {
      const playersLive = storage.get("players");
      const player = playersLive.get(slotIndex);
      if (player) {
        player.set("name", name);
      }
    },
    []
  );

  // Toggle player dead state
  const togglePlayerDead = useMutation(({ storage }, slotIndex: number) => {
    const playersLive = storage.get("players");
    const player = playersLive.get(slotIndex);
    if (player) {
      player.set("isDead", !player.get("isDead"));
    }
  }, []);

  // Add history entry
  const addHistory = useMutation(
    ({ storage }, slotIndex: number, action: string) => {
      const playersLive = storage.get("players");
      const player = playersLive.get(slotIndex);
      if (player) {
        const currentHistory = player.get("history");
        const newHistory = [
          { action, timestamp: Date.now() },
          ...currentHistory.slice(0, 49), // Keep last 50 entries
        ];
        player.set("history", newHistory);
      }
    },
    []
  );

  // Reset game
  const resetGame = useMutation(({ storage }) => {
    const playersLive = storage.get("players");
    const settingsLive = storage.get("settings");
    const startingLife = settingsLive?.get("startingLife") || 40;

    for (let i = 0; i < playersLive.length; i++) {
      const player = playersLive.get(i);
      if (player) {
        player.set("life", startingLife);
        player.set("commanderDamage", [0, 0, 0]);
        player.set("poison", 0);
        player.set("isDead", false);
        player.set("history", []);
      }
    }
  }, []);

  // Broadcast reset event (called after resetGame)
  const broadcastReset = useCallback(() => {
    broadcast({ type: "RESET_GAME" });
  }, [broadcast]);

  // Toggle QR overlay
  const toggleQrOverlay = useMutation(({ storage }) => {
    const current = storage.get("showQrOverlay");
    storage.set("showQrOverlay", !current);
  }, []);

  // Set QR overlay visibility
  const setQrOverlay = useMutation(({ storage }, visible: boolean) => {
    storage.set("showQrOverlay", visible);
  }, []);

  // Claim a slot
  const claimSlot = useCallback(
    (slotIndex: number, playerName: string) => {
      updateMyPresence({
        slot: slotIndex,
        name: playerName,
      });
    },
    [updateMyPresence]
  );

  // Leave slot
  const leaveSlot = useCallback(() => {
    updateMyPresence({
      slot: null,
    });
  }, [updateMyPresence]);

  // Set host status
  const setIsHost = useCallback(
    (isHost: boolean) => {
      updateMyPresence({ isHost });
    },
    [updateMyPresence]
  );

  // Listen for game events
  useEventListener(({ event }) => {
    if (event.type === "RESET_GAME") {
      // Handle reset event (could show notification, etc.)
      console.log("Game was reset");
    }
  });

  return {
    // State
    players,
    settings,
    showQrOverlay,
    connectedPlayers,
    occupiedSlots,
    myPresence,
    mySlot: myPresence?.slot ?? null,
    isHost: myPresence?.isHost ?? false,

    // Mutations
    updateLife,
    updateCommanderDamage,
    updatePoison,
    updatePlayerName,
    togglePlayerDead,
    addHistory,
    resetGame: useCallback(() => {
      resetGame();
      broadcastReset();
    }, [resetGame, broadcastReset]),
    toggleQrOverlay,
    setQrOverlay,

    // Presence
    claimSlot,
    leaveSlot,
    setIsHost,
    updateMyPresence,
  };
}
