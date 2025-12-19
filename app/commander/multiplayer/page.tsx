"use client";

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlayerState } from '../types';
import { AblyProvider } from '../providers/AblyProvider';
import { MultiplayerLobby, generateRoomCode } from '../components/MultiplayerLobby';
import { MultiplayerGame } from '../components/MultiplayerGame';

type GamePhase = 'menu' | 'lobby' | 'game';

function generateClientId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function MultiplayerContent() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [clientId] = useState<string>(() => generateClientId());
  const [gameState, setGameState] = useState<{ players: PlayerState[]; localSlot: number } | null>(null);
  const [error, setError] = useState<string>('');

  // Check for join code in URL
  useEffect(() => {
    const joinParam = searchParams.get('join');
    if (joinParam && joinParam.length === 6) {
      setJoinCode(joinParam.toUpperCase());
    }
  }, [searchParams]);

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
      <div className="min-h-screen bg-[#1a1a1a] text-[#f5f5f5] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-[#ffffff] tracking-wide mb-1">Commander</h1>
        <h2 className="text-lg text-[#888888] mb-8">Multiplayer</h2>

        {/* Name Input */}
        <div className="w-full max-w-sm mb-6">
          <label className="block text-xs text-[#888888] mb-2 font-bold">YOUR NAME</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-[#222222] text-[#ffffff] border border-[#333333] px-4 py-3 focus:outline-none focus:border-[#666666] placeholder-[#666666]"
            maxLength={20}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-[#dc2626] text-xs mb-4 font-bold">{error}</div>
        )}

        {/* Create Room */}
        <button
          onClick={handleCreateRoom}
          className="w-full max-w-sm bg-[#166534] hover:bg-[#16a34a] text-[#ffffff] font-bold py-3 px-6 mb-4 transition-all"
        >
          Create Room
        </button>

        {/* Or Divider */}
        <div className="flex items-center w-full max-w-sm mb-4">
          <div className="flex-1 h-px bg-[#333333]" />
          <span className="px-4 text-[#666666] text-xs">or</span>
          <div className="flex-1 h-px bg-[#333333]" />
        </div>

        {/* Join Room */}
        <div className="w-full max-w-sm">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ENTER ROOM CODE"
            className="w-full bg-[#222222] text-[#ffffff] border border-[#333333] px-4 py-3 mb-2 focus:outline-none focus:border-[#666666] text-center font-mono text-lg tracking-widest placeholder-[#666666]"
            maxLength={6}
          />
          <button
            onClick={handleJoinRoom}
            className="w-full bg-[#1e40af] hover:bg-[#2563eb] text-[#ffffff] font-bold py-3 px-6 transition-all"
          >
            Join Room
          </button>
        </div>

        {/* Back Link */}
        <a
          href="/commander"
          className="mt-8 text-[#666666] hover:text-[#888888] text-sm transition-colors"
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
        <div className="text-[#888888] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center"><div className="text-[#888888] text-sm">Loading...</div></div>}>
      <MultiplayerContent />
    </Suspense>
  );
}
