// Scryfall types

export interface ScryfallRelatedPart {
  id: string;
  component: string; // "token", "meld_part", "meld_result", "combo_piece"
  name: string;
  type_line: string;
  uri: string;
}

export interface ScryfallTokenCard {
  id: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors: string[];
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
  };
}

// Discovery

export interface DiscoveredToken {
  scryfallId: string;
  name: string;
  typeLine: string;
  oracleText?: string;
  basePower: number | null;
  baseToughness: number | null;
  colors: string[];
  imageUrl: string;
  sourceCards: string[];
}

// Game state

export interface TokenStack {
  id: string;
  tokenId: string; // References DiscoveredToken.scryfallId
  count: number;
  isTapped: boolean;
  permanentCounters: number; // +1/+1 counters
  temporaryCounters: number; // Temporary +1/+1 buffs (cleared on end of turn)
}

export interface ActiveToken {
  tokenId: string; // References DiscoveredToken.scryfallId
  name: string;
  typeLine: string;
  imageUrl: string;
  basePower: number | null;
  baseToughness: number | null;
  stacks: TokenStack[];
}

export interface TokenGameState {
  activeTokens: ActiveToken[];
  updatedAt: number;
}

export interface TokenDeckState {
  deckName: string;
  originalInput: string;
  sourceUrl?: string;
  discoveredTokens: DiscoveredToken[];
  updatedAt: number;
}
