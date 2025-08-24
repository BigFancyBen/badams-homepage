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
}

export default function CommanderPage() {
  const [players, setPlayers] = useState<PlayerState[]>([
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0,
      name: "Player 1",
      history: [],
      poison: 0,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0,
      name: "Player 2",
      history: [],
      poison: 0,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0,
      name: "Player 3",
      history: [],
      poison: 0,
    },
    {
      life: 40,
      commanderDamage: [0, 0, 0],
      rotation: 0,
      name: "Player 4",
      history: [],
      poison: 0,
    },
  ]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex
          ? {
              ...player,
              rotation: ((player.rotation + 90) % 360) as 0 | 90 | 180 | 270,
            }
          : player
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
      }))
    );
    setIsMenuOpen(false);
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
          return "rotate-0";
        case 90:
          return "rotate-90";
        case 180:
          return "rotate-180";
        case 270:
          return "-rotate-90";
        default:
          return "rotate-0";
      }
    };

    const rotationClass = getRotationClass(player.rotation);

    // Get commander damage sources (other players)
    const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);

    return (
      <div className="relative w-full h-full border-2 border-slate-600/30 bg-slate-900 overflow-hidden">
        <div
          className={`absolute inset-4 flex flex-col ${rotationClass} h-full`}
        >
          {/* Player Label and Rotation Control */}
          <div className="text-center mb-1 flex items-center justify-center gap-2 shrink-0">
            <h2 className="text-lg font-black text-slate-100 tracking-wide truncate drop-shadow-lg">
              {player.name}
            </h2>
            <button
              onClick={() => updateRotation(playerIndex)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-1.5 px-1.5 shadow-lg hover:shadow-xl transition-all duration-200 w-7 h-7 flex items-center justify-center border border-slate-500/50"
              title="Rotate view"
            >
              ↻
            </button>
          </div>

          {/* Life Counter */}
          <div className="shrink-0 flex flex-col items-center justify-center">
            <div className="relative mb-2">
              <div className="text-5xl font-black text-slate-100 mb-2 select-none tracking-tight drop-shadow-2xl">
                {player.life}
              </div>
              <div className="absolute inset-0 text-5xl font-black text-emerald-400 mb-2 select-none tracking-tight opacity-20 blur-sm">
                {player.life}
              </div>
            </div>

            {/* Life Control Buttons */}
            <div className="flex flex-col gap-1 w-full max-w-[270px]">
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => updateLife(playerIndex, -5)}
                  className="bg-red-700 hover:bg-red-600 text-white text-xs font-bold py-1.5 px-1 shadow-md hover:shadow-lg transition-all duration-150 border-b-2 border-red-900 active:border-red-700"
                >
                  -5
                </button>
                <button
                  onClick={() => updateLife(playerIndex, -1)}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-1.5 px-1 shadow-md hover:shadow-lg transition-all duration-150 border-b-2 border-red-800 active:border-red-600"
                >
                  -1
                </button>
                <button
                  onClick={() => updateLife(playerIndex, 1)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-1 shadow-md hover:shadow-lg transition-all duration-150 border-b-2 border-emerald-800 active:border-emerald-600"
                >
                  +1
                </button>
                <button
                  onClick={() => updateLife(playerIndex, 5)}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold py-1.5 px-1 shadow-md hover:shadow-lg transition-all duration-150 border-b-2 border-emerald-900 active:border-emerald-700"
                >
                  +5
                </button>
              </div>

              {/* Damage All Others Button */}
              <button
                onClick={() => damageAllOthers(playerIndex, -1)}
                className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold py-1.5 px-2 shadow-md hover:shadow-lg transition-all duration-150 border-b-2 border-orange-800 active:border-orange-600"
              >
                -1 to all others
              </button>
            </div>
          </div>

          {/* History */}
          <div className="flex-1 mt-2 mb-2 w-full max-w-[270px] mx-auto flex flex-col min-h-0">
            <div className="bg-slate-800 border border-slate-700/50 border-b-2 border-b-slate-950 p-2 flex-1 overflow-y-auto min-h-0">
              <div className="text-[9px] text-slate-400 font-semibold mb-1 pb-1 border-b border-slate-500">
                Recent Actions:
              </div>
              {player.history.length === 0 ? (
                <div className="text-[8px] text-slate-500 italic mt-1">
                  No actions yet
                </div>
              ) : (
                <div className="mt-1">
                  {player.history.map((entry, index) => {
                    const [text, type] = entry.action.split("|");
                    let textColor = "text-slate-400"; // default

                    if (type === "positive") {
                      textColor = "text-emerald-400";
                    } else if (type === "negative") {
                      textColor = "text-red-400";
                    } else if (type === "poison") {
                      textColor = "text-purple-400";
                    } else if (type === "commander") {
                      textColor = "text-blue-400";
                    }

                    return (
                      <div
                        key={`${entry.timestamp}-${index}`}
                        className={`flex justify-between items-center text-[8px] leading-tight font-medium py-1 border-b border-slate-700/30 ${textColor}`}
                      >
                        <span className="truncate pr-1">{text}</span>
                        <span className="text-slate-500 text-[7px] shrink-0">
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
            <div className="flex flex-wrap gap-2 justify-center pb-4 w-full max-w-[270px] mx-auto">
              {/* Commander Damage Counters */}
              {commanderSources.map((sourceIndex, i) => (
                <div
                  key={sourceIndex}
                  className="bg-slate-800 p-2 text-center flex-1 min-w-0 shadow-lg border border-slate-700/50 border-b-2 border-b-slate-950"
                  style={{ minWidth: "48px" }}
                >
                  <div className="flex items-center justify-center mb-1 h-5">
                    <span className="text-xs text-slate-200 font-bold leading-none tracking-wide whitespace-nowrap">
                      {playerAbbrevs[sourceIndex]}: {player.commanderDamage[i]}
                    </span>
                  </div>
                  <div className="flex gap-0.5 justify-center">
                    <button
                      onClick={() => updateCommanderDamage(playerIndex, i, -1)}
                      className="bg-red-600 hover:bg-red-500 text-white text-[8px] font-bold py-0.5 px-0.5 shadow-md hover:shadow-lg transition-all duration-150 w-4 h-4 flex items-center justify-center border-b border-red-800"
                    >
                      -
                    </button>
                    <button
                      onClick={() => updateCommanderDamage(playerIndex, i, 1)}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white text-[8px] font-bold py-0.5 px-0.5 shadow-md hover:shadow-lg transition-all duration-150 w-4 h-4 flex items-center justify-center border-b border-emerald-900"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {/* Poison Counter */}
              <div
                className="bg-slate-800 p-2 text-center flex-1 min-w-0 shadow-lg border border-slate-700/50 border-b-2 border-b-slate-950"
                style={{ minWidth: "48px" }}
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
                    <span className="text-xs text-slate-200 font-bold leading-none tracking-wide">
                      {player.poison}
                    </span>
                  </div>
                </div>
                <div className="flex gap-0.5 justify-center">
                  <button
                    onClick={() => updatePoison(playerIndex, -1)}
                    className="bg-red-600 hover:bg-red-500 text-white text-[8px] font-bold py-0.5 px-0.5 shadow-md hover:shadow-lg transition-all duration-150 w-4 h-4 flex items-center justify-center border-b border-red-800"
                  >
                    -
                  </button>
                  <button
                    onClick={() => updatePoison(playerIndex, 1)}
                    className="bg-green-900 hover:bg-green-800 text-white text-[8px] font-bold py-0.5 px-0.5 shadow-md hover:shadow-lg transition-all duration-150 w-4 h-4 flex items-center justify-center border-b border-green-950"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-slate-950 overflow-hidden relative select-none">
      {/* Menu Button */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="absolute top-4 right-4 z-10 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-3 px-4 shadow-xl hover:shadow-2xl transition-all duration-200 border border-slate-600/50 border-b-2 border-b-slate-950"
      >
        ⚙️ Menu
      </button>

      {/* Menu Modal */}
      {isMenuOpen && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="bg-slate-800 p-8 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl border-2 border-slate-700/50 border-b-4 border-b-slate-950">
            <h3 className="text-2xl font-black text-slate-100 mb-6 tracking-wide drop-shadow-lg">
              Game Settings
            </h3>

            {/* Player Names */}
            <div className="space-y-4 mb-8">
              <h4 className="text-lg font-bold text-slate-200 tracking-wide">
                Player Names
              </h4>
              {players.map((player, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-slate-300 text-sm font-semibold w-20">
                    Player {index + 1}:
                  </span>
                  <input
                    type="text"
                    value={player.name}
                    onChange={(e) => updatePlayerName(index, e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-950 text-slate-100 border border-slate-600 border-b-2 border-b-slate-800 focus:border-emerald-400 focus:border-b-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none transition-all duration-200 font-medium shadow-inner"
                    placeholder={`Player ${index + 1}`}
                  />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={resetGame}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-4 px-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-red-500/50 border-b-2 border-b-red-900"
              >
                Reset Game
              </button>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-4 px-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-slate-600/50 border-b-2 border-b-slate-950"
              >
                Close
              </button>
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
