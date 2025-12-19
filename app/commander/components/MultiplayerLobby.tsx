"use client";

import { useState, useCallback, useMemo } from 'react';
import { LobbyPlayer, PlayerState } from '../types';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { RoomCodeDisplay } from './RoomCodeDisplay';

interface MultiplayerLobbyProps {
  roomCode: string;
  localClientId: string;
  playerName: string;
  onGameStart: (players: PlayerState[], localSlot: number | null) => void;
  onLeave: () => void;
}

// Colors matching the Commander quadrant player colors
const SLOT_COLORS = [
  { bg: 'bg-[#991b1b]', hover: 'hover:bg-[#b91c1c]' }, // Red - Player 1
  { bg: 'bg-[#1e40af]', hover: 'hover:bg-[#2563eb]' }, // Blue - Player 2
  { bg: 'bg-[#166534]', hover: 'hover:bg-[#16a34a]' }, // Green - Player 3
  { bg: 'bg-[#a16207]', hover: 'hover:bg-[#ca8a04]' }, // Yellow/Amber - Player 4
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
      if (localPlayer) {
        // Pass playerSlot (null for spectators) to game
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
    const playersInSlots = lobbyPlayers.filter((p) => p.playerSlot !== null);
    return (
      playersInSlots.length >= 2 &&
      playersInSlots.every((p) => p.isReady) &&
      isHost
    );
  }, [lobbyPlayers, isHost]);

  const handleStartGame = useCallback(() => {
    if (!canStartGame) return;

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
    <div className="min-h-screen bg-[#1a1a1a] text-[#f5f5f5] p-4 flex flex-col items-center justify-center">
      {/* Connection Status */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <div
          className={`w-2 h-2 ${isConnected ? 'bg-[#22c55e]' : 'bg-[#dc2626]'}`}
        />
        <span className="text-xs text-[#888888]">
          {isConnected ? 'Connected' : 'Connecting...'}
        </span>
      </div>

      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-[#ffffff] tracking-wide mb-4">Commander Lobby</h1>

        {/* Room Code Display with QR */}
        <RoomCodeDisplay roomCode={roomCode} showQR={true} size="large" />

        {isHost && (
          <div className="mt-2 text-[#c2410c] text-xs font-bold">HOST</div>
        )}
      </div>

      {/* Player Slots Grid */}
      <div className="grid grid-cols-2 gap-2 mb-6 w-full max-w-sm">
        {[0, 1, 2, 3].map((slotIndex) => {
          const slotPlayer = getSlotPlayer(slotIndex);
          const isLocalSlot = localPlayerSlot === slotIndex;
          const isEmpty = !slotPlayer;
          const colors = SLOT_COLORS[slotIndex];

          return (
            <div
              key={slotIndex}
              className={`relative p-3 transition-all cursor-pointer border ${
                isEmpty
                  ? 'bg-[#2a2a2a] border-dashed border-[#404040] hover:border-[#666666]'
                  : `${colors.bg} ${colors.hover} border-transparent ${isLocalSlot ? 'ring-2 ring-[#ffffff]' : ''}`
              }`}
              onClick={() => {
                if (isEmpty && localPlayerSlot === null) {
                  joinSlot(slotIndex);
                }
              }}
            >
              <div className="text-xs text-[#a3a3a3] mb-1 font-bold">
                {PLAYER_SLOT_NAMES[slotIndex]}
              </div>

              {slotPlayer ? (
                <div className="flex flex-col">
                  <span className="font-bold text-[#ffffff] truncate text-sm">{slotPlayer.name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    {slotPlayer.isHost && (
                      <span className="text-[10px] bg-[#c2410c] text-[#ffffff] px-1.5 py-0.5 font-bold">
                        HOST
                      </span>
                    )}
                    {slotPlayer.isReady && (
                      <span className="text-[10px] bg-[#166534] text-[#ffffff] px-1.5 py-0.5 font-bold">
                        READY
                      </span>
                    )}
                  </div>
                  {isLocalSlot && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        leaveSlot();
                      }}
                      className="mt-2 text-xs text-[#ffffff]/70 hover:text-[#ffffff] underline"
                    >
                      Leave Slot
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-[#666666] text-xs">
                  {localPlayerSlot === null ? 'Click to join' : 'Empty'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spectators */}
      {lobbyPlayers.filter((p) => p.playerSlot === null).length > 0 && (
        <div className="mb-4 text-center">
          <div className="text-[#888888] text-xs mb-2 font-bold">SPECTATORS</div>
          <div className="flex gap-1 flex-wrap justify-center">
            {lobbyPlayers
              .filter((p) => p.playerSlot === null)
              .map((p) => (
                <span
                  key={p.clientId}
                  className={`bg-[#2a2a2a] border border-[#404040] px-2 py-1 text-xs ${
                    p.clientId === localClientId ? 'ring-1 ring-[#ffffff]' : ''
                  }`}
                >
                  {p.name}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onLeave}
          className="px-4 py-2 bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] text-sm font-bold transition-all"
        >
          Leave
        </button>

        {localPlayerSlot !== null && (
          <button
            onClick={() => setReady(!localPlayer?.isReady)}
            className={`px-4 py-2 text-sm font-bold transition-all ${
              localPlayer?.isReady
                ? 'bg-[#c2410c] hover:bg-[#ea580c] text-[#ffffff]'
                : 'bg-[#166534] hover:bg-[#16a34a] text-[#ffffff]'
            }`}
          >
            {localPlayer?.isReady ? 'Not Ready' : 'Ready'}
          </button>
        )}

        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={!canStartGame}
            className={`px-4 py-2 text-sm font-bold transition-all ${
              canStartGame
                ? 'bg-[#166534] hover:bg-[#16a34a] text-[#ffffff]'
                : 'bg-[#374151] text-[#6b7280] cursor-not-allowed'
            }`}
          >
            Start Game
          </button>
        )}
      </div>

      {/* Start Requirements */}
      {isHost && !canStartGame && (
        <div className="mt-3 text-[#888888] text-xs text-center">
          {lobbyPlayers.filter((p) => p.playerSlot !== null).length < 2
            ? 'Need at least 2 players to start'
            : 'Waiting for all players to be ready...'}
        </div>
      )}
    </div>
  );
}

export { generateRoomCode };
