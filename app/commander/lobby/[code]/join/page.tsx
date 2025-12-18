"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  RoomProvider,
  useStatus,
  createInitialStorage,
  createInitialPresence,
  LivePlayerState,
} from "../../../liveblocks.config";
import { useLobby } from "../../../hooks/useLobby";
import { LobbyHeader } from "../../../components/LobbyHeader";
import { LobbyShareCard } from "../../../components/LobbyShareCard";
import { SlotPicker } from "../../../components/SlotPicker";
import { generateAbbreviations } from "../../../utils";

interface JoinControllerContentProps {
  lobbyCode: string;
}

function JoinControllerContent({ lobbyCode }: JoinControllerContentProps) {
  const router = useRouter();
  const status = useStatus();
  const {
    players,
    settings,
    connectedPlayers,
    occupiedSlots,
    myPresence,
    mySlot,
    updateLife,
    updateCommanderDamage,
    updatePoison,
    updatePlayerName,
    togglePlayerDead,
    addHistory,
    claimSlot,
  } = useLobby();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinel | null>(null);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState(false);

  // Check wake lock support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSupported = "wakeLock" in navigator && window.isSecureContext;
      setIsWakeLockSupported(isSupported);
    }
  }, []);

  // Clean up wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [wakeLockSentinel]);

  const toggleWakeLock = useCallback(async () => {
    if (!isWakeLockSupported) return;

    try {
      if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
      } else {
        const sentinel = await navigator.wakeLock.request("screen");
        setWakeLockSentinel(sentinel);
        sentinel.addEventListener("release", () => setWakeLockSentinel(null));
      }
    } catch (error) {
      console.error("Wake lock error:", error);
    }
  }, [isWakeLockSupported, wakeLockSentinel]);

  // Handle slot selection
  const handleSelectSlot = (slotIndex: number, playerName: string) => {
    claimSlot(slotIndex, playerName);
    // Update the player name in storage too
    updatePlayerName(slotIndex, playerName);
  };

  // Generate slot info for SlotPicker
  const slotInfo = players?.map((player, index) => {
    const occupant = occupiedSlots.find((s) => s.slot === index);
    return {
      index,
      name: occupant?.name || player.name,
      isOccupied: !!occupant,
      isCurrentUser: occupant?.id === connectedPlayers.find((p) => p.slot === mySlot)?.id,
    };
  }) || [];

  // Generate abbreviations
  const playerAbbrevs = players ? generateAbbreviations(players) : ["P1", "P2", "P3", "P4"];

  if (status === "connecting" || status === "reconnecting") {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#cccccc] text-lg mb-2">
            {status === "connecting" ? "Joining lobby..." : "Reconnecting..."}
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

  // Show slot picker if not yet joined
  if (mySlot === null) {
    return (
      <div className="min-h-screen w-screen bg-[#1a1a1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <LobbyHeader
            lobbyCode={lobbyCode}
            connectedCount={occupiedSlots.length}
            maxPlayers={settings?.playerCount || 4}
            className="mb-4"
          />
          <SlotPicker
            slots={slotInfo}
            playerCount={settings?.playerCount || 4}
            onSelectSlot={handleSelectSlot}
          />
        </div>
      </div>
    );
  }

  // Show controller view
  const myPlayer = players?.[mySlot];
  if (!myPlayer) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#cccccc] text-lg">Loading player data...</div>
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
        className="absolute top-12 right-2 z-30 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-xs p-0"
        title="Settings"
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

      {/* Controller View */}
      <ControllerQuadrant
        player={myPlayer}
        playerIndex={mySlot}
        playerAbbrevs={playerAbbrevs}
        onUpdateLife={(delta) => {
          updateLife(mySlot, delta);
          const changeText = delta > 0 ? `+${delta}` : `${delta}`;
          const actionType = delta > 0 ? "positive" : "negative";
          addHistory(mySlot, `${changeText} life|${actionType}`);
        }}
        onUpdateCommanderDamage={(sourceIndex, delta) => {
          updateCommanderDamage(mySlot, sourceIndex, delta);
          const commanderSources = [0, 1, 2, 3].filter((i) => i !== mySlot);
          const actualSourceIndex = commanderSources[sourceIndex];
          const sourceName = players?.[actualSourceIndex]?.name || `P${actualSourceIndex + 1}`;
          const changeText = delta > 0 ? `+${delta}` : `${delta}`;
          addHistory(mySlot, `${changeText} commander damage from ${sourceName}|commander`);
        }}
        onUpdatePoison={(delta) => {
          updatePoison(mySlot, delta);
          const changeText = delta > 0 ? `+${delta}` : `${delta}`;
          addHistory(mySlot, `${changeText} poison|poison`);
        }}
        onToggleDead={() => togglePlayerDead(mySlot)}
      />

      {/* Settings Menu */}
      {isMenuOpen && (
        <ControllerSettingsMenu
          lobbyCode={lobbyCode}
          playerName={myPresence?.name || myPlayer.name}
          wakeLockSentinel={wakeLockSentinel}
          isWakeLockSupported={isWakeLockSupported}
          onUpdateName={(name) => {
            updatePlayerName(mySlot, name);
            claimSlot(mySlot, name);
          }}
          onToggleWakeLock={toggleWakeLock}
          onClose={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
}

// Controller quadrant with full controls
interface ControllerQuadrantProps {
  player: LivePlayerState;
  playerIndex: number;
  playerAbbrevs: string[];
  onUpdateLife: (delta: number) => void;
  onUpdateCommanderDamage: (sourceIndex: number, delta: number) => void;
  onUpdatePoison: (delta: number) => void;
  onToggleDead: () => void;
}

function ControllerQuadrant({
  player,
  playerIndex,
  playerAbbrevs,
  onUpdateLife,
  onUpdateCommanderDamage,
  onUpdatePoison,
  onToggleDead,
}: ControllerQuadrantProps) {
  const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);

  return (
    <div className="flex-1 relative bg-[#222222] overflow-auto p-4">
      {/* Dead overlay */}
      {player.isDead && (
        <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none" />
      )}

      <div className={`w-full max-w-md mx-auto ${player.isDead ? "opacity-50" : ""}`}>
        {/* Player Name */}
        <div className="text-center mb-2">
          <h2 className="text-xl font-bold text-[#ffffff] tracking-wide">
            {player.name}
          </h2>
        </div>

        {/* Life Counter */}
        <div className="text-center mb-4">
          <div className="text-5xl font-bold text-[#f5f5f5] mb-3">
            {player.life}
          </div>

          {/* Life Control Buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <button
              onClick={() => onUpdateLife(-5)}
              className="bg-[#991b1b] hover:bg-[#b91c1c] active:bg-[#7f1d1d] text-white font-bold py-4 text-sm touch-manipulation"
            >
              -5
            </button>
            <button
              onClick={() => onUpdateLife(-1)}
              className="bg-[#b91c1c] hover:bg-[#dc2626] active:bg-[#991b1b] text-white font-bold py-4 text-sm touch-manipulation"
            >
              -1
            </button>
            <button
              onClick={() => onUpdateLife(1)}
              className="bg-[#166534] hover:bg-[#16a34a] active:bg-[#14532d] text-white font-bold py-4 text-sm touch-manipulation"
            >
              +1
            </button>
            <button
              onClick={() => onUpdateLife(5)}
              className="bg-[#14532d] hover:bg-[#166534] active:bg-[#052e16] text-white font-bold py-4 text-sm touch-manipulation"
            >
              +5
            </button>
          </div>
        </div>

        {/* Commander Damage */}
        <div className="mb-4">
          <div className="text-sm font-bold text-[#a3a3a3] mb-2">
            Commander Damage
          </div>
          <div className="grid grid-cols-3 gap-2">
            {commanderSources.map((sourceIndex, i) => (
              <div key={sourceIndex} className="bg-[#2a2a2a] p-3 text-center">
                <div className="text-xs text-[#888888] mb-1">
                  {playerAbbrevs[sourceIndex]}
                </div>
                <div className="text-lg font-bold text-[#3b82f6] mb-2">
                  {player.commanderDamage[i]}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onUpdateCommanderDamage(i, 1)}
                    className="flex-1 bg-[#166534] hover:bg-[#16a34a] text-white text-xs font-bold py-2 touch-manipulation"
                  >
                    +
                  </button>
                  <button
                    onClick={() => onUpdateCommanderDamage(i, -1)}
                    className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-xs font-bold py-2 touch-manipulation"
                  >
                    -
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Poison Counter */}
        <div className="mb-4">
          <div className="bg-[#2a2a2a] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 600 1059.7"
                  className="w-4 h-4 text-[#a855f7]"
                  fill="currentColor"
                >
                  <path d="m598 529c0.6-57.8-17.7-116.1-53.7-161.4-17.4-19.1-31.7-40.9-50.1-59-40.6-40.3-101.4-43-150.3-68.3-2.9-25.5-12.2-51-6.5-76.7 1.7-8.6 4.3-17.2-0.3-25.4-12.8-29.5-1.8-61.6-4.1-92.4-1.7-16.1-0.6-35.8-16-45.7-3.6 33.5-15.9 64.7-25.9 96.4-4.6 24.8-4.6 50.6-15.3 73.9 6.8 23.7-6.6 43.6-21.1 61.1-32.1 16.4-70.2 20.3-98.2 44.4-19.9 16.9-41.4 31.7-63.7 45.5-16.7 20.9-35.2 41.1-42.7 67.5-29.9 36.1-33.4 84.5-50.3 126.7-0.3 62.7 12.4 130.2 52.4 180.5 28.7 23.7 48.7 55.5 77.3 79.1 27.5 16.4 56.8 29.9 85.2 44.6 18.5 4.3 37.6 6.4 56 11.5 14.9 76.9 25.1 155.6 55.1 228.5 9.9-29.9 8.7-62 17.3-92.3 12.1-44.7-12.7-91.2 1.3-135.2 21-18.7 55.9-6.6 79.2-22.6 44.3-27.3 91.1-53.8 123.2-95.6 11.9-24 37.1-41.9 37.1-70.7 0.2-38.7 22.8-75 14.2-114.2" />
                </svg>
                <span className="text-sm font-bold text-[#a855f7]">Poison</span>
              </div>
              <span className="text-2xl font-bold text-[#a855f7]">
                {player.poison}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onUpdatePoison(1)}
                className="flex-1 bg-[#064e3b] hover:bg-[#065f46] text-white text-sm font-bold py-2 touch-manipulation"
              >
                +
              </button>
              <button
                onClick={() => onUpdatePoison(-1)}
                className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-2 touch-manipulation"
              >
                -
              </button>
            </div>
          </div>
        </div>

        {/* Toggle Dead */}
        <button
          onClick={onToggleDead}
          className={`w-full py-3 font-bold text-sm transition-all duration-200 ${
            player.isDead
              ? "bg-[#166534] text-white"
              : "bg-[#991b1b] text-white"
          }`}
        >
          {player.isDead ? "Revive Player" : "Mark as Dead"}
        </button>

        {/* History */}
        <div className="mt-4 bg-[#2a2a2a] p-3 max-h-48 overflow-y-auto">
          <div className="text-xs text-[#a3a3a3] font-semibold mb-2 pb-1 border-b border-[#404040]">
            Recent Actions:
          </div>
          {player.history.length === 0 ? (
            <div className="text-xs text-[#888888] italic">No actions yet</div>
          ) : (
            <div className="space-y-1">
              {player.history.slice(0, 10).map((entry, index) => {
                const [text, type] = entry.action.split("|");
                let textColor = "text-[#a3a3a3]";
                if (type === "positive") textColor = "text-[#22c55e]";
                else if (type === "negative") textColor = "text-[#dc2626]";
                else if (type === "poison") textColor = "text-[#a855f7]";
                else if (type === "commander") textColor = "text-[#3b82f6]";

                return (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    className={`text-xs ${textColor} py-1 border-b border-[#404040]`}
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Controller settings menu
interface ControllerSettingsMenuProps {
  lobbyCode: string;
  playerName: string;
  wakeLockSentinel: WakeLockSentinel | null;
  isWakeLockSupported: boolean;
  onUpdateName: (name: string) => void;
  onToggleWakeLock: () => void;
  onClose: () => void;
}

function ControllerSettingsMenu({
  lobbyCode,
  playerName,
  wakeLockSentinel,
  isWakeLockSupported,
  onUpdateName,
  onToggleWakeLock,
  onClose,
}: ControllerSettingsMenuProps) {
  const [name, setName] = useState(playerName);

  const handleSaveName = () => {
    if (name.trim() && name.trim() !== playerName) {
      onUpdateName(name.trim());
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div className="bg-[#222222] border border-[#333333] w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-[#ffffff] mb-6 text-center tracking-wide">
          Your Settings
        </h3>

        {/* Name Input */}
        <div className="mb-4">
          <label className="text-sm font-bold text-[#a3a3a3] mb-2 block">
            Your Name:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="flex-1 bg-[#2a2a2a] text-[#e5e5e5] border border-[#404040] focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30 focus:outline-none transition-all duration-200 px-3 py-2 text-sm font-medium"
            />
            <button
              onClick={handleSaveName}
              disabled={!name.trim() || name.trim() === playerName}
              className="bg-[#166534] hover:bg-[#14532d] disabled:bg-[#404040] disabled:text-[#666666] text-white text-sm font-bold px-4 py-2"
            >
              Save
            </button>
          </div>
        </div>

        {/* Wake Lock */}
        <div className="mb-4">
          {!isWakeLockSupported ? (
            <div className="bg-[#404040] text-[#888888] text-sm font-bold py-3 px-4 text-center">
              Wake Lock Not Supported
            </div>
          ) : wakeLockSentinel ? (
            <button
              onClick={onToggleWakeLock}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold py-3 px-4"
            >
              ✓ Screen Locked On
            </button>
          ) : (
            <button
              onClick={onToggleWakeLock}
              className="w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] text-sm font-bold py-3 px-4"
            >
              Keep Screen On
            </button>
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
export default function JoinControllerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const lobbyCode = resolvedParams.code.toUpperCase();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#cccccc] text-lg">Joining lobby...</div>
      </div>
    );
  }

  return (
    <RoomProvider
      id={`commander-${lobbyCode}`}
      initialPresence={createInitialPresence()}
      initialStorage={createInitialStorage()}
    >
      <JoinControllerContent lobbyCode={lobbyCode} />
    </RoomProvider>
  );
}
