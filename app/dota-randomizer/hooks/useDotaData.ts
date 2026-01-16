"use client";

import { useState, useEffect } from "react";
import { WheelItem } from "../types";

interface DotaHeroResponse {
  id: number;
  name: string;
  localized_name: string;
}

interface DotaItemResponse {
  id: number;
  dname?: string;
  img?: string;
  cost?: number;
  components?: string[] | null;
  recipe?: number;
  created?: boolean;
}

// Items that should be excluded (consumables, basic components, etc.)
const EXCLUDED_ITEMS = new Set([
  // Consumables
  "tango",
  "tango_single",
  "flask",
  "clarity",
  "enchanted_mango",
  "faerie_fire",
  "ward_observer",
  "ward_sentry",
  "smoke_of_deceit",
  "tome_of_knowledge",
  "dust",
  "bottle",
  "aghanims_shard",
  "cheese",
  "refresher_shard",
  // TP and neutral token
  "tpscroll",
  "neutral_slot",
  // Basic components
  "branches",
  "ring_of_protection",
  "quelling_blade",
  "gauntlets",
  "slippers",
  "mantle",
  "circlet",
  "belt_of_strength",
  "boots_of_elves",
  "robe",
  "ogre_axe",
  "blade_of_alacrity",
  "staff_of_wizardry",
  "ring_of_regen",
  "sobi_mask",
  "gloves",
  "blades_of_attack",
  "chainmail",
  "quarterstaff",
  "helm_of_iron_will",
  "broadsword",
  "claymore",
  "javelin",
  "mithril_hammer",
  "platemail",
  "hyperstone",
  "ultimate_orb",
  "demon_edge",
  "mystic_staff",
  "reaver",
  "eaglesong",
  "relic",
  "ring_of_health",
  "void_stone",
  "energy_booster",
  "vitality_booster",
  "point_booster",
  "cloak",
  "talisman_of_evasion",
  "shadow_amulet",
  "ghost",
  "blight_stone",
  "gem",
  "orb_of_venom",
  "orb_of_corrosion",
  "wind_lace",
  "crown",
  "fluffy_hat",
  "voodoo_mask",
  "infused_raindrop",
  "blitz_knuckles",
  "diadem",
  "blood_grenade",
  "cornucopia",
  // Recipes
  "recipe_",
]);

// Non-upgradeable items (standalone items that don't build into anything else)
const STANDALONE_ITEMS = new Set([
  "blink",
  "boots_of_bearing",
  "guardian_greaves",
  "overwhelming_blink",
  "swift_blink",
  "arcane_blink",
  "travel_boots",
  "travel_boots_2",
  "phase_boots",
  "power_treads",
  "arcane_boots",
  "tranquil_boots",
  "octarine_core",
  "refresher",
  "black_king_bar",
  "sphere",
  "lotus_orb",
  "aeon_disk",
  "wind_waker",
  "bloodstone",
  "heart",
  "shivas_guard",
  "assault",
  "butterfly",
  "skadi",
  "satanic",
  "rapier",
  "abyssal_blade",
  "bloodthorn",
  "sheepstick",
  "monkey_king_bar",
  "daedalus",
  "greater_crit",
  "nullifier",
  "radiance",
  "mjollnir",
  "manta",
  "sange_and_yasha",
  "kaya_and_sange",
  "yasha_and_kaya",
  "silver_edge",
  "ethereal_blade",
  "hurricane_pike",
  "harpoon",
  "diffusal_blade",
  "desolator",
  "aghanims_scepter",
  "rod_of_atos",
  "gleipnir",
  "euls",
  "force_staff",
  "dagon",
  "dagon_2",
  "dagon_3",
  "dagon_4",
  "dagon_5",
  "necronomicon",
  "necronomicon_2",
  "necronomicon_3",
  "hand_of_midas",
  "solar_crest",
  "heavens_halberd",
  "crimson_guard",
  "pipe",
  "mekansm",
  "holy_locket",
  "spirit_vessel",
  "vanguard",
  "blade_mail",
  "hood_of_defiance",
  "eternal_shroud",
  "aether_lens",
  "veil_of_discord",
  "maelstrom",
  "armlet",
  "meteor_hammer",
  "mask_of_madness",
  "helm_of_the_overlord",
  "helm_of_the_dominator",
  "dragon_lance",
  "echo_sabre",
  "shadow_blade",
  "orchid",
  "crystalys",
  "medallion_of_courage",
  "drum_of_endurance",
  "vladmir",
  "buckler",
  "headdress",
  "wraith_band",
  "null_talisman",
  "bracer",
  "soul_ring",
  "magic_wand",
  "urn_of_shadows",
  "falcon_blade",
  "witch_blade",
  "phylactery",
  "pavise",
  "bloodthorn",
  "devastator",
  "disperser",
  "khanda",
  "parasma",
  "revenant_brooch",
  "angels_demise",
  "trident",
  "force_boots",
  "fallen_sky",
  "ex_machina",
  "mirror_shield",
  "apex",
  "pirate_hat",
  "giants_ring",
  "desolator_2",
  "seer_stone",
  "book_of_shadows",
  "recipe",
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

        // Transform heroes
        const transformedHeroes: WheelItem[] = heroesData.map((hero) => {
          // Convert name like "npc_dota_hero_antimage" to "antimage"
          const heroKey = hero.name.replace("npc_dota_hero_", "");
          return {
            id: hero.id,
            name: heroKey,
            displayName: hero.localized_name,
            imageUrl: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroKey}.png`,
          };
        });

        // Transform items - only include upgraded/standalone items
        const transformedItems: WheelItem[] = Object.entries(itemsData)
          .filter(([key, item]) => {
            // Skip if no display name or image
            if (!item.dname || !item.img) return false;

            // Skip recipes
            if (key.startsWith("recipe_")) return false;

            // Skip excluded items (consumables and basic components)
            if (EXCLUDED_ITEMS.has(key)) return false;

            // Include if it's a standalone item or has components (upgraded item)
            const hasComponents =
              item.components && item.components.length > 0;
            const isStandalone = STANDALONE_ITEMS.has(key);
            const isCreated = item.created === true;

            return hasComponents || isStandalone || isCreated;
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
