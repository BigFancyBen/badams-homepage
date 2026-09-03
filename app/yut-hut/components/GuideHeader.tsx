"use client";

import Link from "next/link";
import { ACCENT } from "../data";

export function GuideHeader() {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "rgba(10,10,10,0.82)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono shrink-0"
        >
          &larr; benadams.dev
        </Link>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            Yut Hut
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: ACCENT }}
          >
            Two a week
          </span>
        </div>
      </div>
    </header>
  );
}
