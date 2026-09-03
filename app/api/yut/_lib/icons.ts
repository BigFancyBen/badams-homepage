import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Literal paths so the file tracer picks each PNG up. Anything not listed
 * here renders as no icon rather than a crash — the Worker may know about a
 * skill before this side has art for it.
 */
const ICON_PATHS: Record<string, string> = {
  attack: "app/api/yut/_assets/icons/attack.png",
  defence: "app/api/yut/_assets/icons/defence.png",
  strength: "app/api/yut/_assets/icons/strength.png",
  hitpoints: "app/api/yut/_assets/icons/hitpoints.png",
  prayer: "app/api/yut/_assets/icons/prayer.png",
  slayer: "app/api/yut/_assets/icons/slayer.png",
  woodcutting: "app/api/yut/_assets/icons/woodcutting.png",
  mining: "app/api/yut/_assets/icons/mining.png",
  fishing: "app/api/yut/_assets/icons/fishing.png",
  levelUpBackground: "app/api/yut/_assets/icons/levelUpBackground.png",
};

const cache = new Map<string, string | null>();

/** `data:image/png;base64,...` for a known icon, or null for an unknown one. */
export function iconDataUrl(name: string): string | null {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;

  const relative = ICON_PATHS[name];
  let url: string | null = null;
  if (relative) {
    try {
      const bytes = readFileSync(join(process.cwd(), relative));
      url = `data:image/png;base64,${bytes.toString("base64")}`;
    } catch {
      url = null;
    }
  }
  cache.set(name, url);
  return url;
}
