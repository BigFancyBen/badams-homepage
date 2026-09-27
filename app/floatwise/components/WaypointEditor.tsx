"use client";

import { useState } from "react";
import {
  Waypoint,
  WaypointCategory,
  WAYPOINT_CATEGORIES,
} from "../types";
import { CategoryGlyph } from "./CategoryGlyph";

interface WaypointEditorProps {
  /** The waypoint being created or edited. */
  waypoint: Waypoint;
  /** True when placing a brand-new waypoint (vs. editing an existing one). */
  isNew: boolean;
  onSave: (waypoint: Waypoint) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

/**
 * Modal for naming a waypoint, picking one or more categories, and jotting a
 * note. Used both when dropping a new waypoint and when editing an existing one.
 * The first category picked is the primary one (starred): it's the only icon
 * the map draws for the waypoint.
 */
export function WaypointEditor({
  waypoint,
  isNew,
  onSave,
  onDelete,
  onClose,
}: WaypointEditorProps) {
  const [name, setName] = useState(waypoint.name ?? "");
  const [note, setNote] = useState(waypoint.note ?? "");
  const [categories, setCategories] = useState<WaypointCategory[]>(
    waypoint.categories
  );

  const toggleCategory = (id: WaypointCategory) => {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // The first category is the "primary" one — the single icon the map shows.
  const makePrimary = (id: WaypointCategory) => {
    setCategories((prev) => [id, ...prev.filter((c) => c !== id)]);
  };

  const handleSave = () => {
    if (categories.length === 0) return; // Guarded by disabled button too.
    onSave({
      ...waypoint,
      name: name.trim() || undefined,
      note: note.trim() || undefined,
      categories,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-gray-300 bg-white p-4 shadow-xl dark:border-gray-600 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isNew ? "New waypoint" : "Edit waypoint"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
          {waypoint.lat.toFixed(5)}, {waypoint.lon.toFixed(5)}
          {!isNew && " · drag the pin on the map to move it"}
        </div>

        {/* Name */}
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Name (optional)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cedar Beach put-in"
            className="w-full border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        {/* Categories */}
        <div className="mb-3">
          <span className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Categories <span className="text-gray-400">(pick one or more)</span>
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {WAYPOINT_CATEGORIES.map((cat) => {
              const active = categories.includes(cat.id);
              const primary = categories[0] === cat.id;
              return (
                <div
                  key={cat.id}
                  className={`flex items-stretch border transition-colors ${
                    active
                      ? "border-transparent text-white"
                      : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500"
                  } ${
                    primary
                      ? "ring-2 ring-gray-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-gray-900"
                      : ""
                  }`}
                  style={active ? { backgroundColor: cat.color } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    aria-pressed={active}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
                  >
                    <CategoryGlyph
                      meta={cat}
                      size={18}
                      color={active ? "#ffffff" : cat.color}
                    />
                    <span className={`leading-tight ${primary ? "font-semibold" : ""}`}>
                      {cat.label}
                    </span>
                  </button>
                  {active &&
                    (primary ? (
                      <span
                        className="flex w-8 shrink-0 items-center justify-center"
                        title="Shown on the map"
                        aria-label="Map icon"
                      >
                        <StarIcon filled />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makePrimary(cat.id)}
                        className="flex w-8 shrink-0 items-center justify-center opacity-70 hover:bg-black/15 hover:opacity-100"
                        title="Use as the map icon"
                        aria-label={`Use ${cat.label} as the map icon`}
                      >
                        <StarIcon filled={false} />
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {categories.length === 0
              ? "Pick at least one to save."
              : categories.length === 1
                ? "The starred category is the icon shown on the map."
                : "The starred category is the icon shown on the map. Tap another star to switch."}
          </p>
        </div>

        {/* Note */}
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Note (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything worth remembering about this spot"
            className="w-full resize-none border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        <div className="flex items-center justify-between gap-2">
          {!isNew && onDelete ? (
            <button
              onClick={() => onDelete(waypoint.id)}
              className="border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={categories.length === 0}
              className="bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z" />
    </svg>
  );
}
