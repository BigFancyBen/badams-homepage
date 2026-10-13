import type { Metadata } from "next";

/** The facts every page's metadata, the sitemap and /llms.txt agree on. */

export const SITE_URL = "https://benadams.dev";
export const SITE_NAME = "benadams.dev";
export const SITE_DESCRIPTION =
  "Side projects by Ben Adams: a multiplayer rafting game built in Godot, a DJ lighting and visualizer rig, Discord bots, and tools for Magic: The Gathering and Dota 2.";

export const AUTHOR = {
  name: "Ben Adams",
  url: SITE_URL,
  sameAs: ["https://github.com/BigFancyBen", "https://bigfancyben.itch.io"],
};

interface OgImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export const DEFAULT_OG_IMAGE: OgImage = {
  url: "/og-homepage.jpg",
  width: 1200,
  height: 630,
  alt: "Otters in silly hats paddling a raft in Middle Fork Rafting Simulator, beside a wall of blue lasers from the Prognosticator visualizer and Mario under stage lights in its Super Mario 64 scene",
};

/**
 * The pages a search engine or an agent is pointed at. A page that is
 * `noindex` (the Yut Hut rules, the Scrandle game, the /river legal pages and
 * join links) is deliberately absent: the sitemap and /llms.txt are built from
 * this list, and neither should advertise what the page itself asks not to be
 * indexed.
 */
export const INDEXED_PAGES = [
  {
    path: "/",
    title: "benadams.dev",
    description: SITE_DESCRIPTION,
  },
  {
    path: "/river",
    title: "Middle Fork Rafting Simulator",
    description:
      "Multiplayer whitewater. You and your friends crew one boat down a procedurally generated river canyon, carrying a job's cargo to the take-out.",
  },
  {
    path: "/commander",
    title: "MTG Commander Life Tracker",
    description:
      "Track life, commander damage, and poison counters for Magic: The Gathering Commander games. Four-player quadrant layout that keeps the game state between visits.",
  },
  {
    path: "/tutor-helper",
    title: "Magic Tutor Helper",
    description:
      "Import a Magic: The Gathering decklist from Archidekt and filter it by mana cost and card type, with Scryfall card images.",
  },
  {
    path: "/token-helper",
    title: "MTG Token Helper",
    description:
      "Import a Magic: The Gathering deck, find every token it can make, and track them on the battlefield with tap/untap, counters, and buffs.",
  },
  {
    path: "/floatwise",
    title: "FloatWise",
    description:
      "Float trip planner. Hourly temperature, wind and precipitation forecasts for multiple locations from Open-Meteo, live Yellowstone River flow from USGS, and a map for pinning put-ins, take-outs, and swim spots.",
  },
  {
    path: "/dota-randomizer",
    title: "Dota 2 Randomizer",
    description:
      "Spin the wheels to get a random Dota 2 hero and a random item to build for your next game.",
  },
  {
    path: "/scrandle",
    title: "Scrandle Build Plan",
    description:
      "Build plan for a Scrandle-style food voting game: Discord photos ingested by a Cloudflare Worker, drops of 10 matchups, Elo standings, and a reveal at close.",
  },
  {
    path: "/resume",
    title: "Technologies",
    description: "The languages, frameworks and tools Ben Adams works with.",
  },
] as const;

export type IndexedPath = (typeof INDEXED_PAGES)[number]["path"];

function pageAt(path: IndexedPath) {
  return INDEXED_PAGES.find((p) => p.path === path)!;
}

export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Metadata for one of the indexed pages: its title and description, a
 * canonical URL, and matching Open Graph and Twitter cards. Next merges
 * metadata shallowly, so a segment that sets `openGraph` at all replaces the
 * root's — which is why the image and site name are restated here rather than
 * inherited.
 */
export function pageMetadata(
  path: IndexedPath,
  options: { image?: OgImage; type?: "website" | "article"; keywords?: string } = {},
): Metadata {
  const { title, description } = pageAt(path);
  const image = options.image ?? DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    ...(options.keywords ? { keywords: options.keywords } : {}),
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: options.type ?? "website",
      siteName: SITE_NAME,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

const PERSON = {
  "@type": "Person",
  "@id": `${SITE_URL}/#person`,
  name: AUTHOR.name,
  url: AUTHOR.url,
  sameAs: AUTHOR.sameAs,
};

/** schema.org data for the homepage: the site, and the person it is about. */
export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": PERSON["@id"] },
      },
      {
        "@type": "ProfilePage",
        "@id": `${SITE_URL}/#profile`,
        url: SITE_URL,
        name: SITE_NAME,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: PERSON,
      },
    ],
  };
}

/** schema.org data for one of the free, in-browser tools. */
export function webAppJsonLd(path: IndexedPath, category: string, image?: string) {
  const page = pageAt(path);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: page.title,
    url: absoluteUrl(path),
    description: page.description,
    applicationCategory: category,
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    ...(image ? { image: absoluteUrl(image) } : {}),
    author: PERSON,
  };
}

/** schema.org data for a written page. */
export function articleJsonLd(path: IndexedPath) {
  const page = pageAt(path);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    url: absoluteUrl(path),
    description: page.description,
    inLanguage: "en",
    author: PERSON,
  };
}

/** schema.org data for the rafting game's page. */
export function gameJsonLd(path: IndexedPath, image: string, storeUrl: string) {
  const page = pageAt(path);
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: page.title,
    url: absoluteUrl(path),
    description: page.description,
    image: absoluteUrl(image),
    playMode: "MultiPlayer",
    gamePlatform: ["Windows", "Linux", "Android"],
    sameAs: [storeUrl],
    author: PERSON,
  };
}
