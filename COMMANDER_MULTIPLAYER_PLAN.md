# Commander Multiplayer Lobby Implementation Plan

## Overview

Transform the single-device `/commander` page into a multiplayer experience where:
- **Host device** creates a lobby and gets a shareable code
- **Player devices** join via lobby code and select their slot (1-4)
- **Each player** controls their own life total as a "remote control"
- **Shared display** shows all players' life totals in real-time
- **2-4 players** supported, anonymous (no accounts)

---

## Architecture Decision: Real-Time Backend

### Recommended: Liveblocks

**Why Liveblocks for Vercel?**
- Purpose-built for collaborative/multiplayer apps
- **Works seamlessly with Vercel** (no separate server deployment)
- "Rooms" concept maps perfectly to lobbies
- Presence API tracks connected players
- Storage API syncs game state in real-time
- Free tier: 250 monthly active users
- TypeScript-first with React hooks
- Simple `@liveblocks/react` integration

**Alternative Options:**
| Option | Pros | Cons |
|--------|------|------|
| Ably | 6M free messages/month | More complex setup |
| Pusher | Simple channels API | Cost scales quickly |
| Firebase Realtime DB | Battle-tested | Requires Google account, overkill |
| Supabase Realtime | PostgreSQL + realtime | More infrastructure |

---

## Key Design Principles

1. **Functionality parity** - All buttons/controls work identically to local mode
2. **Same quadrant layout** - Reuse existing `PlayerQuadrant` component
3. **Controller = your quadrant** - Full controls for life, commander damage, poison, history
4. **Display = read-only quadrants** - Shared screen shows all quadrants without controls
5. **Role-based settings** - Host and controllers have different settings menus

---

## Implementation Phases

### Phase 1: Liveblocks Setup

**1.1 Install Dependencies**
```bash
npm install @liveblocks/client @liveblocks/react
```

**1.2 Create Liveblocks Config**
```typescript
// liveblocks.config.ts
import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!,
});

type Presence = {
  odette: string;
  odette: number | null;  // Which slot this user claimed (0-3)
  isHost: boolean;
};

type Storage = {
  players: PlayerState[];  // Reuse existing PlayerState type
  settings: {
    playerCount: 2 | 3 | 4;
  };
};

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useOthers,
  useStorage,
  useMutation,
} = createRoomContext<Presence, Storage>(client);
```

**1.3 Environment Variables**
```env
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=pk_xxx
```

---

### Phase 2: Types Update

**2.1 Add to `app/commander/types.ts`**
```typescript
// Lobby-specific types
export interface LobbyPlayer {
  odette: string;
  odette: number;  // 0-3
  connectionId: string;
  isHost: boolean;
}

export type PlayerCount = 2 | 3 | 4;

export interface LobbySettings {
  playerCount: PlayerCount;
  startingLife: number;
}
```

---

### Phase 3: Route Structure

```
app/commander/
├── page.tsx                    # Landing: Create/Join/Local buttons
├── local/
│   └── page.tsx               # Original single-device mode (moved)
├── lobby/
│   └── [code]/
│       ├── page.tsx           # Shared display (shows all quadrants)
│       └── join/
│           └── page.tsx       # Join flow: enter name, pick slot, then controller
├── components/
│   ├── PlayerQuadrant.tsx     # (existing - minor modifications)
│   ├── GameMenu.tsx           # (existing)
│   ├── LobbyHeader.tsx        # NEW: Shows lobby code + player count
│   └── SlotPicker.tsx         # NEW: Pick available slot (1-4)
├── hooks/
│   ├── useLocalStorage.ts     # (existing)
│   ├── useLobby.ts            # NEW: Liveblocks room wrapper
│   └── ...
└── liveblocks.config.ts       # NEW: Liveblocks setup
```

**URL Structure:**
- `/commander` - Landing page
- `/commander/local` - Single-device mode (existing functionality)
- `/commander/lobby/ABC123` - Shared display for lobby
- `/commander/lobby/ABC123/join` - Join flow (name + slot selection + controller)

---

