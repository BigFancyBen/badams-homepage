"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  RoomProvider,
  useStatus,
  createInitialStorage,
  createInitialPresence,
  LivePlayerState,
} from "../../liveblocks.config";
import { useLobby } from "../../hooks/useLobby";
import { LobbyHeader } from "../../components/LobbyHeader";
import { LobbyShareCard } from "../../components/LobbyShareCard";
import { PlayerCount } from "../../types";
import { generateAbbreviations } from "../../utils";

interface LobbyDisplayContentProps {
  lobbyCode: string;
}

function LobbyDisplayContent({ lobbyCode }: LobbyDisplayContentProps) {
  const router = useRouter();
  const status = useStatus();
  const {
    players,
    settings,
    showQrOverlay,
    connectedPlayers,
    occupiedSlots,
    setIsHost,
    toggleQrOverlay,
    setQrOverlay,
  } = useLobby();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Mark as host on mount
  useEffect(() => {
    setIsHost(true);
  }, [setIsHost]);

  // Auto-hide QR overlay when all slots are filled
  useEffect(() => {
    if (settings && occupiedSlots.length >= settings.playerCount) {
      setQrOverlay(false);
    }
  }, [occupiedSlots.length, settings, setQrOverlay]);

  // Generate abbreviations for player names
  const playerAbbrevs = players ? generateAbbreviations(players) : ["P1", "P2", "P3", "P4"];

  // Get grid layout based on player count
  const getGridClass = () => {
    const count = settings?.playerCount || 4;
    switch (count) {
      case 2:
        return "grid-cols-2 grid-rows-1";
      case 3:
        return "grid-cols-2 grid-rows-2";
      case 4:
      default:
        return "grid-cols-2 grid-rows-2";
    }
  };

  if (status === "connecting" || status === "reconnecting") {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#cccccc] text-lg mb-2">
            {status === "connecting" ? "Connecting to lobby..." : "Reconnecting..."}
          </div>
          <div className="text-[#888888] text-sm">Code: {lobbyCode}</div>
        </div>
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#dc2626] text-lg mb-4">Disconnected from lobby</div>
          <button
            onClick={() => router.push("/commander")}
            className="bg-[#404040] hover:bg-[#4a4a4a] text-white font-bold py-2 px-4"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] overflow-hidden relative select-none flex flex-col">
      {/* Header */}
      <LobbyHeader
        lobbyCode={lobbyCode}
        connectedCount={occupiedSlots.length}
        maxPlayers={settings?.playerCount || 4}
      />

      {/* Settings Button */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="absolute top-12 left-2 z-30 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-xs p-0"
        title="Game Settings"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 21h-4l-.551-2.48a6.991 6.991 0 0 1-1.819-1.05l-2.424.763-2-3.464 1.872-1.718a7.055 7.055 0 0 1 0-2.1L3.206 9.232l2-3.464 2.424.763A6.992 6.992 0 0 1 9.45 5.48L10 3h4l.551 2.48a6.992 6.992 0 0 1 1.819 1.05l2.424-.763 2 3.464-1.872 1.718a7.05 7.05 0 0 1 0 2.1l1.872 1.718-2 3.464-2.424-.763a6.99 6.99 0 0 1-1.819 1.052L14 21z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Player Quadrants Grid */}
      <div className={`grid ${getGridClass()} flex-1`}>
        {players?.slice(0, settings?.playerCount || 4).map((player, index) => (
          <DisplayQuadrant
            key={index}
            player={player}
            playerIndex={index}
            playerAbbrevs={playerAbbrevs}
            isConnected={occupiedSlots.some((s) => s.slot === index)}
          />
        ))}
      </div>

      {/* QR Code Overlay */}
      {showQrOverlay && (
        <div
          className="absolute inset-0 bg-black/70 flex items-center justify-center z-20"
          onClick={toggleQrOverlay}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <LobbyShareCard lobbyCode={lobbyCode} size="large" />
            <p className="text-center text-[#888888] text-sm mt-4">
              Tap anywhere to hide
            </p>
          </div>
        </div>
      )}

      {/* Settings Menu */}
      {isMenuOpen && (
        <HostSettingsMenu
          lobbyCode={lobbyCode}
          showQrOverlay={showQrOverlay || false}
          onToggleQrOverlay={toggleQrOverlay}
          onClose={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
}

// Display-only quadrant (no controls)
interface DisplayQuadrantProps {
  player: LivePlayerState;
  playerIndex: number;
  playerAbbrevs: string[];
  isConnected: boolean;
}

function DisplayQuadrant({
  player,
  playerIndex,
  playerAbbrevs,
  isConnected,
}: DisplayQuadrantProps) {
  const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);

  return (
    <div className="relative w-full h-full border border-[#333333] bg-[#222222] overflow-hidden">
      {/* Dead overlay */}
      {player.isDead && (
        <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none" />
      )}

      {/* Connection indicator */}
      <div
        className={`absolute top-2 right-2 w-3 h-3 ${
          isConnected ? "bg-[#22c55e]" : "bg-[#666666]"
        }`}
        title={isConnected ? "Connected" : "Waiting for player"}
      />

      <div
        className={`w-full h-full flex flex-col items-center justify-center p-4 ${
          player.isDead ? "opacity-50" : ""
        }`}
      >
        {/* Player Name */}
        <h2 className="text-2xl font-bold text-[#ffffff] tracking-wide mb-2 text-center">
          {player.name}
        </h2>

        {/* Life Total */}
        <div className="text-6xl font-bold text-[#f5f5f5] mb-4">
          {player.life}
        </div>

        {/* Commander Damage & Poison Row */}
        <div className="flex gap-4 text-sm">
          {commanderSources.map((sourceIndex, i) => (
            <div key={sourceIndex} className="text-center">
              <span className="text-[#3b82f6] font-bold">
                {playerAbbrevs[sourceIndex]}: {player.commanderDamage[i]}
              </span>
            </div>
          ))}
          <div className="text-center">
            <span className="text-[#a855f7] font-bold">
              Poison: {player.poison}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Host settings menu
interface HostSettingsMenuProps {
  lobbyCode: string;
  showQrOverlay: boolean;
  onToggleQrOverlay: () => void;
  onClose: () => void;
}

function HostSettingsMenu({
  lobbyCode,
  showQrOverlay,
  onToggleQrOverlay,
  onClose,
}: HostSettingsMenuProps) {
  const { resetGame } = useLobby();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    resetGame();
    setShowResetConfirm(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div className="bg-[#222222] border border-[#333333] w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-[#ffffff] mb-6 text-center tracking-wide">
          Game Settings
        </h3>

        {/* Show QR Toggle */}
        <div className="mb-4">
          <button
            onClick={onToggleQrOverlay}
            className={`w-full py-3 px-4 font-bold text-sm transition-all duration-200 ${
              showQrOverlay
                ? "bg-[#16a34a] text-white"
                : "bg-[#2a2a2a] text-[#cccccc] hover:bg-[#3a3a3a]"
            }`}
          >
            {showQrOverlay ? "Hide QR on Display" : "Show QR on Display"}
          </button>
          <p className="text-xs text-[#666666] mt-1 text-center">
            Auto-hides when all players join
          </p>
        </div>

        {/* Reset Game */}
        <div className="mb-4">
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
            >
              Reset Game
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[#f5f5f5] text-center font-bold">
                Reset all players to starting life?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-3 px-4"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] text-sm font-bold py-3 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* QR Code Share */}
        <div className="mb-4">
          <LobbyShareCard lobbyCode={lobbyCode} size="compact" showUrl={false} />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] text-sm font-bold py-3 px-4 transition-all duration-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Main page component with RoomProvider
export default function LobbyDisplayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const lobbyCode = resolvedParams.code.toUpperCase();
  const [isClient, setIsClient] = useState(false);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(4);

  useEffect(() => {
    setIsClient(true);
    // Check if we have a stored player count for this lobby
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`lobby-${lobbyCode}-playerCount`);
      if (stored) {
        setPlayerCount(parseInt(stored) as PlayerCount);
      }
    }
  }, [lobbyCode]);

  if (!isClient) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#cccccc] text-lg">Loading lobby...</div>
      </div>
    );
  }

  return (
    <RoomProvider
      id={`commander-${lobbyCode}`}
      initialPresence={createInitialPresence(true)}
      initialStorage={createInitialStorage(playerCount)}
    >
      <LobbyDisplayContent lobbyCode={lobbyCode} />
    </RoomProvider>
  );
}
