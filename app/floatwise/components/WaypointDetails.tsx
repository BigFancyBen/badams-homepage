"use client";

import { Waypoint, WAYPOINT_CATEGORY_MAP } from "../types";
import { CategoryGlyph } from "./CategoryGlyph";

interface WaypointDetailsProps {
  waypoint: Waypoint;
  /** Opens the waypoint in the editor. Omitted for read-only (shared) views. */
  onEdit?: () => void;
  onClose: () => void;
}

/**
 * Read-only card for a tapped waypoint: every category it belongs to (the
 * primary one — the icon shown on the map — called out first), plus its note.
 */
export function WaypointDetails({ waypoint, onEdit, onClose }: WaypointDetailsProps) {
  const cats = waypoint.categories
    .map((id) => WAYPOINT_CATEGORY_MAP[id])
    .filter(Boolean);
  const primary = cats[0];

  return (
    <div className="border border-gray-600 bg-gray-900/95 p-3 text-gray-100 shadow-lg">
      <div className="mb-2 flex items-start gap-2">
        {primary && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-white/90"
            style={{ backgroundColor: primary.color }}
          >
            <CategoryGlyph meta={primary} size={18} color="#ffffff" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {waypoint.name || primary?.label || "Waypoint"}
          </div>
          <div className="text-[10px] text-gray-400">
            {waypoint.lat.toFixed(5)}, {waypoint.lon.toFixed(5)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-400 hover:text-gray-100"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {cats.map((c, i) => (
          <span
            key={c.id}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs text-white ${
              i === 0 ? "font-semibold ring-2 ring-white ring-offset-1 ring-offset-gray-900" : ""
            }`}
            style={{ backgroundColor: c.color }}
          >
            <CategoryGlyph meta={c} size={14} color="#ffffff" />
            {c.label}
            {i === 0 && cats.length > 1 && (
              <span className="text-[9px] uppercase tracking-wide opacity-90">· map icon</span>
            )}
          </span>
        ))}
      </div>

      {waypoint.note && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-200">{waypoint.note}</p>
      )}

      {onEdit && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 9 17l.464-3.536z" />
            </svg>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
