import { HistoryEntry, PlayerState } from "../types";
import { describeEntry, formatTime } from "../utils";
import { CloseIcon } from "./icons";

interface HistoryModalProps {
  isOpen: boolean;
  player: PlayerState;
  isMobile: boolean;
  onClose: () => void;
}

const entryColor = (entry: HistoryEntry) => {
  switch (entry.kind) {
    case "poison":
      return "text-[#c490e0]";
    case "commander":
      return "text-[#f7b32b]";
    default:
      return entry.value > 0 ? "text-[#a9e5bb]" : "text-[#e3170a]";
  }
};

export function HistoryModal({ isOpen, player, isMobile, onClose }: HistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 bg-[#1a0f1c]/70 z-35 flex flex-col"
      onClick={onClose}
    >
      <div
        className="w-full h-full flex flex-col bg-[#2d1e2f]/95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#614a71]">
          <h3 className={`font-bold text-[#fcf6b1] truncate ${isMobile ? "text-sm" : "text-base"}`}>
            {player.name} — History
          </h3>
          <button
            onClick={onClose}
            className="text-[#fcf6b1]/70 hover:text-[#fcf6b1]/90 transition-colors p-1 ml-2 shrink-0"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
          {player.history.length === 0 ? (
            <div className={`${isMobile ? "text-xs" : "text-sm"} text-[#8b7699] italic mt-2`}>
              No actions yet
            </div>
          ) : (
            <div data-testid="history-list">
              {player.history.map((entry, index) => {
                const textColor = entryColor(entry);
                const { sign, number, label } = describeEntry(entry);
                const signColor = sign === "+" ? "text-[#a9e5bb]" : "text-[#e3170a]";

                return (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    className={`grid items-center ${
                      isMobile
                        ? "text-[11px] grid-cols-[12px_auto_1fr_auto]"
                        : "text-[13px] grid-cols-[16px_auto_1fr_auto]"
                    } leading-tight font-medium py-1.5 border-b border-[#614a71]`}
                    style={{ columnGap: isMobile ? "6px" : "8px" }}
                  >
                    <span className={`font-bold text-center ${signColor}`}>
                      {sign}
                    </span>
                    <span className={`font-bold ${textColor}`}>
                      {number}
                    </span>
                    <span className={`truncate ${textColor}`}>{label}</span>
                    <span className={`text-[#8b7699] ${isMobile ? "text-[9px]" : "text-[11px]"} shrink-0`}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