### Phase 4: User Flows

**4.1 Create Lobby (Host)**
```
1. Visit /commander
2. Select player count (2, 3, or 4)
3. Click "Create Lobby"
4. Generate 6-char code, redirect to /commander/lobby/ABC123
5. Host sees shared display with lobby code shown
6. Host opens /commander/lobby/ABC123/join on their phone to also be a player
   (Or: displays QR code that host can scan to join as player)
```

**Note:** The shared display is typically a TV/tablet/laptop. The host joins as a player from their phone like everyone else, giving them full controller functionality.

**4.2 Join Lobby (Player)**
```
1. Visit /commander
2. Enter lobby code
3. Redirect to /commander/lobby/ABC123/join
4. Enter name
5. Pick available slot (shows which are taken)
6. See controller view (your quadrant only, with controls)
```

**4.3 Shared Display View**
- Shows the same 2x2 (or 2x1, 1x3) grid as current design
- Each quadrant shows player name, life, commander damage, poison
- Lobby code shown in corner (tap to copy)
- Connected player indicators
- **No interactive controls** - display only

**4.4 Controller View (All Players Including Host)**
- Shows only YOUR quadrant (full screen on mobile)
- **Full control over your own values:**
  - Life: +1, -1, +5, -5 buttons
  - Commander damage from each opponent
  - Poison counters
  - Toggle dead state
- **Undo functionality** - Can undo your own recent actions
- **History** - Shows your action history with collapsing (like local mode)
- Small header with lobby code and connection status
- Settings menu button in corner

All controllers have identical functionality - there's no special "host player" in-game. The host distinction only matters for the shared display settings (reset game, etc.).

---

### Phase 5: Settings Menus (Role-Based)

**5.1 Host Display Settings Menu**
The host (shared display) has access to game-wide controls:
```
┌────────────────────────────────┐
│         GAME SETTINGS          │
├────────────────────────────────┤
│  [ ] Keep Screen On            │
│                                │
│  Starting Life: [40]           │
│                                │
│  [    RESET GAME    ]          │
│  (Resets all players to 40)    │
│                                │
│  ┌──────────┐                  │
│  │   QR     │  ABC123  [Copy]  │
│  │  CODE    │  Scan to join    │
│  └──────────┘                  │
│                                │
│         [ CLOSE ]              │
└────────────────────────────────┘
```
- **Keep Screen On** - Wake lock toggle
- **Starting Life** - Configure for next reset
- **Reset Game** - Resets ALL players' life/damage/poison (syncs to all)
- **QR Code + Lobby Code** - Easy sharing for new players to join

**5.2 Controller Settings Menu**
Each player's controller has personal settings:
```
┌────────────────────────────────┐
│        YOUR SETTINGS           │
├────────────────────────────────┤
│  Your Name:                    │
│  [_______________]             │
│                                │
│  [ ] Keep Screen On            │
│                                │
│  ┌──────────┐                  │
│  │   QR     │  ABC123  [Copy]  │
│  │  CODE    │  Share to invite │
│  └──────────┘                  │
│                                │
│         [ CLOSE ]              │
└────────────────────────────────┘
```
- **Your Name** - Change display name (syncs to shared display)
- **Keep Screen On** - Wake lock toggle (per-device)
- **QR Code + Lobby Code** - Share with others to invite more players

---

### Phase 6: Component Changes

**6.1 PlayerQuadrant Modifications**
Add a `mode` prop:
```typescript
interface PlayerQuadrantProps {
  // ... existing props
  mode: 'local' | 'display' | 'controller';
}
```

- `local` - Current behavior (full controls)
- `display` - Read-only, no buttons, optimized for shared screen
- `controller` - Full controls, possibly full-screen on mobile

**6.2 New: LobbyHeader Component**
Simple header showing:
```
┌────────────────────────────────┐
│ LOBBY: ABC123  📋   👥 3/4     │
└────────────────────────────────┘
```
- Lobby code with copy button
- Player count indicator
- Connection status dot

