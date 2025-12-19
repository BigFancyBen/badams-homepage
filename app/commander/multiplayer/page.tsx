"use client";

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AblyProvider } from '../providers/AblyProvider';
import { MultiplayerGame } from '../components/MultiplayerGame';

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
  const [joinCode, setJoinCode] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

  // Initialize client ID and check for saved session
  useEffect(() => {
    // Load saved player name
    const savedName = localStorage.getItem('commander-multiplayer-name');
    if (savedName) {
      setPlayerName(savedName);
    }

    // Check for saved session
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr) {
      try {
        const session: SavedSession = JSON.parse(sessionStr);
        // Check if session is still valid (not expired)
        if (Date.now() - session.timestamp < SESSION_EXPIRY) {
          setSavedSession(session);
          setClientId(session.clientId);
        } else {
          localStorage.removeItem(SESSION_KEY);
          setClientId(generateClientId());
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setClientId(generateClientId());
      }
    } else {
      setClientId(generateClientId());
    }
  }, []);

  // Check for join code in URL
  useEffect(() => {
    const joinParam = searchParams.get('join');
    if (joinParam && joinParam.length === 6) {
      setJoinCode(joinParam.toUpperCase());
    }
  }, [searchParams]);

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
      <div className="min-h-screen bg-[#1a1a1a] text-[#f5f5f5] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-[#ffffff] tracking-wide mb-1">Commander</h1>
        <h2 className="text-lg text-[#888888] mb-8">Multiplayer</h2>

        {/* Rejoin Session Prompt */}
        {savedSession && (
          <div className="w-full max-w-sm mb-6 bg-[#222222] border border-[#444444] p-4">
            <div className="text-xs text-[#888888] mb-2 font-bold">PREVIOUS SESSION</div>
            <div className="text-sm text-[#ffffff] mb-2">
              Room: <span className="font-mono tracking-wider">{savedSession.roomCode}</span>
            </div>
            <div className="text-xs text-[#888888] mb-3">as {savedSession.playerName}</div>
            <div className="flex gap-2">
              <button
                onClick={handleRejoinSession}
                className="flex-1 bg-[#166534] hover:bg-[#16a34a] text-[#ffffff] font-bold py-2 px-4 text-sm transition-all"
              >
                Rejoin
              </button>
              <button
                onClick={handleDismissSession}
                className="flex-1 bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] font-bold py-2 px-4 text-sm transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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

  // Game phase - wrap with AblyProvider
  if (!clientId) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#888888] text-sm">Loading...</div>
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
