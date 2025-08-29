export interface MagicCard {
  id: string;
  name: string;
  mana_cost: string;
  cmc: number; // converted mana cost
  type_line: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  card_faces?: Array<{
    mana_cost: string;
    type_line: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
    };
  }>;
}

export interface ScryfallResponse {
  data: MagicCard[];
  has_more: boolean;
  next_page?: string;
}

export interface CardFilters {
  manaCosts: number[];
  cardTypes: string[];
  typeLogic: 'and' | 'or'; // How to combine multiple card types
  typeSearch: string[]; // Advanced type search (Scryfall-style)
}

export const CARD_TYPES = [
  'Land',
  'Artifact',
  'Enchantment',
  'Creature',
  'Instant',
  'Sorcery',
  'Planeswalker',
  'Battle'
] as const;

export type CardType = typeof CARD_TYPES[number];
