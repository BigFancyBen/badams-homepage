import { Redis } from "@upstash/redis";

// Initialize Redis client
// In production, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Lobby TTL: 4 hours
export const LOBBY_TTL_SECONDS = 4 * 60 * 60;

// Redis key helpers
export function getLobbyKey(code: string): string {
  return `commander:${code.toUpperCase()}`;
}
