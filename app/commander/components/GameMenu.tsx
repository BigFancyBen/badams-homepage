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
  const [wakeLockStatus, setWakeLockStatus] = useState<'not-supported' | 'released' | 'active' | 'error'>('released');
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinel | null>(null);
  const [mobileBrowserWarning, setMobileBrowserWarning] = useState<string | null>(null);

  // Check wake lock support on mount
  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      setWakeLockStatus('not-supported');
      // Detect mobile browsers that don't support wake lock
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userAgent = (window as any).navigator?.userAgent?.toLowerCase() || '';
        if (userAgent.includes('mobile') || userAgent.includes('android')) {
          if (userAgent.includes('firefox')) {
            setMobileBrowserWarning('Firefox Mobile does not support screen wake lock');
          } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            setMobileBrowserWarning('Safari Mobile does not support screen wake lock');
          } else {
            setMobileBrowserWarning('Screen wake lock may not be available in this mobile browser');
          }
        }
      } catch {
        // Ignore errors in user agent detection
      }
    }
  }, []);

  // Release wake lock when component unmounts or modal closes
  useEffect(() => {
    if (!isOpen && wakeLockSentinel) {
      wakeLockSentinel.release();
      setWakeLockSentinel(null);
      setWakeLockStatus('released');
    }
  }, [isOpen, wakeLockSentinel]);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setWakeLockStatus('not-supported');
      return;
    }

    try {
      // Release existing wake lock if any
      if (wakeLockSentinel) {
        await wakeLockSentinel.release();
      }

      const sentinel = await navigator.wakeLock.request('screen');
      setWakeLockSentinel(sentinel);
      setWakeLockStatus('active');

      // Listen for release events
      sentinel.addEventListener('release', () => {
        setWakeLockStatus('released');
        setWakeLockSentinel(null);
      });
    } catch (error) {
      console.error('Failed to request wake lock:', error);
      setWakeLockStatus('error');
      
      // Provide specific feedback for mobile users
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userAgent = (window as any).navigator?.userAgent?.toLowerCase() || '';
        if (userAgent.includes('mobile') || userAgent.includes('android')) {
          console.warn('Wake lock failed on mobile device. This may be due to browser limitations, power saving settings, or permissions.');
        }
      } catch {
        // Ignore errors in user agent detection
      }
    }
  }, [wakeLockSentinel]);

  const releaseWakeLock = async () => {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setWakeLockStatus('released');
      } catch (error) {
        console.error('Failed to release wake lock:', error);
        setWakeLockStatus('error');
      }
    }
  };

  // Handle document visibility changes to maintain wake lock
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockStatus === 'active' && !wakeLockSentinel) {
        // Re-request wake lock when page becomes visible again
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wakeLockStatus, wakeLockSentinel, requestWakeLock]);

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
            {wakeLockStatus === 'not-supported' ? (
              <div className="flex-1 bg-[#404040] text-[#888888] text-sm font-bold py-3 px-4 text-center">
                Wake Lock Not Supported
              </div>
            ) : wakeLockStatus === 'active' ? (
              <button
                onClick={releaseWakeLock}
                className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Screen will stay on - click to disable"
              >
                ✓ Screen On
              </button>
            ) : (
              <button
                onClick={requestWakeLock}
                className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Keep screen on during gameplay"
              >
                Keep Screen On
              </button>
            )}
          </div>
          {/* Error Messages */}
          {wakeLockStatus === 'error' && (
            <div className="text-xs text-[#dc2626] mt-1 text-center">
              Failed to control screen wake lock
            </div>
          )}
          {mobileBrowserWarning && (
            <div className="text-xs text-[#fbbf24] mt-1 text-center">
              {mobileBrowserWarning}
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

