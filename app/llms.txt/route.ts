import { AUTHOR, INDEXED_PAGES, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "../site";
import {
  MFRS,
  PROGNOSTICATOR_SCREENSHOTS,
  SM64_SCENE,
  SUMMARIES,
  TESTQ,
  WAREHOUSE_SCENE,
} from "../components/homepage/projects";

/**
 * /llms.txt — the site as one Markdown file, for agents that would rather read
 * than render (https://llmstxt.org). Built from the same list as the sitemap
 * and the same copy as the homepage cards, so it cannot drift from either, and
 * it links only to pages that are indexed.
 */
export const dynamic = "force-static";

interface Feature {
  label: string;
  text: string;
}

function features(items: readonly Feature[]): string {
  return items.map((f) => `- **${f.label}.** ${f.text}`).join("\n");
}

function project(title: string, body: string, links: [string, string][] = []): string {
  const linkLine = links.map(([label, url]) => `[${label}](${url})`).join(" · ");
  return [`### ${title}`, body, linkLine].filter(Boolean).join("\n\n");
}

function build(): string {
  const pages = INDEXED_PAGES.map(
    (p) => `- [${p.title}](${absoluteUrl(p.path)}): ${p.description}`,
  ).join("\n");

  const projects = [
    project(
      MFRS.title,
      `${MFRS.tagline} ${MFRS.description}\n\n${features(MFRS.features)}\n\nBuilt with: ${MFRS.tags.join(", ")}.`,
      [
        ["Game page", absoluteUrl("/river")],
        ["itch.io", MFRS.itchUrl],
      ],
    ),
    project(
      "Prognosticator",
      `${SUMMARIES.prognosticator}\n\n${features(
        PROGNOSTICATOR_SCREENSHOTS.map((s) => ({ label: s.label, text: s.description })),
      )}`,
    ),
    project(
      `Prognosticator visualizer: ${WAREHOUSE_SCENE.title}`,
      `${WAREHOUSE_SCENE.description}\n\nBuilt with: ${WAREHOUSE_SCENE.tags.join(", ")}.`,
    ),
    project(
      `Prognosticator visualizer: ${SM64_SCENE.title}`,
      `${SM64_SCENE.description}\n\nBuilt with: ${SM64_SCENE.tags.join(", ")}.`,
    ),
    project(
      TESTQ.title,
      `${TESTQ.tagline} ${TESTQ.description}\n\n${features(TESTQ.features)}\n\nBuilt with: ${TESTQ.tags.join(", ")}.`,
      [["Source", TESTQ.repoUrl]],
    ),
    project("hobbit.house", SUMMARIES.hobbitHouse, [
      ["Source", "https://github.com/BigFancyBen/hobbit-ccp"],
    ]),
    project("Scrandle", SUMMARIES.scrandle, [["Build plan", absoluteUrl("/scrandle")]]),
    project("Scranbot", SUMMARIES.scranbot),
    project("Yut Hut", SUMMARIES.yutHut),
    project("MTG Commander Scorekeeper", SUMMARIES.commander, [["Open", absoluteUrl("/commander")]]),
    project("Magic Tutor Helper", SUMMARIES.tutorHelper, [["Open", absoluteUrl("/tutor-helper")]]),
    project("MTG Token Helper", SUMMARIES.tokenHelper, [["Open", absoluteUrl("/token-helper")]]),
    project("FloatWise", SUMMARIES.floatwise, [["Open", absoluteUrl("/floatwise")]]),
    project("Dota 2 Randomizer", SUMMARIES.dotaRandomizer, [["Open", absoluteUrl("/dota-randomizer")]]),
    project("IRLScape", SUMMARIES.irlscape, [
      ["Video", "https://www.youtube.com/watch?v=gCofVhR5HUQ"],
    ]),
    project("OSRS Progress Generator", SUMMARIES.osrsProgress),
  ].join("\n\n");

  return [
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION}`,
    `The personal site of ${AUTHOR.name} (${AUTHOR.sameAs[0]}). The homepage is a showcase of things built outside of work. Several of them are small web apps hosted on this site, which run in the browser and keep their state in localStorage.`,
    `## Pages\n\n${pages}`,
    `## Projects\n\n${projects}`,
    "",
  ].join("\n\n");
}

export function GET() {
  return new Response(build(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
