import { useState, useEffect, useCallback } from "react";
import { PlayerState } from "../types";

interface GameMenuProps {
  isOpen: boolean;
  showResetConfirm: boolean;
  players: PlayerState[];
  isMobileLandscape: boolean;
  isMobilePortrait: boolean;
  onClose: () => void;
  onResetClick: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
  onResetNames: () => void;
  onUpdatePlayerName: (playerIndex: number, name: string) => void;
}

export function GameMenu({
  isOpen,
  showResetConfirm,
  players,
  isMobileLandscape,
  isMobilePortrait,
  onClose,
  onResetClick,
  onResetConfirm,
  onResetCancel,
  onResetNames,
  onUpdatePlayerName,
}: GameMenuProps) {
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinel | null>(null);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState<boolean>(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);

  // Check wake lock support on mount
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = 'wakeLock' in navigator && window.isSecureContext;
      setIsWakeLockSupported(isSupported);
      
      if (!isSupported) {
        if (!window.isSecureContext) {
          setWakeLockError('Requires HTTPS or localhost');
        } else if (!('wakeLock' in navigator)) {
          // Check for specific browser messages
          const userAgent = window.navigator.userAgent.toLowerCase();
          if (userAgent.includes('firefox')) {
            setWakeLockError('Not supported in Firefox');
          } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            setWakeLockError('Not supported in Safari');
          } else {
            setWakeLockError('Not supported in this browser');
          }
        }
      }
    };
    
    checkSupport();
  }, []);

  // Clean up wake lock when component unmounts or modal closes
  useEffect(() => {
    if (!isOpen && wakeLockSentinel) {
      wakeLockSentinel.release().catch(() => {});
      setWakeLockSentinel(null);
    }
  }, [isOpen, wakeLockSentinel]);

  // Clean up on unmount
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
        // Release current wake lock
        console.log('Releasing wake lock...');
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setWakeLockError(null);
        console.log('Wake lock released');
      } else {
        // Request new wake lock
        console.log('Requesting wake lock...');
        setWakeLockError(null);
        
        const sentinel = await navigator.wakeLock.request('screen');
        console.log('Wake lock acquired successfully');
        
        setWakeLockSentinel(sentinel);
        
        // Handle automatic release by system
        sentinel.addEventListener('release', () => {
          console.log('Wake lock released by system');
          setWakeLockSentinel(null);
        });
      }
    } catch (error) {
      console.error('Wake lock error:', error);
      setWakeLockSentinel(null);
      
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            setWakeLockError('Permission denied - tap to try again');
            break;
          case 'NotSupportedError':
            setWakeLockError('Not supported on this device');
            break;
          default:
            setWakeLockError(`Error: ${error.message}`);
        }
      } else {
        setWakeLockError('Failed to toggle wake lock');
      }
    }
  }, [isWakeLockSupported, wakeLockSentinel]);

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

        {/* Player Names */}
        <div className="mb-4">
          <h4 className="text-sm font-bold text-[#a3a3a3] mb-3 tracking-wide">
            PLAYER NAMES:
          </h4>
          <div className="space-y-2">
            {players.map((player, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-xs text-[#888888] font-semibold w-16">
                  P{index + 1}:
                </span>
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
            ))}
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
                onClick={toggleWakeLock}
                className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Screen will stay on - click to disable"
              >
                ✓ Screen Locked On
              </button>
            ) : (
              <button
                onClick={toggleWakeLock}
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onResetNames}
            className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] text-sm font-bold py-3 px-4 transition-all duration-200"
            title="Reset player names to defaults"
          >
            Reset Names
          </button>
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

