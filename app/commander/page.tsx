"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayerState, UndoOperation } from './types';
import { generateAbbreviations } from './utils';
import { useMobileDetection } from './hooks/useMobileDetection';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useHistoryManagement } from './hooks/useHistoryManagement';
import { PlayerQuadrant } from './components/PlayerQuadrant';
import { GameMenu } from './components/GameMenu';

function CommanderPageContent() {
  // Use custom hooks for mobile detection
  const { isMobileLandscape, isMobilePortrait, isLandscape, isClient } = useMobileDetection();
  
  // Use localStorage hook
  const { hasLoadedInitialState, saveSettings, saveGameState, loadInitialState, clearGameState } = useLocalStorage();
  
  // Use history management hook
  const { 
    collapseLifeActions,
    collapseLifeActionsWithFrom,
    collapseCommanderDamageActions,
    collapsePoisonActions,
  } = useHistoryManagement();

  // Global wake lock state
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinel | null>(null);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState<boolean>(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);

  const [players, setPlayers] = useState<PlayerState[]>([
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0, // Will be set properly on client-side
      name: "Player 1",
      history: [],
      poison: 0,
      isDead: false,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0, // Will be set properly on client-side
      name: "Player 2",
      history: [],
      poison: 0,
      isDead: false,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0, // Will be set properly on client-side
      name: "Player 3",
      history: [],
      poison: 0,
      isDead: false,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0, // Will be set properly on client-side
      name: "Player 4",
      history: [],
      poison: 0,
      isDead: false,
    },
  ]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [rotatingPlayer, setRotatingPlayer] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);

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
    
    if (isClient) {
      checkSupport();
    }
  }, [isClient]);

  // Clean up wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [wakeLockSentinel]);

  // Handle page visibility changes to maintain wake lock
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockSentinel && wakeLockSentinel.released) {
        // Try to re-acquire wake lock when page becomes visible again
        // This won't work without user interaction, but we'll show the appropriate state
        setWakeLockSentinel(null);
        setWakeLockError('Wake lock lost - tap to reactivate');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLockSentinel]);

  const toggleWakeLock = useCallback(async () => {
    if (!isWakeLockSupported) return;

    try {
      if (wakeLockSentinel) {
        // Release current wake lock
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setWakeLockError(null);
      } else {
        // Request new wake lock
        setWakeLockError(null);
        
        const sentinel = await navigator.wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
        
        // Handle automatic release by system
        sentinel.addEventListener('release', () => {
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

  // Handle orientation changes for mobile devices
  useEffect(() => {
    if (isClient && (isMobileLandscape || isMobilePortrait)) {
      // Update all players to face correctly for mobile
      setPlayers((prev) =>
        prev.map((player) => ({
          ...player,
          rotation: isLandscape ? 90 : 0,
        }))
      );
    }
  }, [isClient, isMobileLandscape, isMobilePortrait, isLandscape]);

  // Load saved settings, player names, and game state on component mount
  useEffect(() => {
    const { initialPlayers, savedPlayerNames } = loadInitialState();
    
    if (initialPlayers) {
      setPlayers(initialPlayers);
    } else if (savedPlayerNames) {
      setPlayers((prev) =>
        prev.map((player, index) => ({
          ...player,
          name: savedPlayerNames[index] || player.name,
        }))
      );
    }
  }, [loadInitialState]);

  // Update localStorage whenever players change
  useEffect(() => {
    if (hasLoadedInitialState) {
      saveSettings(players);
    }
  }, [players, saveSettings, hasLoadedInitialState]);

  // Auto-save game state whenever players state changes
  useEffect(() => {
    // Only save if we're on the client and have finished loading initial state
    if (typeof window !== "undefined" && hasLoadedInitialState) {
      saveGameState(players);
    }
  }, [players, saveGameState, hasLoadedInitialState]);

  // Generate unique abbreviations for player names
  const playerAbbrevs = generateAbbreviations(players);

  const addHistory = (playerIndex: number, action: string) => {
    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index === playerIndex) {
          let newHistory;
          
          if (action.includes('life|') && !action.includes('from ')) {
            // Direct life actions - use existing collapsing logic
            newHistory = collapseLifeActions(action, player.history);
          } else if (action.includes('life from ')) {
            // Life actions from a specific player - extract the player name
            const match = action.match(/life from (.+)\|/);
            const fromPlayer = match ? match[1] : '';
            newHistory = collapseLifeActionsWithFrom(action, player.history, fromPlayer);
          } else if (action.includes('commander damage from ') && action.includes('|commander')) {
            // Commander damage actions - use commander damage collapsing logic
            newHistory = collapseCommanderDamageActions(action, player.history);
          } else if (action.includes('poison|poison')) {
            // Poison actions - use poison collapsing logic
            newHistory = collapsePoisonActions(action, player.history);
          } else {
            // Other actions - no collapsing
            newHistory = [{ action, timestamp: Date.now() }, ...player.history];
          }
          
          return {
            ...player,
            history: newHistory,
          };
        }
        return player;
      })
    );
  };

  const updatePoison = (playerIndex: number, change: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex
          ? { ...player, poison: Math.max(0, player.poison + change) }
          : player
      )
    );

    const changeText = change > 0 ? `+${change}` : `${change}`;
    addHistory(playerIndex, `${changeText} poison|poison`);
  };

  const updateLife = (playerIndex: number, change: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex
          ? { ...player, life: Math.max(0, player.life + change) }
          : player
      )
    );

    const changeText = change > 0 ? `+${change}` : `${change}`;
    const actionType = change > 0 ? "positive" : "negative";
    addHistory(playerIndex, `${changeText} life|${actionType}`);
  };

  const updateCommanderDamage = (
    playerIndex: number,
    sourceIndex: number,
    change: number
  ) => {
    // Calculate the actual change that will be applied (considering clamping)
    const currentDamage = players[playerIndex].commanderDamage[sourceIndex];
    const newDamageValue = Math.max(0, Math.min(21, currentDamage + change));
    const actualChange = newDamageValue - currentDamage;

    // Only proceed if there was an actual change
    if (actualChange !== 0) {
      setPlayers((prev) =>
        prev.map((player, index) => {
          if (index === playerIndex) {
            const newDamage = [...player.commanderDamage];
            newDamage[sourceIndex] = newDamageValue;
            return {
              ...player,
              commanderDamage: newDamage as [number, number, number],
              // Update life directly without creating a life history entry
              life: Math.max(0, player.life - actualChange),
            };
          }
          return player;
        })
      );

      // Only add commander damage history entry (not a life entry)
      const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);
      const actualSourceIndex = commanderSources[sourceIndex];
      const changeText = actualChange > 0 ? `+${actualChange}` : `${actualChange}`;
      const sourceName =
        players[actualSourceIndex]?.name || `P${actualSourceIndex + 1}`;
      addHistory(playerIndex, `${changeText} commander damage from ${sourceName}|commander`);
    }
  };

  const updateRotation = (playerIndex: number) => {
    // Prevent rapid clicking
    if (rotatingPlayer === playerIndex) return;

    setRotatingPlayer(playerIndex);

    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index === playerIndex) {
          let newRotation: number;
          if (isMobileLandscape || isMobilePortrait) {
            if (isLandscape) {
              // Mobile landscape: flip between 90° and 270°
              newRotation = player.rotation === 90 ? 270 : 90;
            } else {
              // Mobile portrait: flip between 0° and 180°
              newRotation = player.rotation === 0 ? 180 : 0;
            }
          } else {
            // Desktop: full 4-way rotation
            newRotation = (player.rotation + 90) % 360;
          }

          return {
            ...player,
            rotation: newRotation as 0 | 90 | 180 | 270,
          };
        }
        return player;
      })
    );

    // Clear the rotating state after a short delay
    setTimeout(() => {
      setRotatingPlayer(null);
    }, 300);
  };

  const togglePlayerDead = (playerIndex: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex ? { ...player, isDead: !player.isDead } : player
      )
    );
  };

  const damageAllOthers = (playerIndex: number, damage: number) => {
    const changeText = damage > 0 ? `+${damage}` : `${damage}`;
    const actionType = damage > 0 ? "positive" : "negative";
    const sourceName = players[playerIndex]?.name || `P${playerIndex + 1}`;
    const timestamp = Date.now();
    
    // Store information for undo operation
    const affectedPlayers: Array<{ playerIndex: number; lifeChange: number }> = [];
    const historyEntries: Array<{ playerIndex: number; entry: { action: string; timestamp: number } }> = [];
    
    // Track which players will be affected and create history entries
    [0, 1, 2, 3].forEach((index) => {
      if (index !== playerIndex) {
        affectedPlayers.push({
          playerIndex: index,
          lifeChange: damage,
        });
        
        historyEntries.push({
          playerIndex: index,
          entry: {
            action: `${changeText} life from ${sourceName}|${actionType}`,
            timestamp,
          },
        });
      }
    });

    // Update player states using collapsing logic
    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index !== playerIndex) {
          // Apply damage
          const newLife = Math.max(0, player.life + damage);
          
          // Add the proper "from player" format that can still collapse
          const fromPlayerAction = `${changeText} life from ${sourceName}|${actionType}`;
          const collapsedHistory = collapseLifeActionsWithFrom(fromPlayerAction, player.history, sourceName);
          
          return {
            ...player,
            life: newLife,
            history: collapsedHistory,
          };
        }
        return player;
      })
    );

    // Add to undo stack
    const undoOperation: UndoOperation = {
      sourcePlayerIndex: playerIndex,
      affectedPlayers,
      historyEntries,
      timestamp,
    };
    
    setUndoStack((prev) => [undoOperation, ...prev]);
  };

  const undoDamageAllOthers = () => {
    if (undoStack.length === 0) return;
    
    const lastOperation = undoStack[0];
    const now = Date.now();
    const COLLAPSE_WINDOW_MS = 2000; // 2 seconds
    
    // Check if the undo is happening within the collapse window
    const isWithinCollapseWindow = now - lastOperation.timestamp <= COLLAPSE_WINDOW_MS;
    
    // Get the source player name for history formatting
    const sourcePlayerName = players[lastOperation.sourcePlayerIndex]?.name || `P${lastOperation.sourcePlayerIndex + 1}`;
    
    // Reverse the life changes and handle history
    setPlayers((prev) =>
      prev.map((player, index) => {
        const affectedPlayer = lastOperation.affectedPlayers.find(
          (ap) => ap.playerIndex === index
        );
        
        if (affectedPlayer) {
          // Reverse the life change
          const newLife = player.life - affectedPlayer.lifeChange;
          
          let newHistory;
          
          if (isWithinCollapseWindow) {
            // If undoing within the collapse window, create a reverse action for collapsing
            const reverseChange = -affectedPlayer.lifeChange;
            const changeText = reverseChange > 0 ? `+${reverseChange}` : `${reverseChange}`;
            const actionType = reverseChange > 0 ? "positive" : "negative";
            const reverseAction = `${changeText} life from ${sourcePlayerName}|${actionType}`;
            
            // Use collapsing logic with the reverse action for "from player" format
            newHistory = collapseLifeActionsWithFrom(reverseAction, player.history, sourcePlayerName);
          } else {
            // If undoing outside the collapse window, create a reverse action for proper collapsing
            const reverseChange = -affectedPlayer.lifeChange;
            const changeText = reverseChange > 0 ? `+${reverseChange}` : `${reverseChange}`;
            const actionType = reverseChange > 0 ? "positive" : "negative";
            const reverseAction = `${changeText} life from ${sourcePlayerName}|${actionType}`;
            
            // Use collapsing logic with the reverse action for "from player" format
            newHistory = collapseLifeActionsWithFrom(reverseAction, player.history, sourcePlayerName);
          }
          
          return {
            ...player,
            life: Math.max(0, newLife),
            history: newHistory,
          };
        }
        
        return player;
      })
    );
    
    // Remove the operation from undo stack
    setUndoStack((prev) => prev.slice(1));
  };

  const updatePlayerName = (playerIndex: number, name: string) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex ? { ...player, name } : player
      )
    );
  };

  const resetGame = () => {
    setPlayers((prev) =>
      prev.map((player) => ({
        life: 40,
        commanderDamage: [0, 0, 0] as [number, number, number],
        rotation: player.rotation, // Keep current rotation
        name: player.name, // Keep current name
        history: [], // Clear history
        poison: 0, // Reset poison
        isDead: false, // Reset dead status
      }))
    );
    setShowResetConfirm(false);
    setIsMenuOpen(false);
    setUndoStack([]); // Clear undo stack

    // Clear the saved game state but keep the settings
    clearGameState();

    // Reset will trigger auto-save of the new clean state
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  const resetPlayerNames = useCallback(() => {
    setPlayers((prev) =>
      prev.map((player, index) => ({
        ...player,
        name: `Player ${index + 1}`,
      }))
    );
  }, []);

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] overflow-hidden relative select-none">
      {/* Multiplayer Link - top right */}
      <a
        href="/commander/multiplayer"
        className="absolute top-1 right-2 z-30 text-white/50 hover:text-white/70 text-xs transition-colors"
        title="Play Online"
      >
        Multiplayer →
      </a>

      {/* Menu Button - centered on mobile, top-left on desktop */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className={`absolute z-30 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-xs p-0 ${
          isMobileLandscape || isMobilePortrait
            ? "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" // Center on mobile
            : "top-1 left-2" // Top-left on desktop
        }`}
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

      {/* Menu Modal */}
      <GameMenu
        isOpen={isMenuOpen}
        showResetConfirm={showResetConfirm}
        players={players}
        isMobileLandscape={isMobileLandscape}
        isMobilePortrait={isMobilePortrait}
        wakeLockSentinel={wakeLockSentinel}
        isWakeLockSupported={isWakeLockSupported}
        wakeLockError={wakeLockError}
        onClose={() => setIsMenuOpen(false)}
        onResetClick={handleResetClick}
        onResetConfirm={resetGame}
        onResetCancel={cancelReset}
        onResetNames={resetPlayerNames}
        onUpdatePlayerName={updatePlayerName}
        onToggleWakeLock={toggleWakeLock}
      />

      {/* 4 Player Quadrants - Perfect quarters of the screen */}
      <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
        <div className="w-full h-full">
          <PlayerQuadrant 
            player={players[0]} 
            playerIndex={0}
            playerAbbrevs={playerAbbrevs}
            isMobileLandscape={isMobileLandscape}
            isMobilePortrait={isMobilePortrait}
            rotatingPlayer={rotatingPlayer}
            undoStackLength={undoStack.length}
            onUpdateLife={updateLife}
            onUpdatePoison={updatePoison}
            onUpdateCommanderDamage={updateCommanderDamage}
            onUpdateRotation={updateRotation}
            onTogglePlayerDead={togglePlayerDead}
            onDamageAllOthers={damageAllOthers}
            onUndoDamageAllOthers={undoDamageAllOthers}
          />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant 
            player={players[1]} 
            playerIndex={1}
            playerAbbrevs={playerAbbrevs}
            isMobileLandscape={isMobileLandscape}
            isMobilePortrait={isMobilePortrait}
            rotatingPlayer={rotatingPlayer}
            undoStackLength={undoStack.length}
            onUpdateLife={updateLife}
            onUpdatePoison={updatePoison}
            onUpdateCommanderDamage={updateCommanderDamage}
            onUpdateRotation={updateRotation}
            onTogglePlayerDead={togglePlayerDead}
            onDamageAllOthers={damageAllOthers}
            onUndoDamageAllOthers={undoDamageAllOthers}
          />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant 
            player={players[3]} 
            playerIndex={3}
            playerAbbrevs={playerAbbrevs}
            isMobileLandscape={isMobileLandscape}
            isMobilePortrait={isMobilePortrait}
            rotatingPlayer={rotatingPlayer}
            undoStackLength={undoStack.length}
            onUpdateLife={updateLife}
            onUpdatePoison={updatePoison}
            onUpdateCommanderDamage={updateCommanderDamage}
            onUpdateRotation={updateRotation}
            onTogglePlayerDead={togglePlayerDead}
            onDamageAllOthers={damageAllOthers}
            onUndoDamageAllOthers={undoDamageAllOthers}
          />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant 
            player={players[2]} 
            playerIndex={2}
            playerAbbrevs={playerAbbrevs}
            isMobileLandscape={isMobileLandscape}
            isMobilePortrait={isMobilePortrait}
            rotatingPlayer={rotatingPlayer}
            undoStackLength={undoStack.length}
            onUpdateLife={updateLife}
            onUpdatePoison={updatePoison}
            onUpdateCommanderDamage={updateCommanderDamage}
            onUpdateRotation={updateRotation}
            onTogglePlayerDead={togglePlayerDead}
            onDamageAllOthers={damageAllOthers}
            onUndoDamageAllOthers={undoDamageAllOthers}
          />
        </div>
      </div>
    </div>
  );
}

// Default export with loading state for SSR compatibility
export default function CommanderPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show loading state during hydration
  if (!isClient) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#cccccc] text-lg">Loading Commander...</div>
      </div>
    );
  }

  return <CommanderPageContent />;
}
