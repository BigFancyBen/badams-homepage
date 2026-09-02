import Anthropic from "@anthropic-ai/sdk";
import { dishUrl } from "./images";
import { KIND_NAMES, kindPromptLines } from "./kinds";
import type { Dish, Env } from "./types";

/**
 * Classification runs as its own pass rather than inline with ingest: a vision
 * call per image would push ingest past the 50-subrequest ceiling, and the
 * thousand dishes already in the catalog need classifying anyway.
 *
 * Two subrequests per dish (the API call, then a batched write), so twenty per
 * invocation leaves plenty of headroom. Like the backfill, this keeps no
 * cursor of its own — it simply asks for the next unclassified batch, so
 * calling it repeatedly drains the catalog.
 *
 * "Unclassified" is two things now. A photograph with no category cannot play
 * at all and is the urgent case; a dish or drink with a category but no kind
 * plays fine and only misses the themed rounds. Both are pending work and the
 * first sorts ahead of the second, so a night's new photographs are never
 * stuck behind a thousand-dish backfill of kinds.
 */
const MAX_PER_RUN = 20;
/** Six simultaneous outgoing connections. */
const BATCH_SIZE = 5;
/**
 * Some images can never be classified — a panorama past the vision API's
 * dimension limit fails identically every time. Give up after this many tries
 * so one bad photo does not burn an API call every hour forever.
 */
const MAX_ATTEMPTS = 3;

const SYSTEM = `You label photographs from a private Discord channel where friends post what they cook and eat. Plenty of the photos are not food at all — people post each other, their pets, receipts, menus, screenshots — and those need labelling honestly rather than forced into a food category.

category — one of:
  food        a prepared, edible dish is the subject, whether or not a drink shares the frame. A cocktail beside a plate of fries is food.
  drink       exclusively drinks, with no solid food as a subject.
  ingredient  raw or unprepared components — groceries, a shopping haul, produce on a counter, meat before cooking.
  person      one or more people are the subject.
  pet         an animal is the subject.
  place       a room, building, view, or landscape is the subject, with no dish in the foreground.
  document    a receipt, menu, label, handwritten recipe, or packaging photographed for its text.
  screenshot  a capture of a phone or computer screen, including memes and text posts.
  other       anything that fits none of the above — an empty plate, a gadget, a plant.

When a dish shares the frame with something else, ask what the photo is *of*. A plate on a restaurant table is food. A wide shot of the restaurant with a plate on a far table is place. A person holding a burger up to the camera is food if the burger fills the frame, person if the photo is of them.

name — a short, specific, faintly deadpan label for what is pictured, in the register of a museum caption written by someone amused. Three to six words. Name what is actually visible, including the setting when it is doing comedic work: "poolside meat in a bag", "pretzel with radish situation", "lone tart, plastic coffin". Do not invent restaurant names, do not guess cuisine you cannot see, and do not editorialise about quality. If the subject is genuinely unidentifiable, say so plainly: "unidentifiable brown mass".

kind — what the dish or drink actually *is*, one level below the category. It is what the weekly themed round groups on: five pastas is an argument worth having, five unrelated plates is not. Only food and drink have kinds; everything else is "other".

${kindPromptLines()}

Pick the one a person would use to describe the photo in a word. When two fit, take the more specific — a bowl of ramen is noodles rather than soup, a steak sandwich is a sandwich rather than steak. When nothing fits, "other" is the honest answer and a better one than forcing it.`;

const TOOL: Anthropic.Tool = {
  name: "label_dish",
  description: "Record the category, kind and name for the pictured dish.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: [
          "food",
          "drink",
          "ingredient",
          "person",
          "pet",
          "place",
          "document",
          "screenshot",
          "other",
        ],
      },
      kind: {
        type: "string",
        enum: KIND_NAMES,
        description:
          "What the dish or drink is, one level finer than the category. " +
          "\"other\" for anything that is not food or drink.",
      },
      name: {
        type: "string",
        description: "Three to six words naming what is pictured.",
      },
    },
    required: ["category", "kind", "name"],
    additionalProperties: false,
  },
};

export interface ClassifyReport {
  attempted: number;
  labelled: number;
  failed: number;
  remaining: number;
  /** Gave up on these — they failed MAX_ATTEMPTS times. */
  abandoned: number;
  samples: { id: number; category: string; kind: string; name: string }[];
}

