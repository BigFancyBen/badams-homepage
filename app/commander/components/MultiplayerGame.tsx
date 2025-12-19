"use client";

import { useState, useEffect, useCallback } from 'react';
import { PlayerState, GameAction, SlotOwner } from '../types';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { generateAbbreviations } from '../utils';
import { useMobileDetection } from '../hooks/useMobileDetection';
import { useHistoryManagement } from '../hooks/useHistoryManagement';
import { PlayerQuadrant } from './PlayerQuadrant';
import { GameMenu } from './GameMenu';

// Default player states
const DEFAULT_PLAYERS: PlayerState[] = [
  { life: 40, commanderDamage: [0, 0, 0], rotation: 0, name: 'Player 1', history: [], poison: 0, isDead: false },
  { life: 40, commanderDamage: [0, 0, 0], rotation: 0, name: 'Player 2', history: [], poison: 0, isDead: false },
  { life: 40, commanderDamage: [0, 0, 0], rotation: 0, name: 'Player 3', history: [], poison: 0, isDead: false },
  { life: 40, commanderDamage: [0, 0, 0], rotation: 0, name: 'Player 4', history: [], poison: 0, isDead: false },
];

// Slot colors matching the Commander design
const SLOT_COLORS = [
  { bg: 'bg-[#991b1b]', text: 'Player 1' }, // Red
  { bg: 'bg-[#1e40af]', text: 'Player 2' }, // Blue
  { bg: 'bg-[#166534]', text: 'Player 3' }, // Green
  { bg: 'bg-[#a16207]', text: 'Player 4' }, // Yellow/Amber
];

interface MultiplayerGameProps {
  roomCode: string;
  localClientId: string;
  playerName: string;
  isCreator: boolean;
  onLeaveGame: () => void;
}

