# Commander Multiplayer Lobby Implementation Plan

## Overview

Transform the single-device `/commander` page into a multiplayer experience where:
- **Host device** creates a lobby and gets a shareable code
- **Player devices** join via lobby code
- **Each player** controls their own life total, name, and values as a "remote control"
- **Shared display** shows all players' life totals in real-time

---

## Architecture Decision: Real-Time Backend

### Recommended: PartyKit

**Why PartyKit?**
- Purpose-built for multiplayer/collaborative apps
- Runs on Cloudflare's edge network (low latency)
- Simple API, easy integration with Next.js
- Free tier: 100k monthly active connections
- TypeScript-first
- Handles lobby rooms natively

**Alternative Options:**
| Option | Pros | Cons |
|--------|------|------|
| Firebase Realtime DB | Battle-tested, easy setup | Overkill for this use case, Google account required |
| Supabase Realtime | PostgreSQL + realtime | More complex setup |
| Pusher | Simple API | Cost scales quickly |
| Self-hosted WebSocket | Full control | Requires server management |

---

## Implementation Phases

### Phase 1: PartyKit Setup & Infrastructure

**1.1 Install Dependencies**
```bash
npm install partysocket partykit
```

**1.2 Create PartyKit Server**
Create `party/commander.ts` - the server-side lobby manager:
- Handle lobby creation with unique 6-character codes
- Manage player connections (join/leave)
- Broadcast state changes to all connected clients
- Handle reconnection scenarios

**1.3 Configure PartyKit**
Create `partykit.json` configuration file for deployment.

---

### Phase 2: Lobby System

**2.1 New Types** (`app/commander/types.ts`)
```typescript
interface LobbyState {
  code: string;
  hostId: string;
  players: ConnectedPlayer[];
  gameState: GameState;
  createdAt: number;
}

interface ConnectedPlayer {
  id: string;           // Connection ID
  playerSlot: number;   // 0-3 (which quadrant)
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

interface GameState {
  players: PlayerState[]; // Existing player state
  settings: GameSettings;
}

type LobbyMessage =
  | { type: 'join'; playerName: string }
  | { type: 'claim-slot'; slot: number }
  | { type: 'update-life'; slot: number; delta: number }
  | { type: 'update-commander-damage'; slot: number; fromPlayer: number; delta: number }
  | { type: 'update-poison'; slot: number; delta: number }
  | { type: 'update-name'; slot: number; name: string }
  | { type: 'toggle-death'; slot: number }
  | { type: 'reset-game' }
  | { type: 'kick-player'; playerId: string }
  | { type: 'sync-request' };
```

**2.2 Lobby Code Generation**
- 6-character alphanumeric codes (easy to type/share)
- Avoid ambiguous characters (0/O, 1/l/I)
- Example: `ABC123`, `XK7M2P`

---

### Phase 3: Page Restructure

**3.1 New Route Structure**
```
app/commander/
├── page.tsx                    # Landing: Create/Join lobby buttons
├── local/
│   └── page.tsx               # Original single-device mode (moved here)
├── lobby/
│   └── [code]/
│       ├── page.tsx           # Shared display (host view)
│       └── controller/
│           └── page.tsx       # Player remote control view
├── components/
│   ├── PlayerQuadrant.tsx     # (existing)
│   ├── GameMenu.tsx           # (existing)
│   ├── LobbyLanding.tsx       # NEW: Create/Join UI
│   ├── LobbyDisplay.tsx       # NEW: Shared screen view
│   ├── PlayerController.tsx   # NEW: Remote control UI
│   └── ConnectionStatus.tsx   # NEW: Connection indicator
├── hooks/
│   ├── useLocalStorage.ts     # (existing)
│   ├── usePartySocket.ts      # NEW: PartyKit connection
│   └── useLobbyState.ts       # NEW: Lobby state management
└── party/
    └── commander.ts           # PartyKit server
```

