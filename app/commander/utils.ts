import { ParsedAction, ParsedLifeActionFromPlayer, ParsedCommanderDamageAction, ParsedPoisonAction, PlayerState } from './types';

// Helper function to parse life actions
export const parseLifeAction = (actionStr: string): ParsedAction | null => {
  const match = actionStr.match(/^([+-])(\d+)\s+life\|(.+)$/);
  if (!match) return null;
  return {
    value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1),
    type: match[3]
  };
};

// Helper function to parse life actions from a specific player
export const parseLifeActionFromPlayer = (actionStr: string): ParsedLifeActionFromPlayer | null => {
  const match = actionStr.match(/^([+-])(\d+)\s+life from (.+)\|(.+)$/);
  if (!match) return null;
  return {
    value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1),
    type: match[4],
    fromPlayer: match[3]
  };
};

// Helper function to parse commander damage actions
export const parseCommanderDamageAction = (actionStr: string): ParsedCommanderDamageAction | null => {
  const match = actionStr.match(/^([+-])(\d+)\s+commander damage from (.+)\|commander$/);
  if (!match) return null;
  return {
    value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1),
    fromPlayer: match[3]
  };
};

// Helper function to parse poison actions
export const parsePoisonAction = (actionStr: string): ParsedPoisonAction | null => {
  const match = actionStr.match(/^([+-])(\d+)\s+poison\|poison$/);
  if (!match) return null;
  return {
    value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1)
  };
};

// Generate unique abbreviations for player names
export const generateAbbreviations = (players: PlayerState[]): string[] => {
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

// Format timestamp to time string
export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

// Parse action text to extract components for display
export const parseActionForDisplay = (actionText: string) => {
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

// Get rotation CSS class based on rotation value
export const getRotationClass = (rotation: number): string => {
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