export function MultiplayerGame(props: MultiplayerGameProps) {
  const { roomCode, localClientId, playerName, isCreator, onLeaveGame } = props;
  const { isMobileLandscape, isMobilePortrait, isLandscape, isClient } = useMobileDetection();
  const {
    collapseLifeActions,
    collapseLifeActionsWithFrom,
    collapseCommanderDamageActions,
    collapsePoisonActions,
  } = useHistoryManagement();

  const [players, setPlayers] = useState<PlayerState[]>(DEFAULT_PLAYERS);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [rotatingPlayer, setRotatingPlayer] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<{ sourcePlayerIndex: number; affectedPlayers: { playerIndex: number; lifeChange: number }[]; timestamp: number }[]>([]);
  const [viewMode, setViewMode] = useState<'controller' | 'overview'>('overview');
  const [pendingSyncRequest, setPendingSyncRequest] = useState<string | null>(null);

  // Wake lock state
  const [wakeLockSentinel, setWakeLockSentinel] = useState<WakeLockSentinel | null>(null);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState<boolean>(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);

  // Handle incoming game actions from other players
  const handleGameAction = useCallback((action: GameAction) => {
    // Skip if this is an action we sent (filter by senderId)
    if (action.senderId === localClientId) {
      return;
    }

    switch (action.type) {
      case 'FULL_STATE_SYNC':
        setPlayers(action.players);
        break;
      case 'UPDATE_LIFE':
        setPlayers((prev) =>
          prev.map((player, index) =>
            index === action.playerIndex
              ? { ...player, life: Math.max(0, player.life + action.change) }
              : player
          )
        );
        break;
      case 'UPDATE_POISON':
        setPlayers((prev) =>
          prev.map((player, index) =>
            index === action.playerIndex
              ? { ...player, poison: Math.max(0, player.poison + action.change) }
              : player
          )
        );
        break;
      case 'UPDATE_COMMANDER_DAMAGE':
        setPlayers((prev) =>
          prev.map((player, index) => {
            if (index === action.playerIndex) {
              const currentDamage = player.commanderDamage[action.sourceIndex];
              const newDamageValue = Math.max(0, Math.min(21, currentDamage + action.change));
              const actualChange = newDamageValue - currentDamage;
              const newDamage = [...player.commanderDamage];
              newDamage[action.sourceIndex] = newDamageValue;
              return {
                ...player,
                commanderDamage: newDamage as [number, number, number],
                life: Math.max(0, player.life - actualChange),
              };
            }
            return player;
          })
        );
        break;
      case 'TOGGLE_DEAD':
        setPlayers((prev) =>
          prev.map((player, index) =>
            index === action.playerIndex ? { ...player, isDead: !player.isDead } : player
          )
        );
        break;
      case 'DAMAGE_ALL_OTHERS':
        setPlayers((prev) =>
          prev.map((player, index) =>
            index !== action.sourcePlayerIndex
              ? { ...player, life: Math.max(0, player.life + action.damage) }
              : player
          )
        );
        break;
      case 'RESET_GAME':
        setPlayers((prev) =>
          prev.map((player) => ({
            ...player,
            life: 40,
            commanderDamage: [0, 0, 0] as [number, number, number],
            history: [],
            poison: 0,
            isDead: false,
          }))
        );
        setUndoStack([]);
        break;
      case 'CLAIM_SLOT':
        // Update the player name for the claimed slot
        setPlayers((prev) =>
          prev.map((player, index) =>
            index === action.slotIndex
              ? { ...player, name: action.name }
              : player
          )
        );
        break;
      case 'REQUEST_STATE_SYNC':
        // Mark that someone requested a sync - host will respond via useEffect
        setPendingSyncRequest(action.senderId);
        break;
    }
  }, [localClientId]);

  const { isConnected, isHost, slotOwners, localPlayerSlot, sendGameAction, claimSlot } = useMultiplayer({
    roomCode,
    localClientId,
    playerName,
    isCreator,
    onGameAction: handleGameAction,
  });

  // Switch to controller mode when claiming a slot
  useEffect(() => {
    if (localPlayerSlot !== null) {
      setViewMode('controller');
    }
  }, [localPlayerSlot]);

  // Host responds to state sync requests
  useEffect(() => {
    if (pendingSyncRequest && isHost) {
      sendGameAction({
        type: 'FULL_STATE_SYNC',
        players,
        slotOwners,
        senderId: localClientId,
      });
      setPendingSyncRequest(null);
    }
  }, [pendingSyncRequest, isHost, players, slotOwners, localClientId, sendGameAction]);

  // Request state sync when joining as non-creator
  useEffect(() => {
    if (isConnected && !isCreator) {
      // Small delay to ensure we're fully connected
      const timer = setTimeout(() => {
        sendGameAction({
          type: 'REQUEST_STATE_SYNC',
          senderId: localClientId,
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isCreator, localClientId, sendGameAction]);

  // Wake lock support check
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = 'wakeLock' in navigator && window.isSecureContext;
      setIsWakeLockSupported(isSupported);
      if (!isSupported) {
        if (!window.isSecureContext) {
          setWakeLockError('Requires HTTPS or localhost');
        } else if (!('wakeLock' in navigator)) {
          setWakeLockError('Not supported in this browser');
        }
      }
    };
    if (isClient) {
      checkSupport();
    }
  }, [isClient]);

  const toggleWakeLock = useCallback(async () => {
    if (!isWakeLockSupported) return;
    try {
      if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setWakeLockError(null);
      } else {
        const sentinel = await navigator.wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
        sentinel.addEventListener('release', () => setWakeLockSentinel(null));
      }
    } catch (error) {
      console.error('Wake lock error:', error);
      setWakeLockSentinel(null);
    }
  }, [isWakeLockSupported, wakeLockSentinel]);

  // Generate abbreviations
  const playerAbbrevs = generateAbbreviations(players);

  // Helper to broadcast action with senderId
  const broadcastAction = useCallback((action: { type: string; [key: string]: unknown }) => {
    sendGameAction({ ...action, senderId: localClientId } as GameAction);
  }, [sendGameAction, localClientId]);

  // Action handlers (broadcast to all players)
  const addHistory = useCallback((playerIndex: number, action: string) => {
    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index === playerIndex) {
          let newHistory;
          if (action.includes('life|') && !action.includes('from ')) {
            newHistory = collapseLifeActions(action, player.history);
          } else if (action.includes('life from ')) {
            const match = action.match(/life from (.+)\|/);
            const fromPlayer = match ? match[1] : '';
            newHistory = collapseLifeActionsWithFrom(action, player.history, fromPlayer);
          } else if (action.includes('commander damage from ') && action.includes('|commander')) {
            newHistory = collapseCommanderDamageActions(action, player.history);
          } else if (action.includes('poison|poison')) {
            newHistory = collapsePoisonActions(action, player.history);
          } else {
            newHistory = [{ action, timestamp: Date.now() }, ...player.history];
          }
          return { ...player, history: newHistory };
        }
        return player;
      })
    );
  }, [collapseLifeActions, collapseLifeActionsWithFrom, collapseCommanderDamageActions, collapsePoisonActions]);

  const updateLife = useCallback((playerIndex: number, change: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex ? { ...player, life: Math.max(0, player.life + change) } : player
      )
    );
    const changeText = change > 0 ? `+${change}` : `${change}`;
    const actionType = change > 0 ? 'positive' : 'negative';
    addHistory(playerIndex, `${changeText} life|${actionType}`);
    broadcastAction({ type: 'UPDATE_LIFE', playerIndex, change });
  }, [addHistory, broadcastAction]);

  const updatePoison = useCallback((playerIndex: number, change: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex ? { ...player, poison: Math.max(0, player.poison + change) } : player
      )
    );
    const changeText = change > 0 ? `+${change}` : `${change}`;
    addHistory(playerIndex, `${changeText} poison|poison`);
    broadcastAction({ type: 'UPDATE_POISON', playerIndex, change });
  }, [addHistory, broadcastAction]);

  const updateCommanderDamage = useCallback((playerIndex: number, sourceIndex: number, change: number) => {
    const currentDamage = players[playerIndex].commanderDamage[sourceIndex];
    const newDamageValue = Math.max(0, Math.min(21, currentDamage + change));
    const actualChange = newDamageValue - currentDamage;

    if (actualChange !== 0) {
      setPlayers((prev) =>
        prev.map((player, index) => {
          if (index === playerIndex) {
            const newDamage = [...player.commanderDamage];
            newDamage[sourceIndex] = newDamageValue;
            return {
              ...player,
              commanderDamage: newDamage as [number, number, number],
              life: Math.max(0, player.life - actualChange),
            };
          }
          return player;
        })
      );

      const commanderSources = [0, 1, 2, 3].filter((i) => i !== playerIndex);
      const actualSourceIndex = commanderSources[sourceIndex];
      const changeText = actualChange > 0 ? `+${actualChange}` : `${actualChange}`;
      const sourceName = players[actualSourceIndex]?.name || `P${actualSourceIndex + 1}`;
      addHistory(playerIndex, `${changeText} commander damage from ${sourceName}|commander`);
      broadcastAction({ type: 'UPDATE_COMMANDER_DAMAGE', playerIndex, sourceIndex, change: actualChange });
    }
  }, [players, addHistory, broadcastAction]);

  const updateRotation = useCallback((playerIndex: number) => {
    if (rotatingPlayer === playerIndex) return;
    setRotatingPlayer(playerIndex);
    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index === playerIndex) {
          let newRotation: number;
          if (isMobileLandscape || isMobilePortrait) {
            if (isLandscape) {
              newRotation = player.rotation === 90 ? 270 : 90;
            } else {
              newRotation = player.rotation === 0 ? 180 : 0;
            }
          } else {
            newRotation = (player.rotation + 90) % 360;
          }
          return { ...player, rotation: newRotation as 0 | 90 | 180 | 270 };
        }
        return player;
      })
    );
    setTimeout(() => setRotatingPlayer(null), 300);
  }, [rotatingPlayer, isMobileLandscape, isMobilePortrait, isLandscape]);

  const togglePlayerDead = useCallback((playerIndex: number) => {
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === playerIndex ? { ...player, isDead: !player.isDead } : player
      )
    );
    broadcastAction({ type: 'TOGGLE_DEAD', playerIndex });
  }, [broadcastAction]);

  const damageAllOthers = useCallback((playerIndex: number, damage: number) => {
    const changeText = damage > 0 ? `+${damage}` : `${damage}`;
    const actionType = damage > 0 ? 'positive' : 'negative';
    const sourceName = players[playerIndex]?.name || `P${playerIndex + 1}`;

    const affectedPlayers: Array<{ playerIndex: number; lifeChange: number }> = [];

    [0, 1, 2, 3].forEach((index) => {
      if (index !== playerIndex) {
        affectedPlayers.push({ playerIndex: index, lifeChange: damage });
      }
    });

    setPlayers((prev) =>
      prev.map((player, index) => {
        if (index !== playerIndex) {
          const newLife = Math.max(0, player.life + damage);
          const fromPlayerAction = `${changeText} life from ${sourceName}|${actionType}`;
          const collapsedHistory = collapseLifeActionsWithFrom(fromPlayerAction, player.history, sourceName);
          return { ...player, life: newLife, history: collapsedHistory };
        }
        return player;
      })
    );

    setUndoStack((prev) => [{ sourcePlayerIndex: playerIndex, affectedPlayers, timestamp: Date.now() }, ...prev]);
    broadcastAction({ type: 'DAMAGE_ALL_OTHERS', sourcePlayerIndex: playerIndex, damage });
  }, [players, collapseLifeActionsWithFrom, broadcastAction]);

  const undoDamageAllOthers = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastOperation = undoStack[0];
    const sourcePlayerName = players[lastOperation.sourcePlayerIndex]?.name || `P${lastOperation.sourcePlayerIndex + 1}`;

    setPlayers((prev) =>
      prev.map((player, index) => {
        const affectedPlayer = lastOperation.affectedPlayers.find((ap) => ap.playerIndex === index);
        if (affectedPlayer) {
          const newLife = player.life - affectedPlayer.lifeChange;
          const reverseChange = -affectedPlayer.lifeChange;
          const changeText = reverseChange > 0 ? `+${reverseChange}` : `${reverseChange}`;
          const actionType = reverseChange > 0 ? 'positive' : 'negative';
          const reverseAction = `${changeText} life from ${sourcePlayerName}|${actionType}`;
          const newHistory = collapseLifeActionsWithFrom(reverseAction, player.history, sourcePlayerName);
          return { ...player, life: Math.max(0, newLife), history: newHistory };
        }
        return player;
      })
    );
    setUndoStack((prev) => prev.slice(1));
  }, [undoStack, players, collapseLifeActionsWithFrom]);

  const updatePlayerName = useCallback((playerIndex: number, name: string) => {
    setPlayers((prev) =>
      prev.map((player, index) => (index === playerIndex ? { ...player, name } : player))
    );
  }, []);

  const resetGame = useCallback(() => {
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        life: 40,
        commanderDamage: [0, 0, 0] as [number, number, number],
        history: [],
        poison: 0,
        isDead: false,
      }))
    );
    setShowResetConfirm(false);
    setIsMenuOpen(false);
    setUndoStack([]);
    broadcastAction({ type: 'RESET_GAME' });
  }, [broadcastAction]);

  const resetPlayerNames = useCallback(() => {
    setPlayers((prev) =>
      prev.map((player, index) => ({ ...player, name: `Player ${index + 1}` }))
    );
  }, []);

  const handleClaimSlot = useCallback((slotIndex: number) => {
    claimSlot(slotIndex);
    // Update local player name immediately
    setPlayers((prev) =>
      prev.map((player, index) =>
        index === slotIndex ? { ...player, name: playerName } : player
      )
    );
  }, [claimSlot, playerName]);

  const isSpectator = localPlayerSlot === null;

  // Render unclaimed slot placeholder
  const renderUnclaimedSlot = (slotIndex: number, gridIndex: number) => {
    const color = SLOT_COLORS[slotIndex];
    const positions = [
      { top: 0, left: 0 },      // 0 = top-left
      { top: 0, left: '50%' },  // 1 = top-right
      { top: '50%', left: '50%' }, // 2 = bottom-right (grid index 3)
      { top: '50%', left: 0 },  // 3 = bottom-left (grid index 2)
    ];
    const pos = positions[gridIndex];

    return (
      <div
        key={gridIndex}
        className={`absolute w-1/2 h-1/2 ${color.bg} opacity-40 flex items-center justify-center cursor-pointer hover:opacity-60 transition-opacity`}
        style={{ top: pos.top, left: pos.left }}
        onClick={() => handleClaimSlot(slotIndex)}
      >
        <div className="text-center text-white/80">
          <div className="text-lg font-bold mb-2">{color.text}</div>
          <div className="text-sm">Tap to join</div>
        </div>
      </div>
    );
  };

  // Render disconnected overlay
  const renderDisconnectedOverlay = (slotOwner: SlotOwner) => (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 pointer-events-none">
      <div className="text-white/60 text-center">
        <div className="text-sm font-bold">{slotOwner.name}</div>
        <div className="text-xs">Disconnected</div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] overflow-hidden relative select-none">
      {/* Connection indicator */}
      <div className="absolute top-1 right-2 z-30 flex items-center gap-1.5">
        <div className={`w-2 h-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {/* Menu Button */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className={`absolute z-30 font-bold transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white/50 text-xs p-0 ${
          isMobileLandscape || isMobilePortrait
            ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
            : 'top-1 left-2'
        }`}
        title="Game Settings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 21h-4l-.551-2.48a6.991 6.991 0 0 1-1.819-1.05l-2.424.763-2-3.464 1.872-1.718a7.055 7.055 0 0 1 0-2.1L3.206 9.232l2-3.464 2.424.763A6.992 6.992 0 0 1 9.45 5.48L10 3h4l.551 2.48a6.992 6.992 0 0 1 1.819 1.05l2.424-.763 2 3.464-1.872 1.718a7.05 7.05 0 0 1 0 2.1l1.872 1.718-2 3.464-2.424-.763a6.99 6.99 0 0 1-1.819 1.052L14 21z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Menu Modal */}
      <GameMenu
        isOpen={isMenuOpen}
        showResetConfirm={showResetConfirm}
        players={players}
        isMobileLandscape={isMobileLandscape}
        isMobilePortrait={isMobilePortrait}
        wakeLockSentinel={wakeLockSentinel}
        isWakeLockSupported={isWakeLockSupported}
        wakeLockError={wakeLockError}
        onClose={() => setIsMenuOpen(false)}
        onResetClick={() => setShowResetConfirm(true)}
        onResetConfirm={resetGame}
        onResetCancel={() => setShowResetConfirm(false)}
        onResetNames={resetPlayerNames}
        onUpdatePlayerName={updatePlayerName}
        onToggleWakeLock={toggleWakeLock}
        multiplayerMode
        onLeaveGame={onLeaveGame}
        isHost={isHost}
        viewMode={isSpectator ? undefined : viewMode}
        onToggleViewMode={isSpectator ? undefined : () => setViewMode(viewMode === 'controller' ? 'overview' : 'controller')}
        roomCode={roomCode}
      />

      {/* Controller View - Full screen for local player only */}
      {viewMode === 'controller' && localPlayerSlot !== null && (
        <div className="h-full w-full">
          <PlayerQuadrant
            player={players[localPlayerSlot]}
            playerIndex={localPlayerSlot}
            playerAbbrevs={playerAbbrevs}
            isMobileLandscape={isMobileLandscape}
            isMobilePortrait={isMobilePortrait}
            rotatingPlayer={rotatingPlayer}
            undoStackLength={undoStack.length}
            fullScreen
            onUpdateLife={updateLife}
            onUpdatePoison={updatePoison}
            onUpdateCommanderDamage={updateCommanderDamage}
            onUpdateRotation={updateRotation}
            onTogglePlayerDead={togglePlayerDead}
            onDamageAllOthers={damageAllOthers}
            onUndoDamageAllOthers={undoDamageAllOthers}
          />
        </div>
      )}

      {/* Overview View - All 4 quadrants */}
      {(viewMode === 'overview' || isSpectator) && (
        <div className="relative h-full w-full">
          {/* Grid order: 0=top-left, 1=top-right, 3=bottom-left, 2=bottom-right */}
          {[0, 1, 3, 2].map((playerIndex, gridIndex) => {
            const slotOwner = slotOwners[playerIndex];
            const isClaimed = slotOwner !== null;
            const isDisconnected = slotOwner && !slotOwner.isConnected;

            if (!isClaimed) {
              // Unclaimed slot - show join button
              return renderUnclaimedSlot(playerIndex, gridIndex);
            }

            // Claimed slot - show player quadrant
            const positions = [
              { top: 0, left: 0 },
              { top: 0, left: '50%' },
              { top: '50%', left: '50%' },
              { top: '50%', left: 0 },
            ];
            const pos = positions[gridIndex];

            return (
              <div
                key={gridIndex}
                className="absolute w-1/2 h-1/2"
                style={{ top: pos.top, left: pos.left }}
              >
                {isDisconnected && renderDisconnectedOverlay(slotOwner)}
                <PlayerQuadrant
                  player={players[playerIndex]}
                  playerIndex={playerIndex}
                  playerAbbrevs={playerAbbrevs}
                  isMobileLandscape={isMobileLandscape}
                  isMobilePortrait={isMobilePortrait}
                  rotatingPlayer={rotatingPlayer}
                  undoStackLength={undoStack.length}
                  readOnly={isSpectator || playerIndex !== localPlayerSlot}
                  onUpdateLife={updateLife}
                  onUpdatePoison={updatePoison}
                  onUpdateCommanderDamage={updateCommanderDamage}
                  onUpdateRotation={updateRotation}
                  onTogglePlayerDead={togglePlayerDead}
                  onDamageAllOthers={damageAllOthers}
                  onUndoDamageAllOthers={undoDamageAllOthers}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
