"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { TokenStack } from "../types";

interface TokenCardProps {
  stack: TokenStack;
  name: string;
  imageUrl: string;
  basePower: number | null;
  baseToughness: number | null;
  onToggleTap: () => void;
  onIncrementCount: () => void;
  onDecrementCount: () => void;
  onAddPermanent: () => void;
  onRemovePermanent: () => void;
  onAddTemporary: () => void;
  onRemoveTemporary: () => void;
  onSplit: () => void;
  onRemove: () => void;
}

function CounterRow({
  label,
  value,
  onIncrement,
  onDecrement,
  color,
}: {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  color: "green" | "amber" | "neutral";
}) {
  const colorClasses = {
    green: "text-[#4ade80]",
    amber: "text-[#fbbf24]",
    neutral: "text-[#e5e5e5]",
  };

  const btnClasses = {
    green:
      "border-[#4ade80]/40 text-[#4ade80] hover:bg-[#4ade80]/20 active:bg-[#4ade80]/30",
    amber:
      "border-[#fbbf24]/40 text-[#fbbf24] hover:bg-[#fbbf24]/20 active:bg-[#fbbf24]/30",
    neutral:
      "border-[#404040] text-[#e5e5e5] hover:bg-[#3a3a3a] active:bg-[#444444]",
  };

  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs font-medium ${colorClasses[color]} w-12`}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDecrement();
          }}
          className={`w-7 h-7 border text-sm font-bold transition-colors ${btnClasses[color]}`}
        >
          -
        </button>
        <span
          className={`w-8 text-center text-sm font-bold ${colorClasses[color]}`}
        >
          {value}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIncrement();
          }}
          className={`w-7 h-7 border text-sm font-bold transition-colors ${btnClasses[color]}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function TokenCard({
  stack,
  name,
  imageUrl,
  basePower,
  baseToughness,
  onToggleTap,
  onIncrementCount,
  onDecrementCount,
  onAddPermanent,
  onRemovePermanent,
  onAddTemporary,
  onRemoveTemporary,
  onSplit,
  onRemove,
}: TokenCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const hasPT = basePower !== null && baseToughness !== null;
  const buffAmount = stack.permanentCounters + stack.temporaryCounters;
  const isBuffed =
    hasPT && (stack.permanentCounters > 0 || stack.temporaryCounters > 0);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    // Outer wrapper: controls space reservation, never rotates
    <div
      className="relative transition-all duration-200"
      style={{
        aspectRatio: stack.isTapped ? "680/488" : "488/680",
      }}
    >
      {/* Inner card: rotates when tapped */}
      <div
        className="absolute inset-0 origin-center transition-transform duration-200 cursor-pointer"
        style={
          stack.isTapped
            ? { transform: "rotate(90deg) scale(0.718)" }
            : undefined
        }
        onClick={onToggleTap}
      >
        {/* Card image */}
        <div className="relative w-full h-full overflow-hidden bg-[#111111]">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
          />

          {/* Tapped dark overlay */}
          {stack.isTapped && (
            <div className="absolute inset-0 bg-black/30" />
          )}

          {/* Count overlay (center) */}
          {stack.count > 1 && (
            <div
              className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
                stack.isTapped ? "-rotate-90" : ""
              }`}
            >
              <span
                className="text-6xl font-black text-white"
                style={{
                  WebkitTextStroke: "3px black",
                  paintOrder: "stroke fill",
                  textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                }}
              >
                {stack.count}
              </span>
            </div>
          )}

          {/* P/T badge (bottom-center) */}
          {hasPT && (
            <div
              className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none ${
                stack.isTapped ? "-rotate-90" : ""
              }`}
            >
              <div
                className={`bg-white border-2 border-black px-2 py-0.5 text-sm font-bold ${
                  isBuffed ? "text-green-600" : "text-black"
                }`}
              >
                {buffAmount > 0
                  ? `+${buffAmount}/+${buffAmount}`
                  : "+0/+0"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu button (top-left, on outer wrapper so it never rotates) */}
      <button
        ref={menuButtonRef}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        className="absolute top-1.5 left-1.5 z-10 w-8 h-8 flex items-center justify-center bg-black/60 text-white hover:bg-black/80 transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Menu popover */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute top-11 left-1.5 z-20 w-52 bg-[#1a1a1a] border-2 border-[#333333] shadow-xl"
        >
          {/* Token name header */}
          <div className="px-3 py-2 border-b border-[#333333]">
            <span className="text-sm font-medium text-[#e5e5e5] truncate block">
              {name}
            </span>
          </div>

          {/* Controls */}
          <div className="px-3 py-2 space-y-1.5">
            <CounterRow
              label="Count"
              value={stack.count}
              onIncrement={onIncrementCount}
              onDecrement={onDecrementCount}
              color="neutral"
            />

            {hasPT && (
              <>
                <CounterRow
                  label="+1/+1"
                  value={stack.permanentCounters}
                  onIncrement={onAddPermanent}
                  onDecrement={onRemovePermanent}
                  color="green"
                />
                <CounterRow
                  label="Buff"
                  value={stack.temporaryCounters}
                  onIncrement={onAddTemporary}
                  onDecrement={onRemoveTemporary}
                  color="amber"
                />
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="border-t border-[#333333]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleTap();
                setMenuOpen(false);
              }}
              className={`w-full px-3 py-1.5 text-xs font-medium text-left transition-colors ${
                stack.isTapped
                  ? "text-red-400 hover:bg-red-500/20"
                  : "text-[#9ca3af] hover:bg-[#2a2a2a]"
              }`}
            >
              {stack.isTapped ? "UNTAP" : "TAP"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSplit();
                setMenuOpen(false);
              }}
              disabled={stack.count < 2}
              className="w-full px-3 py-1.5 text-xs font-medium text-left text-[#9ca3af] hover:bg-[#2a2a2a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              SPLIT
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-full px-3 py-1.5 text-xs font-medium text-left text-red-400 hover:bg-red-500/20 transition-colors"
            >
              REMOVE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
