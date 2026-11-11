import {
  DOTA_RANDOMIZER,
  FLOATWISE,
  HOBBIT_HOUSE,
  IRLSCAPE,
  MFRS,
  MFRS_LINKS,
  MTG_GROUP,
  OATHKEEP,
  PROGNOSTICATOR_CARD,
  PROGNOSTICATOR_SCREENSHOTS,
  SCRANBOT,
  SCRANDLE,
  SCENES,
  SUMMARIES,
  TESTQ,
  TESTQ_LINK,
  VISUALIZER_SCENES,
  WAREHOUSE_SCENE,
  YUT_HUT,
} from "../homepage/projects";

/**
 * What the museum's details panel shows for each exhibit. Every string comes from the objects the
 * homepage grid renders (homepage/projects.ts); nothing is written here. Keyed by exhibit id.
 */
export interface DetailLink {
  label: string;
  href: string;
}

export interface DetailFeature {
  label: string;
  text: string;
}

/** A sub-block under the project, for what the grid shows as a group (apps, scenes, slides). */
export interface DetailSection {
  heading: string;
  text: string[];
  features?: DetailFeature[];
  tags?: string[];
  links?: DetailLink[];
}

export interface ProjectDetail {
  /** The title the homepage shows. */
  title: string;
  kicker?: string;
  tagline?: string;
  description: string[];
  features: DetailFeature[];
  tags: string[];
  links: DetailLink[];
  sections: DetailSection[];
}

const CARD_LINK = "View project \u2192";
const GITHUB_LINK = "View on GitHub";
const YOUTUBE_LINK = "Watch on YouTube";

function detail(d: Partial<ProjectDetail> & { title: string }): ProjectDetail {
  return { description: [], features: [], tags: [], links: [], sections: [], ...d };
}

export const PROJECT_DETAILS: Record<string, ProjectDetail> = {
  mfrs: detail({
    title: MFRS.title,
    kicker: MFRS.kicker,
    tagline: MFRS.tagline,
    description: [MFRS.description],
    features: MFRS.features,
    tags: MFRS.tags,
    links: [
      { label: `${MFRS_LINKS.river.label} \u2192`, href: MFRS_LINKS.river.href },
      MFRS_LINKS.itch,
    ],
  }),
  oathkeep: detail({
    title: OATHKEEP.title,
    kicker: OATHKEEP.kicker,
    tagline: OATHKEEP.tagline,
    description: [OATHKEEP.description],
    features: OATHKEEP.features,
    tags: OATHKEEP.tags,
  }),
  /* The grid's card shows one slide's label and text at a time; the panel lists them all. */
  prognosticator: detail({
    title: PROGNOSTICATOR_CARD.title,
    tags: PROGNOSTICATOR_CARD.tags,
    sections: PROGNOSTICATOR_SCREENSHOTS.map((s) => ({ heading: s.label, text: [s.description] })),
  }),
  /* The grid's visualizer group: its heading and intro, then the other scenes. */
  warehouse: detail({
    title: WAREHOUSE_SCENE.title,
    description: [WAREHOUSE_SCENE.description],
    tags: WAREHOUSE_SCENE.tags,
    sections: [
      { heading: VISUALIZER_SCENES.title, text: [VISUALIZER_SCENES.description] },
      ...SCENES.filter((scene) => scene !== WAREHOUSE_SCENE).map((scene) => ({ heading: scene.title, text: [scene.description], tags: scene.tags })),
    ],
  }),
  "hobbit-house": detail({
    title: HOBBIT_HOUSE.title,
    description: [SUMMARIES.hobbitHouse],
    tags: HOBBIT_HOUSE.tags,
    links: [{ label: GITHUB_LINK, href: HOBBIT_HOUSE.href }],
  }),
  testq: detail({
    title: TESTQ.title,
    tagline: TESTQ.tagline,
    description: [TESTQ.description],
    features: TESTQ.features,
    tags: TESTQ.tags,
    links: [{ label: `${TESTQ_LINK.label} \u2192`, href: TESTQ_LINK.href }],
  }),
  scrandle: detail({
    title: SCRANDLE.title,
    description: [SUMMARIES.scrandle],
    tags: SCRANDLE.tags,
    links: [{ label: CARD_LINK, href: SCRANDLE.href }],
    sections: [{ heading: SCRANBOT.title, text: [SUMMARIES.scranbot], tags: SCRANBOT.tags }],
  }),
  "yut-hut": detail({
    title: YUT_HUT.title,
    description: [SUMMARIES.yutHut],
    features: YUT_HUT.features,
    tags: YUT_HUT.tags,
    links: [{ label: `${YUT_HUT.rulesLink.label} \u2192`, href: YUT_HUT.rulesLink.href }],
  }),
  magic: detail({
    title: MTG_GROUP.title,
    tagline: MTG_GROUP.tagline,
    tags: MTG_GROUP.tags,
    sections: MTG_GROUP.apps.map((app) => ({
      heading: app.title,
      text: [app.description],
      links: [{ label: CARD_LINK, href: app.href }],
    })),
  }),
  floatwise: detail({
    title: FLOATWISE.title,
    description: [SUMMARIES.floatwise],
    tags: FLOATWISE.tags,
    links: [{ label: CARD_LINK, href: FLOATWISE.href }],
  }),
  "dota-randomizer": detail({
    title: DOTA_RANDOMIZER.title,
    description: [SUMMARIES.dotaRandomizer],
    tags: DOTA_RANDOMIZER.tags,
    links: [{ label: CARD_LINK, href: DOTA_RANDOMIZER.href }],
  }),
  irlscape: detail({
    title: IRLSCAPE.title,
    description: [SUMMARIES.irlscape],
    links: [{ label: YOUTUBE_LINK, href: IRLSCAPE.href }],
  }),
  /* No card on the homepage: its title, and the link the old homepage carried. */
  resume: detail({
    title: "R\u00e9sum\u00e9",
    links: [{ label: "Resume", href: "/resume" }],
  }),
};
