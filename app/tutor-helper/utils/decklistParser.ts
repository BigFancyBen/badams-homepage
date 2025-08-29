export interface ParsedCard {
  quantity: number;
  name: string;
  originalLine?: string;
}

export interface ParsedDecklist {
  cards: ParsedCard[];
  errors: string[];
  totalCards: number;
}

// Parse a single card line (handles various formats)
function parseCardLine(line: string): ParsedCard | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return null; // Skip empty lines and comments
  }
  
  // Format: "1 Card Name" or "1x Card Name"
  const quantityMatch = trimmed.match(/^(\d+)x?\s+(.+)/);
  if (quantityMatch) {
    const quantity = parseInt(quantityMatch[1]);
    let cardName = quantityMatch[2].trim();
    
    // Handle double-faced cards: "Card Name // Other Side"
    if (cardName.includes(' // ')) {
      cardName = cardName.split(' // ')[0].trim();
    }
    
    return {
      quantity,
      name: cardName,
      originalLine: trimmed
    };
  }
  
  // If no quantity found, assume 1
  let cardName = trimmed;
  if (cardName.includes(' // ')) {
    cardName = cardName.split(' // ')[0].trim();
  }
  
  return {
    quantity: 1,
    name: cardName,
    originalLine: trimmed
  };
}

// Parse comma-separated card names
function parseCommaSeparated(input: string): ParsedCard[] {
  return input
    .split(',')
    .map(card => {
      const trimmed = card.trim();
      if (!trimmed) return null;
      
      return {
        quantity: 1,
        name: trimmed,
        originalLine: trimmed
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);
}

// Main parsing function
export function parseDecklist(input: string): ParsedDecklist {
  const errors: string[] = [];
  let cards: ParsedCard[] = [];
  
  if (!input.trim()) {
    return { cards: [], errors: ['Please enter a decklist'], totalCards: 0 };
  }
  
  // Check if it's comma-separated (no line breaks and contains commas)
  const hasLineBreaks = input.includes('\n');
  const hasCommas = input.includes(',');
  
  if (!hasLineBreaks && hasCommas) {
    cards = parseCommaSeparated(input);
  } else {
    // Parse as line-separated format
    const lines = input.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        const parsed = parseCardLine(line);
        if (parsed) {
          cards.push(parsed);
        }
      } catch {
        errors.push(`Error parsing line ${i + 1}: "${line}"`);
      }
    }
  }
  
  // Remove duplicates and combine quantities
  const cardMap = new Map<string, ParsedCard>();
  for (const card of cards) {
    const existing = cardMap.get(card.name.toLowerCase());
    if (existing) {
      existing.quantity += card.quantity;
    } else {
      cardMap.set(card.name.toLowerCase(), { ...card });
    }
  }
  
  const uniqueCards = Array.from(cardMap.values());
  const totalCards = uniqueCards.reduce((sum, card) => sum + card.quantity, 0);
  
  if (uniqueCards.length === 0) {
    errors.push('No valid cards found in the input');
  }
  
  return {
    cards: uniqueCards,
    errors,
    totalCards
  };
}
