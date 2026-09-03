import { ACCENT } from "../data";
import { renderInline } from "../utils";

interface DataTableProps {
  columns: string[];
  rows: string[][];
}

/**
 * Plain table for the numeric rules (weights, XP curve, tiers, events).
 * The first column is the row's name; the second is highlighted as the value.
 */
export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div
      className="overflow-x-auto scrandle-scroll"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <table className="w-full text-left border-collapse">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {columns.map((heading) => (
              <th
                key={heading}
                scope="col"
                className="font-mono text-[10px] font-normal uppercase tracking-widest text-gray-600 px-4 py-3 whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderTop: i === 0 ? undefined : "1px solid rgba(255,255,255,0.04)",
              }}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={
                    j === 0
                      ? "text-sm font-medium text-white px-4 py-3 align-top whitespace-nowrap"
                      : j === 1
                        ? "font-mono text-sm px-4 py-3 align-top whitespace-nowrap"
                        : "text-sm text-gray-400 leading-relaxed px-4 py-3 align-top"
                  }
                  style={j === 1 ? { color: ACCENT } : undefined}
                >
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
