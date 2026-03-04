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
  isConnected?: boolean;
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
  isConnected,
}: GameMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-[#1a0f1c]/60 flex items-center justify-center z-40 p-4">
      <div
        className={`bg-[#3a2942] border border-[#543f63] w-full max-w-md mx-4 ${
          isMobileLandscape || isMobilePortrait ? "p-4" : "p-6"
        }`}
      >
        <h3 className="text-xl font-bold text-[#fcf6b1] mb-6 text-center tracking-wide">
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
          <div className="mb-4 flex items-center justify-between text-xs" data-testid="connection-status">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${isConnected ? 'bg-[#a9e5bb]' : 'bg-[#e3170a]'}`} data-testid="connection-indicator" />
              <span className="text-[#8b7699]" data-testid="connected-count">
                {connectedCount} player{connectedCount !== 1 ? 's' : ''} connected
              </span>
            </div>
            {latencyMs !== null && latencyMs !== undefined && (
              <span className={`${latencyMs < 100 ? 'text-[#a9e5bb]' : latencyMs < 300 ? 'text-[#f7b32b]' : 'text-[#e3170a]'}`}>
                {latencyMs}ms latency
              </span>
            )}
          </div>
        )}

        {/* Player Names - In multiplayer controller mode, only show local player */}
        <div className="mb-4">
          <h4 className="text-sm font-bold text-[#9d88aa] mb-3 tracking-wide">
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
                    <span className="text-xs text-[#8b7699] font-semibold w-16">
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
                    className="flex-1 bg-[#473455] text-[#e8e0a0] border border-[#614a71] focus:border-[#a9e5bb] focus:ring-1 focus:ring-[#a9e5bb]/30 focus:outline-hidden transition-all duration-200 px-3 py-2 text-sm font-medium"
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
              <div className="flex-1 bg-[#614a71] text-[#8b7699] text-sm font-bold py-3 px-4 text-center">
                Wake Lock Not Supported
              </div>
            ) : wakeLockSentinel ? (
              <button
                onClick={onToggleWakeLock}
                className="flex-1 bg-[#1d6637] hover:bg-[#17522c] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Screen will stay on - click to disable"
              >
                ✓ Screen Locked On
              </button>
            ) : (
              <button
                onClick={onToggleWakeLock}
                className="flex-1 bg-[#473455] hover:bg-[#5e4a6e] text-[#d4ca88] text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Prevent screen from turning off during gameplay"
              >
                Keep Screen On
              </button>
            )}
          </div>
          {/* Status and Error Messages */}
          {wakeLockError && (
            <div className="text-xs text-[#e3170a] mt-2 text-center leading-relaxed">
              {wakeLockError}
            </div>
          )}
          {wakeLockSentinel && (
            <div className="text-xs text-[#a9e5bb] mt-2 text-center">
              Screen lock active - your screen will not turn off
            </div>
          )}
        </div>

        {/* View Mode Toggle - Only in multiplayer */}
        {multiplayerMode && viewMode && onToggleViewMode && (
          <div className="mb-4">
            <h4 className="text-sm font-bold text-[#9d88aa] mb-3 tracking-wide">
              VIEW MODE:
            </h4>
            <div className="flex gap-2">
              <button
                onClick={onToggleViewMode}
                className={`flex-1 text-sm font-bold py-3 px-4 transition-all duration-200 ${
                  viewMode === 'controller'
                    ? 'bg-[#1d6637] text-white'
                    : 'bg-[#473455] hover:bg-[#5e4a6e] text-[#d4ca88]'
                }`}
              >
                My Controls
              </button>
              <button
                onClick={onToggleViewMode}
                className={`flex-1 text-sm font-bold py-3 px-4 transition-all duration-200 ${
                  viewMode === 'overview'
                    ? 'bg-[#1d6637] text-white'
                    : 'bg-[#473455] hover:bg-[#5e4a6e] text-[#d4ca88]'
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
            className={`text-sm text-[#fcf6b1] font-bold transition-opacity duration-200 ${
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
              className="w-full bg-[#7a5a0a] hover:bg-[#a58018] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
            >
              Leave Game
            </button>
            {isHost && (
              <p className="text-xs text-[#8b7699] mt-2 text-center">
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
              className="flex-1 bg-[#473455] hover:bg-[#5e4a6e] text-[#d4ca88] text-sm font-bold py-3 px-4 transition-all duration-200"
              title="Reset player names to defaults"
            >
              Reset Names
            </button>
          )}
          {!showResetConfirm ? (
            <button
              onClick={onResetClick}
              className="flex-1 bg-[#9a0f08] hover:bg-[#c0140b] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
            >
              Reset Game
            </button>
          ) : (
            <button
              onClick={onResetConfirm}
              className="flex-1 bg-[#9a0f08] hover:bg-[#c0140b] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
            >
              Yes, Reset
            </button>
          )}
          <button
            onClick={showResetConfirm ? onResetCancel : onClose}
            className="flex-1 bg-[#614a71] hover:bg-[#6e5580] text-[#e8e0a0] text-sm font-bold py-3 px-4 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

