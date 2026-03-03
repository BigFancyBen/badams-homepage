"use client";

import Image from "next/image";
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
  const hasPT = basePower !== null && baseToughness !== null;
  const totalPower =
    hasPT
      ? (basePower ?? 0) + stack.permanentCounters + stack.temporaryCounters
      : null;
  const totalToughness =
    hasPT
      ? (baseToughness ?? 0) + stack.permanentCounters + stack.temporaryCounters
      : null;
  const isBuffed =
    hasPT && (stack.permanentCounters > 0 || stack.temporaryCounters > 0);

  return (
    <div
      className={`bg-[#1a1a1a] border-2 transition-colors ${
        stack.isTapped ? "border-red-500/60" : "border-[#333333]"
      }`}
    >
      {/* Token Image - tap to rotate */}
      <button
        onClick={onToggleTap}
        className="w-full relative aspect-[488/680] overflow-hidden bg-[#111111]"
        title={stack.isTapped ? "Untap" : "Tap"}
      >
        <Image
          src={imageUrl}
          alt={name}
          fill
          className={`object-cover transition-transform duration-200 ${
            stack.isTapped ? "rotate-90 scale-125" : ""
          }`}
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
        />
        {stack.isTapped && (
          <div className="absolute inset-0 bg-black/30" />
        )}
      </button>

      {/* Info Bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#222222] border-t border-[#333333]">
        <span className="text-sm font-medium text-[#e5e5e5] truncate">
          {name}
        </span>
        {hasPT && (
          <span
            className={`text-sm font-bold ml-2 shrink-0 ${
              isBuffed ? "text-[#4ade80]" : "text-[#e5e5e5]"
            }`}
          >
            {totalPower}/{totalToughness}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="px-2 py-2 space-y-1.5 border-t border-[#333333]">
        {/* Count */}
        <CounterRow
          label="Count"
          value={stack.count}
          onIncrement={onIncrementCount}
          onDecrement={onDecrementCount}
          color="neutral"
        />

        {/* +1/+1 Counters - only show for tokens with P/T */}
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
      <div className="flex border-t border-[#333333]">
        <button
          onClick={onToggleTap}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors border-r border-[#333333] ${
            stack.isTapped
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "text-[#9ca3af] hover:bg-[#2a2a2a]"
          }`}
        >
          {stack.isTapped ? "UNTAP" : "TAP"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSplit();
          }}
          disabled={stack.count < 2}
          className="flex-1 py-1.5 text-xs font-medium text-[#9ca3af] hover:bg-[#2a2a2a] transition-colors border-r border-[#333333] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          SPLIT
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-1 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          X
        </button>
      </div>
    </div>
  );
}
