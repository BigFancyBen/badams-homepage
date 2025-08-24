"use client";

import { useState, useEffect, useRef } from "react";

interface HistoryEntry {
  action: string;
  timestamp: number;
}

interface PlayerState {
  life: number;
  commanderDamage: [number, number, number]; // damage from 3 other players
  rotation: 0 | 90 | 180 | 270; // rotation in degrees
  name: string;
  history: HistoryEntry[];
  poison: number;
  isDead: boolean;
}

export default function CommanderPage() {
  // Determine initial rotation based on mobile landscape
  const getInitialRotation = () => {
    if (typeof window !== "undefined") {
      // Use height to detect mobile in landscape (height < 500 typically indicates mobile landscape)
      const isMobileLandscape =
        window.innerHeight < 500 && window.innerWidth > window.innerHeight;
      const isMobilePortrait =
        window.innerWidth < 768 && window.innerHeight > window.innerWidth;
      const isLandscape = window.innerWidth > window.innerHeight;

      // For mobile devices in landscape orientation, start rotated 90°
      return isMobileLandscape || (isMobilePortrait && isLandscape) ? 90 : 0;
    }
    return 0;
  };

  const [players, setPlayers] = useState<PlayerState[]>([
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: getInitialRotation(),
      name: "Player 1",
      history: [],
      poison: 0,
      isDead: false,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: getInitialRotation(),
      name: "Player 2",
      history: [],
      poison: 0,
      isDead: false,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: getInitialRotation(),
      name: "Player 3",
      history: [],
      poison: 0,
      isDead: false,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: getInitialRotation(),
      name: "Player 4",
      history: [],
      poison: 0,
      isDead: false,
    },
  ]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [rotatingPlayer, setRotatingPlayer] = useState<number | null>(null);

  // Handle orientation changes on mobile
  useEffect(() => {
    const handleOrientationChange = () => {
      if (typeof window !== "undefined") {
        const isMobileLandscape =
          window.innerHeight < 500 && window.innerWidth > window.innerHeight;
        const isMobilePortrait =
          window.innerWidth < 768 && window.innerHeight > window.innerWidth;
        const isLandscape = window.innerWidth > window.innerHeight;

        if (isMobileLandscape || isMobilePortrait) {
          setPlayers((prev) =>
            prev.map((player) => ({
              ...player,
              rotation: isLandscape ? 90 : 0,
            }))
          );
        }
      }
    };

    window.addEventListener("resize", handleOrientationChange);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", handleOrientationChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  // Generate unique abbreviations for player names
  const generateAbbreviations = () => {
    const abbreviations: string[] = [];
    const usedAbbrevs = new Set<string>();

    // First pass: find common prefixes and group similar names
    const nameGroups: { [key: string]: number[] } = {};

    players.forEach((player, index) => {
      // If using default name, keep P1, P2, etc.
      if (player.name === `Player ${index + 1}`) {
        abbreviations[index] = `P${index + 1}`;
        return;
      }

      const name = player.name.trim().toLowerCase();
      // Try to find a meaningful 3-character prefix
      const prefix = name.substring(0, 3);

      if (!nameGroups[prefix]) {
        nameGroups[prefix] = [];
      }
      nameGroups[prefix].push(index);
    });

    // Second pass: assign abbreviations
    Object.entries(nameGroups).forEach(([prefix, indices]) => {
      if (indices.length === 1) {
        // Only one name with this prefix, use 3 characters
        const index = indices[0];
        const abbrev = prefix.toUpperCase();
        usedAbbrevs.add(abbrev);
        abbreviations[index] = abbrev;
      } else {
        // Multiple names with same prefix, use prefix + numbers
        indices.forEach((index, i) => {
          const abbrev = prefix.toUpperCase() + (i + 1);
          usedAbbrevs.add(abbrev);
          abbreviations[index] = abbrev;
        });
      }
    });

    return abbreviations;
  };

  const playerAbbrevs = generateAbbreviations();

  const addHistory = (playerIndex: number, action: string) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex
          ? {
              ...player,
              history: [
                { action, timestamp: Date.now() },
                ...player.history, // Keep all history
              ],
            }
          : player
      )
    );
  };

  const updatePoison = (playerIndex: number, change: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex
          ? { ...player, poison: Math.max(0, player.poison + change) }
          : player
      )
    );

    const changeText = change > 0 ? `+${change}` : `${change}`;
    const actionType = change > 0 ? "positive" : "negative";
    addHistory(playerIndex, `Poison ${changeText}|poison`);
  };

  const updateLife = (playerIndex: number, change: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex
          ? { ...player, life: Math.max(0, player.life + change) }
          : player
      )
    );

    const changeText = change > 0 ? `+${change}` : `${change}`;
    const actionType = change > 0 ? "positive" : "negative";
    addHistory(playerIndex, `${changeText}|${actionType}`);
  };

  const updateCommanderDamage = (
    playerIndex: number,
    sourceIndex: number,
    change: number
  ) => {
    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index === playerIndex) {
          const newDamage = [...player.commanderDamage];
          newDamage[sourceIndex] = Math.max(
            0,
            Math.min(21, newDamage[sourceIndex] + change)
          );
          return {
            ...player,
            commanderDamage: newDamage as [number, number, number],
          };
        }
        return player;
      })
    );

    const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);
    const actualSourceIndex = commanderSources[sourceIndex];
    const changeText = change > 0 ? `+${change}` : `${change}`;
    const actionType = change > 0 ? "positive" : "negative";
    const sourceName =
      players[actualSourceIndex]?.name || `P${actualSourceIndex + 1}`;
    addHistory(
      playerIndex,
      `${sourceName} ${changeText} commander damage|commander`
    );
  };

  const updateRotation = (playerIndex: number) => {
    // Prevent rapid clicking
    if (rotatingPlayer === playerIndex) return;

    setRotatingPlayer(playerIndex);

    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index === playerIndex) {
          // Detect mobile using height for landscape detection
          const isMobileLandscape =
            window.innerHeight < 500 && window.innerWidth > window.innerHeight;
          const isMobilePortrait =
            window.innerWidth < 768 && window.innerHeight > window.innerWidth;
          const isLandscape = window.innerWidth > window.innerHeight;

          let newRotation: number;
          if (isMobileLandscape || isMobilePortrait) {
            if (isLandscape) {
              // Mobile landscape: flip between 90° and 270°
              newRotation = player.rotation === 90 ? 270 : 90;
            } else {
              // Mobile portrait: flip between 0° and 180°
              newRotation = player.rotation === 0 ? 180 : 0;
            }
          } else {
            // Desktop: full 4-way rotation
            newRotation = (player.rotation + 90) % 360;
          }

          return {
            ...player,
            rotation: newRotation as 0 | 90 | 180 | 270,
          };
        }
        return player;
      })
    );

    // Clear the rotating state after a short delay
    setTimeout(() => {
      setRotatingPlayer(null);
    }, 300);
  };

  const togglePlayerDead = (playerIndex: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex ? { ...player, isDead: !player.isDead } : player
      )
    );
  };

  const damageAllOthers = (playerIndex: number, damage: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index !== playerIndex
          ? { ...player, life: Math.max(0, player.life + damage) }
          : player
      )
    );

    // Add history to all other players
    const changeText = damage > 0 ? `+${damage}` : `${damage}`;
    const actionType = damage > 0 ? "positive" : "negative";
    const sourceName = players[playerIndex]?.name || `P${playerIndex + 1}`;
    [0, 1, 2, 3].forEach((index) => {
      if (index !== playerIndex) {
        addHistory(index, `${changeText} from ${sourceName}|${actionType}`);
      }
    });
  };

  const updatePlayerName = (playerIndex: number, name: string) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex ? { ...player, name } : player
      )
    );
  };

  const resetGame = () => {
    setPlayers((prev) =>
      prev.map((player, index) => ({
        life: 40,
        commanderDamage: [0, 0, 0] as [number, number, number],
        rotation: player.rotation, // Keep current rotation
        name: player.name, // Keep current name
        history: [], // Clear history
        poison: 0, // Reset poison
        isDead: false, // Reset dead status
      }))
    );
    setShowResetConfirm(false);
    setIsMenuOpen(false);
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  const PlayerQuadrant = ({
    player,
    playerIndex,
  }: {
    player: PlayerState;
    playerIndex: number;
  }) => {
    const [lastActionTime, setLastActionTime] = useState<number>(0);

    // Track the most recent action for highlighting
    useEffect(() => {
      if (player.history.length > 0) {
        setLastActionTime(player.history[0].timestamp);
      }
    }, [player.history]);

    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // Dynamic rotation based on player's rotation state
    const getRotationClass = (rotation: number) => {
      switch (rotation) {
        case 0:
          return "rotate-0 origin-center";
        case 90:
          return "rotate-90 origin-center";
        case 180:
          return "rotate-180 origin-center";
        case 270:
          return "-rotate-90 origin-center";
        default:
          return "rotate-0 origin-center";
      }
    };

    const rotationClass = getRotationClass(player.rotation);

    // Get commander damage sources (other players)
    const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);

    return (
      <div className="relative w-full h-full border border-[#333333] bg-[#222222] overflow-hidden">
        {/* Dead overlay */}
        {player.isDead && (
          <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none" />
        )}

        {/* Corner Controls - positioned outside of rotated container */}
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <button
            onClick={() => togglePlayerDead(playerIndex)}
            className={`text-xs font-bold py-1.5 px-1.5 transition-all duration-200 w-7 h-7 flex items-center justify-center ${
              player.isDead
                ? "bg-[#7a1a1a] hover:bg-[#8a2a2a] text-[#cccccc]"
                : "bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc]"
            }`}
            title={player.isDead ? "Revive player" : "Mark as dead"}
          >
            💀
          </button>
          <button
            onClick={() => updateRotation(playerIndex)}
            disabled={rotatingPlayer === playerIndex}
            className={`text-xs font-bold py-1.5 px-1.5 transition-all duration-200 w-7 h-7 flex items-center justify-center ${
              rotatingPlayer === playerIndex
                ? "bg-[#1a1a1a] text-[#666666] cursor-not-allowed"
                : "bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc]"
            }`}
            title={
              (window.innerHeight < 500 &&
                window.innerWidth > window.innerHeight) ||
              (window.innerWidth < 768 &&
                window.innerHeight > window.innerWidth)
                ? "Flip view"
                : "Rotate view"
            }
          >
            ↻
          </button>
        </div>

        <div
          className={`absolute ${player.isDead ? "opacity-50" : ""}`}
          style={{
            ...(player.rotation === 90 || player.rotation === 270
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
            {/* Player Label */}
            <div className="text-center mb-1 shrink-0">
              <h2 className="text-lg font-bold text-[#ffffff] tracking-wide truncate">
                {player.name}
              </h2>
            </div>

            {/* Life Counter */}
            <div className="shrink-0 flex flex-col items-center justify-center">
              <div className="relative mb-1">
                <div className="text-4xl font-bold text-[#f5f5f5] mb-1 select-none tracking-tight">
                  {player.life}
                </div>
                <div className="absolute inset-0 text-4xl font-bold text-[#166534] mb-1 select-none tracking-tight opacity-15 blur-sm">
                  {player.life}
                </div>
              </div>

              {/* Life Control Buttons */}
              <div className="flex flex-col gap-1 w-full max-w-xs">
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => updateLife(playerIndex, -5)}
                    className="bg-[#991b1b] hover:bg-[#b91c1c] text-white text-xs font-bold py-1.5 px-1 transition-all duration-150"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => updateLife(playerIndex, -1)}
                    className="bg-[#b91c1c] hover:bg-[#dc2626] text-white text-xs font-bold py-1.5 px-1 transition-all duration-150"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => updateLife(playerIndex, 1)}
                    className="bg-[#166534] hover:bg-[#16a34a] text-white text-xs font-bold py-1.5 px-1 transition-all duration-150"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => updateLife(playerIndex, 5)}
                    className="bg-[#14532d] hover:bg-[#166534] text-white text-xs font-bold py-1.5 px-1 transition-all duration-150"
                  >
                    +5
                  </button>
                </div>

                {/* Damage All Others Button */}
                <button
                  onClick={() => damageAllOthers(playerIndex, -1)}
                  className="bg-[#c2410c] hover:bg-[#ea580c] text-white text-xs font-bold py-1.5 px-2 transition-all duration-150"
                >
                  -1 to all others
                </button>
              </div>
            </div>

            {/* History */}
            <div className="flex-1 mt-1 mb-1 w-full max-w-xs mx-auto flex flex-col min-h-0">
              <div className="bg-[#2a2a2a] p-2 flex-1 overflow-y-auto min-h-0">
                <div className="text-[9px] text-[#a3a3a3] font-semibold mb-1 pb-1 border-b border-[#404040]">
                  Recent Actions:
                </div>
                {player.history.length === 0 ? (
                  <div className="text-[8px] text-[#888888] italic mt-1">
                    No actions yet
                  </div>
                ) : (
                  <div className="mt-1">
                    {player.history.map((entry, index) => {
                      const [text, type] = entry.action.split("|");
                      let textColor = "text-[#a3a3a3]"; // default

                      if (type === "positive") {
                        textColor = "text-[#22c55e]";
                      } else if (type === "negative") {
                        textColor = "text-[#dc2626]";
                      } else if (type === "poison") {
                        textColor = "text-[#a855f7]";
                      } else if (type === "commander") {
                        textColor = "text-[#3b82f6]";
                      }

                      return (
                        <div
                          key={`${entry.timestamp}-${index}`}
                          className={`flex justify-between items-center text-[8px] leading-tight font-medium py-1 border-b border-[#404040] ${textColor}`}
                        >
                          <span className="truncate pr-1">{text}</span>
                          <span className="text-[#888888] text-[7px] shrink-0">
                            {formatTime(entry.timestamp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Commander Damage & Poison Counters */}
            <div className="shrink-0 pb-4">
              <div className="flex flex-wrap gap-1 justify-center pb-2 w-full max-w-xs mx-auto">
                {/* Commander Damage Counters */}
                {commanderSources.map((sourceIndex, i) => (
                  <div
                    key={sourceIndex}
                    className="bg-[#2a2a2a] p-2 text-center flex-1 min-w-0"
                    style={{ minWidth: "52px" }}
                  >
                    <div className="flex items-center justify-center mb-1 h-5">
                      <span className="text-xs text-[#e5e5e5] font-bold leading-none tracking-wide whitespace-nowrap">
                        {playerAbbrevs[sourceIndex]}:{" "}
                        {player.commanderDamage[i]}
                      </span>
                    </div>
                    <div className="flex gap-1 justify-center items-center">
                      <button
                        onClick={() =>
                          updateCommanderDamage(playerIndex, i, -1)
                        }
                        className="bg-[#991b1b] hover:bg-[#b91c1c] text-white text-[8px] font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center"
                      >
                        -
                      </button>
                      <button
                        onClick={() => updateCommanderDamage(playerIndex, i, 1)}
                        className="bg-[#166534] hover:bg-[#16a34a] text-white text-[8px] font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}

                {/* Poison Counter */}
                <div
                  className="bg-[#2a2a2a] p-2 text-center flex-1 min-w-0"
                  style={{ minWidth: "52px" }}
                >
                  <div className="flex items-center justify-center mb-1 h-5">
                    <div className="flex items-center whitespace-nowrap">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 600 1059.7"
                        className="w-3 h-3 mr-1 flex-shrink-0"
                        fill="currentColor"
                      >
                        <path
                          d="m598 529c0.6-57.8-17.7-116.1-53.7-161.4-17.4-19.1-31.7-40.9-50.1-59-40.6-40.3-101.4-43-150.3-68.3-2.9-25.5-12.2-51-6.5-76.7 1.7-8.6 4.3-17.2-0.3-25.4-12.8-29.5-1.8-61.6-4.1-92.4-1.7-16.1-0.6-35.8-16-45.7-3.6 33.5-15.9 64.7-25.9 96.4-4.6 24.8-4.6 50.6-15.3 73.9 6.8 23.7-6.6 43.6-21.1 61.1-32.1 16.4-70.2 20.3-98.2 44.4-19.9 16.9-41.4 31.7-63.7 45.5-16.7 20.9-35.2 41.1-42.7 67.5-29.9 36.1-33.4 84.5-50.3 126.7-0.3 62.7 12.4 130.2 52.4 180.5 28.7 23.7 48.7 55.5 77.3 79.1 27.5 16.4 56.8 29.9 85.2 44.6 18.5 4.3 37.6 6.4 56 11.5 14.9 76.9 25.1 155.6 55.1 228.5 9.9-29.9 8.7-62 17.3-92.3 12.1-44.7-12.7-91.2 1.3-135.2 21-18.7 55.9-6.6 79.2-22.6 44.3-27.3 91.1-53.8 123.2-95.6 11.9-24 37.1-41.9 37.1-70.7 0.2-38.7 22.8-75 14.2-114.2m-328.4 237.2c-32.1-7.8-61.9-23.1-88.8-41.9-28.9-19.3-39.7-55.2-68.3-75-26.7-31.9-21-75.5-31.9-113.3 4.4-26.4 9.6-52.5 12.3-79.2 13-21.1 33.2-38 38.7-63.5 19.1-27.4 48.2-46.3 71.6-70.1 17-19.6 44.1-11.3 66.4-12.1-2.2 21.6-4 44 1.4 65.3 2.6 13.1 8.6 26 6.5 39.7-4.5 29.2 6.5 58.5-1.3 87.3-15.6 60.3 1.4 121.2 2.9 182-2.2 26.9-3.5 54-9.6 80.6m243.1-114.3c-21.2 15.1-39.3 33.6-57.8 51.7-32.2 22.3-64.1 45.8-102.4 57 3.4-27.3 6.8-55.5-1.9-82.2-21.4-60.5 4.8-123.8 9.2-184.9-3.9-36.4-0.2-75.2-16.9-108.7-2.2-25.1 8.7-49.5 16.1-73.1 25.3 10.1 49.2 23.8 70.2 41.3 25.5 19.1 64.5 31.4 70.2 67 2.9 23.4 28.5 37.5 27.7 61.4-1.6 56.8 6.3 116.3-14.4 170.5"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="text-xs text-[#e5e5e5] font-bold leading-none tracking-wide">
                        {player.poison}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 justify-center items-center">
                    <button
                      onClick={() => updatePoison(playerIndex, -1)}
                      className="bg-[#991b1b] hover:bg-[#b91c1c] text-white text-[8px] font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center"
                    >
                      -
                    </button>
                    <button
                      onClick={() => updatePoison(playerIndex, 1)}
                      className="bg-[#064e3b] hover:bg-[#065f46] text-white text-[8px] font-bold transition-all duration-150 w-4 h-4 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] overflow-hidden relative select-none">
      {/* Menu Button */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="absolute top-4 left-4 z-30 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#cccccc] font-bold py-1.5 px-1.5 transition-all duration-200 w-7 h-7 flex items-center justify-center"
        title="Game Settings"
      >
        ⚙️
      </button>

      {/* Menu Modal */}
      {isMenuOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 p-4">
          <div
            className={`bg-[#2a2a2a] w-full max-h-[90vh] overflow-y-auto ${
              // Mobile-specific sizing
              (window.innerHeight < 500 &&
                window.innerWidth > window.innerHeight) ||
              (window.innerWidth < 768 &&
                window.innerHeight > window.innerWidth)
                ? "max-w-[95vw] p-4" // Mobile: wider, less padding
                : "max-w-md p-8 mx-4" // Desktop: normal
            }`}
          >
            <h3
              className={`font-bold text-[#f5f5f5] mb-4 tracking-wide ${
                // Mobile-specific text sizing
                (window.innerHeight < 500 &&
                  window.innerWidth > window.innerHeight) ||
                (window.innerWidth < 768 &&
                  window.innerHeight > window.innerWidth)
                  ? "text-lg" // Mobile: smaller header
                  : "text-2xl mb-6" // Desktop: larger header
              }`}
            >
              Game Settings
            </h3>

            {/* Player Names */}
            <div className="mb-2">
              <h4
                className={`font-bold text-[#cccccc] tracking-wide mb-3 ${
                  // Mobile-specific text sizing
                  (window.innerHeight < 500 &&
                    window.innerWidth > window.innerHeight) ||
                  (window.innerWidth < 768 &&
                    window.innerHeight > window.innerWidth)
                    ? "text-base" // Mobile: smaller subheader
                    : "text-lg" // Desktop: larger subheader
                }`}
              >
                Player Names
              </h4>
              <div
                className={`${
                  // Mobile landscape: grid layout
                  window.innerHeight < 500 &&
                  window.innerWidth > window.innerHeight
                    ? "grid grid-cols-2 gap-2"
                    : "space-y-3"
                }`}
              >
                {players.map((player, index) => (
                  <div
                    key={index}
                    className={`flex items-center ${
                      // Mobile landscape: adjust layout
                      window.innerHeight < 500 &&
                      window.innerWidth > window.innerHeight
                        ? "flex-col gap-1"
                        : "gap-3"
                    }`}
                  >
                    <span
                      className={`text-[#b3b3b3] font-semibold ${
                        // Mobile-specific label sizing
                        window.innerHeight < 500 &&
                        window.innerWidth > window.innerHeight
                          ? "text-xs w-full text-center"
                          : "text-sm w-20"
                      }`}
                    >
                      Player {index + 1}:
                    </span>
                    <input
                      type="text"
                      value={
                        player.name === `Player ${index + 1}` ? "" : player.name
                      }
                      onChange={(e) =>
                        updatePlayerName(
                          index,
                          e.target.value || `Player ${index + 1}`
                        )
                      }
                      className={`flex-1 bg-[#1a1a1a] text-[#e5e5e5] focus:border-[#4ade80] focus:ring-2 focus:ring-[#4ade80]/20 focus:outline-none transition-all duration-200 font-medium ${
                        // Mobile-specific input sizing
                        (window.innerHeight < 500 &&
                          window.innerWidth > window.innerHeight) ||
                        (window.innerWidth < 768 &&
                          window.innerHeight > window.innerWidth)
                          ? "px-2 py-2 text-sm" // Mobile: smaller input
                          : "px-4 py-3" // Desktop: larger input
                      }`}
                      placeholder={`Player ${index + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="text-center">
                <p
                  className={`text-[#f5f5f5] font-bold mb-2 transition-opacity duration-200 ${
                    showResetConfirm ? "opacity-100" : "opacity-0"
                  } ${
                    // Mobile-specific text sizing
                    (window.innerHeight < 500 &&
                      window.innerWidth > window.innerHeight) ||
                    (window.innerWidth < 768 &&
                      window.innerHeight > window.innerWidth)
                      ? "text-xs" // Mobile: smaller confirmation text
                      : "text-sm" // Desktop: normal size
                  }`}
                >
                  Are you sure you want to reset the entire game?
                </p>
              </div>
              {!showResetConfirm ? (
                <div
                  className={`flex ${
                    // Mobile landscape: stack buttons vertically for space
                    window.innerHeight < 500 &&
                    window.innerWidth > window.innerHeight
                      ? "flex-col gap-2"
                      : "gap-4"
                  }`}
                >
                  <button
                    onClick={handleResetClick}
                    className={`flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white font-bold transition-all duration-200 ${
                      // Mobile-specific button sizing
                      (window.innerHeight < 500 &&
                        window.innerWidth > window.innerHeight) ||
                      (window.innerWidth < 768 &&
                        window.innerHeight > window.innerWidth)
                        ? "py-3 px-4 text-sm" // Mobile: smaller buttons
                        : "py-4 px-6" // Desktop: larger buttons
                    }`}
                  >
                    Reset Game
                  </button>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex-1 bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] font-bold transition-all duration-200 ${
                      // Mobile-specific button sizing
                      (window.innerHeight < 500 &&
                        window.innerWidth > window.innerHeight) ||
                      (window.innerWidth < 768 &&
                        window.innerHeight > window.innerWidth)
                        ? "py-3 px-4 text-sm" // Mobile: smaller buttons
                        : "py-4 px-6" // Desktop: larger buttons
                    }`}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div
                  className={`flex ${
                    // Mobile landscape: stack buttons vertically for space
                    window.innerHeight < 500 &&
                    window.innerWidth > window.innerHeight
                      ? "flex-col gap-2"
                      : "gap-4"
                  }`}
                >
                  <button
                    onClick={resetGame}
                    className={`flex-1 bg-[#991b1b] hover:bg-[#b91c1c] text-white font-bold transition-all duration-200 ${
                      // Mobile-specific button sizing
                      (window.innerHeight < 500 &&
                        window.innerWidth > window.innerHeight) ||
                      (window.innerWidth < 768 &&
                        window.innerHeight > window.innerWidth)
                        ? "py-3 px-4 text-sm" // Mobile: smaller buttons
                        : "py-4 px-6" // Desktop: larger buttons
                    }`}
                  >
                    Yes, Reset
                  </button>
                  <button
                    onClick={cancelReset}
                    className={`flex-1 bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] font-bold transition-all duration-200 ${
                      // Mobile-specific button sizing
                      (window.innerHeight < 500 &&
                        window.innerWidth > window.innerHeight) ||
                      (window.innerWidth < 768 &&
                        window.innerHeight > window.innerWidth)
                        ? "py-3 px-4 text-sm" // Mobile: smaller buttons
                        : "py-4 px-6" // Desktop: larger buttons
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4 Player Quadrants - Perfect quarters of the screen */}
      <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
        <div className="w-full h-full">
          <PlayerQuadrant player={players[0]} playerIndex={0} />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant player={players[1]} playerIndex={1} />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant player={players[3]} playerIndex={3} />
        </div>
        <div className="w-full h-full">
          <PlayerQuadrant player={players[2]} playerIndex={2} />
        </div>
      </div>
    </div>
  );
}
