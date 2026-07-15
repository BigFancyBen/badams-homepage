"use client";

import { WaypointCategoryMeta } from "../types";

interface CategoryGlyphProps {
  meta: WaypointCategoryMeta;
  /** Pixel size of the square glyph. */
  size?: number;
  /** Stroke color; defaults to currentColor so it inherits text color. */
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Renders a waypoint category's lucide glyph as an inline SVG. Shares its path
 * data with the Leaflet markers (see WAYPOINT_CATEGORIES.iconPaths) so the map
 * and the surrounding UI never drift apart.
 */
export function CategoryGlyph({
  meta,
  size = 20,
  color = "currentColor",
  strokeWidth = 2,
  className,
}: CategoryGlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: meta.iconPaths }}
    />
  );
}
