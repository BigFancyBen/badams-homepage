"use client";

import { useState, useCallback, useEffect, Suspense, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { AblyProvider } from '../providers/AblyProvider';
import { MultiplayerGame } from '../components/MultiplayerGame';

// Helper functions for useSyncExternalStore (SSR-safe isClient detection)
function subscribeNoop(_callback: () => void) {
  return () => {};
}
function getSnapshotClient() {
  return true;
}
function getSnapshotServer() {
  return false;
}

type GamePhase = 'menu' | 'game';

interface SavedSession {
  roomCode: string;
  clientId: string;
  playerName: string;
  isCreator: boolean;
  timestamp: number;
}

const SESSION_KEY = 'commander-multiplayer-session';
const SESSION_EXPIRY = 1000 * 60 * 60 * 2; // 2 hours

function generateClientId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function MultiplayerContent() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [roomCode, setRoomCode] = useState<string>('');

  // Initialize joinCode from URL params using lazy initialization
  const [joinCode, setJoinCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const joinParam = urlParams.get('join');
      if (joinParam && joinParam.length === 6) {
        return joinParam.toUpperCase();
      }
    }
    return '';
  });

  // Initialize playerName from localStorage using lazy initialization
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('commander-multiplayer-name') || '';
    }
    return '';
  });

  // Initialize clientId from localStorage using lazy initialization
  const [clientId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (sessionStr) {
        try {
          const session: SavedSession = JSON.parse(sessionStr);
          if (Date.now() - session.timestamp < SESSION_EXPIRY) {
            return session.clientId;
          }
          localStorage.removeItem(SESSION_KEY);
        } catch {
          localStorage.removeItem(SESSION_KEY);
        }
      }
      return generateClientId();
    }
    return '';
  });

  const [error, setError] = useState<string>('');
  const [isCreator, setIsCreator] = useState<boolean>(false);

  // Initialize savedSession from localStorage using lazy initialization
  const [savedSession, setSavedSession] = useState<SavedSession | null>(() => {
    if (typeof window !== 'undefined') {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (sessionStr) {
        try {
          const session: SavedSession = JSON.parse(sessionStr);
          if (Date.now() - session.timestamp < SESSION_EXPIRY) {
            return session;
          }
        } catch {
          // Invalid session
        }
      }
    }
    return null;
  });

  // Update joinCode when URL params change (for deep links)
  useEffect(() => {
    const joinParam = searchParams.get('join');
    if (joinParam && joinParam.length === 6 && joinParam.toUpperCase() !== joinCode) {
      // Defer to avoid synchronous setState in effect
      setTimeout(() => setJoinCode(joinParam.toUpperCase()), 0);
    }
  }, [searchParams, joinCode]);

  // Save player name
  useEffect(() => {
    if (playerName) {
      localStorage.setItem('commander-multiplayer-name', playerName);
    }
  }, [playerName]);

  // Save session when joining a room
  const saveSession = useCallback((code: string, creator: boolean) => {
    const session: SavedSession = {
      roomCode: code,
      clientId,
      playerName,
      isCreator: creator,
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [clientId, playerName]);

  const handleCreateRoom = useCallback(() => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    const code = generateRoomCode();
    setRoomCode(code);
    setIsCreator(true);
    saveSession(code, true);
    setPhase('game');
  }, [playerName, saveSession]);

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
    const code = joinCode.toUpperCase();
    setRoomCode(code);
    setIsCreator(false);
    saveSession(code, false);
    setPhase('game');
  }, [playerName, joinCode, saveSession]);

  const handleRejoinSession = useCallback(() => {
    if (!savedSession) return;
    setRoomCode(savedSession.roomCode);
    setPlayerName(savedSession.playerName);
    setIsCreator(savedSession.isCreator);
    // Update timestamp on rejoin
    saveSession(savedSession.roomCode, savedSession.isCreator);
    setPhase('game');
  }, [savedSession, saveSession]);

  const handleDismissSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSavedSession(null);
  }, []);

  const handleLeave = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSavedSession(null);
    setPhase('menu');
    setRoomCode('');
    setJoinCode('');
    setIsCreator(false);
  }, []);

  // Render menu phase
  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-[#2d1e2f] text-[#fcf6b1] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-[#fcf6b1] tracking-wide mb-1">Commander</h1>
        <h2 className="text-lg text-[#8b7699] mb-8">Multiplayer</h2>

        {/* Rejoin Session Prompt */}
        {savedSession && (
          <div className="w-full max-w-sm mb-6 bg-[#3a2942] border border-[#614a71] p-4">
            <div className="text-xs text-[#8b7699] mb-2 font-bold">PREVIOUS SESSION</div>
            <div className="text-sm text-[#fcf6b1] mb-2">
              Room: <span className="font-mono tracking-wider">{savedSession.roomCode}</span>
            </div>
            <div className="text-xs text-[#8b7699] mb-3">as {savedSession.playerName}</div>
            <div className="flex gap-2">
              <button
                onClick={handleRejoinSession}
                className="flex-1 bg-[#1d6637] hover:bg-[#27874a] text-[#fcf6b1] font-bold py-2 px-4 text-sm transition-all"
              >
                Rejoin
              </button>
              <button
                onClick={handleDismissSession}
                className="flex-1 bg-[#614a71] hover:bg-[#6e5580] text-[#e8e0a0] font-bold py-2 px-4 text-sm transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Name Input */}
        <div className="w-full max-w-sm mb-6">
          <label className="block text-xs text-[#8b7699] mb-2 font-bold">YOUR NAME</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-[#3a2942] text-[#fcf6b1] border border-[#543f63] px-4 py-3 focus:outline-hidden focus:border-[#7a6388] placeholder-[#7a6388]"
            maxLength={20}
            data-testid="player-name-input"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-[#e3170a] text-xs mb-4 font-bold" data-testid="error-message">{error}</div>
        )}

        {/* Create Room */}
        <button
          onClick={handleCreateRoom}
          className="w-full max-w-sm bg-[#1d6637] hover:bg-[#27874a] text-[#fcf6b1] font-bold py-3 px-6 mb-4 transition-all"
          data-testid="create-room-button"
        >
          Create Room
        </button>

        {/* Or Divider */}
        <div className="flex items-center w-full max-w-sm mb-4">
          <div className="flex-1 h-px bg-[#543f63]" />
          <span className="px-4 text-[#7a6388] text-xs">or</span>
          <div className="flex-1 h-px bg-[#543f63]" />
        </div>

        {/* Join Room */}
        <div className="w-full max-w-sm">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ENTER ROOM CODE"
            className="w-full bg-[#3a2942] text-[#fcf6b1] border border-[#543f63] px-4 py-3 mb-2 focus:outline-hidden focus:border-[#7a6388] text-center font-mono text-lg tracking-widest placeholder-[#7a6388]"
            maxLength={6}
            data-testid="room-code-input"
          />
          <button
            onClick={handleJoinRoom}
            className="w-full bg-[#a07b14] hover:bg-[#c99a1c] text-[#fcf6b1] font-bold py-3 px-6 transition-all"
            data-testid="join-room-button"
          >
            Join Room
          </button>
        </div>

        {/* Back Link */}
        <a
          href="/commander"
          className="mt-8 text-[#7a6388] hover:text-[#8b7699] text-sm transition-colors"
        >
          ← Back to Single Player
        </a>
      </div>
    );
  }

  // Game phase - wrap with AblyProvider
  if (!clientId) {
    return (
      <div className="w-screen h-screen bg-[#2d1e2f] flex items-center justify-center">
        <div className="text-[#8b7699] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <AblyProvider clientId={clientId} channelName={`commander:${roomCode}`}>
      <MultiplayerGame
        roomCode={roomCode}
        localClientId={clientId}
        playerName={playerName}
        isCreator={isCreator}
        onLeaveGame={handleLeave}
      />
    </AblyProvider>
  );
}

export default function MultiplayerPage() {
  // Use useSyncExternalStore for SSR-safe isClient detection
  const isClient = useSyncExternalStore(subscribeNoop, getSnapshotClient, getSnapshotServer);

  if (!isClient) {
    return (
      <div className="w-screen h-screen bg-[#2d1e2f] flex items-center justify-center">
        <div className="text-[#8b7699] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="w-screen h-screen bg-[#2d1e2f] flex items-center justify-center"><div className="text-[#8b7699] text-sm">Loading...</div></div>}>
      <MultiplayerContent />
    </Suspense>
  );
}
