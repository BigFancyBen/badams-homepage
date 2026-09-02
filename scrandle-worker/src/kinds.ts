/**
 * What a photograph is *of*, one level below the category.
 *
 * `category` answers whether a photo can play at all and against what — food
 * with food, drink with drink. That is enough for a pair, where the question
 * is only "which of these two", but it is not enough for a themed five. A card
 * holding a lasagne, a smoothie-bowl breakfast, a steak, a bag of chips and a
 * cheeseboard asks people to rank five things that are not comparable, and the
 * answer they give is mostly which meal they would rather be eating.
 *
 * A kind is the fix. Five pastas is a real argument; so is five steaks, or
 * five beers. It is the classifier that assigns one, in the same pass and the
 * same call that assigns the category, so the two can never disagree about
 * what a photograph is.
 *
 * The list is closed and deliberately coarse. A free-text kind fragments on
 * contact with a channel — "pasta", "spaghetti", "pasta bake" and "carbonara"
 * are four groups of one, and a themed round needs three of something. Coarse
 * buckets that a hundred photographs actually fall into beat precise ones that
 * nothing shares.
 */

export interface KindSpec {
  /** Stored in `dishes.kind`, and what the draw groups on. */
  name: string;
  /** The category it sits under. A kind never spans both. */
  category: "food" | "drink";
  /** How a round of them is announced: "rank **the pasta**". */
  label: string;
  /** The line the classifier reads when choosing between kinds. */
  hint: string;
}

/**
 * The bucket for everything else — a one-off, or a plate that is genuinely
 * several dishes. Stored like any other kind so "labelled, and it is nothing
 * in particular" is distinguishable from "not labelled yet", but never themed
 * on: a round of five unrelated plates is the card this whole file exists to
 * avoid.
 */
export const OTHER_KIND = "other";

export const KINDS: KindSpec[] = [
  // ── food ─────────────────────────────────────────────────────────
  {
    name: "pasta",
    category: "food",
    label: "the pasta",
    hint: "Italian-style pasta in any form — a bowl of it, lasagne, mac and cheese, ravioli",
  },
  {
    name: "pizza",
    category: "food",
    label: "the pizzas",
    hint: "pizza, whole or by the slice, and flatbreads dressed like one",
  },
  {
    name: "burger",
    category: "food",
    label: "the burgers",
    hint: "a patty in a bun",
  },
  {
    name: "sandwich",
    category: "food",
    label: "the sandwiches",
    hint: "sandwiches, subs, wraps, toasties, bagels — anything held together by bread that is not a burger",
  },
  {
    name: "steak",
    category: "food",
    label: "the steaks",
    hint: "a cut of red meat cooked and served whole — steak, chops, a sliced joint on a board",
  },
  {
    name: "roast",
    category: "food",
    label: "the roasts",
    hint: "a roast dinner, or a whole roasted bird or joint before it is carved",
  },
  {
    name: "bbq",
    category: "food",
    label: "the barbecue",
    hint: "smoked or grilled over fire — ribs, brisket, skewers, a loaded grill",
  },
  {
    name: "chicken",
    category: "food",
    label: "the chicken",
    hint: "chicken as the subject and not already covered — fried, wings, schnitzel, a plate of pieces",
  },
  {
    name: "seafood",
    category: "food",
    label: "the seafood",
    hint: "fish and shellfish — a fillet, prawns, mussels, fish and chips",
  },
  {
    name: "sushi",
    category: "food",
    label: "the sushi",
    hint: "sushi, sashimi, poke",
  },
  {
    name: "curry",
    category: "food",
    label: "the curries",
    hint: "a spiced sauce served with rice or bread — curry, dal, tagine, stew of that shape",
  },
  {
    name: "noodles",
    category: "food",
    label: "the noodles",
    hint: "Asian noodles and noodle soups — ramen, pho, stir-fried noodles",
  },
  {
    name: "rice",
    category: "food",
    label: "the rice",
    hint: "rice as the dish rather than the side — fried rice, risotto, paella, a rice bowl",
  },
  {
    name: "tacos",
    category: "food",
    label: "the tacos",
    hint: "tacos, burritos, quesadillas, nachos",
  },
  {
    name: "soup",
    category: "food",
    label: "the soups",
    hint: "soups and stews eaten from a bowl that are not curries or noodle soups",
  },
  {
    name: "salad",
    category: "food",
    label: "the salads",
    hint: "a salad as the dish",
  },
  {
    name: "breakfast",
    category: "food",
    label: "the breakfasts",
    hint: "plainly a breakfast — eggs, pancakes, a fry-up, granola",
  },
  {
    name: "dessert",
    category: "food",
    label: "the desserts",
    hint: "sweet and at the end — cake, ice cream, pudding, pastries eaten as a treat",
  },
  {
    name: "baking",
    category: "food",
    label: "the baking",
    hint: "bread and savoury pastry out of an oven — loaves, pies, sausage rolls",
  },
  {
    name: "cheese",
    category: "food",
    label: "the cheeseboards",
    hint: "a cheeseboard or charcuterie spread",
  },
  {
    name: "snacks",
    category: "food",
    label: "the snacks",
    hint: "fries, crisps, dips, bar snacks, a plate of small things to share",
  },

  // ── drink ────────────────────────────────────────────────────────
  {
    name: "beer",
    category: "drink",
    label: "the beers",
    hint: "beer and cider, in a glass or the can it came from",
  },
  {
    name: "wine",
    category: "drink",
    label: "the wine",
    hint: "wine of any colour, in a glass or a bottle",
  },
  {
    name: "cocktail",
    category: "drink",
    label: "the cocktails",
    hint: "a mixed drink, garnished or otherwise built",
  },
  {
    name: "spirits",
    category: "drink",
    label: "the spirits",
    hint: "spirits neat or on ice — whisky, tequila, a shot",
  },
  {
    name: "coffee",
    category: "drink",
    label: "the coffees",
    hint: "coffee, hot or iced",
  },
  {
    name: "tea",
    category: "drink",
    label: "the tea",
    hint: "tea and infusions, hot or iced",
  },
  {
    name: "soft",
    category: "drink",
    label: "the soft drinks",
    hint: "soft drinks — soda, juice, water, smoothies, milkshakes",
  },
];

/** Every value `dishes.kind` may hold, `other` included. The classifier's enum. */
export const KIND_NAMES: string[] = [...KINDS.map((k) => k.name), OTHER_KIND];

const LABELS = new Map(KINDS.map((kind) => [kind.name, kind.label]));

/**
 * How a round of one kind is announced. Falls back to naming nothing in
 * particular, which is what an untuned or retired kind should read as rather
 * than the raw column value.
 */
export function kindLabel(kind: string | null, fallback: string): string {
  if (!kind) return fallback;
  return LABELS.get(kind) ?? fallback;
}

/** The kind list as the classifier reads it, two spaces in and aligned. */
export function kindPromptLines(): string {
  const width = Math.max(...KIND_NAMES.map((name) => name.length));
  const lines = KINDS.map(
    (kind) => `  ${kind.name.padEnd(width)}  ${kind.hint}`
  );
  lines.push(
    `  ${OTHER_KIND.padEnd(width)}  ` +
      "the photo is not food or drink at all, or it is food or drink that fits none of the above"
  );
  return lines.join("\n");
}