**3.2 URL Structure**
- `/commander` - Landing page (Create/Join)
- `/commander/local` - Original single-device mode
- `/commander/lobby/ABC123` - Shared display for lobby ABC123
- `/commander/lobby/ABC123/controller` - Player remote for lobby ABC123

---

### Phase 4: User Flows

**4.1 Host Flow (Create Lobby)**
```
1. User visits /commander
2. Clicks "Create Lobby"
3. System generates lobby code (e.g., ABC123)
4. Redirects to /commander/lobby/ABC123
5. Shows shared display with QR code + lobby code
6. Other players join and appear in quadrants
```

**4.2 Player Flow (Join Lobby)**
```
1. User visits /commander
2. Enters lobby code (ABC123)
3. Redirects to /commander/lobby/ABC123/controller
4. Enters their name
5. Claims an available player slot (1-4)
6. Gets personal remote control interface
7. Their changes sync to shared display
```

**4.3 Shared Display Features**
- Shows all 4 player quadrants (like current design)
- Displays lobby code prominently for late joiners
- Shows QR code linking to controller URL
- Connection status indicators per player
- Host controls: kick players, reset game

**4.4 Controller Features**
- Large, touch-friendly buttons for life changes
- Commander damage tracking
- Poison counter
- Name editing
- Action history for this player only
- Connection status indicator

---

### Phase 5: PartyKit Server Logic

**5.1 Server State Management**
```typescript
// party/commander.ts
export default class CommanderParty implements Party.Server {
  lobby: LobbyState;

  onConnect(conn: Party.Connection) {
    // Send current state to new connection
    conn.send(JSON.stringify({ type: 'sync', state: this.lobby }));
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message);

    switch(msg.type) {
      case 'join':
        this.addPlayer(sender.id, msg.playerName);
        break;
      case 'update-life':
        this.updatePlayerLife(msg.slot, msg.delta);
        break;
      // ... handle all message types
    }

    // Broadcast updated state to all clients
    this.party.broadcast(JSON.stringify({
      type: 'state-update',
      state: this.lobby
    }));
  }

  onClose(conn: Party.Connection) {
    this.markPlayerDisconnected(conn.id);
  }
}
```

**5.2 State Persistence**
- Use PartyKit's built-in storage for lobby persistence
- Lobbies auto-expire after 4 hours of inactivity
- Option to save/restore games

---

### Phase 6: Component Implementation

**6.1 LobbyLanding Component**
```
┌─────────────────────────────┐
│      COMMANDER TRACKER      │
│                             │
│  ┌───────────────────────┐  │
│  │   CREATE LOBBY        │  │
│  │   Host a new game     │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │   JOIN LOBBY          │  │
│  │   [______] Enter code │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │   LOCAL MODE          │  │
│  │   Single device       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

**6.2 LobbyDisplay Component (Shared Screen)**
```
┌─────────────────────────────────────────┐
│  LOBBY: ABC123  [QR]    👥 3/4 players  │
├───────────────────┬─────────────────────┤
│                   │                     │
│    PLAYER 1       │     PLAYER 2        │
│      40 ❤️        │       38 ❤️         │
│    (waiting...)   │     (Alice)         │
│                   │                     │
├───────────────────┼─────────────────────┤
│                   │                     │
│    PLAYER 3       │     PLAYER 4        │
│      40 ❤️        │       35 ❤️         │
│     (Bob)         │     (Carol)         │
│                   │                     │
└───────────────────┴─────────────────────┘
```

**6.3 PlayerController Component (Remote)**
```
┌─────────────────────────────┐
│  Connected to ABC123   🟢   │
├─────────────────────────────┤
│                             │
│         YOUR LIFE           │
│           40                │
│                             │
│   [-5] [-1]    [+1] [+5]   │
│                             │
├─────────────────────────────┤
│  Commander Damage           │
│  From Alice: 0  [+] [-]     │
│  From Bob:   0  [+] [-]     │
│  From Carol: 2  [+] [-]     │
├─────────────────────────────┤
│  Poison: 0      [+] [-]     │
├─────────────────────────────┤
│  ┌─ History ─────────────┐  │
│  │ +5 life               │  │
│  │ -1 life               │  │
│  │ +2 cmdr from Carol    │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

