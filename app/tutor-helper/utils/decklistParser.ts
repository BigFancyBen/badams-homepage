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

// Extract deck ID from various deck site URLs
export function extractDeckId(url: string): { site: string; id: string } | null {
  const cleanUrl = url.trim();
  
  // Moxfield: https://www.moxfield.com/decks/DECK_ID
  const moxfieldMatch = cleanUrl.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/);
  if (moxfieldMatch) {
    return { site: 'moxfield', id: moxfieldMatch[1] };
  }
  
  // Archidekt: https://archidekt.com/decks/DECK_ID
  const archidektMatch = cleanUrl.match(/archidekt\.com\/decks\/(\d+)/);
  if (archidektMatch) {
    return { site: 'archidekt', id: archidektMatch[1] };
  }
  
  // TappedOut: https://tappedout.net/mtg-decks/DECK_NAME/
  const tappedOutMatch = cleanUrl.match(/tappedout\.net\/mtg-decks\/([a-zA-Z0-9_-]+)/);
  if (tappedOutMatch) {
    return { site: 'tappedout', id: tappedOutMatch[1] };
  }
  
  return null;
}

// Fetch decklist from supported sites
export async function fetchDecklistFromUrl(url: string): Promise<string> {
  const deckInfo = extractDeckId(url);
  if (!deckInfo) {
    throw new Error('Invalid deck URL format');
  }

  try {
    switch (deckInfo.site) {
      case 'moxfield':
        return await fetchMoxfieldDecklist(deckInfo.id);
      case 'archidekt':
        return await fetchArchidektDecklist(deckInfo.id);
      case 'tappedout':
        return await fetchTappedOutDecklist(deckInfo.id);
      default:
        throw new Error(`Unsupported site: ${deckInfo.site}`);
    }
  } catch (error) {
    throw new Error(`Failed to fetch decklist from ${deckInfo.site}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Fetch decklist from Moxfield
async function fetchMoxfieldDecklist(deckId: string): Promise<string> {
  const response = await fetch(`https://www.moxfield.com/api/v2/decks/${deckId}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (!data.mainboard || !Array.isArray(data.mainboard)) {
    throw new Error('Invalid deck data format');
  }
  
  // Convert Moxfield format to our format
  return data.mainboard
    .map((card: any) => `${card.quantity} ${card.card.name}`)
    .join('\n');
}

// Fetch decklist from Archidekt
async function fetchArchidektDecklist(deckId: string): Promise<string> {
  const response = await fetch(`https://archidekt.com/api/decks/${deckId}/`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error('Invalid deck data format');
  }
  
  // Convert Archidekt format to our format
  return data.cards
    .filter((card: any) => card.categories && card.categories.includes('main'))
    .map((card: any) => `${card.quantity} ${card.card.name}`)
    .join('\n');
}

// Fetch decklist from TappedOut
async function fetchTappedOutDecklist(deckId: string): Promise<string> {
  // TappedOut doesn't have a public API, so we'll scrape the HTML
  const response = await fetch(`https://tappedout.net/mtg-decks/${deckId}/`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  
  // Extract card information from the HTML
  // This is a simplified approach - TappedOut's HTML structure may change
  const cardRegex = /<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/g;
  const cards: string[] = [];
  let match;
  
  while ((match = cardRegex.exec(html)) !== null) {
    const quantity = match[1];
    const cardName = match[2].trim();
    if (cardName && quantity) {
      cards.push(`${quantity} ${cardName}`);
    }
  }
  
  if (cards.length === 0) {
    throw new Error('No cards found in deck');
  }
  
  return cards.join('\n');
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
    
    // Handle adventure cards: "Card Name // Adventure Name"
    // This is the same as double-faced, so no special handling needed
    
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
export async function parseDecklist(input: string): Promise<ParsedDecklist> {
  const errors: string[] = [];
  let cards: ParsedCard[] = [];
  
  if (!input.trim()) {
    return { cards: [], errors: ['Please enter a decklist'], totalCards: 0 };
  }
  
  // Check if it's a URL
  const deckInfo = extractDeckId(input);
  if (deckInfo) {
    try {
      const decklistText = await fetchDecklistFromUrl(input);
      // Parse the fetched decklist text
      const parsedDecklist = await parseDecklistText(decklistText);
      return parsedDecklist;
    } catch (error) {
      errors.push(`Failed to fetch decklist from ${deckInfo.site}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { cards: [], errors, totalCards: 0 };
    }
  }
  
  // Parse the input text directly
  return await parseDecklistText(input);
}

// Parse decklist text (separated for reusability)
async function parseDecklistText(input: string): Promise<ParsedDecklist> {
  const errors: string[] = [];
  let cards: ParsedCard[] = [];
  
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
      } catch (error) {
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
