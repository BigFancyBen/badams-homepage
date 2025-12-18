"use client";

import { useState, useCallback, useMemo } from 'react';
import { LobbyPlayer, PlayerState } from '../types';
import { useMultiplayer } from '../hooks/useMultiplayer';

interface MultiplayerLobbyProps {
  roomCode: string;
  localClientId: string;
  playerName: string;
  onGameStart: (players: PlayerState[], localSlot: number) => void;
  onLeave: () => void;
}

const PLAYER_COLORS = [
  'bg-red-600',
  'bg-blue-600',
  'bg-green-600',
  'bg-yellow-600',
];

const PLAYER_SLOT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function MultiplayerLobby({
  roomCode,
  localClientId,
  playerName,
  onGameStart,
  onLeave,
}: MultiplayerLobbyProps) {
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);

  const handlePlayersUpdate = useCallback((players: LobbyPlayer[]) => {
    setLobbyPlayers(players);
  }, []);

  const handleGameAction = useCallback(() => {
    // Not needed in lobby
  }, []);

  const handleGameStartReceived = useCallback(
    (players: PlayerState[]) => {
      const localPlayer = lobbyPlayers.find((p) => p.clientId === localClientId);
      if (localPlayer && localPlayer.playerSlot !== null) {
        onGameStart(players, localPlayer.playerSlot);
      }
    },
    [lobbyPlayers, localClientId, onGameStart]
  );

  const {
    isConnected,
    isHost,
    localPlayerSlot,
    joinSlot,
    leaveSlot,
    setReady,
    startGame,
  } = useMultiplayer({
    roomCode,
    localClientId,
    playerName,
    onGameAction: handleGameAction,
    onPlayersUpdate: handlePlayersUpdate,
    onGameStart: handleGameStartReceived,
  });

  const localPlayer = useMemo(
    () => lobbyPlayers.find((p) => p.clientId === localClientId),
    [lobbyPlayers, localClientId]
  );

  const canStartGame = useMemo(() => {
    // At least 2 players in slots and all are ready
    const playersInSlots = lobbyPlayers.filter((p) => p.playerSlot !== null);
    return (
      playersInSlots.length >= 2 &&
      playersInSlots.every((p) => p.isReady) &&
      isHost
    );
  }, [lobbyPlayers, isHost]);

  const handleStartGame = useCallback(() => {
    if (!canStartGame) return;

    // Create initial game state with players in their slots
    const initialPlayers: PlayerState[] = [0, 1, 2, 3].map((slotIndex) => {
      const player = lobbyPlayers.find((p) => p.playerSlot === slotIndex);
      return {
        life: 40,
        commanderDamage: [0, 0, 0] as [number, number, number],
        rotation: 0 as const,
        name: player?.name || PLAYER_SLOT_NAMES[slotIndex],
        history: [],
        poison: 0,
        isDead: false,
      };
    });

    startGame(initialPlayers);
  }, [canStartGame, lobbyPlayers, startGame]);

  const getSlotPlayer = (slotIndex: number) => {
    return lobbyPlayers.find((p) => p.playerSlot === slotIndex);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-4 flex flex-col items-center justify-center">
      {/* Connection Status */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-400">
          {isConnected ? 'Connected' : 'Connecting...'}
        </span>
      </div>

      {/* Room Code */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Commander Lobby</h1>
        <div className="bg-gray-800 rounded-lg px-6 py-3 inline-block">
          <span className="text-gray-400 text-sm">Room Code:</span>
          <span className="text-3xl font-mono font-bold ml-2 tracking-wider">
            {roomCode}
          </span>
        </div>
        {isHost && (
          <div className="mt-2 text-yellow-500 text-sm">You are the host</div>
        )}
      </div>

      {/* Player Slots Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-md">
        {[0, 1, 2, 3].map((slotIndex) => {
          const slotPlayer = getSlotPlayer(slotIndex);
          const isLocalSlot = localPlayerSlot === slotIndex;
          const isEmpty = !slotPlayer;

          return (
            <div
              key={slotIndex}
              className={`relative rounded-lg p-4 transition-all ${
                isEmpty
                  ? 'bg-gray-800 border-2 border-dashed border-gray-600 hover:border-gray-400 cursor-pointer'
                  : `${PLAYER_COLORS[slotIndex]} ${isLocalSlot ? 'ring-2 ring-white' : ''}`
              }`}
              onClick={() => {
                if (isEmpty && localPlayerSlot === null) {
                  joinSlot(slotIndex);
                }
              }}
            >
              <div className="text-sm text-gray-300 mb-1">
                {PLAYER_SLOT_NAMES[slotIndex]}
              </div>

              {slotPlayer ? (
                <div className="flex flex-col">
                  <span className="font-bold truncate">{slotPlayer.name}</span>
                  <div className="flex items-center gap-2 mt-2">
                    {slotPlayer.isHost && (
                      <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">
                        Host
                      </span>
                    )}
                    {slotPlayer.isReady && (
                      <span className="text-xs bg-green-500 text-black px-2 py-0.5 rounded">
                        Ready
                      </span>
                    )}
                  </div>
                  {isLocalSlot && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        leaveSlot();
                      }}
                      className="mt-2 text-xs text-white/70 hover:text-white underline"
                    >
                      Leave Slot
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  {localPlayerSlot === null ? 'Click to join' : 'Empty'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spectators */}
      {lobbyPlayers.filter((p) => p.playerSlot === null).length > 0 && (
        <div className="mb-6 text-center">
          <div className="text-gray-400 text-sm mb-2">Spectators:</div>
          <div className="flex gap-2 flex-wrap justify-center">
            {lobbyPlayers
              .filter((p) => p.playerSlot === null)
              .map((p) => (
                <span
                  key={p.clientId}
                  className={`bg-gray-700 px-3 py-1 rounded text-sm ${
                    p.clientId === localClientId ? 'ring-1 ring-white' : ''
                  }`}
                >
                  {p.name}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onLeave}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Leave
        </button>

        {localPlayerSlot !== null && (
          <button
            onClick={() => setReady(!localPlayer?.isReady)}
            className={`px-6 py-2 rounded-lg transition-colors ${
              localPlayer?.isReady
                ? 'bg-yellow-600 hover:bg-yellow-500'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {localPlayer?.isReady ? 'Not Ready' : 'Ready'}
          </button>
        )}

        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={!canStartGame}
            className={`px-6 py-2 rounded-lg transition-colors ${
              canStartGame
                ? 'bg-blue-600 hover:bg-blue-500'
                : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            Start Game
          </button>
        )}
      </div>

      {/* Start Requirements */}
      {isHost && !canStartGame && (
        <div className="mt-4 text-gray-400 text-sm text-center">
          {lobbyPlayers.filter((p) => p.playerSlot !== null).length < 2
            ? 'Need at least 2 players to start'
            : 'Waiting for all players to be ready...'}
        </div>
      )}
    </div>
  );
}

export { generateRoomCode };
