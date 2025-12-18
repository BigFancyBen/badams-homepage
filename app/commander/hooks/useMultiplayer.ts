"use client";

import { useCallback, useEffect, useState } from 'react';
import { useChannel, usePresence, usePresenceListener, useConnectionStateListener } from 'ably/react';
import { PlayerState, LobbyPlayer, GameAction } from '../types';

interface UseMultiplayerProps {
  roomCode: string;
  localClientId: string;
  playerName: string;
  onGameAction: (action: GameAction) => void;
  onPlayersUpdate: (players: LobbyPlayer[]) => void;
  onGameStart: (initialState: PlayerState[]) => void;
}

interface UseMultiplayerReturn {
  isConnected: boolean;
  lobbyPlayers: LobbyPlayer[];
  isHost: boolean;
  localPlayerSlot: number | null;
  sendGameAction: (action: GameAction) => void;
  joinSlot: (slot: number) => void;
  leaveSlot: () => void;
  setReady: (ready: boolean) => void;
  startGame: (initialState: PlayerState[]) => void;
}

export function useMultiplayer({
  roomCode,
  localClientId,
  playerName,
  onGameAction,
  onPlayersUpdate,
  onGameStart,
}: UseMultiplayerProps): UseMultiplayerReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [localPlayerSlot, setLocalPlayerSlot] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);

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
      onGameAction(message.data as GameAction);
    } else if (message.name === 'game-start') {
      onGameStart(message.data.players as PlayerState[]);
    }
  });

  // Track presence for lobby - use both hooks
  const { updateStatus } = usePresence<LobbyPlayer>(
    `commander:${roomCode}`,
    {
      clientId: localClientId,
      name: playerName,
      playerSlot: null,
      isHost: false,
      isReady: false,
    }
  );

  // Listen for presence updates from all clients
  const { presenceData } = usePresenceListener<LobbyPlayer>(`commander:${roomCode}`);

  // Update lobby players when presence changes
  useEffect(() => {
    const players = presenceData.map((member) => member.data);

    // Determine host (first player to join)
    const sortedPlayers = [...players].sort((a: LobbyPlayer, b: LobbyPlayer) => {
      // Host is determined by clientId order (first to connect)
      return a.clientId.localeCompare(b.clientId);
    });

    const hostClientId = sortedPlayers[0]?.clientId;
    const updatedPlayers = players.map((p: LobbyPlayer) => ({
      ...p,
      isHost: p.clientId === hostClientId,
    }));

    setLobbyPlayers(updatedPlayers);

    // Update local player state
    const localPlayer = updatedPlayers.find((p: LobbyPlayer) => p.clientId === localClientId);
    if (localPlayer) {
      setLocalPlayerSlot(localPlayer.playerSlot);
      setIsHost(localPlayer.isHost);
    }

    onPlayersUpdate(updatedPlayers);
  }, [presenceData, localClientId, onPlayersUpdate]);

  // Send a game action to all players
  const sendGameAction = useCallback(
    (action: GameAction) => {
      channel.publish('game-action', action);
    },
    [channel]
  );

  // Join a player slot
  const joinSlot = useCallback(
    (slot: number) => {
      // Check if slot is already taken
      const slotTaken = lobbyPlayers.some(
        (p) => p.playerSlot === slot && p.clientId !== localClientId
      );

      if (!slotTaken) {
        setLocalPlayerSlot(slot);
        updateStatus({
          clientId: localClientId,
          name: playerName,
          playerSlot: slot,
          isHost,
          isReady: false,
        });
      }
    },
    [lobbyPlayers, localClientId, playerName, isHost, updateStatus]
  );

  // Leave current slot
  const leaveSlot = useCallback(() => {
    setLocalPlayerSlot(null);
    updateStatus({
      clientId: localClientId,
      name: playerName,
      playerSlot: null,
      isHost,
      isReady: false,
    });
  }, [localClientId, playerName, isHost, updateStatus]);

  // Set ready status
  const setReady = useCallback(
    (ready: boolean) => {
      updateStatus({
        clientId: localClientId,
        name: playerName,
        playerSlot: localPlayerSlot,
        isHost,
        isReady: ready,
      });
    },
    [localClientId, playerName, localPlayerSlot, isHost, updateStatus]
  );

  // Start the game (host only)
  const startGame = useCallback(
    (initialState: PlayerState[]) => {
      if (isHost) {
        channel.publish('game-start', { players: initialState });
      }
    },
    [isHost, channel]
  );

  return {
    isConnected,
    lobbyPlayers,
    isHost,
    localPlayerSlot,
    sendGameAction,
    joinSlot,
    leaveSlot,
    setReady,
    startGame,
  };
}
