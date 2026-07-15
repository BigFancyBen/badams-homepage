"use client";

import { useState } from "react";
import {
  Waypoint,
  WaypointCategory,
  WAYPOINT_CATEGORIES,
} from "../types";

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

        <div className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">
          {waypoint.lat.toFixed(5)}, {waypoint.lon.toFixed(5)}
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
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 border px-2 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? "border-transparent text-white"
                      : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500"
                  }`}
                  style={active ? { backgroundColor: cat.color } : undefined}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
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
