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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check wake lock support and security context on mount
  useEffect(() => {
    // Check if running in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      setWakeLockStatus('not-supported');
      setErrorMessage('Wake Lock requires a secure context (HTTPS)');
      return;
    }

    // Check browser support
    if (!('wakeLock' in navigator)) {
      setWakeLockStatus('not-supported');
      // Detect specific browsers for better error messages
      try {
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (userAgent.includes('firefox')) {
          setErrorMessage('Firefox does not support Screen Wake Lock API');
        } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
          setErrorMessage('Safari does not support Screen Wake Lock API');
        } else {
          setErrorMessage('Screen Wake Lock API not supported in this browser');
        }
      } catch {
        setErrorMessage('Screen Wake Lock API not supported');
      }
      return;
    }

    // Clear any previous errors if browser supports wake lock
    setErrorMessage(null);
  }, []);

  // Release wake lock when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {
          // Ignore errors on cleanup
        });
      }
    };
  }, [wakeLockSentinel]);

  // Release wake lock when modal closes
  useEffect(() => {
    if (!isOpen && wakeLockSentinel) {
      wakeLockSentinel.release().catch((error) => {
        console.warn('Failed to release wake lock on modal close:', error);
      });
      setWakeLockSentinel(null);
      setWakeLockStatus('released');
    }
  }, [isOpen, wakeLockSentinel]);

  const requestWakeLock = useCallback(async () => {
    // Reset error state
    setErrorMessage(null);

    // Check if wake lock is supported
    if (!('wakeLock' in navigator)) {
      setWakeLockStatus('not-supported');
      setErrorMessage('Screen Wake Lock API not supported');
      return;
    }

    // Check secure context
    if (!window.isSecureContext) {
      setWakeLockStatus('error');
      setErrorMessage('Wake Lock requires HTTPS or localhost');
      return;
    }

    try {
      // Release existing wake lock first
      if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
      }

      console.log('Requesting screen wake lock...');
      const sentinel = await navigator.wakeLock.request('screen');
      
      console.log('Wake lock requested successfully');
      setWakeLockSentinel(sentinel);
      setWakeLockStatus('active');

      // Listen for release events (when system releases the lock)
      sentinel.addEventListener('release', () => {
        console.log('Wake lock was released by the system');
        setWakeLockStatus('released');
        setWakeLockSentinel(null);
      });

    } catch (error) {
      console.error('Failed to request wake lock:', error);
      setWakeLockStatus('error');
      
      // Provide specific error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setErrorMessage('Wake lock permission denied. Try interacting with the page first.');
        } else if (error.name === 'NotSupportedError') {
          setErrorMessage('Wake lock not supported on this device');
        } else {
          setErrorMessage(`Wake lock failed: ${error.message}`);
        }
      } else {
        setErrorMessage('Wake lock request failed');
      }

      // Additional logging for debugging
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mobile') || userAgent.includes('android')) {
        console.warn('Wake lock failed on mobile device. Check browser settings, power saving mode, or battery level.');
      }
    }
  }, [wakeLockSentinel]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinel) {
      try {
        console.log('Releasing wake lock...');
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setWakeLockStatus('released');
        setErrorMessage(null);
        console.log('Wake lock released successfully');
      } catch (error) {
        console.error('Failed to release wake lock:', error);
        setWakeLockStatus('error');
        setErrorMessage('Failed to release wake lock');
      }
    }
  }, [wakeLockSentinel]);

  // Handle document visibility changes - inform user they need to reactivate
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && wakeLockStatus === 'active') {
        console.log('Page hidden - wake lock will be released by browser');
      } else if (document.visibilityState === 'visible' && wakeLockStatus === 'active' && !wakeLockSentinel) {
        console.log('Page visible again - wake lock needs to be re-requested with user interaction');
        setWakeLockStatus('released');
        setErrorMessage('Screen was hidden - click button again to reactivate wake lock');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wakeLockStatus, wakeLockSentinel]);

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
                ✓ Screen Locked On
              </button>
            ) : (
              <button
                onClick={requestWakeLock}
                className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Prevent screen from turning off during gameplay"
              >
                Keep Screen On
              </button>
            )}
          </div>
          {/* Status and Error Messages */}
          {errorMessage && (
            <div className="text-xs text-[#dc2626] mt-2 text-center leading-relaxed">
              {errorMessage}
            </div>
          )}
          {wakeLockStatus === 'active' && (
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

