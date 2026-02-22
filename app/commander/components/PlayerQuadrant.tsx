import { useState, useEffect } from "react";
import { PlayerState } from "../types";
import { getRotationClass } from "../utils";
import { HistoryModal } from "./HistoryModal";

interface PlayerQuadrantProps {
  player: PlayerState;
  playerIndex: number;
  playerAbbrevs: string[];
  isMobileLandscape: boolean;
  isMobilePortrait: boolean;
  rotatingPlayer: number | null;
  undoStackLength: number;
  readOnly?: boolean;
  fullScreen?: boolean;
  onUpdateLife: (playerIndex: number, change: number) => void;
  onUpdatePoison: (playerIndex: number, change: number) => void;
  onUpdateCommanderDamage: (
    playerIndex: number,
    sourceIndex: number,
    change: number
  ) => void;
  onUpdateRotation: (playerIndex: number) => void;
  onTogglePlayerDead: (playerIndex: number) => void;
  onDamageAllOthers: (playerIndex: number, damage: number) => void;
  onUndoDamageAllOthers: () => void;
}

export function PlayerQuadrant({
  player,
  playerIndex,
  playerAbbrevs,
  isMobileLandscape,
  isMobilePortrait,
  rotatingPlayer,
  undoStackLength,
  readOnly = false,
  fullScreen = false,
  onUpdateLife,
  onUpdatePoison,
  onUpdateCommanderDamage,
  onUpdateRotation,
  onTogglePlayerDead,
  onDamageAllOthers,
  onUndoDamageAllOthers,
}: PlayerQuadrantProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCommanderExpanded, setIsCommanderExpanded] = useState(false);

  // Track the most recent action for highlighting
  useEffect(() => {
    // This effect tracks history changes for potential future highlighting features
  }, [player.history]);

  const rotationClass = getRotationClass(player.rotation);
  const isMobile = isMobileLandscape || isMobilePortrait;

  // Get commander damage sources (other players)
  const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);

  return (
    <div className="relative w-full h-full border border-[#333333] bg-[#222222] overflow-hidden" data-testid={`player-quadrant-${playerIndex}`}>
      {/* History Modal - covers this quadrant only */}
      <HistoryModal
        isOpen={isHistoryOpen}
        player={player}
        playerIndex={playerIndex}
        isMobileLandscape={isMobileLandscape}
        isMobilePortrait={isMobilePortrait}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Dead overlay */}
      {player.isDead && (
        <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none" />
      )}
      {/* Desktop-only fixed position buttons */}
      {!readOnly && !isMobileLandscape && !isMobilePortrait && (
        <>
          {/* Rotation Control - fixed position on desktop */}
          <button
            onClick={() => onUpdateRotation(playerIndex)}
            disabled={rotatingPlayer === playerIndex}
            className={`absolute z-30 w-11 h-11 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-sm p-0 ${
              rotatingPlayer === playerIndex
                ? "text-white/40 cursor-not-allowed"
                : ""
            } ${
              playerIndex === 0
                ? "top-2 right-2" // Player 1: top-right (away from settings & center)
                : playerIndex === 1
                ? "top-2 left-2" // Player 2: top-left (away from center)
                : playerIndex === 2
                ? "bottom-2 left-2" // Player 3: bottom-left (away from center)
                : "bottom-2 right-2" // Player 4: bottom-right (away from center)
            }`}
            title="Rotate view"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Death Toggle - fixed position on desktop */}
          <button
            onClick={() => onTogglePlayerDead(playerIndex)}
            className={`absolute z-30 w-11 h-11 transition-all duration-200 flex items-center justify-center ${
              player.isDead
                ? "text-red-500 hover:text-red-400"
                : "text-white/70 hover:text-red-400"
            } ${
              playerIndex === 0
                ? "bottom-2 left-2" // Player 1: bottom-left (away from center)
                : playerIndex === 1
                ? "bottom-2 right-2" // Player 2: bottom-right (away from center)
                : playerIndex === 2
                ? "top-2 right-2" // Player 3: top-right (away from center)
                : "top-2 left-2" // Player 4: top-left (away from center & settings)
            }`}
            title={player.isDead ? "Revive player" : "Mark as dead"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
              className="drop-shadow-lg"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.91 1.47 2.18 2.79 3.71 3.92.63.47 1.32.88 2.05 1.24.73-.36 1.42-.77 2.05-1.24 1.53-1.13 2.8-2.45 3.71-3.92C18.5 12.37 19 10.74 19 9c0-3.87-3.13-7-7-7zM8.5 7c.83 0 1.5.67 1.5 1.5S9.33 10 8.5 10 7 9.33 7 8.5 7.67 7 8.5 7zm7 0c.83 0 1.5.67 1.5 1.5S16.33 10 15.5 10 14 9.33 14 8.5 14.67 7 15.5 7zM12 13c-1.21 0-2.25.86-2.45 2h4.9c-.2-1.14-1.24-2-2.45-2z" />
            </svg>
          </button>
        </>
      )}{" "}
      <div
        className={`absolute ${player.isDead ? "opacity-50" : ""}`}
        style={{
          ...(fullScreen
            ? {
                // Full screen mode for controller view
                top: "0.5rem",
                left: "0.5rem",
                width: "calc(100vw - 1rem)",
                height: "calc(100vh - 1rem)",
              }
            : player.rotation === 90 || player.rotation === 270
            ? {
                // Landscape container (rotated): center within quadrant
                top: "50%",
                left: "50%",
                width: "calc(100vh / 2 - 1rem)",
                height: "calc(100vw / 2 - 1rem)",
                transform: "translate(-50%, -50%)",
                transformOrigin: "center",
              }
            : {
                // Portrait container (normal): use full quadrant
                top: "0.5rem",
                left: "0.5rem",
                width: "calc(100vw / 2 - 1rem)",
                height: "calc(100vh / 2 - 1rem)",
              }),
        }}
      >
        <div className={`w-full h-full flex flex-col ${rotationClass}`}>
          {/* Mobile-only buttons that rotate with quadrant - positioned in corners */}
          {!readOnly && (isMobileLandscape || isMobilePortrait) && (
            <>
              {/* Rotation Control - top left corner */}
              <button
                onClick={() => onUpdateRotation(playerIndex)}
                disabled={rotatingPlayer === playerIndex}
                className={`absolute top-1 left-1 z-10 w-10 h-10 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-xs p-0 ${
                  rotatingPlayer === playerIndex
                    ? "text-white/40 cursor-not-allowed"
                    : ""
                }`}
                title={
                  isMobileLandscape || isMobilePortrait
                    ? "Flip view"
                    : "Rotate view"
                }
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>

              {/* Death Toggle - top right corner */}
              <button
                onClick={() => onTogglePlayerDead(playerIndex)}
                className={`absolute top-1 right-1 z-10 w-10 h-10 transition-all duration-200 flex items-center justify-center ${
                  player.isDead
                    ? "text-red-500 hover:text-red-400"
                    : "text-white/70 hover:text-red-400"
                }`}
                title={player.isDead ? "Revive player" : "Mark as dead"}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                  className="drop-shadow-lg"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.91 1.47 2.18 2.79 3.71 3.92.63.47 1.32.88 2.05 1.24.73-.36 1.42-.77 2.05-1.24 1.53-1.13 2.8-2.45 3.71-3.92C18.5 12.37 19 10.74 19 9c0-3.87-3.13-7-7-7zM8.5 7c.83 0 1.5.67 1.5 1.5S9.33 10 8.5 10 7 9.33 7 8.5 7.67 7 8.5 7zm7 0c.83 0 1.5.67 1.5 1.5S16.33 10 15.5 10 14 9.33 14 8.5 14.67 7 15.5 7zM12 13c-1.21 0-2.25.86-2.45 2h4.9c-.2-1.14-1.24-2-2.45-2z" />
                </svg>
              </button>
            </>
          )}

          {/* Player Name + Life Total - tappable to open history */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="shrink-0 w-full flex flex-col items-center cursor-pointer group pt-1"
          >
            <h2 className={`font-bold text-[#ffffff] tracking-wide truncate group-hover:text-[#4ade80] transition-colors ${isMobile ? "text-base" : "text-lg"}`}>
              {player.name}
              {player.history.length > 0 && (
                <span className={`ml-1.5 text-[#888888] font-normal ${isMobile ? "text-[9px]" : "text-[11px]"}`}>({player.history.length})</span>
              )}
            </h2>
            <div className="relative">
              <div className={`font-bold text-[#f5f5f5] select-none tracking-tight leading-none ${isMobile ? "text-7xl" : "text-8xl"}`} data-testid={`life-total-${playerIndex}`}>
                {player.life}
              </div>
              <div className={`absolute inset-0 font-bold text-[#166534] select-none tracking-tight leading-none opacity-15 blur-sm ${isMobile ? "text-7xl" : "text-8xl"}`}>
                {player.life}
              </div>
            </div>
          </button>

          {/* Life Control Buttons - flex-1 to fill available space */}
          {!readOnly && (
            <div className={`flex-1 flex flex-col w-[96%] mx-auto min-h-0 ${isMobile ? "gap-1 py-1" : "gap-2 py-2"}`}>
              <div className={`grid grid-cols-4 flex-[3] min-h-0 ${isMobile ? "gap-1" : "gap-2"}`}>
                <button
                  onClick={() => onUpdateLife(playerIndex, -5)}
                  className={`bg-[#991b1b] hover:bg-[#b91c1c] active:bg-[#7f1d1d] text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-xl" : "text-2xl"}`}
                  data-testid={`life-minus-5-${playerIndex}`}
                >
                  -5
                </button>
                <button
                  onClick={() => onUpdateLife(playerIndex, -1)}
                  className={`bg-[#b91c1c] hover:bg-[#dc2626] active:bg-[#991b1b] text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-xl" : "text-2xl"}`}
                  data-testid={`life-minus-1-${playerIndex}`}
                >
                  -1
                </button>
                <button
                  onClick={() => onUpdateLife(playerIndex, 1)}
                  className={`bg-[#166534] hover:bg-[#16a34a] active:bg-[#14532d] text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-xl" : "text-2xl"}`}
                  data-testid={`life-plus-1-${playerIndex}`}
                >
                  +1
                </button>
                <button
                  onClick={() => onUpdateLife(playerIndex, 5)}
                  className={`bg-[#14532d] hover:bg-[#166534] active:bg-[#052e16] text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-xl" : "text-2xl"}`}
                  data-testid={`life-plus-5-${playerIndex}`}
                >
                  +5
                </button>
              </div>

              {/* Damage All Others Button and Undo */}
              <div className={`flex flex-1 min-h-0 ${isMobile ? "gap-1" : "gap-2"}`}>
                <button
                  onClick={() => onDamageAllOthers(playerIndex, -1)}
                  className={`flex-1 bg-[#c2410c] hover:bg-[#ea580c] active:bg-[#9a3412] text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-base" : "text-lg"}`}
                >
                  -1 to all others
                </button>
                <button
                  onClick={onUndoDamageAllOthers}
                  disabled={undoStackLength === 0}
                  className={`bg-[#6b7280] hover:bg-[#9ca3af] active:bg-[#4b5563] disabled:bg-[#374151] disabled:text-[#6b7280] disabled:cursor-not-allowed text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-xl px-4" : "text-2xl px-6"}`}
                  title="Undo last damage to all others"
                >
                  ↶
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Commander Damage & Poison Counters */}
          <div className="shrink-0 pb-1 w-[96%] mx-auto">
            {/* Toggle bar */}
            <button
              onClick={() => setIsCommanderExpanded(!isCommanderExpanded)}
              className={`w-full flex items-center justify-center bg-[#2a2a2a] hover:bg-[#333333] transition-colors touch-manipulation ${isMobile ? "py-1" : "py-1.5"}`}
            >
              <span className={`text-[#a3a3a3] font-semibold mr-1.5 ${isMobile ? "text-[9px]" : "text-[11px]"}`}>
                Cmdr / Poison
              </span>
              <svg
                width={isMobile ? "10" : "12"}
                height={isMobile ? "10" : "12"}
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`text-[#a3a3a3] transition-transform duration-200 ${isCommanderExpanded ? "rotate-180" : ""}`}
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            {/* Expandable content */}
            {isCommanderExpanded && (
              <div
                className={`grid grid-cols-4 w-full mt-1 ${isMobile ? "gap-1" : "gap-2"}`}
              >
                {/* Commander Damage Counters */}
                {commanderSources.map((sourceIndex, i) => (
                  <div
                    key={sourceIndex}
                    className={`bg-[#2a2a2a] text-center ${isMobile ? "p-1" : "p-2"}`}
                  >
                    <div className={`flex items-center justify-center h-5 ${isMobile ? "mb-0.5" : "mb-2"}`}>
                      <span className={`text-[#e5e5e5] font-bold leading-none tracking-wide whitespace-nowrap ${isMobile ? "text-[9px]" : "text-xs"}`}>
                        {playerAbbrevs[sourceIndex]} {player.commanderDamage[i]}
                      </span>
                    </div>
                    {!readOnly && (
                      <div className={`flex justify-center items-stretch ${isMobile ? "flex-col gap-1" : "gap-1"}`}>
                        <button
                          onClick={() => onUpdateCommanderDamage(playerIndex, i, 1)}
                          className={`bg-[#166534] hover:bg-[#16a34a] active:bg-[#14532d] text-white text-xs font-bold transition-all duration-150 flex items-center justify-center flex-shrink-0 touch-manipulation ${isMobile ? "w-full h-6" : "w-8 h-8"}`}
                        >
                          <svg width={isMobile ? "10" : "14"} height={isMobile ? "10" : "14"} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onUpdateCommanderDamage(playerIndex, i, -1)}
                          className={`bg-[#991b1b] hover:bg-[#b91c1c] active:bg-[#7f1d1d] text-white text-xs font-bold transition-all duration-150 flex items-center justify-center flex-shrink-0 touch-manipulation ${isMobile ? "w-full h-6" : "w-8 h-8"}`}
                        >
                          <svg width={isMobile ? "10" : "14"} height={isMobile ? "10" : "14"} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13H5v-2h14v2z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Poison Counter */}
                <div className={`bg-[#2a2a2a] text-center ${isMobile ? "p-1" : "p-2"}`}>
                  <div className={`flex items-center justify-center h-5 ${isMobile ? "mb-0.5" : "mb-2"}`}>
                    <div className="flex items-center whitespace-nowrap">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 600 1059.7"
                        className={`mr-1 flex-shrink-0 ${isMobile ? "w-2 h-2" : "w-3 h-3"}`}
                        fill="currentColor"
                      >
                        <path
                          d="m598 529c0.6-57.8-17.7-116.1-53.7-161.4-17.4-19.1-31.7-40.9-50.1-59-40.6-40.3-101.4-43-150.3-68.3-2.9-25.5-12.2-51-6.5-76.7 1.7-8.6 4.3-17.2-0.3-25.4-12.8-29.5-1.8-61.6-4.1-92.4-1.7-16.1-0.6-35.8-16-45.7-3.6 33.5-15.9 64.7-25.9 96.4-4.6 24.8-4.6 50.6-15.3 73.9 6.8 23.7-6.6 43.6-21.1 61.1-32.1 16.4-70.2 20.3-98.2 44.4-19.9 16.9-41.4 31.7-63.7 45.5-16.7 20.9-35.2 41.1-42.7 67.5-29.9 36.1-33.4 84.5-50.3 126.7-0.3 62.7 12.4 130.2 52.4 180.5 28.7 23.7 48.7 55.5 77.3 79.1 27.5 16.4 56.8 29.9 85.2 44.6 18.5 4.3 37.6 6.4 56 11.5 14.9 76.9 25.1 155.6 55.1 228.5 9.9-29.9 8.7-62 17.3-92.3 12.1-44.7-12.7-91.2 1.3-135.2 21-18.7 55.9-6.6 79.2-22.6 44.3-27.3 91.1-53.8 123.2-95.6 11.9-24 37.1-41.9 37.1-70.7 0.2-38.7 22.8-75 14.2-114.2m-328.4 237.2c-32.1-7.8-61.9-23.1-88.8-41.9-28.9-19.3-39.7-55.2-68.3-75-26.7-31.9-21-75.5-31.9-113.3 4.4-26.4 9.6-52.5 12.3-79.2 13-21.1 33.2-38 38.7-63.5 19.1-27.4 48.2-46.3 71.6-70.1 17-19.6 44.1-11.3 66.4-12.1-2.2 21.6-4 44 1.4 65.3 2.6 13.1 8.6 26 6.5 39.7-4.5 29.2 6.5 58.5-1.3 87.3-15.6 60.3 1.4 121.2 2.9 182-2.2 26.9-3.5 54-9.6 80.6m243.1-114.3c-21.2 15.1-39.3 33.6-57.8 51.7-32.2 22.3-64.1 45.8-102.4 57 3.4-27.3 6.8-55.5-1.9-82.2-21.4-60.5 4.8-123.8 9.2-184.9-3.9-36.4-0.2-75.2-16.9-108.7-2.2-25.1 8.7-49.5 16.1-73.1 25.3 10.1 49.2 23.8 70.2 41.3 25.5 19.1 64.5 31.4 70.2 67 2.9 23.4 28.5 37.5 27.7 61.4-1.6 56.8 6.3 116.3-14.4 170.5"
                          fill="currentColor"
                        />
                      </svg>
                      <span
                        className={`text-[#e5e5e5] font-bold leading-none tracking-wide ${isMobile ? "text-[9px]" : "text-xs"}`}
                        data-testid={`poison-counter-${playerIndex}`}
                      >
                        {player.poison}
                      </span>
                    </div>
                  </div>
                  {!readOnly && (
                    <div className={`flex justify-center items-stretch ${isMobile ? "flex-col gap-1" : "gap-1"}`}>
                      <button
                        onClick={() => onUpdatePoison(playerIndex, 1)}
                        className={`bg-[#064e3b] hover:bg-[#065f46] active:bg-[#022c22] text-white text-xs font-bold transition-all duration-150 flex items-center justify-center flex-shrink-0 touch-manipulation ${isMobile ? "w-full h-6" : "w-8 h-8"}`}
                      >
                        <svg width={isMobile ? "10" : "14"} height={isMobile ? "10" : "14"} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onUpdatePoison(playerIndex, -1)}
                        className={`bg-[#991b1b] hover:bg-[#b91c1c] active:bg-[#7f1d1d] text-white text-xs font-bold transition-all duration-150 flex items-center justify-center flex-shrink-0 touch-manipulation ${isMobile ? "w-full h-6" : "w-8 h-8"}`}
                      >
                        <svg width={isMobile ? "10" : "14"} height={isMobile ? "10" : "14"} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13H5v-2h14v2z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
