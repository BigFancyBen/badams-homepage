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

// Items to exclude - cosmetics, event items, and confirmed removed items
const ALWAYS_EXCLUDE = new Set([
  // Cosmetic/event items
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
  // Confirmed removed items (no longer in the shop)
  "wraith_pact",           // Removed in 7.33
  "necronomicon",          // Removed in 7.29
  "necronomicon_2",
  "necronomicon_3",
  "ring_of_aquila",        // Removed in 7.20
  "iron_talon",            // Removed
  "poor_mans_shield",      // Removed (now neutral only)
  "helm_of_the_dominator", // Removed in 7.33
  "helm_of_the_dominator_2",
  "vladmir",               // Removed
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

        // Filter for upgraded/final items that are currently purchasable
        const transformedItems: WheelItem[] = Object.entries(itemsData)
          .filter(([key, item]) => {
            // Basic validation
            if (!item.dname || !item.img) return false;
            if (key.startsWith("recipe_")) return false;
            if (ALWAYS_EXCLUDE.has(key)) return false;

            // Must have a cost > 0 (free items aren't purchasable upgrades)
            if (!item.cost || item.cost <= 0) return false;

            // Exclude neutral items (tier > 0 means it's a neutral drop)
            if (item.tier !== undefined && item.tier > 0) return false;

            // Exclude consumables
            if (item.charges) return false;
            if (key === "tpscroll" || key === "smoke_of_deceit" || key === "dust") return false;

            // Must be an upgraded item (has components it's built from)
            const hasComponents = item.components && item.components.length > 0;
            if (!hasComponents) return false;

            // Exclude items that can be upgraded further (unless they're expensive enough to be final-tier worthy)
            const canBeUpgraded = hasUpgrade.has(key);
            if (canBeUpgraded && item.cost < 4000) {
              return false;
            }

            return true;
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
