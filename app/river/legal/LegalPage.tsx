import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { RIVER } from "../config";
import { MONO } from "../typography";

/**
 * The three legal documents, served so the Discord application has URLs to
 * point its Terms of Service and Privacy Policy fields at.
 *
 * **Nothing links to these pages and search engines are told to skip them.**
 * They exist for the application form and for a player who goes looking. The
 * `noindex` comes from `legalMetadata()` below; there is deliberately no
 * `Disallow` in `robots.ts`, because a crawler that is barred from fetching the
 * page never reads the tag that tells it not to index the page.
 *
 * The markdown is copied from the game repo (`docs/legal/`) rather than fetched,
 * because that repo is private and a build-time fetch would need a token in
 * Vercel. The copies here are what the world sees, so when the game's text
 * changes, copy it across in the same pull request.
 */

const DOCS = {
  terms: "terms.md",
  privacy: "privacy.md",
  notices: "notices.md",
} as const;

export type LegalDoc = keyof typeof DOCS;

/** Relative links between the markdown files, pointed at the routes instead. */
const LINK_MAP: Record<string, string> = {
  "privacy-policy.md": "/river/privacy",
  "terms-of-use.md": "/river/terms",
  "third-party-notices.md": "/river/notices",
};

/**
 * The two fields the source text leaves open. Filling them in is one edit here;
 * until then the brackets render in orange so nobody mistakes an unfinished
 * document for a finished one.
 */
function fill(markdown: string): string {
  let out = markdown;
  if (RIVER.legal.supportEmail) {
    out = out.replaceAll("[SUPPORT EMAIL]", RIVER.legal.supportEmail);
  }
  if (RIVER.legal.jurisdiction) {
    out = out.replaceAll("[STATE/COUNTRY]", RIVER.legal.jurisdiction);
  }
  return out;
}

function read(doc: LegalDoc): string {
  const file = path.join(process.cwd(), "app", "river", "legal", DOCS[doc]);
  return fill(fs.readFileSync(file, "utf8"));
}

export function legalMetadata(title: string): Metadata {
  return {
    title: `${title} — Middle Fork Rafting Simulator`,
    robots: { index: false, follow: false },
  };
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const markdown = read(doc);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:px-10 sm:py-24">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-10 text-3xl font-semibold tracking-tight uppercase sm:text-4xl">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            /* No rule of its own: the source text already separates its
               sections with `---`, and two lines read as a mistake. */
            <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight uppercase">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 mb-3 text-lg font-semibold tracking-tight">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-[#f2efe3]/80">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-2 pl-6 text-[#f2efe3]/80">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-2 pl-6 text-[#f2efe3]/80">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <Strong>{children}</Strong>,
          a: ({ href, children }) => (
            <a
              href={href ? (LINK_MAP[href] ?? href) : undefined}
              className="text-[#e2650f] underline underline-offset-4 hover:text-[#f2efe3]"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className={`${MONO} bg-[#f2efe3]/10 px-1.5 py-0.5 text-[0.9em]`}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className={`${MONO} mb-4 overflow-x-auto border border-[#f2efe3]/15 bg-black/30 p-4 text-sm`}
            >
              {children}
            </pre>
          ),
          hr: () => <hr className="my-10 border-[#f2efe3]/15" />,
        }}
      >
        {markdown}
      </ReactMarkdown>

      {/* Out, but not in: the game's page links here, and nothing links there. */}
      <p className={`${MONO} mt-16 border-t border-[#f2efe3]/15 pt-8 text-xs text-[#f2efe3]/40`}>
        <Link href="/river" className="hover:text-[#f2efe3]">
          Middle Fork Rafting Simulator
        </Link>
      </p>
    </main>
  );
}

/** Bold, except for a placeholder nobody has filled in yet. */
function Strong({ children }: { children?: React.ReactNode }) {
  const text = typeof children === "string" ? children : "";
  const unfilled = text.startsWith("[") && text.endsWith("]");
  return (
    <strong
      className={unfilled ? `${MONO} bg-[#e2650f]/20 px-1 text-[#e2650f]` : "text-[#f2efe3]"}
    >
      {children}
    </strong>
  );
}
