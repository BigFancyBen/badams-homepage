"use client";

import { useState, useEffect } from "react";
import { WheelItem } from "../types";

interface DotaHeroResponse {
  id: number;
  name: string;
  localized_name: string;
  img: string;
  icon: string;
}

interface DotaItemResponse {
  id: number;
  dname?: string;
  img?: string;
  cost?: number;
  components?: string[] | null;
  recipe?: number;
  created?: boolean;
  charges?: number | boolean;
  tier?: number;
}

// Minimal exclusion list for things the API doesn't clearly mark
const ALWAYS_EXCLUDE = new Set([
  "river_painter",
  "river_painter2",
  "river_painter3",
  "river_painter4",
  "river_painter5",
  "river_painter6",
  "river_painter7",
  "mystery_hook",
  "mystery_arrow",
  "mystery_missile",
  "mystery_toss",
  "mystery_vacuum",
]);

export function useDotaData() {
  const [heroes, setHeroes] = useState<WheelItem[]>([]);
  const [items, setItems] = useState<WheelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch heroes and items in parallel
        const [heroesResponse, itemsResponse] = await Promise.all([
          fetch("https://api.opendota.com/api/heroes"),
          fetch("https://api.opendota.com/api/constants/items"),
        ]);

        if (!heroesResponse.ok || !itemsResponse.ok) {
          throw new Error("Failed to fetch Dota 2 data");
        }

        const heroesData: DotaHeroResponse[] = await heroesResponse.json();
        const itemsData: Record<string, DotaItemResponse> =
          await itemsResponse.json();

        // Transform heroes - use Steam CDN
        const transformedHeroes: WheelItem[] = heroesData.map((hero) => {
          const heroKey = hero.name.replace("npc_dota_hero_", "");
          return {
            id: hero.id,
            name: heroKey,
            displayName: hero.localized_name,
            imageUrl: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroKey}.png`,
          };
        });

        // Build a set of all items that are used as components
        const componentItems = new Set<string>();
        Object.values(itemsData).forEach((item) => {
          if (item.components && Array.isArray(item.components)) {
            item.components.forEach((comp) => componentItems.add(comp));
          }
        });

        // Build set of items that have upgrades
        const hasUpgrade = new Set<string>();
        Object.values(itemsData).forEach((item) => {
          if (item.components && Array.isArray(item.components)) {
            item.components.forEach((comp) => {
              const compItem = itemsData[comp];
              if (compItem?.components && compItem.components.length > 0) {
                hasUpgrade.add(comp);
              }
            });
          }
        });

        // Filter for upgraded/final items
        const transformedItems: WheelItem[] = Object.entries(itemsData)
          .filter(([key, item]) => {
            if (!item.dname || !item.img) return false;
            if (key.startsWith("recipe_")) return false;
            if (ALWAYS_EXCLUDE.has(key)) return false;
            if (item.tier !== undefined && item.tier > 0) return false;
            if (item.charges) return false;
            if (key === "tpscroll") return false;

            const hasComponents = item.components && item.components.length > 0;
            const isExpensive = (item.cost || 0) >= 2000;
            const isPurchasable = item.created === true;
            const isBasicComponent = componentItems.has(key) && !hasComponents;
            const canBeUpgraded = hasUpgrade.has(key);

            if (hasComponents) {
              if (canBeUpgraded && (item.cost || 0) < 3000) {
                return false;
              }
              return true;
            }

            if (isPurchasable && isExpensive && !isBasicComponent) {
              return true;
            }

            return false;
          })
          .map(([key, item]) => ({
            id: item.id,
            name: key,
            displayName: item.dname || key,
            imageUrl: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${key}.png`,
          }));

        setHeroes(transformedHeroes);
        setItems(transformedItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { heroes, items, loading, error };
}