**6.3 New: SlotPicker Component**
```
┌────────────────────────────────┐
│     Choose your slot           │
│                                │
│  [1 - Alice ✓]  [2 - Empty]   │
│  [3 - Bob ✓]    [4 - Empty]   │
│                                │
│  Your name: [________]         │
│                                │
│        [ JOIN GAME ]           │
└────────────────────────────────┘
```

---

### Phase 7: Liveblocks Integration

**7.1 Room = Lobby**
Each lobby code is a Liveblocks room ID:
- Room `commander-ABC123` contains the game state
- Presence tracks who's connected and their slot
- Storage holds the synchronized `PlayerState[]`

**7.2 useLobby Hook**
```typescript
// hooks/useLobby.ts
export function useLobby() {
  const storage = useStorage((root) => root.players);
  const others = useOthers();
  const [myPresence, updateMyPresence] = useMyPresence();

  const updateLife = useMutation(({ storage }, slot: number, delta: number) => {
    const players = storage.get("players");
    const player = players.get(slot);
    player.set("life", player.get("life") + delta);
  }, []);

  // ... other mutations for commander damage, poison, etc.

  return {
    players: storage,
    connectedPlayers: others,
    mySlot: myPresence.slot,
    updateLife,
    // ...
  };
}
```

---

### Phase 8: Lobby Code Generation

**6-character codes using unambiguous characters:**
```typescript
// Avoid: 0/O, 1/l/I
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateLobbyCode(): string {
  return Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
}
```

---

### Phase 9: Layout Configurations

**For 4 players:** 2x2 grid (current layout)
**For 3 players:** Top row 2, bottom row 1 centered
**For 2 players:** Side by side or stacked

```typescript
const getGridLayout = (playerCount: PlayerCount) => {
  switch (playerCount) {
    case 2: return 'grid-cols-2 grid-rows-1';
    case 3: return 'grid-cols-2 grid-rows-2'; // 3rd spans or centers
    case 4: return 'grid-cols-2 grid-rows-2';
  }
};
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `liveblocks.config.ts` | Liveblocks client setup |
| `app/commander/local/page.tsx` | Original single-device mode |
| `app/commander/lobby/[code]/page.tsx` | Shared display |
| `app/commander/lobby/[code]/join/page.tsx` | Join flow + controller |
| `app/commander/components/LobbyHeader.tsx` | Lobby info header |
| `app/commander/components/SlotPicker.tsx` | Slot selection UI |
| `app/commander/hooks/useLobby.ts` | Liveblocks wrapper hook |

### Modified Files
| File | Changes |
|------|---------|
| `app/commander/page.tsx` | Replace with landing page (Create/Join/Local) |
| `app/commander/types.ts` | Add lobby types |
| `app/commander/components/PlayerQuadrant.tsx` | Add `mode` prop |
| `package.json` | Add @liveblocks/client, @liveblocks/react |
| `.env.local` | Add NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY |

---

## Deployment (Vercel)

1. Create Liveblocks account at liveblocks.io
2. Get public API key from dashboard
3. Add `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` to Vercel environment variables
4. Deploy as normal - no additional servers needed!

---

## Implementation Order

1. **Phase 1**: Install Liveblocks, create config
2. **Phase 2**: Add lobby types to types.ts
3. **Phase 3**: Create landing page with Create/Join/Local options
4. **Phase 4**: Move existing code to `/local`
5. **Phase 5**: Role-based settings menus (host vs controller)
6. **Phase 6**: Add `mode` prop to PlayerQuadrant
7. **Phase 7**: Build Liveblocks integration (useLobby hook)
8. **Phase 8**: Lobby code generation utilities
9. **Phase 9**: Build lobby display page + controller view
10. **Phase 10**: Testing across devices

---

## Summary

- **Backend**: Liveblocks (works natively with Vercel, no extra servers)
- **Players**: 2-4, anonymous, select their own slot
- **UI**: Minimal changes - same quadrant design, just with mode switching
- **Routes**: `/commander` (landing), `/commander/local` (single), `/commander/lobby/[code]` (display), `/commander/lobby/[code]/join` (controller)
