"use client";

import { useState } from "react";

interface SlotInfo {
  index: number;
  name: string | null;
  isOccupied: boolean;
  isCurrentUser: boolean;
}

interface SlotPickerProps {
  slots: SlotInfo[];
  playerCount: number;
  onSelectSlot: (slotIndex: number, playerName: string) => void;
  className?: string;
}

export function SlotPicker({
  slots,
  playerCount,
  onSelectSlot,
  className = "",
}: SlotPickerProps) {
  const [playerName, setPlayerName] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [error, setError] = useState("");

  const availableSlots = slots.slice(0, playerCount);

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (selectedSlot === null) {
      setError("Please select a slot");
      return;
    }

    const slot = availableSlots[selectedSlot];
    if (slot.isOccupied && !slot.isCurrentUser) {
      setError("This slot is already taken");
      return;
    }

    setError("");
    onSelectSlot(selectedSlot, playerName.trim());
  };

  return (
    <div className={`bg-[#222222] border border-[#333333] p-6 ${className}`}>
      <h2 className="text-xl font-bold text-[#f5f5f5] mb-4 text-center tracking-wide">
        Choose Your Slot
      </h2>

      {/* Slot Selection Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {availableSlots.map((slot, index) => (
          <button
            key={index}
            onClick={() => {
              if (!slot.isOccupied || slot.isCurrentUser) {
                setSelectedSlot(index);
                setError("");
              }
            }}
            disabled={slot.isOccupied && !slot.isCurrentUser}
            className={`p-4 border transition-all duration-200 ${
              selectedSlot === index
                ? "border-[#22c55e] bg-[#166534]/20"
                : slot.isOccupied && !slot.isCurrentUser
                ? "border-[#404040] bg-[#2a2a2a] opacity-50 cursor-not-allowed"
                : "border-[#404040] bg-[#2a2a2a] hover:border-[#555555] hover:bg-[#333333]"
            }`}
          >
            <div className="text-sm font-bold text-[#888888] mb-1">
              Player {index + 1}
            </div>
            {slot.isOccupied ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[#f5f5f5] font-semibold">
                  {slot.name || `Player ${index + 1}`}
                </span>
                {slot.isCurrentUser ? (
                  <span className="text-[#22c55e] text-xs">(You)</span>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ) : (
              <span className="text-[#666666] italic">Empty</span>
            )}
          </button>
        ))}
      </div>

      {/* Name Input */}
      <div className="mb-4">
        <label className="text-[#a3a3a3] text-sm font-semibold mb-2 block">
          Your Name:
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => {
            setPlayerName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleJoin();
          }}
          placeholder="Enter your name"
          maxLength={20}
          className="w-full bg-[#2a2a2a] text-[#f5f5f5] border border-[#404040] focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30 focus:outline-none transition-all duration-200 px-4 py-3 text-sm font-medium"
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-[#dc2626] text-sm mb-4 text-center">{error}</p>
      )}

      {/* Join Button */}
      <button
        onClick={handleJoin}
        disabled={!playerName.trim() || selectedSlot === null}
        className="w-full bg-[#166534] hover:bg-[#14532d] active:bg-[#052e16] disabled:bg-[#404040] disabled:text-[#666666] disabled:cursor-not-allowed text-white font-bold py-3 px-4 transition-all duration-200"
      >
        JOIN GAME
      </button>
    </div>
  );
}
