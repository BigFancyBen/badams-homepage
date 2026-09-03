/**
 * The item-key rule, copied verbatim from src/checkins.ts (`itemKey`) so the
 * data pipeline names sprites and drop rows exactly the way the Worker looks
 * them up. Change both together.
 */
export function itemKey(name) {
  if (name === "Amulet of glory (t)") return "glory_t";
  return name.toLowerCase().replace(/[()']/g, "").replace(/[\s-]+/g, "_").replace(/_+/g, "_").replace(/_$/, "");
}
