"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useLobby } from "../../../hooks/useLobby";
import { LobbyHeader } from "../../../components/LobbyHeader";
import { LobbyShareCard } from "../../../components/LobbyShareCard";
import { PlayerState } from "../../../types";
import { generateAbbreviations } from "../../../utils";

// Controller page - player selects their slot, then controls their life totals
export default function ControllerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const lobbyCode = resolvedParams.code.toUpperCase();
  const router = useRouter();

  // Poll every 1 second so player can see the full view if they want
  const { lobby, isLoading, error, updatePlayer, refetch } = useLobby(
    lobbyCode,
    { pollInterval: 1000 }
  );

  // Which slot this controller is assigned to (stored in session)
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [viewMode, setViewMode] = useState<"controller" | "full">("controller");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] =
    useState<WakeLockSentinel | null>(null);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState(false);

  // Check for existing slot assignment on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`controller-${lobbyCode}-slot`);
      const storedName = sessionStorage.getItem(`controller-${lobbyCode}-name`);
      if (stored !== null) {
        setMySlot(parseInt(stored, 10));
      }
      if (storedName) {
        setPlayerName(storedName);
      }
    }
  }, [lobbyCode]);

  // Check wake lock support
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsWakeLockSupported("wakeLock" in navigator && window.isSecureContext);
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
  const handleSelectSlot = async (slot: number, name: string) => {
    setMySlot(slot);
    setPlayerName(name);
    // Store in session
    sessionStorage.setItem(`controller-${lobbyCode}-slot`, slot.toString());
    sessionStorage.setItem(`controller-${lobbyCode}-name`, name);
    // Update player name in the lobby
    await updatePlayer(slot, { name });
  };

  // Player actions
  const handleUpdateLife = async (delta: number) => {
    if (mySlot === null) return;
    const changeText = delta > 0 ? `+${delta}` : `${delta}`;
    const actionType = delta > 0 ? "positive" : "negative";
    await updatePlayer(mySlot, {
      lifeDelta: delta,
      historyEntry: { action: `${changeText} life|${actionType}` },
    });
  };

  const handleUpdateCommanderDamage = async (
    sourceIndex: number,
    delta: number
  ) => {
    if (mySlot === null) return;
    await updatePlayer(mySlot, {
      commanderDamageUpdate: { sourceIndex, delta },
      historyEntry: {
        action: `${delta > 0 ? "+" : ""}${delta} commander damage|commander`,
      },
    });
  };

  const handleUpdatePoison = async (delta: number) => {
    if (mySlot === null) return;
    const changeText = delta > 0 ? `+${delta}` : `${delta}`;
    await updatePlayer(mySlot, {
      poisonDelta: delta,
      historyEntry: { action: `${changeText} poison|poison` },
    });
  };

  const handleToggleDead = async () => {
    if (mySlot === null) return;
    await updatePlayer(mySlot, { toggleDead: true });
  };

  const handleUpdateName = async (name: string) => {
    if (mySlot === null) return;
    setPlayerName(name);
    sessionStorage.setItem(`controller-${lobbyCode}-name`, name);
    await updatePlayer(mySlot, { name });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#cccccc] text-lg mb-2">Joining lobby...</div>
          <div className="text-[#888888] text-sm">Code: {lobbyCode}</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !lobby) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#dc2626] text-lg mb-4">
            {error || "Lobby not found"}
          </div>
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

  // Slot selection (if not yet assigned)
  if (mySlot === null) {
    return (
      <SlotPicker
        lobby={lobby}
        lobbyCode={lobbyCode}
        onSelectSlot={handleSelectSlot}
      />
    );
  }

  const myPlayer = lobby.players[mySlot];
  const playerAbbrevs = generateAbbreviations(lobby.players);

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] overflow-hidden relative select-none flex flex-col">
      {/* Header */}
      <LobbyHeader
        lobbyCode={lobbyCode}
        connectedCount={lobby.settings.playerCount}
        maxPlayers={lobby.settings.playerCount}
      />

      {/* View Toggle & Settings */}
      <div className="absolute top-12 right-2 z-30 flex gap-2">
        <button
          onClick={() =>
            setViewMode(viewMode === "controller" ? "full" : "controller")
          }
          className="text-white/70 hover:text-white/50 text-xs font-bold"
        >
          {viewMode === "controller" ? "Full View" : "Controller"}
        </button>
        <button
          onClick={() => setIsMenuOpen(true)}
          className="text-white/70 hover:text-white/50"
          title="Settings"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 21h-4l-.551-2.48a6.991 6.991 0 0 1-1.819-1.05l-2.424.763-2-3.464 1.872-1.718a7.055 7.055 0 0 1 0-2.1L3.206 9.232l2-3.464 2.424.763A6.992 6.992 0 0 1 9.45 5.48L10 3h4l.551 2.48a6.992 6.992 0 0 1 1.819 1.05l2.424-.763 2 3.464-1.872 1.718a7.05 7.05 0 0 1 0 2.1l1.872 1.718-2 3.464-2.424-.763a6.99 6.99 0 0 1-1.819 1.052L14 21z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      {viewMode === "controller" ? (
        <ControllerView
          player={myPlayer}
          slot={mySlot}
          onUpdateLife={handleUpdateLife}
          onUpdateCommanderDamage={handleUpdateCommanderDamage}
          onUpdatePoison={handleUpdatePoison}
          onToggleDead={handleToggleDead}
        />
      ) : (
        <FullGameView
          lobby={lobby}
          playerAbbrevs={playerAbbrevs}
          mySlot={mySlot}
        />
      )}

      {/* Settings Menu */}
      {isMenuOpen && (
        <ControllerSettingsMenu
          lobbyCode={lobbyCode}
          playerName={playerName}
          wakeLockSentinel={wakeLockSentinel}
          isWakeLockSupported={isWakeLockSupported}
          onUpdateName={handleUpdateName}
          onToggleWakeLock={toggleWakeLock}
          onClose={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
}

// Slot picker component
interface SlotPickerProps {
  lobby: NonNullable<ReturnType<typeof useLobby>["lobby"]>;
  lobbyCode: string;
  onSelectSlot: (slot: number, name: string) => void;
}

function SlotPicker({ lobby, lobbyCode, onSelectSlot }: SlotPickerProps) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [name, setName] = useState("");

  const handleJoin = () => {
    if (selectedSlot !== null && name.trim()) {
      onSelectSlot(selectedSlot, name.trim());
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LobbyHeader
          lobbyCode={lobbyCode}
          connectedCount={lobby.settings.playerCount}
          maxPlayers={lobby.settings.playerCount}
          className="mb-6"
        />

        <h2 className="text-xl font-bold text-[#ffffff] mb-4 text-center">
          Select Your Slot
        </h2>

        {/* Slot Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {lobby.players
            .slice(0, lobby.settings.playerCount)
            .map((player, index) => (
              <button
                key={index}
                onClick={() => setSelectedSlot(index)}
                className={`p-4 border-2 transition-all ${
                  selectedSlot === index
                    ? "border-[#22c55e] bg-[#22c55e]/10"
                    : "border-[#404040] bg-[#2a2a2a] hover:border-[#666666]"
                }`}
              >
                <div className="text-lg font-bold text-[#ffffff]">
                  {player.name}
                </div>
                <div className="text-sm text-[#888888]">
                  {player.life} life
                </div>
              </button>
            ))}
        </div>

        {/* Name Input */}
        {selectedSlot !== null && (
          <div className="mb-4">
            <label className="text-sm font-bold text-[#a3a3a3] mb-2 block">
              Your Name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lobby.players[selectedSlot].name}
              maxLength={20}
              className="w-full bg-[#2a2a2a] text-[#e5e5e5] border border-[#404040] focus:border-[#4ade80] focus:outline-none px-3 py-2 text-sm"
              autoFocus
            />
          </div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoin}
          disabled={selectedSlot === null || !name.trim()}
          className="w-full bg-[#166534] hover:bg-[#14532d] disabled:bg-[#404040] disabled:text-[#666666] text-white text-sm font-bold py-3 px-4"
        >
          Join as {selectedSlot !== null ? lobby.players[selectedSlot].name : "..."}
        </button>
      </div>
    </div>
  );
}

// Simple controller view (just buttons for one player)
interface ControllerViewProps {
  player: PlayerState;
  slot: number;
  onUpdateLife: (delta: number) => void;
  onUpdateCommanderDamage: (sourceIndex: number, delta: number) => void;
  onUpdatePoison: (delta: number) => void;
  onToggleDead: () => void;
}

function ControllerView({
  player,
  slot,
  onUpdateLife,
  onUpdateCommanderDamage,
  onUpdatePoison,
  onToggleDead,
}: ControllerViewProps) {
  return (
    <div className="flex-1 relative bg-[#222222] overflow-auto p-4">
      {/* Dead overlay */}
      {player.isDead && (
        <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none" />
      )}

      <div
        className={`w-full max-w-md mx-auto ${player.isDead ? "opacity-50" : ""}`}
      >
        {/* Player Name & Life */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-[#ffffff] tracking-wide">
            {player.name}
          </h2>
          <div className="text-6xl font-bold text-[#f5f5f5] my-4">
            {player.life}
          </div>
        </div>

        {/* Life Control Buttons */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <button
            onClick={() => onUpdateLife(-5)}
            className="bg-[#991b1b] hover:bg-[#b91c1c] active:bg-[#7f1d1d] text-white font-bold py-4 text-lg touch-manipulation"
          >
            -5
          </button>
          <button
            onClick={() => onUpdateLife(-1)}
            className="bg-[#b91c1c] hover:bg-[#dc2626] active:bg-[#991b1b] text-white font-bold py-4 text-lg touch-manipulation"
          >
            -1
          </button>
          <button
            onClick={() => onUpdateLife(1)}
            className="bg-[#166534] hover:bg-[#16a34a] active:bg-[#14532d] text-white font-bold py-4 text-lg touch-manipulation"
          >
            +1
          </button>
          <button
            onClick={() => onUpdateLife(5)}
            className="bg-[#14532d] hover:bg-[#166534] active:bg-[#052e16] text-white font-bold py-4 text-lg touch-manipulation"
          >
            +5
          </button>
        </div>

        {/* Commander Damage */}
        <div className="mb-4">
          <div className="text-sm font-bold text-[#a3a3a3] mb-2">
            Commander Damage Received
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[#2a2a2a] p-3 text-center">
                <div className="text-xs text-[#888888] mb-1">Source {i + 1}</div>
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
              <span className="text-sm font-bold text-[#a855f7]">Poison</span>
              <span className="text-2xl font-bold text-[#a855f7]">
                {player.poison}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onUpdatePoison(1)}
                className="flex-1 bg-[#064e3b] hover:bg-[#065f46] text-white text-sm font-bold py-2 touch-manipulation"
              >
                +1
              </button>
              <button
                onClick={() => onUpdatePoison(-1)}
                className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-2 touch-manipulation"
              >
                -1
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
      </div>
    </div>
  );
}

// Full game view (see all players)
interface FullGameViewProps {
  lobby: NonNullable<ReturnType<typeof useLobby>["lobby"]>;
  playerAbbrevs: string[];
  mySlot: number;
}

function FullGameView({ lobby, playerAbbrevs, mySlot }: FullGameViewProps) {
  const getGridClass = () => {
    switch (lobby.settings.playerCount) {
      case 2:
        return "grid-cols-2 grid-rows-1";
      case 3:
        return "grid-cols-2 grid-rows-2";
      default:
        return "grid-cols-2 grid-rows-2";
    }
  };

  return (
    <div className={`grid ${getGridClass()} flex-1`}>
      {lobby.players.slice(0, lobby.settings.playerCount).map((player, index) => {
        const commanderSources = [0, 1, 2, 3].filter((i) => i !== index);
        const isMe = index === mySlot;

        return (
          <div
            key={index}
            className={`relative w-full h-full border bg-[#222222] overflow-hidden ${
              isMe ? "border-[#22c55e] border-2" : "border-[#333333]"
            }`}
          >
            {player.isDead && (
              <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none" />
            )}

            <div
              className={`w-full h-full flex flex-col items-center justify-center p-2 ${
                player.isDead ? "opacity-50" : ""
              }`}
            >
              <h2 className="text-lg font-bold text-[#ffffff] mb-1">
                {player.name}
                {isMe && <span className="text-[#22c55e] ml-1">(You)</span>}
              </h2>
              <div className="text-4xl font-bold text-[#f5f5f5] mb-2">
                {player.life}
              </div>
              <div className="flex gap-2 text-xs">
                {commanderSources.map((sourceIndex, i) => (
                  <span key={sourceIndex} className="text-[#3b82f6] font-bold">
                    {playerAbbrevs[sourceIndex]}: {player.commanderDamage[i]}
                  </span>
                ))}
                <span className="text-[#a855f7] font-bold">
                  P: {player.poison}
                </span>
              </div>
            </div>
          </div>
        );
      })}
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
          Settings
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
              className="flex-1 bg-[#2a2a2a] text-[#e5e5e5] border border-[#404040] focus:border-[#4ade80] focus:outline-none px-3 py-2 text-sm"
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
              Screen Locked On
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
          className="w-full bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] text-sm font-bold py-3 px-4"
        >
          Close
        </button>
      </div>
    </div>
  );
}
