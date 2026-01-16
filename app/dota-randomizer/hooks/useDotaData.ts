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
  // Basic upgrade items to exclude (not interesting for randomizer)
  "magic_wand",
  "bracer",
  "null_talisman",
  "wraith_band",
  "soul_ring",
  "orb_of_corrosion",
  "falcon_blade",
  "perseverance",
  "oblivion_staff",
  "buckler",
  "headdress",
  "ring_of_basilius",
  "soul_booster",
]);

// Non-upgrade items to explicitly include
const ALWAYS_INCLUDE = new Set([
  "aghanims_shard",
  "blink",              // Blink Dagger
  "ghost",              // Ghost Scepter
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

        // Filter for upgraded items that are currently purchasable
        const transformedItems: WheelItem[] = Object.entries(itemsData)
          .filter(([key, item]) => {
            // Basic validation
            if (!item.dname || !item.img) return false;
            if (key.startsWith("recipe_")) return false;
            if (ALWAYS_EXCLUDE.has(key)) return false;

            // Must have a cost > 0 (free items aren't purchasable)
            if (!item.cost || item.cost <= 0) return false;

            // Exclude neutral items (tier > 0 means it's a neutral drop)
            if (item.tier !== undefined && item.tier > 0) return false;

            // Exclude consumables
            if (item.charges) return false;
            if (key === "tpscroll" || key === "smoke_of_deceit" || key === "dust") return false;

            // Always include specific items (Aghanim's Shard, Blink, Ghost Scepter)
            if (ALWAYS_INCLUDE.has(key)) return true;

            // Include all upgraded items (items with components)
            const hasComponents = item.components && item.components.length > 0;
            return hasComponents;
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
