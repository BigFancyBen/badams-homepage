"use client";

import { useState, useEffect, useCallback } from "react";

// Custom hook for window dimensions with SSR safety
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Set initial size
    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return { ...windowSize, isClient };
}

// Mobile detection utilities
function useMobileDetection() {
  const { width, height, isClient } = useWindowSize();

  const isMobileLandscape = isClient && height < 500 && width > height;
  const isMobilePortrait = isClient && width < 768 && height > width;
  const isLandscape = isClient && width > height;

  return { isMobileLandscape, isMobilePortrait, isLandscape, isClient };
}

interface HistoryEntry {
  action: string;
  timestamp: number;
}

interface PlayerState {
  life: number;
  commanderDamage: [number, number, number]; // damage from 3 other players
  rotation: 0 | 90 | 180 | 270; // rotation in degrees
  name: string;
  history: HistoryEntry[];
  poison: number;
  isDead: boolean;
}

interface UndoOperation {
  sourcePlayerIndex: number;
  affectedPlayers: Array<{
    playerIndex: number;
    lifeChange: number;
  }>;
  historyEntries: Array<{
    playerIndex: number;
    entry: HistoryEntry;
  }>;
  timestamp: number;
}

function CommanderPageContent() {
  // Use custom hooks for mobile detection
  const { isMobileLandscape, isMobilePortrait, isLandscape, isClient } =
    useMobileDetection();

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

  const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false);

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
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("commander-settings");
      const savedGameState = localStorage.getItem("commander-game-state");

      // Load complete game state if it exists (this takes precedence for players)
      if (savedGameState) {
        try {
          const gameState = JSON.parse(savedGameState);
          if (
            gameState.players &&
            Array.isArray(gameState.players) &&
            gameState.players.length === 4
          ) {
            setPlayers(gameState.players);
            // Still need to load settings even if game state exists
            // Don't return early, continue to settings loading
          }
        } catch (error) {
          console.error("Failed to load game state:", error);
          // If there's an error loading the game state, remove it
          localStorage.removeItem("commander-game-state");
        }
      }

      // Load settings (player names and scoreboard setting)
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          // Only update player names if we didn't load them from game state
          if (settings.playerNames && !savedGameState) {
            setPlayers((prev) =>
              prev.map((player, index) => ({
                ...player,
                name: settings.playerNames[index] || player.name,
              }))
            );
          }

        } catch (error) {
          console.error("Failed to parse saved settings:", error);
        }
      }

      // Mark that we've finished loading initial state
      setHasLoadedInitialState(true);
    }
  }, []);

  // Save player names to localStorage
  const saveToLocalStorage = useCallback(() => {
    if (typeof window !== "undefined") {
      const playerNames = players.map((player) => player.name);
      const settings = {
        playerNames: playerNames,
      };
      localStorage.setItem("commander-settings", JSON.stringify(settings));
    }
  }, [players]);

  // Save complete game state to localStorage
  const saveGameStateToStorage = useCallback(() => {
    if (typeof window !== "undefined") {
      const gameState = {
        players: players,
        timestamp: Date.now(),
      };

      localStorage.setItem("commander-game-state", JSON.stringify(gameState));
    }
  }, [players]);

  // Update localStorage whenever players change
  useEffect(() => {
    if (hasLoadedInitialState) {
      saveToLocalStorage();
    }
  }, [saveToLocalStorage, hasLoadedInitialState]);

  // Auto-save game state whenever players state changes
  useEffect(() => {
    // Only save if we're on the client and have finished loading initial state
    if (typeof window !== "undefined" && hasLoadedInitialState) {
      saveGameStateToStorage();
    }
  }, [players, saveGameStateToStorage, hasLoadedInitialState]);

  // Generate unique abbreviations for player names
  const generateAbbreviations = () => {
    const abbreviations: string[] = [];
    const usedAbbrevs = new Set<string>();

    // First pass: find common prefixes and group similar names
    const nameGroups: { [key: string]: number[] } = {};

    players.forEach((player, index) => {
      // If using default name, keep P1, P2, etc.
      if (player.name === `Player ${index + 1}`) {
        abbreviations[index] = `P${index + 1}`;
        return;
      }

      const name = player.name.trim().toLowerCase();
      // Try to find a meaningful 3-character prefix
      const prefix = name.substring(0, 3);

      if (!nameGroups[prefix]) {
        nameGroups[prefix] = [];
      }
      nameGroups[prefix].push(index);
    });

    // Second pass: assign abbreviations
    Object.entries(nameGroups).forEach(([prefix, indices]) => {
      if (indices.length === 1) {
        // Only one name with this prefix, use 3 characters
        const index = indices[0];
        const abbrev = prefix.toUpperCase();
        usedAbbrevs.add(abbrev);
        abbreviations[index] = abbrev;
      } else {
        // Multiple names with same prefix, use prefix + numbers
        indices.forEach((index, i) => {
          const abbrev = prefix.toUpperCase() + (i + 1);
          usedAbbrevs.add(abbrev);
          abbreviations[index] = abbrev;
        });
      }
    });

    return abbreviations;
  };

  const playerAbbrevs = generateAbbreviations();

  // Helper function to parse life actions
  const parseLifeAction = (actionStr: string): { value: number, type: string } | null => {
    const match = actionStr.match(/^([+-])(\d+)\s+life\|(.+)$/);
    if (!match) return null;
    return {
      value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1),
      type: match[3]
    };
  };

  // Helper function to re-evaluate and collapse existing history
  const reEvaluateHistoryCollapsing = (existingHistory: HistoryEntry[]): HistoryEntry[] => {
    if (existingHistory.length === 0) return existingHistory;

    // Find all consecutive life actions at the beginning of history (any sign)
    const consecutiveActions: HistoryEntry[] = [];
    
    for (let i = 0; i < existingHistory.length; i++) {
      const entry = existingHistory[i];
      
      // Include direct life actions (not "from" someone)
      if (entry.action.includes('life|') && !entry.action.includes('from ')) {
        const parsed = parseLifeAction(entry.action);
        if (parsed) {
          consecutiveActions.push(entry);
        } else {
          break; // Invalid life action format
        }
      } else {
        break; // Stop if we hit a non-life action or life action "from" someone
      }
    }

    if (consecutiveActions.length <= 1) {
      return existingHistory; // Nothing to collapse
    }

    // Parse consecutive actions
    const consecutiveParsed = consecutiveActions.map(entry => parseLifeAction(entry.action)).filter(Boolean) as { value: number, type: string }[];
    
    if (consecutiveParsed.length <= 1) {
      return existingHistory; // Nothing valid to collapse
    }

    // Collapse the values: sum them all up (allows cancellation)
    const totalValue = consecutiveParsed.reduce((sum, parsed) => sum + parsed.value, 0);
    
    // If the total is 0, we can remove all consecutive life actions (complete cancellation)
    if (totalValue === 0) {
      return existingHistory.slice(consecutiveActions.length);
    }

    // Create the collapsed action using the most recent timestamp
    const changeText = totalValue > 0 ? `+${totalValue}` : `${totalValue}`;
    const actionType = totalValue > 0 ? "positive" : "negative";
    const collapsedAction = `${changeText} life|${actionType}`;

    // Return history with consecutive actions replaced by the collapsed one
    return [
      { action: collapsedAction, timestamp: consecutiveActions[0].timestamp },
      ...existingHistory.slice(consecutiveActions.length)
    ];
  };

  // Helper function to collapse recent life actions
  const collapseLifeActions = (newAction: string, existingHistory: HistoryEntry[]): HistoryEntry[] => {
    const now = Date.now();
    const COLLAPSE_WINDOW_MS = 2000; // 2 seconds
    
    // Only collapse life actions, not commander damage or poison
    if (!newAction.includes('life|')) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }

    // Find recent life actions within the time window (any sign)
    const newParsed = parseLifeAction(newAction);
    if (!newParsed) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }
    
    const recentActions: HistoryEntry[] = [];
    
    for (const entry of existingHistory) {
      if (now - entry.timestamp > COLLAPSE_WINDOW_MS) break;
      if (entry.action.includes('life|') && !entry.action.includes('from ')) {
        const parsed = parseLifeAction(entry.action);
        if (parsed) {
          recentActions.push(entry);
        } else {
          break; // Stop if we can't parse the action
        }
      } else {
        break; // Stop if we hit a non-life action or life action "from" someone
      }
    }

    // Parse recent actions and include the new one
    const allValues: number[] = [newParsed.value];
    const recentParsed = recentActions.map(entry => parseLifeAction(entry.action)).filter(Boolean) as { value: number, type: string }[];
    
    for (const parsed of recentParsed) {
      allValues.push(parsed.value);
    }

    // Collapse the values: sum them all up (allows cancellation)
    const totalValue = allValues.reduce((sum, val) => sum + val, 0);
    
    // If the total is 0, we can skip adding anything (complete cancellation)
    if (totalValue === 0) {
      // Remove the recent life actions and don't add the new one
      return existingHistory.slice(recentActions.length);
    }

    // Create the collapsed action
    const changeText = totalValue > 0 ? `+${totalValue}` : `${totalValue}`;
    const actionType = totalValue > 0 ? "positive" : "negative";
    const collapsedAction = `${changeText} life|${actionType}`;

    // Return history with recent actions replaced by the collapsed one
    return [
      { action: collapsedAction, timestamp: now },
      ...existingHistory.slice(recentActions.length)
    ];
  };

  const addHistory = (playerIndex: number, action: string) => {
    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index === playerIndex) {
          let newHistory: HistoryEntry[];
          
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
          // Use client-side mobile detection state

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

  // Helper function to parse life actions from a specific player
  const parseLifeActionFromPlayer = (actionStr: string): { value: number, type: string, fromPlayer: string } | null => {
    const match = actionStr.match(/^([+-])(\d+)\s+life from (.+)\|(.+)$/);
    if (!match) return null;
    return {
      value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1),
      type: match[4],
      fromPlayer: match[3]
    };
  };

  // Helper function to collapse life actions from a specific player
  const collapseLifeActionsWithFrom = (newAction: string, existingHistory: HistoryEntry[], fromPlayer: string): HistoryEntry[] => {
    const now = Date.now();
    const COLLAPSE_WINDOW_MS = 2000; // 2 seconds
    
    // Only collapse life actions from the same player
    if (!newAction.includes('life from ') || !newAction.includes(fromPlayer)) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }

    // Find recent life actions from the same player within the time window
    const newParsed = parseLifeActionFromPlayer(newAction);
    if (!newParsed) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }
    
    const recentActions: HistoryEntry[] = [];
    
    for (const entry of existingHistory) {
      if (now - entry.timestamp > COLLAPSE_WINDOW_MS) break;
      if (entry.action.includes(`life from ${fromPlayer}|`)) {
        const parsed = parseLifeActionFromPlayer(entry.action);
        if (parsed) {
          recentActions.push(entry);
        } else {
          break; // Stop if we can't parse the action
        }
      } else {
        break; // Stop if we hit a non-matching action
      }
    }

    // Parse recent actions and include the new one
    const allValues: number[] = [newParsed.value];
    const recentParsed = recentActions.map(entry => parseLifeActionFromPlayer(entry.action)).filter(Boolean) as { value: number, type: string, fromPlayer: string }[];
    
    for (const parsed of recentParsed) {
      allValues.push(parsed.value);
    }

    // Collapse the values: sum them all up (allows cancellation)
    const totalValue = allValues.reduce((sum, val) => sum + val, 0);
    
    // If the total is 0, we can skip adding anything (complete cancellation)
    if (totalValue === 0) {
      // Remove the recent life actions and don't add the new one
      return existingHistory.slice(recentActions.length);
    }

    // Create the collapsed action
    const changeText = totalValue > 0 ? `+${totalValue}` : `${totalValue}`;
    const actionType = totalValue > 0 ? "positive" : "negative";
    const collapsedAction = `${changeText} life from ${fromPlayer}|${actionType}`;

    // Return history with recent actions replaced by the collapsed one
    return [
      { action: collapsedAction, timestamp: now },
      ...existingHistory.slice(recentActions.length)
    ];
  };

  // Helper function to parse commander damage actions
  const parseCommanderDamageAction = (actionStr: string): { value: number, fromPlayer: string } | null => {
    const match = actionStr.match(/^([+-])(\d+)\s+commander damage from (.+)\|commander$/);
    if (!match) return null;
    return {
      value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1),
      fromPlayer: match[3]
    };
  };

  // Helper function to collapse commander damage actions
  const collapseCommanderDamageActions = (newAction: string, existingHistory: HistoryEntry[]): HistoryEntry[] => {
    const now = Date.now();
    const COLLAPSE_WINDOW_MS = 2000; // 2 seconds
    
    // Only collapse commander damage actions
    if (!newAction.includes('commander damage from ') || !newAction.includes('|commander')) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }

    // Find recent commander damage actions from the same player within the time window
    const newParsed = parseCommanderDamageAction(newAction);
    if (!newParsed) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }
    
    const recentActions: HistoryEntry[] = [];
    
    for (const entry of existingHistory) {
      if (now - entry.timestamp > COLLAPSE_WINDOW_MS) break;
      if (entry.action.includes(`commander damage from ${newParsed.fromPlayer}|commander`)) {
        const parsed = parseCommanderDamageAction(entry.action);
        if (parsed && parsed.fromPlayer === newParsed.fromPlayer) {
          recentActions.push(entry);
        } else {
          break; // Stop if we can't parse the action or different player
        }
      } else {
        break; // Stop if we hit a non-matching action
      }
    }

    // Parse recent actions and include the new one
    const allValues: number[] = [newParsed.value];
    const recentParsed = recentActions.map(entry => parseCommanderDamageAction(entry.action)).filter(Boolean) as { value: number, fromPlayer: string }[];
    
    for (const parsed of recentParsed) {
      allValues.push(parsed.value);
    }

    // Collapse the values: sum them all up (allows cancellation)
    const totalValue = allValues.reduce((sum, val) => sum + val, 0);
    
    // If the total is 0, we can skip adding anything (complete cancellation)
    if (totalValue === 0) {
      // Remove the recent commander damage actions and don't add the new one
      return existingHistory.slice(recentActions.length);
    }

    // Create the collapsed action
    const changeText = totalValue > 0 ? `+${totalValue}` : `${totalValue}`;
    const collapsedAction = `${changeText} commander damage from ${newParsed.fromPlayer}|commander`;

    // Return history with recent actions replaced by the collapsed one
    return [
      { action: collapsedAction, timestamp: now },
      ...existingHistory.slice(recentActions.length)
    ];
  };

  // Helper function to parse poison actions
  const parsePoisonAction = (actionStr: string): { value: number } | null => {
    const match = actionStr.match(/^([+-])(\d+)\s+poison\|poison$/);
    if (!match) return null;
    return {
      value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1)
    };
  };

  // Helper function to collapse poison actions
  const collapsePoisonActions = (newAction: string, existingHistory: HistoryEntry[]): HistoryEntry[] => {
    const now = Date.now();
    const COLLAPSE_WINDOW_MS = 2000; // 2 seconds
    
    // Only collapse poison actions
    if (!newAction.includes('poison|poison')) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }

    // Find recent poison actions within the time window
    const newParsed = parsePoisonAction(newAction);
    if (!newParsed) {
      return [{ action: newAction, timestamp: now }, ...existingHistory];
    }
    
    const recentActions: HistoryEntry[] = [];
    
    for (const entry of existingHistory) {
      if (now - entry.timestamp > COLLAPSE_WINDOW_MS) break;
      if (entry.action.includes('poison|poison')) {
        const parsed = parsePoisonAction(entry.action);
        if (parsed) {
          recentActions.push(entry);
        } else {
          break; // Stop if we can't parse the action
        }
      } else {
        break; // Stop if we hit a non-matching action
      }
    }

    // Parse recent actions and include the new one
    const allValues: number[] = [newParsed.value];
    const recentParsed = recentActions.map(entry => parsePoisonAction(entry.action)).filter(Boolean) as { value: number }[];
    
    for (const parsed of recentParsed) {
      allValues.push(parsed.value);
    }

    // Collapse the values: sum them all up (allows cancellation)
    const totalValue = allValues.reduce((sum, val) => sum + val, 0);
    
    // If the total is 0, we can skip adding anything (complete cancellation)
    if (totalValue === 0) {
      // Remove the recent poison actions and don't add the new one
      return existingHistory.slice(recentActions.length);
    }

    // Create the collapsed action
    const changeText = totalValue > 0 ? `+${totalValue}` : `${totalValue}`;
    const collapsedAction = `${changeText} poison|poison`;

    // Return history with recent actions replaced by the collapsed one
    return [
      { action: collapsedAction, timestamp: now },
      ...existingHistory.slice(recentActions.length)
    ];
  };

  const damageAllOthers = (playerIndex: number, damage: number) => {
    const changeText = damage > 0 ? `+${damage}` : `${damage}`;
    const actionType = damage > 0 ? "positive" : "negative";
    const sourceName = players[playerIndex]?.name || `P${playerIndex + 1}`;
    const timestamp = Date.now();
    
    // Store information for undo operation
    const affectedPlayers: Array<{ playerIndex: number; lifeChange: number }> = [];
    const historyEntries: Array<{ playerIndex: number; entry: HistoryEntry }> = [];
    
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
          
          let newHistory: HistoryEntry[];
          
          if (isWithinCollapseWindow) {
            // If undoing within the collapse window, create a reverse action for collapsing
            const reverseChange = -affectedPlayer.lifeChange;
            const changeText = reverseChange > 0 ? `+${reverseChange}` : `${reverseChange}`;
            const actionType = reverseChange > 0 ? "positive" : "negative";
            const reverseAction = `${changeText} life from ${sourcePlayerName}|${actionType}`;
            
            // Use collapsing logic with the reverse action for "from player" format
            newHistory = collapseLifeActionsWithFrom(reverseAction, player.history, sourcePlayerName);
          } else {
            // If undoing outside the collapse window, we need to remove the matching "from player" entry
            const targetChange = affectedPlayer.lifeChange;
            const changeText = targetChange > 0 ? `+${targetChange}` : `${targetChange}`;
            const actionType = targetChange > 0 ? "positive" : "negative";
            const targetAction = `${changeText} life from ${sourcePlayerName}|${actionType}`;
            
            // Find and remove the matching entry by timestamp and action
            const filteredHistory = player.history.filter(
              (entry) => !(entry.timestamp === lastOperation.timestamp && entry.action === targetAction)
            );
            
            // Re-evaluate history collapsing after removing the undo entry
            newHistory = reEvaluateHistoryCollapsing(filteredHistory);
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
    if (typeof window !== "undefined") {
      localStorage.removeItem("commander-game-state");
    }

    // Reset will trigger auto-save of the new clean state
    setHasLoadedInitialState(true);
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  const PlayerQuadrant = ({
    player,
    playerIndex,
  }: {
    player: PlayerState;
    playerIndex: number;
  }) => {
    // Track the most recent action for highlighting
    useEffect(() => {
      // This effect tracks history changes for potential future highlighting features
    }, [player.history]);

    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    };

    // Dynamic rotation based on player's rotation state
    const getRotationClass = (rotation: number) => {
      switch (rotation) {
        case 0:
          return "rotate-0 origin-center";
        case 90:
          return "rotate-90 origin-center";
        case 180:
          return "rotate-180 origin-center";
        case 270:
          return "-rotate-90 origin-center";
        default:
          return "rotate-0 origin-center";
      }
    };

    const rotationClass = getRotationClass(player.rotation);

    // Get commander damage sources (other players)
    const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);

    return (
      <div className="relative w-full h-full border border-[#333333] bg-[#222222] overflow-hidden">
        {/* Dead overlay */}
        {player.isDead && (
          <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none" />
        )}

        {/* Desktop-only fixed position buttons */}
        {!isMobileLandscape && !isMobilePortrait && (
          <>
            {/* Rotation Control - fixed position on desktop */}
            <button
              onClick={() => updateRotation(playerIndex)}
              disabled={rotatingPlayer === playerIndex}
              className={`absolute z-30 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-sm p-0 ${
                rotatingPlayer === playerIndex
                  ? "text-white/40 cursor-not-allowed"
                  : ""
              } ${
                playerIndex === 0
                  ? "top-2 right-2" // Player 1: top-right (away from settings & center)
                  : playerIndex === 1
                  ? "top-2 left-2" // Player 2: top-left (away from center)
                  : playerIndex === 2
                  ? "bottom-2 left-2" // Player 3: bottom-left (away from center)
                  : "bottom-2 right-2" // Player 4: bottom-right (away from center)
              }`}
              title="Rotate view"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>

            {/* Death Toggle - fixed position on desktop */}
            <button
              onClick={() => togglePlayerDead(playerIndex)}
              className={`absolute z-30 text-white hover:text-red-400 transition-all duration-200 flex items-center justify-center ${
                player.isDead ? "text-red-500" : "text-white/70"
              } ${
                playerIndex === 0
                  ? "bottom-2 left-2" // Player 1: bottom-left (away from center)
                  : playerIndex === 1
                  ? "bottom-2 right-2" // Player 2: bottom-right (away from center)
                  : playerIndex === 2
                  ? "top-2 right-2" // Player 3: top-right (away from center)
                  : "top-2 left-2" // Player 4: top-left (away from center & settings)
              }`}
              title={player.isDead ? "Revive player" : "Mark as dead"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
                className="drop-shadow-lg"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.91 1.47 2.18 2.79 3.71 3.92.63.47 1.32.88 2.05 1.24.73-.36 1.42-.77 2.05-1.24 1.53-1.13 2.8-2.45 3.71-3.92C18.5 12.37 19 10.74 19 9c0-3.87-3.13-7-7-7zM8.5 7c.83 0 1.5.67 1.5 1.5S9.33 10 8.5 10 7 9.33 7 8.5 7.67 7 8.5 7zm7 0c.83 0 1.5.67 1.5 1.5S16.33 10 15.5 10 14 9.33 14 8.5 14.67 7 15.5 7zM12 13c-1.21 0-2.25.86-2.45 2h4.9c-.2-1.14-1.24-2-2.45-2z" />
              </svg>
            </button>
          </>
        )}

        <div
          className={`absolute ${player.isDead ? "opacity-50" : ""}`}
          style={{
            ...(player.rotation === 90 || player.rotation === 270
              ? {
                  // Landscape container (rotated): center within quadrant
                  top: "50%",
                  left: "50%",
                  width: "calc(100vh / 2 - 1rem)",
                  height: "calc(100vw / 2 - 1rem)",
                  transform: "translate(-50%, -50%)",
                  transformOrigin: "center",
                }
              : {
                  // Portrait container (normal): use full quadrant
                  top: "0.5rem",
                  left: "0.5rem",
                  width: "calc(100vw / 2 - 1rem)",
                  height: "calc(100vh / 2 - 1rem)",
                }),
          }}
        >
          <div className={`w-full h-full flex flex-col ${rotationClass}`}>
            {/* Mobile-only buttons that rotate with quadrant - positioned in corners */}
            {(isMobileLandscape || isMobilePortrait) && (
              <>
                {/* Rotation Control - top left corner */}
                <button
                  onClick={() => updateRotation(playerIndex)}
                  disabled={rotatingPlayer === playerIndex}
                  className={`absolute top-1 left-1 z-10 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-xs p-0 ${
                    rotatingPlayer === playerIndex
                      ? "text-white/40 cursor-not-allowed"
                      : ""
                  }`}
                  title={
                    isMobileLandscape || isMobilePortrait
                      ? "Flip view"
                      : "Rotate view"
                  }
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>

                {/* Death Toggle - top right corner */}
                <button
                  onClick={() => togglePlayerDead(playerIndex)}
                  className={`absolute top-1 right-1 z-10 text-white hover:text-red-400 transition-all duration-200 flex items-center justify-center ${
                    player.isDead ? "text-red-500" : "text-white/70"
                  }`}
                  title={player.isDead ? "Revive player" : "Mark as dead"}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                    className="drop-shadow-lg"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.91 1.47 2.18 2.79 3.71 3.92.63.47 1.32.88 2.05 1.24.73-.36 1.42-.77 2.05-1.24 1.53-1.13 2.8-2.45 3.71-3.92C18.5 12.37 19 10.74 19 9c0-3.87-3.13-7-7-7zM8.5 7c.83 0 1.5.67 1.5 1.5S9.33 10 8.5 10 7 9.33 7 8.5 7.67 7 8.5 7zm7 0c.83 0 1.5.67 1.5 1.5S16.33 10 15.5 10 14 9.33 14 8.5 14.67 7 15.5 7zM12 13c-1.21 0-2.25.86-2.45 2h4.9c-.2-1.14-1.24-2-2.45-2z" />
                  </svg>
                </button>
              </>
            )}

            {/* Player Label */}
            <div className="text-center mb-1 shrink-0 w-full flex justify-center">
              <h2 className="text-lg font-bold text-[#ffffff] tracking-wide truncate">
                {player.name}
              </h2>
            </div>

            {/* Life Counter */}
            <div className="shrink-0 flex flex-col items-center justify-center">
              <div className="relative mb-1">
                <div className="text-4xl font-bold text-[#f5f5f5] mb-1 select-none tracking-tight">
                  {player.life}
                </div>
                <div className="absolute inset-0 text-4xl font-bold text-[#166534] mb-1 select-none tracking-tight opacity-15 blur-sm">
                  {player.life}
                </div>
              </div>

              {/* Life Control Buttons */}
              <div className="flex flex-col gap-1 w-full max-w-xs">
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => updateLife(playerIndex, -5)}
                    className="bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-3 px-1 transition-all duration-150"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => updateLife(playerIndex, -1)}
                    className="bg-[#b91c1c] hover:bg-[#dc2626] text-white text-sm font-bold py-3 px-1 transition-all duration-150"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => updateLife(playerIndex, 1)}
                    className="bg-[#166534] hover:bg-[#16a34a] text-white text-sm font-bold py-3 px-1 transition-all duration-150"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => updateLife(playerIndex, 5)}
                    className="bg-[#14532d] hover:bg-[#166534] text-white text-sm font-bold py-3 px-1 transition-all duration-150"
                  >
                    +5
                  </button>
                </div>

                {/* Damage All Others Button and Undo */}
                <div className="flex gap-1">
                  <button
                    onClick={() => damageAllOthers(playerIndex, -1)}
                    className="flex-1 bg-[#c2410c] hover:bg-[#ea580c] text-white text-sm font-bold py-3 px-2 transition-all duration-150"
                  >
                    -1 to all others
                  </button>
                  <button
                    onClick={undoDamageAllOthers}
                    disabled={undoStack.length === 0}
                    className="bg-[#6b7280] hover:bg-[#9ca3af] disabled:bg-[#374151] disabled:text-[#6b7280] disabled:cursor-not-allowed text-white text-sm font-bold py-3 px-2 transition-all duration-150"
                    title="Undo last damage to all others"
                  >
                    ↶
                  </button>
                </div>
              </div>
            </div>

            {/* History */}
            <div className="flex-1 mt-1 mb-1 w-full max-w-xs mx-auto flex flex-col min-h-0">
              <div className="bg-[#2a2a2a] p-2 flex-1 overflow-y-auto min-h-0">
                <div
                  className={`${
                    isMobileLandscape || isMobilePortrait
                      ? "text-[9px]"
                      : "text-[12px]"
                  } text-[#a3a3a3] font-semibold mb-1 pb-1 border-b border-[#404040]`}
                >
                  Recent Actions:
                </div>
                {player.history.length === 0 ? (
                  <div
                    className={`${
                      isMobileLandscape || isMobilePortrait
                        ? "text-[9px]"
                        : "text-[12px]"
                    } text-[#888888] italic mt-1`}
                  >
                    No actions yet
                  </div>
                ) : (
                  <div className="mt-1">
                    {player.history.map((entry, index) => {
                      const [text, type] = entry.action.split("|");
                      let textColor = "text-[#a3a3a3]"; // default

                      if (type === "positive") {
                        textColor = "text-[#22c55e]";
                      } else if (type === "negative") {
                        textColor = "text-[#dc2626]";
                      } else if (type === "poison") {
                        textColor = "text-[#a855f7]";
                      } else if (type === "commander") {
                        textColor = "text-[#3b82f6]";
                      }

                      // Parse the action text to extract components
                      const parseAction = (actionText: string) => {
                        // Match patterns like "+5", "-1", "+2 commander damage", etc.
                        const match = actionText.match(/^([+-])(\d+)\s*(.*)$/);
                        if (match) {
                          return {
                            sign: match[1],
                            number: match[2],
                            label: match[3] || "",
                          };
                        }
                        // Fallback for non-standard formats
                        return {
                          sign: "",
                          number: "",
                          label: actionText,
                        };
                      };

                      const { sign, number, label } = parseAction(text);

                      // Set sign color
                      const signColor =
                        sign === "+"
                          ? "text-[#22c55e]"
                          : sign === "-"
                          ? "text-[#dc2626]"
                          : "";

                      return (
                        <div
                          key={`${entry.timestamp}-${index}`}
                          className={`grid items-center ${
                            isMobileLandscape || isMobilePortrait
                              ? "text-[9px] grid-cols-[10px_auto_1fr_auto]"
                              : "text-[12px] grid-cols-[16px_auto_1fr_auto]"
                          } leading-tight font-medium py-1 border-b border-[#404040]`}
                          style={{
                            columnGap:
                              isMobileLandscape || isMobilePortrait
                                ? "4px"
                                : "8px",
                          }}
                        >
                          <span
                            className={`font-bold text-center ${signColor}`}
                          >
                            {sign}
                          </span>
                          <span className={`font-bold ${textColor}`}>
                            {number}
                          </span>
                          <span className={`truncate ${textColor}`}>
                            {label}
                          </span>
                          <span
                            className={`text-[#888888] ${
                              isMobileLandscape || isMobilePortrait
                                ? "text-[8px]"
                                : "text-[11px]"
                            } shrink-0`}
                          >
                            {formatTime(entry.timestamp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Commander Damage & Poison Counters */}
            <div className="shrink-0 pb-1">
              <div className="grid grid-cols-4 gap-1 w-full max-w-xs mx-auto">
                {/* Commander Damage Counters */}
                {commanderSources.map((sourceIndex, i) => (
                  <div
                    key={sourceIndex}
                    className="bg-[#2a2a2a] text-center relative"
                  >
                    <button
                      onClick={() => updateCommanderDamage(playerIndex, i, -1)}
                      className="absolute left-0 top-0 w-1/2 h-full z-10"
                    />
                    <button
                      onClick={() => updateCommanderDamage(playerIndex, i, 1)}
                      className="absolute right-0 top-0 w-1/2 h-full z-10"
                    />
                    <div className="p-2 pointer-events-none">
                      <div className="flex items-center justify-center mb-1 h-5">
                        <span className="text-xs text-[#e5e5e5] font-bold leading-none tracking-wide whitespace-nowrap">
                          {playerAbbrevs[sourceIndex]} {player.commanderDamage[i]}
                        </span>
                      </div>
                      <div className="flex gap-1 justify-center items-center">
                        <span className="bg-[#991b1b] hover:bg-[#b91c1c] text-white text-xs font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center flex-shrink-0">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M19 13H5v-2h14v2z" />
                          </svg>
                        </span>
                        <span className="bg-[#166534] hover:bg-[#16a34a] text-white text-xs font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center flex-shrink-0">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Poison Counter */}
                <div className="bg-[#2a2a2a] text-center relative">
                  <button
                    onClick={() => updatePoison(playerIndex, -1)}
                    className="absolute left-0 top-0 w-1/2 h-full z-10"
                  />
                  <button
                    onClick={() => updatePoison(playerIndex, 1)}
                    className="absolute right-0 top-0 w-1/2 h-full z-10"
                  />
                  <div className="p-2 pointer-events-none">
                    <div className="flex items-center justify-center mb-1 h-5">
                      <div className="flex items-center whitespace-nowrap">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 600 1059.7"
                          className="w-3 h-3 mr-1 flex-shrink-0"
                          fill="currentColor"
                        >
                          <path
                            d="m598 529c0.6-57.8-17.7-116.1-53.7-161.4-17.4-19.1-31.7-40.9-50.1-59-40.6-40.3-101.4-43-150.3-68.3-2.9-25.5-12.2-51-6.5-76.7 1.7-8.6 4.3-17.2-0.3-25.4-12.8-29.5-1.8-61.6-4.1-92.4-1.7-16.1-0.6-35.8-16-45.7-3.6 33.5-15.9 64.7-25.9 96.4-4.6 24.8-4.6 50.6-15.3 73.9 6.8 23.7-6.6 43.6-21.1 61.1-32.1 16.4-70.2 20.3-98.2 44.4-19.9 16.9-41.4 31.7-63.7 45.5-16.7 20.9-35.2 41.1-42.7 67.5-29.9 36.1-33.4 84.5-50.3 126.7-0.3 62.7 12.4 130.2 52.4 180.5 28.7 23.7 48.7 55.5 77.3 79.1 27.5 16.4 56.8 29.9 85.2 44.6 18.5 4.3 37.6 6.4 56 11.5 14.9 76.9 25.1 155.6 55.1 228.5 9.9-29.9 8.7-62 17.3-92.3 12.1-44.7-12.7-91.2 1.3-135.2 21-18.7 55.9-6.6 79.2-22.6 44.3-27.3 91.1-53.8 123.2-95.6 11.9-24 37.1-41.9 37.1-70.7 0.2-38.7 22.8-75 14.2-114.2m-328.4 237.2c-32.1-7.8-61.9-23.1-88.8-41.9-28.9-19.3-39.7-55.2-68.3-75-26.7-31.9-21-75.5-31.9-113.3 4.4-26.4 9.6-52.5 12.3-79.2 13-21.1 33.2-38 38.7-63.5 19.1-27.4 48.2-46.3 71.6-70.1 17-19.6 44.1-11.3 66.4-12.1-2.2 21.6-4 44 1.4 65.3 2.6 13.1 8.6 26 6.5 39.7-4.5 29.2 6.5 58.5-1.3 87.3-15.6 60.3 1.4 121.2 2.9 182-2.2 26.9-3.5 54-9.6 80.6m243.1-114.3c-21.2 15.1-39.3 33.6-57.8 51.7-32.2 22.3-64.1 45.8-102.4 57 3.4-27.3 6.8-55.5-1.9-82.2-21.4-60.5 4.8-123.8 9.2-184.9-3.9-36.4-0.2-75.2-16.9-108.7-2.2-25.1 8.7-49.5 16.1-73.1 25.3 10.1 49.2 23.8 70.2 41.3 25.5 19.1 64.5 31.4 70.2 67 2.9 23.4 28.5 37.5 27.7 61.4-1.6 56.8 6.3 116.3-14.4 170.5"
                            fill="currentColor"
                          />
                        </svg>
                        <span className="text-xs text-[#e5e5e5] font-bold leading-none tracking-wide">
                          {player.poison}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 justify-center items-center">
                      <span className="bg-[#991b1b] hover:bg-[#b91c1c] text-white text-xs font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M19 13H5v-2h14v2z" />
                        </svg>
                      </span>
                      <span className="bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] overflow-hidden relative select-none">
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
      {isMenuOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
          <div className={`bg-[#222222] border border-[#333333] w-full max-w-md mx-4 ${
            isMobileLandscape || isMobilePortrait ? "p-4" : "p-6"
          }`}>
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
                        updatePlayerName(
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
                onClick={() => {
                  setPlayers((prev) =>
                    prev.map((player, index) => ({
                      ...player,
                      name: `Player ${index + 1}`,
                    }))
                  );
                }}
                className="flex-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] text-sm font-bold py-3 px-4 transition-all duration-200"
                title="Reset player names to defaults"
              >
                Reset Names
              </button>
              {!showResetConfirm ? (
                <button
                  onClick={handleResetClick}
                  className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
                >
                  Reset Game
                </button>
              ) : (
                <button
                  onClick={resetGame}
                  className="flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white text-sm font-bold py-3 px-4 transition-all duration-200"
                >
                  Yes, Reset
                </button>
              )}
              <button
                onClick={
                  showResetConfirm ? cancelReset : () => setIsMenuOpen(false)
                }
                className="flex-1 bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] text-sm font-bold py-3 px-4 transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4 Player Quadrants - Perfect quarters of the screen */}
      <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
        <div className="w-full h-full">
          <PlayerQuadrant player={players[0]} playerIndex={0} />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant player={players[1]} playerIndex={1} />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant player={players[3]} playerIndex={3} />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant player={players[2]} playerIndex={2} />
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
