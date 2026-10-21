import { useState } from "react";
import { PlayerState, Rotation } from "../types";
import { commanderSources, getRotationClass } from "../utils";
import { HistoryModal } from "./HistoryModal";
import { MinusIcon, PlusIcon, PoisonIcon, RotateIcon, SkullIcon } from "./icons";

interface PlayerQuadrantProps {
  player: PlayerState;
  playerIndex: number;
  // The angle to draw at; may differ from player.rotation on phones
  rotation: Rotation;
  playerAbbrevs: string[];
  isMobile: boolean;
  isRotating: boolean;
  canUndo: boolean;
  onUpdateLife: (playerIndex: number, change: number) => void;
  onUpdatePoison: (playerIndex: number, change: number) => void;
  onUpdateCommanderDamage: (playerIndex: number, sourceSlot: number, change: number) => void;
  onUpdateRotation: (playerIndex: number) => void;
  onTogglePlayerDead: (playerIndex: number) => void;
  onDamageAllOthers: (playerIndex: number, damage: number) => void;
  onUndoDamageAllOthers: (playerIndex: number) => void;
}

// Desktop corner for the rotate and death buttons, away from the table centre
const DESKTOP_ROTATE_POSITION = ["top-2 right-2", "top-2 left-2", "bottom-2 left-2", "bottom-2 right-2"];
const DESKTOP_DEATH_POSITION = ["bottom-2 left-2", "bottom-2 right-2", "top-2 right-2", "top-2 left-2"];

const LIFE_BUTTONS = [
  { change: -5, testId: "life-minus-5", className: "bg-[#9a0f08] hover:bg-[#c0140b] active:bg-[#7a0c06]" },
  { change: -1, testId: "life-minus-1", className: "bg-[#c0140b] hover:bg-[#e3170a] active:bg-[#9a0f08]" },
  { change: 1, testId: "life-plus-1", className: "bg-[#1d6637] hover:bg-[#27874a] active:bg-[#17522c]" },
  { change: 5, testId: "life-plus-5", className: "bg-[#17522c] hover:bg-[#1d6637] active:bg-[#0f4420]" },
];

interface CounterButtonsProps {
  isMobile: boolean;
  onChange: (change: number) => void;
}

function CounterButtons({ isMobile, onChange }: CounterButtonsProps) {
  const sizeClass = isMobile ? "w-full h-6" : "w-8 h-8";
  const iconSize = isMobile ? 10 : 14;
  const baseClass = `text-white text-xs font-bold transition-all duration-150 flex items-center justify-center shrink-0 touch-manipulation ${sizeClass}`;
  return (
    <div className={`flex justify-center items-stretch ${isMobile ? "flex-col gap-1" : "gap-1"}`}>
      <button
        onClick={() => onChange(1)}
        className={`bg-[#1d6637] hover:bg-[#27874a] active:bg-[#17522c] ${baseClass}`}
      >
        <PlusIcon size={iconSize} />
      </button>
      <button
        onClick={() => onChange(-1)}
        className={`bg-[#9a0f08] hover:bg-[#c0140b] active:bg-[#7a0c06] ${baseClass}`}
      >
        <MinusIcon size={iconSize} />
      </button>
    </div>
  );
}

