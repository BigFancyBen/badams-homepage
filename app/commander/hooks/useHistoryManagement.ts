import { useCallback } from 'react';
import { HistoryEntry } from '../types';
import { 
  parseLifeAction, 
  parseLifeActionFromPlayer, 
  parseCommanderDamageAction, 
  parsePoisonAction 
} from '../utils';

export function useHistoryManagement() {
  
  // Helper function to collapse recent life actions
  const collapseLifeActions = useCallback((newAction: string, existingHistory: HistoryEntry[]): HistoryEntry[] => {
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
  }, []);

  // Helper function to collapse life actions from a specific player
  const collapseLifeActionsWithFrom = useCallback((newAction: string, existingHistory: HistoryEntry[], fromPlayer: string): HistoryEntry[] => {
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
  }, []);

  // Helper function to collapse commander damage actions
  const collapseCommanderDamageActions = useCallback((newAction: string, existingHistory: HistoryEntry[]): HistoryEntry[] => {
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
  }, []);

  // Helper function to collapse poison actions
  const collapsePoisonActions = useCallback((newAction: string, existingHistory: HistoryEntry[]): HistoryEntry[] => {
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
  }, []);

  return {
    collapseLifeActions,
    collapseLifeActionsWithFrom,
    collapseCommanderDamageActions,
    collapsePoisonActions,
  };
}

