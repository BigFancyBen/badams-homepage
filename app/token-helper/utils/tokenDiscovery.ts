import {
  ScryfallRelatedPart,
  ScryfallTokenCard,
  DiscoveredToken,
} from "../types";

/**
 * Extract token-related parts from a Scryfall card's all_parts array.
 */
export function extractTokenParts(
  allParts: ScryfallRelatedPart[] | undefined
): ScryfallRelatedPart[] {
  if (!allParts) return [];
  return allParts.filter((part) => part.component === "token");
}

/**
 * Parse numeric power/toughness, returning null for non-numeric values (e.g., "*").
 */
function parseStatValue(value: string | undefined): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

/**
 * Convert a Scryfall token card API response into a DiscoveredToken.
 */
export function buildDiscoveredToken(
  card: ScryfallTokenCard,
  sourceCards: string[]
): DiscoveredToken {
  const imageUrl =
    card.image_uris?.normal ||
    card.image_uris?.small ||
    "/placeholder-card.svg";

  return {
    scryfallId: card.id,
    name: card.name,
    typeLine: card.type_line,
    oracleText: card.oracle_text,
    basePower: parseStatValue(card.power),
    baseToughness: parseStatValue(card.toughness),
    colors: card.colors,
    imageUrl,
    sourceCards,
  };
}

/**
 * Deduplicate token parts by Scryfall ID, merging source card info.
 * Returns a map of token ID -> { part, sourceCards }.
 */
export function deduplicateTokenParts(
  tokenParts: Array<{ part: ScryfallRelatedPart; sourceCard: string }>
): Map<string, { part: ScryfallRelatedPart; sourceCards: string[] }> {
  const tokenMap = new Map<
    string,
    { part: ScryfallRelatedPart; sourceCards: string[] }
  >();

  for (const { part, sourceCard } of tokenParts) {
    const existing = tokenMap.get(part.id);
    if (existing) {
      if (!existing.sourceCards.includes(sourceCard)) {
        existing.sourceCards.push(sourceCard);
      }
    } else {
      tokenMap.set(part.id, { part, sourceCards: [sourceCard] });
    }
  }

  return tokenMap;
}
