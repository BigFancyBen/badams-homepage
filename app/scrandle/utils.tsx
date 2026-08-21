import { Fragment, type ReactNode } from "react";

/**
 * Minimal inline formatter for the plan copy: `code` spans and **bold** runs.
 * The source doc is markdown, and rewriting every string as JSX would bury the
 * content in tags.
 */
export function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[0.85em] px-1 py-px whitespace-nowrap"
          style={{
            color: "#a3be8c",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={i}>{part}</Fragment>;
  });
}
