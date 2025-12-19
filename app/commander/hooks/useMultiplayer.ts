"use client";

import { useCallback, useEffect, useState } from 'react';
import { useChannel, usePresence, usePresenceListener, useConnectionStateListener } from 'ably/react';
import { PlayerState, LobbyPlayer, GameAction } from '../types';

interface UseMultiplayerProps {
  roomCode: string;
  localClientId: string;
  playerName: string;
  isCreator: boolean;
  onGameAction: (action: GameAction) => void;
  onPlayersUpdate: (players: LobbyPlayer[]) => void;
  onGameStart: (initialState: PlayerState[]) => void;
}

interface UseMultiplayerReturn {
  isConnected: boolean;
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
  isCreator,
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
      isHost: isCreator,
      isReady: false,
      isCreator,
    }
  );

  // Listen for presence updates from all clients
  const { presenceData } = usePresenceListener<LobbyPlayer>(`commander:${roomCode}`);

  // Update lobby players when presence changes
  useEffect(() => {
    // Host is the player who created the room (isCreator = true)
    const creatorClientId = presenceData.find((member) => member.data.isCreator)?.data?.clientId;

    const updatedPlayers = presenceData.map((member) => ({
      ...member.data,
      isHost: member.data.clientId === creatorClientId,
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
          isCreator,
        });
      }
    },
    [lobbyPlayers, localClientId, playerName, isHost, isCreator, updateStatus]
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
      isCreator,
    });
  }, [localClientId, playerName, isHost, isCreator, updateStatus]);

  // Set ready status
  const setReady = useCallback(
    (ready: boolean) => {
      updateStatus({
        clientId: localClientId,
        name: playerName,
        playerSlot: localPlayerSlot,
        isHost,
        isReady: ready,
        isCreator,
      });
    },
    [localClientId, playerName, localPlayerSlot, isHost, isCreator, updateStatus]
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
    isHost,
    localPlayerSlot,
    sendGameAction,
    joinSlot,
    leaveSlot,
    setReady,
    startGame,
  };
}
