import { ACCENT } from "../data";
import type { Block } from "../types";
import { renderInline } from "../utils";
import { CodeBlock } from "./CodeBlock";

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        if (block.kind === "p") {
          return (
            <p key={i} className="text-sm text-gray-400 leading-relaxed">
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.kind === "ul") {
          return (
            <ul key={i} className="flex flex-col gap-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-sm text-gray-400 leading-relaxed">
                  <span aria-hidden="true" style={{ color: ACCENT }}>
                    —
                  </span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === "ol") {
          return (
            <ol key={i} className="flex flex-col gap-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-sm text-gray-400 leading-relaxed">
                  <span
                    className="font-mono text-xs shrink-0 pt-0.5"
                    style={{ color: ACCENT }}
                  >
                    {String(j + 1).padStart(2, "0")}
                  </span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.kind === "code") {
          return <CodeBlock key={i} code={block.code} lang={block.lang} />;
        }

        return (
          <p
            key={i}
            className="text-sm text-gray-400 leading-relaxed p-3"
            style={{
              borderLeft: `2px solid ${ACCENT}60`,
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
