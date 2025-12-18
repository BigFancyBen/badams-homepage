"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LobbyState, PlayerState } from "../types";

interface UseLobbyOptions {
  // Poll interval in ms. Set to 0 to disable polling (write-only mode)
  pollInterval?: number;
}

interface UseLobbyReturn {
  lobby: LobbyState | null;
  isLoading: boolean;
  error: string | null;
  // Actions
  updatePlayer: (slot: number, updates: PlayerUpdate) => Promise<void>;
  resetGame: () => Promise<void>;
  setQrOverlay: (visible: boolean) => Promise<void>;
  refetch: () => Promise<void>;
}

interface PlayerUpdate {
  lifeDelta?: number;
  life?: number;
  commanderDamageUpdate?: { sourceIndex: number; delta: number };
  poisonDelta?: number;
  poison?: number;
  name?: string;
  toggleDead?: boolean;
  isDead?: boolean;
  historyEntry?: { action: string };
}

export function useLobby(
  lobbyCode: string,
  options: UseLobbyOptions = {}
): UseLobbyReturn {
  const { pollInterval = 1000 } = options;
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLobby = useCallback(async () => {
    try {
      const response = await fetch(`/api/commander/lobby/${lobbyCode}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Lobby not found");
          return;
        }
        throw new Error("Failed to fetch lobby");
      }
      const data: LobbyState = await response.json();
      setLobby(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching lobby:", err);
      setError("Failed to connect to lobby");
    } finally {
      setIsLoading(false);
    }
  }, [lobbyCode]);

  // Initial fetch
  useEffect(() => {
    fetchLobby();
  }, [fetchLobby]);

  // Polling (only if pollInterval > 0)
  useEffect(() => {
    if (pollInterval <= 0) return;

    pollRef.current = setInterval(fetchLobby, pollInterval);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchLobby, pollInterval]);

  const updatePlayer = useCallback(
    async (slot: number, updates: PlayerUpdate) => {
      try {
        const response = await fetch(
          `/api/commander/lobby/${lobbyCode}/player/${slot}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update player");
        }

        // Optimistic update for non-polling mode
        if (pollInterval <= 0) {
          const { player, version } = await response.json();
          setLobby((prev) => {
            if (!prev) return prev;
            const newPlayers = [...prev.players];
            newPlayers[slot] = player;
            return { ...prev, players: newPlayers, version };
          });
        }
      } catch (err) {
        console.error("Error updating player:", err);
        throw err;
      }
    },
    [lobbyCode, pollInterval]
  );

  const resetGame = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/commander/lobby/${lobbyCode}/reset`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to reset game");
      }

      const data: LobbyState = await response.json();
      setLobby(data);
    } catch (err) {
      console.error("Error resetting game:", err);
      throw err;
    }
  }, [lobbyCode]);

  const setQrOverlay = useCallback(
    async (visible: boolean) => {
      try {
        const response = await fetch(`/api/commander/lobby/${lobbyCode}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showQrOverlay: visible }),
        });

        if (!response.ok) {
          throw new Error("Failed to update QR overlay");
        }

        const data: LobbyState = await response.json();
        setLobby(data);
      } catch (err) {
        console.error("Error updating QR overlay:", err);
        throw err;
      }
    },
    [lobbyCode]
  );

  return {
    lobby,
    isLoading,
    error,
    updatePlayer,
    resetGame,
    setQrOverlay,
    refetch: fetchLobby,
  };
}

// Simplified hook for controller (write-only, no polling)
export function useLobbyController(lobbyCode: string, slot: number) {
  const { lobby, isLoading, error, updatePlayer, refetch } = useLobby(
    lobbyCode,
    { pollInterval: 0 }
  );

  const player = lobby?.players[slot] ?? null;

  const updateLife = useCallback(
    async (delta: number) => {
      const changeText = delta > 0 ? `+${delta}` : `${delta}`;
      const actionType = delta > 0 ? "positive" : "negative";
      await updatePlayer(slot, {
        lifeDelta: delta,
        historyEntry: { action: `${changeText} life|${actionType}` },
      });
    },
    [updatePlayer, slot]
  );

  const updateCommanderDamage = useCallback(
    async (sourceIndex: number, delta: number) => {
      await updatePlayer(slot, {
        commanderDamageUpdate: { sourceIndex, delta },
        historyEntry: {
          action: `${delta > 0 ? "+" : ""}${delta} commander damage|commander`,
        },
      });
    },
    [updatePlayer, slot]
  );

  const updatePoison = useCallback(
    async (delta: number) => {
      const changeText = delta > 0 ? `+${delta}` : `${delta}`;
      await updatePlayer(slot, {
        poisonDelta: delta,
        historyEntry: { action: `${changeText} poison|poison` },
      });
    },
    [updatePlayer, slot]
  );

  const updateName = useCallback(
    async (name: string) => {
      await updatePlayer(slot, { name });
    },
    [updatePlayer, slot]
  );

  const toggleDead = useCallback(async () => {
    await updatePlayer(slot, { toggleDead: true });
  }, [updatePlayer, slot]);

  return {
    player,
    isLoading,
    error,
    updateLife,
    updateCommanderDamage,
    updatePoison,
    updateName,
    toggleDead,
    refetch,
  };
}
