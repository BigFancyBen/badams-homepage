import { CARD_TYPES } from '../types';

// Normalize card type from Scryfall type_line to our filter categories
export function normalizeCardType(typeLine: string): string[] {
  const normalizedTypes: string[] = [];
  const lowerTypeLine = typeLine.toLowerCase();
  
  // Check each of our filter categories
  for (const cardType of CARD_TYPES) {
    const lowerCardType = cardType.toLowerCase();
    
    // Handle special cases
    if (lowerCardType === 'land') {
      if (lowerTypeLine.includes('land')) {
        normalizedTypes.push(cardType);
      }
    } else if (lowerCardType === 'artifact') {
      if (lowerTypeLine.includes('artifact')) {
        normalizedTypes.push(cardType);
      }
    } else if (lowerCardType === 'enchantment') {
      if (lowerTypeLine.includes('enchantment')) {
        normalizedTypes.push(cardType);
      }
    } else if (lowerCardType === 'creature') {
      if (lowerTypeLine.includes('creature')) {
        normalizedTypes.push(cardType);
      }
    } else if (lowerCardType === 'instant') {
      if (lowerTypeLine.includes('instant')) {
        normalizedTypes.push(cardType);
      }
    } else if (lowerCardType === 'sorcery') {
      if (lowerTypeLine.includes('sorcery')) {
        normalizedTypes.push(cardType);
      }
    } else if (lowerCardType === 'planeswalker') {
      if (lowerTypeLine.includes('planeswalker')) {
        normalizedTypes.push(cardType);
      }
    } else if (lowerCardType === 'battle') {
      if (lowerTypeLine.includes('battle')) {
        normalizedTypes.push(cardType);
      }
    }
  }
  
  return normalizedTypes;
}

// Get the primary card type (for display purposes)
export function getPrimaryCardType(typeLine: string): string {
  const types = normalizeCardType(typeLine);
  
  // Priority order for primary type
  const priorityOrder = ['Creature', 'Planeswalker', 'Artifact', 'Enchantment', 'Land', 'Instant', 'Sorcery', 'Battle'];
  
  for (const priority of priorityOrder) {
    if (types.includes(priority)) {
      return priority;
    }
  }
  
  return types[0] || 'Unknown';
}

// Parse all individual types from a Magic card's type line
function parseAllCardTypes(typeLine: string): string[] {
  // Example type lines:
  // "Land Creature — Forest Dryad"
  // "Legendary Artifact — Equipment" 
  // "Instant"
  // "Creature — Human Wizard"
  // "Land — Forest Island"
  
  const allTypes: string[] = [];
  
  // Split by em dash, en dash, or regular dash to separate main types from subtypes
  const parts = typeLine.split(/\s*[—–-]\s*/);
  
  // Parse main types (everything before the dash)
  const mainTypesString = parts[0].trim();
  const mainTypes = mainTypesString.split(/\s+/).filter(type => type.length > 0);
  allTypes.push(...mainTypes);
  
  // Parse subtypes (everything after the dash, if present)
  if (parts.length > 1) {
    const subTypesString = parts[1].trim();
    const subTypes = subTypesString.split(/\s+/).filter(type => type.length > 0);
    allTypes.push(...subTypes);
  }
  
  return allTypes.map(type => type.toLowerCase().trim());
}

// Enhanced card type matching for filtering
export function cardMatchesTypeFilter(card: { type_line: string }, filterTypes: string[], logic: 'and' | 'or'): boolean {
  if (filterTypes.length === 0) return true;
  
  // Get all individual types from the card (supertypes, types, subtypes)
  const allCardTypes = parseAllCardTypes(card.type_line);
  
  // Normalize filter types for comparison
  const normalizedFilterTypes = filterTypes.map(type => type.toLowerCase().trim());
  
  if (logic === 'and') {
    // ALL filter types must be present on the card (exact match)
    return normalizedFilterTypes.every(filterType => 
      allCardTypes.includes(filterType)
    );
  } else {
    // ANY filter type must be present on the card (exact match)
    return normalizedFilterTypes.some(filterType => 
      allCardTypes.includes(filterType)
    );
  }
}
