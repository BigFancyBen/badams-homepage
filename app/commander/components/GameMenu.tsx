import { PlayerState } from "../types";
import { RoomCodeDisplay } from "./RoomCodeDisplay";

interface GameMenuProps {
  isOpen: boolean;
  showResetConfirm: boolean;
  players: PlayerState[];
  isMobileLandscape: boolean;
  isMobilePortrait: boolean;
  wakeLockSentinel: WakeLockSentinel | null;
  isWakeLockSupported: boolean;
  wakeLockError: string | null;
  onClose: () => void;
  onResetClick: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
  onResetNames: () => void;
  onUpdatePlayerName: (playerIndex: number, name: string) => void;
  onToggleWakeLock: () => void;
  multiplayerMode?: boolean;
  onLeaveGame?: () => void;
  isHost?: boolean;
  viewMode?: 'controller' | 'overview';
  onToggleViewMode?: () => void;
  roomCode?: string;
  connectedCount?: number;
  latencyMs?: number | null;
  localPlayerSlot?: number | null;
}

export function GameMenu({
  isOpen,
  showResetConfirm,
  players,
  isMobileLandscape,
  isMobilePortrait,
  wakeLockSentinel,
  isWakeLockSupported,
  wakeLockError,
  onClose,
  onResetClick,
  onResetConfirm,
  onResetCancel,
  onResetNames,
  onUpdatePlayerName,
  onToggleWakeLock,
  multiplayerMode = false,
  onLeaveGame,
  isHost = false,
  viewMode,
  onToggleViewMode,
  roomCode,
  connectedCount,
  latencyMs,
  localPlayerSlot,
}: GameMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div
        className={`bg-[#222222] border border-[#333333] w-full max-w-md mx-4 ${
          isMobileLandscape || isMobilePortrait ? "p-4" : "p-6"
        }`}
      >
        <h3 className="text-xl font-bold text-[#ffffff] mb-6 text-center tracking-wide">
          Game Settings
        </h3>

        {/* Room Code - Only in multiplayer */}
        {multiplayerMode && roomCode && (
          <div className="mb-6">
            <RoomCodeDisplay roomCode={roomCode} showQR={true} size="small" />
          </div>
        )}

        {/* Connection Quality - Only in multiplayer */}
        {multiplayerMode && connectedCount !== undefined && (
          <div className="mb-4 flex items-center justify-between text-xs">
            <span className="text-[#888888]">
              {connectedCount} player{connectedCount !== 1 ? 's' : ''} connected
            </span>
            {latencyMs !== null && latencyMs !== undefined && (
              <span className={`${latencyMs < 100 ? 'text-[#16a34a]' : latencyMs < 300 ? 'text-[#f59e0b]' : 'text-[#dc2626]'}`}>
                {latencyMs}ms latency
              </span>
            )}
          </div>
        )}

        {/* Player Names - In multiplayer controller mode, only show local player */}
        <div className="mb-4">
          <h4 className="text-sm font-bold text-[#a3a3a3] mb-3 tracking-wide">
            {multiplayerMode && viewMode === 'controller' ? 'YOUR NAME:' : 'PLAYER NAMES:'}
          </h4>
          <div className="space-y-2">
            {players.map((player, index) => {
              // In multiplayer controller mode, only show local player's name
              if (multiplayerMode && viewMode === 'controller' && index !== localPlayerSlot) {
                return null;
              }
              return (
                <div key={index} className="flex items-center gap-3">
                  {!(multiplayerMode && viewMode === 'controller') && (
                    <span className="text-xs text-[#888888] font-semibold w-16">
                      P{index + 1}:
                    </span>
                  )}
                  <input
                    type="text"
                    value={
                      player.name === `Player ${index + 1}` ? "" : player.name
                    }
                    onChange={(e) =>
                      onUpdatePlayerName(
                        index,
                        e.target.value || `Player ${index + 1}`
                      )
                    }
                    className="flex-1 bg-[#2a2a2a] text-[#e5e5e5] border border-[#404040] focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30 focus:outline-none transition-all duration-200 px-3 py-2 text-sm font-medium"
                    placeholder={`Player ${index + 1}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Wake Lock Section */}
        <div className="mb-4">
          <div className="flex gap-2">
            {!isWakeLockSupported ? (
              <div className="flex-1 bg-[#404040] text-[#888888] text-sm font-bold py-3 px-4 text-center">
                Wake Lock Not Supported
              </div>
            ) : wakeLockSentinel ? (
              <button
                onClick={onToggleWakeLock}
                className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Screen will stay on - click to disable"
              >
                ✓ Screen Locked On
              </button>
            ) : (
              <button
                onClick={onToggleWakeLock}
                className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Prevent screen from turning off during gameplay"
              >
                Keep Screen On
              </button>
            )}
          </div>
          {/* Status and Error Messages */}
          {wakeLockError && (
            <div className="text-xs text-[#dc2626] mt-2 text-center leading-relaxed">
              {wakeLockError}
            </div>
          )}
          {wakeLockSentinel && (
            <div className="text-xs text-[#16a34a] mt-2 text-center">
              Screen lock active - your screen will not turn off
            </div>
          )}
        </div>

        {/* View Mode Toggle - Only in multiplayer */}
        {multiplayerMode && viewMode && onToggleViewMode && (
          <div className="mb-4">
            <h4 className="text-sm font-bold text-[#a3a3a3] mb-3 tracking-wide">
              VIEW MODE:
            </h4>
            <div className="flex gap-2">
              <button
                onClick={onToggleViewMode}
                className={`flex-1 text-sm font-bold py-3 px-4 transition-all duration-200 ${
                  viewMode === 'controller'
                    ? 'bg-[#16a34a] text-white'
                    : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc]'
                }`}
              >
                My Controls
              </button>
              <button
                onClick={onToggleViewMode}
                className={`flex-1 text-sm font-bold py-3 px-4 transition-all duration-200 ${
                  viewMode === 'overview'
                    ? 'bg-[#16a34a] text-white'
                    : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc]'
                }`}
              >
                View All Players
              </button>
            </div>
          </div>
        )}

        {/* Reset Confirmation Text */}
        <div className="text-center mb-2">
          <p
            className={`text-sm text-[#f5f5f5] font-bold transition-opacity duration-200 ${
              showResetConfirm ? "opacity-100" : "opacity-0"
            }`}
          >
            Are you sure you want to reset the entire game?
          </p>
        </div>

        {/* Multiplayer Leave Button */}
        {multiplayerMode && onLeaveGame && (
          <div className="mb-4">
            <button
              onClick={onLeaveGame}
              className="w-full bg-[#7c2d12] hover:bg-[#9a3412] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
            >
              Leave Game
            </button>
            {isHost && (
              <p className="text-xs text-[#888888] mt-2 text-center">
                Another player will become host when you leave
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* Reset Names - only in single player or for host in multiplayer */}
          {(!multiplayerMode || isHost) && (
            <button
              onClick={onResetNames}
              className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] text-sm font-bold py-3 px-4 transition-all duration-200"
              title="Reset player names to defaults"
            >
              Reset Names
            </button>
          )}
          {!showResetConfirm ? (
            <button
              onClick={onResetClick}
              className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
            >
              Reset Game
            </button>
          ) : (
            <button
              onClick={onResetConfirm}
              className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
            >
              Yes, Reset
            </button>
          )}
          <button
            onClick={showResetConfirm ? onResetCancel : onClose}
            className="flex-1 bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] text-sm font-bold py-3 px-4 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

