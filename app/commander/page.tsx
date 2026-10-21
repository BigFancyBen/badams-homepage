"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { HistoryEntry, Layout, PlayerState, UndoOperation } from './types';
import {
  addHistoryEntry,
  commanderSources,
  COMMANDER_DAMAGE_MAX,
  createPlayer,
  defaultPlayerName,
  fitRotation,
  generateAbbreviations,
  nextRotation,
} from './utils';
import { loadGame, saveGame } from './storage';
import { useMobileDetection } from './hooks/useMobileDetection';
import { useWakeLock } from './hooks/useWakeLock';
import { PlayerQuadrant } from './components/PlayerQuadrant';
import { GameMenu } from './components/GameMenu';
import { SettingsIcon } from './components/icons';

// Helper functions for useSyncExternalStore (SSR-safe isClient detection)
function subscribeNoop(_callback: () => void) {
  return () => {};
}
function getSnapshotClient() {
  return true;
}
function getSnapshotServer() {
  return false;
}

// Grid order: top row 1, 2; bottom row 4, 3 — so seats run clockwise
const SEAT_ORDER = [0, 1, 3, 2];

function CommanderPageContent() {
  const { isMobileLandscape, isMobilePortrait } = useMobileDetection();
  const layout: Layout = isMobilePortrait ? "portrait" : isMobileLandscape ? "landscape" : "desktop";
  const isMobile = layout !== "desktop";

  const wakeLock = useWakeLock();

  // Only rendered in the browser, so the saved game can be read up front
  const [players, setPlayers] = useState<PlayerState[]>(loadGame);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [rotatingPlayer, setRotatingPlayer] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const rotateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    saveGame(players);
  }, [players]);

  useEffect(() => () => clearTimeout(rotateTimer.current), []);

  const playerAbbrevs = generateAbbreviations(players);

  const updatePlayer = (playerIndex: number, update: (player: PlayerState) => PlayerState) => {
    setPlayers((prev) => prev.map((player, index) => (index === playerIndex ? update(player) : player)));
  };

  const withHistory = (player: PlayerState, entry: Omit<HistoryEntry, "timestamp">) =>
    addHistoryEntry(player.history, entry);

  const updateLife = (playerIndex: number, change: number) => {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      life: player.life + change,
      history: withHistory(player, { kind: "life", value: change }),
    }));
  };

  const updatePoison = (playerIndex: number, change: number) => {
    updatePlayer(playerIndex, (player) => {
      const poison = Math.max(0, player.poison + change);
      if (poison === player.poison) return player;
      return {
        ...player,
        poison,
        history: withHistory(player, { kind: "poison", value: poison - player.poison }),
      };
    });
  };

  // Commander damage also costs life, but is logged only as commander damage
  const updateCommanderDamage = (playerIndex: number, sourceSlot: number, change: number) => {
    const sourceIndex = commanderSources(playerIndex)[sourceSlot];
    const sourceName = players[sourceIndex].name;
    updatePlayer(playerIndex, (player) => {
      const current = player.commanderDamage[sourceSlot];
      const next = Math.max(0, Math.min(COMMANDER_DAMAGE_MAX, current + change));
      const actualChange = next - current;
      if (actualChange === 0) return player;
      const commanderDamage = [...player.commanderDamage] as PlayerState["commanderDamage"];
      commanderDamage[sourceSlot] = next;
      return {
        ...player,
        commanderDamage,
        life: player.life - actualChange,
        history: withHistory(player, { kind: "commander", value: actualChange, from: sourceName }),
      };
    });
  };

  const updateRotation = (playerIndex: number) => {
    // Ignore taps while the previous turn is still animating
    if (rotatingPlayer === playerIndex) return;
    setRotatingPlayer(playerIndex);
    updatePlayer(playerIndex, (player) => ({ ...player, rotation: nextRotation(player.rotation, layout) }));
    clearTimeout(rotateTimer.current);
    rotateTimer.current = setTimeout(() => setRotatingPlayer(null), 300);
  };

  const togglePlayerDead = (playerIndex: number) => {
    updatePlayer(playerIndex, (player) => ({ ...player, isDead: !player.isDead }));
  };

  const changeOthersLife = (sourceIndex: number, sourceName: string, change: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === sourceIndex
          ? player
          : {
              ...player,
              life: player.life + change,
              history: withHistory(player, { kind: "life", value: change, from: sourceName }),
            }
      )
    );
  };

  const damageAllOthers = (playerIndex: number, damage: number) => {
    const sourceName = players[playerIndex].name;
    changeOthersLife(playerIndex, sourceName, damage);
    setUndoStack((prev) => [{ sourcePlayerIndex: playerIndex, sourceName, change: damage }, ...prev]);
  };

  // Undo the most recent "-1 others" pressed by this player
  const undoDamageAllOthers = (playerIndex: number) => {
    const operation = undoStack.find((op) => op.sourcePlayerIndex === playerIndex);
    if (!operation) return;
    changeOthersLife(playerIndex, operation.sourceName, -operation.change);
    setUndoStack((prev) => prev.filter((op) => op !== operation));
  };

  const updatePlayerName = (playerIndex: number, name: string) => {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      name: name.trim() ? name : defaultPlayerName(playerIndex),
    }));
  };

  const resetGame = () => {
    // Keep names and seating, reset everything else
    setPlayers((prev) =>
      prev.map((player, index) => createPlayer(index, { name: player.name, rotation: player.rotation }))
    );
    setShowResetConfirm(false);
    setIsMenuOpen(false);
    setUndoStack([]);
  };

  const resetPlayerNames = () => {
    setPlayers((prev) => prev.map((player, index) => ({ ...player, name: defaultPlayerName(index) })));
  };

  return (
    <div className="h-dvh w-screen bg-[#2d1e2f] overflow-hidden relative select-none">
      {/* Menu Button - centered on mobile, top-left on desktop */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className={`absolute z-30 font-bold transition-all duration-200 flex items-center justify-center text-[#fcf6b1]/70 hover:text-[#fcf6b1]/50 text-xs p-0 ${
          isMobile
            ? "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" // Center on mobile
            : "top-1 left-2" // Top-left on desktop
        }`}
        title="Game Settings"
      >
        <SettingsIcon size={14} />
      </button>

      <GameMenu
        isOpen={isMenuOpen}
        showResetConfirm={showResetConfirm}
        players={players}
        isMobile={isMobile}
        isWakeLockActive={wakeLock.isActive}
        isWakeLockSupported={wakeLock.isSupported}
        wakeLockError={wakeLock.error}
        onClose={() => setIsMenuOpen(false)}
        onResetClick={() => setShowResetConfirm(true)}
        onResetConfirm={resetGame}
        onResetCancel={() => setShowResetConfirm(false)}
        onResetNames={resetPlayerNames}
        onUpdatePlayerName={updatePlayerName}
        onToggleWakeLock={wakeLock.toggle}
      />

      {/* 4 Player Quadrants - Perfect quarters of the screen */}
      <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
        {SEAT_ORDER.map((playerIndex) => (
          <div key={playerIndex} className="w-full h-full">
            <PlayerQuadrant
              player={players[playerIndex]}
              playerIndex={playerIndex}
              rotation={fitRotation(players[playerIndex].rotation, layout)}
              playerAbbrevs={playerAbbrevs}
              isMobile={isMobile}
              isRotating={rotatingPlayer === playerIndex}
              canUndo={undoStack.some((op) => op.sourcePlayerIndex === playerIndex)}
              onUpdateLife={updateLife}
              onUpdatePoison={updatePoison}
              onUpdateCommanderDamage={updateCommanderDamage}
              onUpdateRotation={updateRotation}
              onTogglePlayerDead={togglePlayerDead}
              onDamageAllOthers={damageAllOthers}
              onUndoDamageAllOthers={undoDamageAllOthers}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Default export with loading state for SSR compatibility
export default function CommanderPage() {
  // Use useSyncExternalStore for SSR-safe isClient detection
  const isClient = useSyncExternalStore(subscribeNoop, getSnapshotClient, getSnapshotServer);

  // Show loading state during hydration
  if (!isClient) {
    return (
      <div className="w-screen h-dvh bg-[#2d1e2f] flex items-center justify-center">
        <div className="text-[#d4ca88] text-lg">Loading Commander...</div>
      </div>
    );
  }

  return <CommanderPageContent />;
}