### Phase 7: Error Handling & Edge Cases

**7.1 Connection Issues**
- Show reconnection UI with countdown
- Auto-reconnect with exponential backoff
- Preserve local state during disconnection
- Sync state on reconnection

**7.2 Player Disconnection**
- Mark player as "disconnected" (grayed out)
- Host can kick disconnected players
- Slot becomes available after timeout (30s)

**7.3 Host Disconnection**
- Transfer host to next connected player
- Or: freeze game until host returns
- Show "Host disconnected" warning

**7.4 Lobby Full**
- Show "Lobby full" message
- Option to spectate (read-only view)

---

### Phase 8: Mobile Optimization

**8.1 Controller View**
- Full-screen life controls
- Large touch targets (minimum 48px)
- Swipe gestures for quick adjustments
- Haptic feedback on actions

**8.2 Display View**
- Auto-rotate based on device orientation
- Scale to fit any screen
- Hide lobby code after initial join period (tap to reveal)

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `party/commander.ts` | PartyKit server |
| `partykit.json` | PartyKit configuration |
| `app/commander/lobby/[code]/page.tsx` | Shared display |
| `app/commander/lobby/[code]/controller/page.tsx` | Player remote |
| `app/commander/local/page.tsx` | Original single-device mode |
| `app/commander/components/LobbyLanding.tsx` | Create/Join UI |
| `app/commander/components/LobbyDisplay.tsx` | Shared screen component |
| `app/commander/components/PlayerController.tsx` | Remote control component |
| `app/commander/components/ConnectionStatus.tsx` | Connection indicator |
| `app/commander/hooks/usePartySocket.ts` | PartyKit connection hook |
| `app/commander/hooks/useLobbyState.ts` | Lobby state management |

### Modified Files
| File | Changes |
|------|---------|
| `app/commander/page.tsx` | Replace with landing page |
| `app/commander/types.ts` | Add lobby-related types |
| `package.json` | Add partykit dependencies |

---

## Deployment Considerations

**PartyKit Deployment**
- Deploy PartyKit server to Cloudflare: `npx partykit deploy`
- Configure environment variables for production URLs
- Set up custom domain (optional)

**Next.js Integration**
- PartyKit URL configured via environment variable
- Development: `localhost:1999`
- Production: `your-project.partykit.dev`

---

## Future Enhancements (Not in Initial Scope)

1. **Spectator Mode** - Watch-only viewers
2. **Game Presets** - Quick setup for different formats
3. **Chat** - In-game messaging
4. **Sound Effects** - Audio feedback on life changes
5. **Themes** - Custom color schemes per player
6. **Tournament Mode** - Track multiple games
7. **Card Search** - Integration with Scryfall API
8. **Animated Transitions** - Smooth state changes

---

## Implementation Order

1. **Phase 1**: PartyKit setup (1 file)
2. **Phase 2**: Types and utilities (2 files)
3. **Phase 3**: Hooks for connection (2 files)
4. **Phase 4**: Landing page restructure (1 file)
5. **Phase 5**: Move existing code to `/local` (1 file)
6. **Phase 6**: Shared display view (2 files)
7. **Phase 7**: Controller view (2 files)
8. **Phase 8**: Testing & polish

---

## Questions to Confirm

1. **Lobby Size**: Is 4 players max correct, or should we support 2-6?
2. **Player Slots**: Should players auto-assign to slots or choose manually?
3. **Persistence**: Should lobbies survive server restarts?
4. **Spectators**: Should non-players be able to view the shared display?
5. **Authentication**: Any need for player accounts, or anonymous only?
