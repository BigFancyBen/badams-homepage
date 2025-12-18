"use client";

import { createClient, LiveList, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// Player state type for Liveblocks (JSON-serializable)
export type LivePlayerState = {
  life: number;
  commanderDamage: [number, number, number];
  rotation: 0 | 90 | 180 | 270;
  name: string;
  history: Array<{ action: string; timestamp: number }>;
  poison: number;
  isDead: boolean;
};

// Settings type
type Settings = {
  playerCount: 2 | 3 | 4;
  startingLife: number;
};

// Declare global Liveblocks types (v2+ recommended pattern)
declare global {
  interface Liveblocks {
    Presence: {
      name: string;
      slot: number | null;
      isHost: boolean;
    };
    Storage: {
      players: LiveList<LiveObject<LivePlayerState>>;
      settings: LiveObject<Settings>;
      showQrOverlay: boolean;
    };
    UserMeta: {
      id: string;
      info: {
        name?: string;
      };
    };
    RoomEvent:
      | { type: "RESET_GAME" }
      | { type: "PLAYER_JOINED"; name: string; slot: number }
      | { type: "PLAYER_LEFT"; slot: number };
  }
}

// Create the Liveblocks client
const client = createClient({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY || "",
  throttle: 100,
});

// Create the room context
export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useOthersConnectionIds,
  useOther,
  useSelf,
  useStorage,
  useMutation,
  useStatus,
  useBroadcastEvent,
  useEventListener,
  useCanUndo,
  useCanRedo,
  useUndo,
  useRedo,
  useHistory,
} = createRoomContext(client);

// Helper to create initial player state
export function createInitialPlayer(
  index: number,
  startingLife: number = 40
): LivePlayerState {
  return {
    life: startingLife,
    commanderDamage: [0, 0, 0],
    rotation: 0,
    name: `Player ${index + 1}`,
    history: [],
    poison: 0,
    isDead: false,
  };
}

// Helper to create initial storage
export function createInitialStorage(
  playerCount: 2 | 3 | 4 = 4,
  startingLife: number = 40
) {
  return {
    players: new LiveList([
      new LiveObject(createInitialPlayer(1, startingLife)),
      new LiveObject(createInitialPlayer(2, startingLife)),
      new LiveObject(createInitialPlayer(3, startingLife)),
      new LiveObject(createInitialPlayer(4, startingLife)),
    ]),
    settings: new LiveObject({
      playerCount,
      startingLife,
    }),
    showQrOverlay: true,
  };
}

// Helper to create initial presence
export function createInitialPresence(isHost: boolean = false) {
  return {
    name: "",
    slot: null,
    isHost,
  };
}
