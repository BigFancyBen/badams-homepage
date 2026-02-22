import { ParsedDecklist } from "./decklistParser";

export function isArchidektUrl(input: string): boolean {
  return /archidekt\.com\/decks\/\d+/i.test(input.trim());
}

export interface ArchidektProxyResponse {
  name: string;
  cards: Array<{ quantity: number; name: string }>;
}

export async function fetchArchidektDeck(
  url: string
): Promise<{ name: string; decklist: ParsedDecklist; originalInput: string }> {
  const response = await fetch(
    `/api/archidekt?url=${encodeURIComponent(url)}`
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error || `Failed to import deck (status ${response.status})`
    );
  }

  const data = (await response.json()) as ArchidektProxyResponse;

  if (!data.cards || data.cards.length === 0) {
    throw new Error("Deck has no cards");
  }

  // Build a plain-text decklist string for originalInput storage
  const originalInput = data.cards
    .map((c) => `${c.quantity} ${c.name}`)
    .join("\n");

  const decklist: ParsedDecklist = {
    cards: data.cards.map((c) => ({
      quantity: c.quantity,
      name: c.name,
    })),
    errors: [],
    totalCards: data.cards.reduce((sum, c) => sum + c.quantity, 0),
  };

  return {
    name: data.name,
    decklist,
    originalInput,
  };
}
