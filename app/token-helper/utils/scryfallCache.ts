import { ScryfallRelatedPart, ScryfallTokenCard } from "../types";

const CARD_CACHE_KEY = "token-helper-card-cache";
const TOKEN_CACHE_KEY = "token-helper-token-cache";
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedCardEntry {
  name: string;
  tokenParts: ScryfallRelatedPart[];
  cachedAt: number;
}

interface CachedTokenEntry {
  token: ScryfallTokenCard;
  cachedAt: number;
}

// Simple hash function — copied from tutor-helper's useLocalStorageCache.ts
function createCacheKey(cardName: string): string {
  const normalizedName = cardName.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    const char = normalizedName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `card_${Math.abs(hash).toString(36)}_${normalizedName.length}`;
}

function loadCache<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache<T>(key: string, cache: Record<string, T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

// --- Card-level cache (Phase 1) ---

export function loadCachedCardParts(
  cardNames: string[]
): { cached: Map<string, { name: string; parts: ScryfallRelatedPart[] }>; missing: string[] } {
  const cache = loadCache<CachedCardEntry>(CARD_CACHE_KEY);
  const now = Date.now();
  const cached = new Map<string, { name: string; parts: ScryfallRelatedPart[] }>();
  const missing: string[] = [];

  for (const cardName of cardNames) {
    const key = createCacheKey(cardName);
    const entry = cache[key];

    if (entry && now - entry.cachedAt < CACHE_EXPIRY) {
      cached.set(cardName, { name: entry.name, parts: entry.tokenParts });
    } else {
      missing.push(cardName);
    }
  }

  return { cached, missing };
}

export function saveCachedCardParts(
  results: { searchTerm: string; cardName: string; parts: ScryfallRelatedPart[] }[]
): void {
  const cache = loadCache<CachedCardEntry>(CARD_CACHE_KEY);

  for (const { searchTerm, cardName, parts } of results) {
    const key = createCacheKey(searchTerm);
    cache[key] = { name: cardName, tokenParts: parts, cachedAt: Date.now() };
  }

  saveCache(CARD_CACHE_KEY, cache);
}

// --- Token-level cache (Phase 2) ---

export function loadCachedTokenCards(
  tokenIds: string[]
): { cached: Map<string, ScryfallTokenCard>; missing: string[] } {
  const cache = loadCache<CachedTokenEntry>(TOKEN_CACHE_KEY);
  const now = Date.now();
  const cached = new Map<string, ScryfallTokenCard>();
  const missing: string[] = [];

  for (const id of tokenIds) {
    const entry = cache[id];

    if (entry && now - entry.cachedAt < CACHE_EXPIRY) {
      cached.set(id, entry.token);
    } else {
      missing.push(id);
    }
  }

  return { cached, missing };
}

export function saveCachedTokenCards(
  tokens: { id: string; card: ScryfallTokenCard }[]
): void {
  const cache = loadCache<CachedTokenEntry>(TOKEN_CACHE_KEY);

  for (const { id, card } of tokens) {
    cache[id] = { token: card, cachedAt: Date.now() };
  }

  saveCache(TOKEN_CACHE_KEY, cache);
}

// --- Cleanup ---

export function cleanupExpiredEntries(): void {
  const now = Date.now();

  // Clean card cache
  const cardCache = loadCache<CachedCardEntry>(CARD_CACHE_KEY);
  const cleanedCards: Record<string, CachedCardEntry> = {};
  for (const [key, entry] of Object.entries(cardCache)) {
    if (now - entry.cachedAt < CACHE_EXPIRY) {
      cleanedCards[key] = entry;
    }
  }
  saveCache(CARD_CACHE_KEY, cleanedCards);

  // Clean token cache
  const tokenCache = loadCache<CachedTokenEntry>(TOKEN_CACHE_KEY);
  const cleanedTokens: Record<string, CachedTokenEntry> = {};
  for (const [key, entry] of Object.entries(tokenCache)) {
    if (now - entry.cachedAt < CACHE_EXPIRY) {
      cleanedTokens[key] = entry;
    }
  }
  saveCache(TOKEN_CACHE_KEY, cleanedTokens);
}