interface Label {
  id: number;
  category: string;
  kind: string;
  name: string;
}

/**
 * Anything still missing a label, at either depth. Written once and used by
 * the pending query, the remaining count and the abandoned count, so those
 * three can never disagree about what counts as work — which is exactly how a
 * drain loop ends up spinning forever on rows it will not pick up.
 */
const NEEDS_LABEL =
  "(category IS NULL OR (category IN ('food','drink') AND kind IS NULL))";

async function abandonedCount(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM dishes WHERE ${NEEDS_LABEL} AND classify_attempts >= ?`
  )
    .bind(MAX_ATTEMPTS)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

async function labelOne(
  client: Anthropic,
  env: Env,
  dish: Dish
): Promise<Label | null> {
  const response = await client.messages.create({
    // Haiku 4.5 by request. It predates adaptive thinking and effort, so
    // neither parameter belongs here — both would be rejected.
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "label_dish" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: dishUrl(env, dish) },
          },
          {
            type: "text",
            text: "Label this dish.",
          },
        ],
      },
    ],
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "label_dish") {
      // Strict mode validates the shape, but the input still arrives as
      // unknown — parse rather than trust.
      const input = block.input as {
        category?: string;
        kind?: string;
        name?: string;
      };
      if (!input.category || !input.kind || !input.name) return null;
      return {
        id: dish.id,
        category: input.category,
        kind: input.kind,
        name: input.name.slice(0, 120),
      };
    }
  }

  return null;
}

export async function classify(
  env: Env,
  limit = MAX_PER_RUN
): Promise<ClassifyReport> {
  const report: ClassifyReport = {
    attempted: 0,
    labelled: 0,
    failed: 0,
    remaining: 0,
    abandoned: 0,
    samples: [],
  };

  const capped = Math.min(limit, MAX_PER_RUN);
  const pending = await env.DB.prepare(
    `SELECT * FROM dishes WHERE ${NEEDS_LABEL} AND classify_attempts < ? ` +
      // Photographs that cannot play at all come first. A dish waiting only
      // for its kind is already in every matchup it could be in.
      "ORDER BY (category IS NULL) DESC, id LIMIT ?"
  )
    .bind(MAX_ATTEMPTS, capped)
    .all<Dish>();

  const dishes = pending.results ?? [];
  report.attempted = dishes.length;
  if (dishes.length === 0) return report;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const labels: Label[] = [];
  const failures: number[] = [];

  for (let i = 0; i < dishes.length; i += BATCH_SIZE) {
    const batch = dishes.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((dish) =>
        labelOne(client, env, dish).catch(() => null)
      )
    );
    for (let j = 0; j < results.length; j++) {
      const label = results[j];
      if (label) labels.push(label);
      else {
        failures.push(batch[j].id);
        report.failed++;
      }
    }
  }

  if (labels.length > 0) {
    await env.DB.batch(
      labels.map((label) =>
        env.DB.prepare(
          // COALESCE rather than a straight assignment: most of these rows are
          // here for the kind alone and already carry a category and a name
          // the channel has seen. Overwriting those would quietly re-label a
          // photograph mid-rotation — and a category change under an open
          // matchup is a pair that no longer shares one.
          "UPDATE dishes SET category = COALESCE(category, ?), " +
            "name = COALESCE(name, ?), kind = ? WHERE id = ?"
        ).bind(label.category, label.name, label.kind, label.id)
      )
    );
    report.labelled = labels.length;
    report.samples = labels.slice(0, 5);
  }

  if (failures.length > 0) {
    await env.DB.batch(
      failures.map((id) =>
        env.DB.prepare(
          "UPDATE dishes SET classify_attempts = classify_attempts + 1 WHERE id = ?"
        ).bind(id)
      )
    );
  }

  // "Remaining" means still worth trying — dishes that exhausted their
  // attempts are done, not pending, or the caller loops forever.
  const left = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM dishes WHERE ${NEEDS_LABEL} AND classify_attempts < ?`
  )
    .bind(MAX_ATTEMPTS)
    .first<{ n: number }>();
  report.remaining = left?.n ?? 0;
  report.abandoned = await abandonedCount(env);

  return report;
}