export function PlayerQuadrant({
  player,
  playerIndex,
  rotation,
  playerAbbrevs,
  isMobile,
  isRotating,
  canUndo,
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

  const isSideways = rotation === 90 || rotation === 270;
  const rotateClass = `font-bold transition-all duration-200 flex items-center justify-center text-[#fcf6b1]/70 hover:text-[#fcf6b1]/50 p-0 ${
    isRotating ? "text-[#fcf6b1]/40 cursor-not-allowed" : ""
  }`;
  const deathClass = `transition-all duration-200 flex items-center justify-center ${
    player.isDead ? "text-[#e3170a] hover:text-[#f04a3e]" : "text-[#fcf6b1]/70 hover:text-[#f04a3e]"
  }`;
  const deathTitle = player.isDead ? "Revive player" : "Mark as dead";

  return (
    <div className="relative w-full h-full border border-[#543f63] bg-[#3a2942] overflow-hidden" data-testid={`player-quadrant-${playerIndex}`}>
      {/* History Modal - covers this quadrant only */}
      <HistoryModal
        isOpen={isHistoryOpen}
        player={player}
        isMobile={isMobile}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Dead overlay */}
      {player.isDead && (
        <div className="absolute inset-0 bg-[#1a0f1c]/60 z-20 pointer-events-none" />
      )}

      {/* Desktop: buttons sit in fixed corners and don't rotate */}
      {!isMobile && (
        <>
          <button
            onClick={() => onUpdateRotation(playerIndex)}
            disabled={isRotating}
            className={`absolute z-30 w-11 h-11 text-sm ${rotateClass} ${DESKTOP_ROTATE_POSITION[playerIndex]}`}
            title="Rotate view"
          >
            <RotateIcon size={20} />
          </button>
          <button
            onClick={() => onTogglePlayerDead(playerIndex)}
            className={`absolute z-30 w-11 h-11 ${deathClass} ${DESKTOP_DEATH_POSITION[playerIndex]}`}
            title={deathTitle}
          >
            <SkullIcon size={20} />
          </button>
        </>
      )}

      <div
        className={`absolute ${player.isDead ? "opacity-50" : ""}`}
        style={
          isSideways
            ? {
                // Landscape container (rotated): center within quadrant
                top: "50%",
                left: "50%",
                width: "calc(100dvh / 2 - 1rem)",
                height: "calc(100vw / 2 - 1rem)",
                transform: "translate(-50%, -50%)",
                transformOrigin: "center",
              }
            : {
                // Portrait container (normal): use full quadrant
                top: "0.5rem",
                left: "0.5rem",
                width: "calc(100vw / 2 - 1rem)",
                height: "calc(100dvh / 2 - 1rem)",
              }
        }
      >
        <div className={`w-full h-full flex flex-col ${getRotationClass(rotation)}`}>
          {/* Mobile: buttons rotate with the quadrant, in its top corners */}
          {isMobile && (
            <>
              <button
                onClick={() => onUpdateRotation(playerIndex)}
                disabled={isRotating}
                className={`absolute top-1 left-1 z-10 w-10 h-10 text-xs ${rotateClass}`}
                title="Flip view"
              >
                <RotateIcon size={16} />
              </button>
              <button
                onClick={() => onTogglePlayerDead(playerIndex)}
                className={`absolute top-1 right-1 z-10 w-10 h-10 ${deathClass}`}
                title={deathTitle}
              >
                <SkullIcon size={18} />
              </button>
            </>
          )}

          {/* Player Name + Life Total - tappable to open history */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="shrink-0 w-full flex flex-col items-center cursor-pointer group pt-1"
          >
            <h2 className={`font-bold text-[#fcf6b1] tracking-wide truncate group-hover:text-[#a9e5bb] transition-colors ${isMobile ? "text-base" : "text-lg"}`}>
              {player.name}
            </h2>
            <div className="relative">
              <div className={`font-bold text-[#fcf6b1] select-none tracking-tight leading-none ${isMobile ? "text-7xl" : "text-8xl"}`} data-testid={`life-total-${playerIndex}`}>
                {player.life}
              </div>
              <div className={`absolute inset-0 font-bold text-[#1d6637] select-none tracking-tight leading-none opacity-15 blur-xs ${isMobile ? "text-7xl" : "text-8xl"}`}>
                {player.life}
              </div>
            </div>
          </button>

          {/* Life Control Buttons - flex-1 to fill available space */}
          <div className={`flex-1 flex flex-col w-[96%] mx-auto min-h-0 ${isMobile ? "gap-1 py-1" : "gap-2 py-2"}`}>
            <div className={`grid grid-cols-4 flex-3 min-h-0 ${isMobile ? "gap-1" : "gap-2"}`}>
              {LIFE_BUTTONS.map(({ change, testId, className }) => (
                <button
                  key={change}
                  onClick={() => onUpdateLife(playerIndex, change)}
                  className={`${className} text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-xl" : "text-2xl"}`}
                  data-testid={`${testId}-${playerIndex}`}
                >
                  {change > 0 ? `+${change}` : change}
                </button>
              ))}
            </div>

            {/* Damage All Others Button and Undo */}
            <div className={`flex flex-1 min-h-0 ${isMobile ? "gap-1" : "gap-2"}`}>
              <button
                onClick={() => onDamageAllOthers(playerIndex, -1)}
                className={`flex-1 bg-[#c99a1c] hover:bg-[#f7b32b] active:bg-[#a58018] text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-base" : "text-lg"}`}
                data-testid={`damage-others-${playerIndex}`}
              >
                -1 others
              </button>
              <button
                onClick={() => onUndoDamageAllOthers(playerIndex)}
                disabled={!canUndo}
                className={`bg-[#6b5a78] hover:bg-[#8a7899] active:bg-[#4e3c57] disabled:bg-[#382840] disabled:text-[#5a4a66] disabled:cursor-not-allowed text-white font-bold transition-all duration-150 touch-manipulation flex items-center justify-center ${isMobile ? "text-xl px-4" : "text-2xl px-6"}`}
                title="Undo your last -1 others"
                data-testid={`undo-damage-others-${playerIndex}`}
              >
                ↶
              </button>
            </div>
          </div>

          {/* Collapsible Commander Damage & Poison Counters */}
          <div className="shrink-0 pb-1 w-[96%] mx-auto">
            <button
              onClick={() => setIsCommanderExpanded(!isCommanderExpanded)}
              className={`w-full flex items-center justify-center bg-[#473455] hover:bg-[#543f63] transition-colors touch-manipulation ${isMobile ? "py-1" : "py-1.5"}`}
            >
              <span className={`text-[#9d88aa] font-semibold mr-1.5 ${isMobile ? "text-[9px]" : "text-[11px]"}`}>
                Cmdr / Poison
              </span>
              <svg
                width={isMobile ? "10" : "12"}
                height={isMobile ? "10" : "12"}
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`text-[#9d88aa] transition-transform duration-200 ${isCommanderExpanded ? "rotate-180" : ""}`}
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            {isCommanderExpanded && (
              <div className={`grid grid-cols-4 w-full mt-1 ${isMobile ? "gap-1" : "gap-2"}`}>
                {/* Commander Damage Counters */}
                {commanderSources(playerIndex).map((sourceIndex, slot) => (
                  <div key={sourceIndex} className={`bg-[#473455] text-center ${isMobile ? "p-1" : "p-2"}`}>
                    <div className={`flex items-center justify-center h-5 ${isMobile ? "mb-0.5" : "mb-2"}`}>
                      <span className={`text-[#e8e0a0] font-bold leading-none tracking-wide whitespace-nowrap ${isMobile ? "text-[9px]" : "text-xs"}`}>
                        {playerAbbrevs[sourceIndex]} {player.commanderDamage[slot]}
                      </span>
                    </div>
                    <CounterButtons
                      isMobile={isMobile}
                      onChange={(change) => onUpdateCommanderDamage(playerIndex, slot, change)}
                    />
                  </div>
                ))}

                {/* Poison Counter */}
                <div className={`bg-[#473455] text-center ${isMobile ? "p-1" : "p-2"}`}>
                  <div className={`flex items-center justify-center h-5 ${isMobile ? "mb-0.5" : "mb-2"}`}>
                    <div className="flex items-center whitespace-nowrap">
                      <PoisonIcon className={`mr-1 shrink-0 ${isMobile ? "w-2 h-2" : "w-3 h-3"}`} />
                      <span
                        className={`text-[#e8e0a0] font-bold leading-none tracking-wide ${isMobile ? "text-[9px]" : "text-xs"}`}
                        data-testid={`poison-counter-${playerIndex}`}
                      >
                        {player.poison}
                      </span>
                    </div>
                  </div>
                  <CounterButtons
                    isMobile={isMobile}
                    onChange={(change) => onUpdatePoison(playerIndex, change)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
