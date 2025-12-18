"use client";

import { useState, useCallback, useEffect } from 'react';
import { PlayerState } from '../types';
import { AblyProvider } from '../providers/AblyProvider';
import { MultiplayerLobby, generateRoomCode } from '../components/MultiplayerLobby';
import { MultiplayerGame } from '../components/MultiplayerGame';

type GamePhase = 'menu' | 'lobby' | 'game';

function generateClientId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function MultiplayerContent() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [clientId] = useState<string>(() => generateClientId());
  const [gameState, setGameState] = useState<{ players: PlayerState[]; localSlot: number } | null>(null);
  const [error, setError] = useState<string>('');

  // Load saved player name
  useEffect(() => {
    const saved = localStorage.getItem('commander-multiplayer-name');
    if (saved) {
      setPlayerName(saved);
    }
  }, []);

  // Save player name
  useEffect(() => {
    if (playerName) {
      localStorage.setItem('commander-multiplayer-name', playerName);
    }
  }, [playerName]);

  const handleCreateRoom = useCallback(() => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    const code = generateRoomCode();
    setRoomCode(code);
    setPhase('lobby');
  }, [playerName]);

  const handleJoinRoom = useCallback(() => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!joinCode.trim() || joinCode.trim().length !== 6) {
      setError('Please enter a valid 6-character room code');
      return;
    }
    setError('');
    setRoomCode(joinCode.toUpperCase());
    setPhase('lobby');
  }, [playerName, joinCode]);

  const handleGameStart = useCallback((players: PlayerState[], localSlot: number) => {
    setGameState({ players, localSlot });
    setPhase('game');
  }, []);

  const handleLeave = useCallback(() => {
    setPhase('menu');
    setRoomCode('');
    setJoinCode('');
    setGameState(null);
  }, []);

  // Render based on phase
  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl font-bold mb-2">Commander</h1>
        <h2 className="text-xl text-gray-400 mb-8">Multiplayer</h2>

        {/* Name Input */}
        <div className="w-full max-w-sm mb-6">
          <label className="block text-sm text-gray-400 mb-2">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            maxLength={20}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-500 text-sm mb-4">{error}</div>
        )}

        {/* Create Room */}
        <button
          onClick={handleCreateRoom}
          className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg mb-4 transition-colors"
        >
          Create Room
        </button>

        {/* Or Divider */}
        <div className="flex items-center w-full max-w-sm mb-4">
          <div className="flex-1 h-px bg-gray-600" />
          <span className="px-4 text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-600" />
        </div>

        {/* Join Room */}
        <div className="w-full max-w-sm">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter room code"
            className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 mb-2 focus:outline-none focus:border-green-500 text-center font-mono text-lg tracking-wider"
            maxLength={6}
          />
          <button
            onClick={handleJoinRoom}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Join Room
          </button>
        </div>

        {/* Back Link */}
        <a
          href="/commander"
          className="mt-8 text-gray-500 hover:text-gray-400 text-sm transition-colors"
        >
          ← Back to Single Player
        </a>
      </div>
    );
  }

  // For lobby and game phases, wrap with AblyProvider
  return (
    <AblyProvider clientId={clientId} channelName={`commander:${roomCode}`}>
      {phase === 'lobby' ? (
        <MultiplayerLobby
          roomCode={roomCode}
          localClientId={clientId}
          playerName={playerName}
          onGameStart={handleGameStart}
          onLeave={handleLeave}
        />
      ) : gameState ? (
        <MultiplayerGame
          roomCode={roomCode}
          localClientId={clientId}
          playerName={playerName}
          initialPlayers={gameState.players}
          localPlayerSlot={gameState.localSlot}
          onLeaveGame={handleLeave}
        />
      ) : null}
    </AblyProvider>
  );
}

export default function MultiplayerPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#cccccc] text-lg">Loading Multiplayer...</div>
      </div>
    );
  }

  return <MultiplayerContent />;
}
