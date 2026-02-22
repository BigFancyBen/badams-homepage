import { PlayerState } from "../types";
import { formatTime, parseActionForDisplay } from "../utils";

interface HistoryModalProps {
  isOpen: boolean;
  player: PlayerState;
  playerIndex: number;
  isMobileLandscape: boolean;
  isMobilePortrait: boolean;
  onClose: () => void;
}

export function HistoryModal({
  isOpen,
  player,
  isMobileLandscape,
  isMobilePortrait,
  onClose,
}: HistoryModalProps) {
  if (!isOpen) return null;

  const isMobile = isMobileLandscape || isMobilePortrait;

  return (
    <div
      className="absolute inset-0 bg-[#1a0f1c]/70 z-[35] flex flex-col"
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
          {player.history.length === 0 ? (
            <div className={`${isMobile ? "text-xs" : "text-sm"} text-[#8b7699] italic mt-2`}>
              No actions yet
            </div>
          ) : (
            <div>
              {player.history.map((entry, index) => {
                const [text, type] = entry.action.split("|");
                let textColor = "text-[#9d88aa]";

                if (type === "positive") {
                  textColor = "text-[#a9e5bb]";
                } else if (type === "negative") {
                  textColor = "text-[#e3170a]";
                } else if (type === "poison") {
                  textColor = "text-[#c490e0]";
                } else if (type === "commander") {
                  textColor = "text-[#f7b32b]";
                }

                const { sign, number, label } = parseActionForDisplay(text);

                const signColor =
                  sign === "+"
                    ? "text-[#a9e5bb]"
                    : sign === "-"
                    ? "text-[#e3170a]"
                    : "";

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
