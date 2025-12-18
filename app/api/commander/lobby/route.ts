import { NextResponse } from "next/server";
import { redis, getLobbyKey, LOBBY_TTL_SECONDS } from "@/app/commander/lib/redis";
import {
  generateLobbyCode,
  PlayerState,
  LobbyState,
  PlayerCount,
} from "@/app/commander/types";

// Create initial player state
function createInitialPlayer(index: number, startingLife: number): PlayerState {
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

// POST: Create a new lobby
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerCount: PlayerCount = body.playerCount || 4;
    const startingLife: number = body.startingLife || 40;

    // Generate unique lobby code
    let code: string;
    let attempts = 0;
    do {
      code = generateLobbyCode();
      const existing = await redis.get(getLobbyKey(code));
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate unique lobby code" },
        { status: 500 }
      );
    }

    // Create initial lobby state
    const lobby: LobbyState = {
      code,
      players: Array.from({ length: 4 }, (_, i) =>
        createInitialPlayer(i + 1, startingLife)
      ),
      settings: {
        playerCount,
        startingLife,
      },
      showQrOverlay: true,
      createdAt: Date.now(),
      version: 1,
    };

    // Store in Redis with TTL
    await redis.set(getLobbyKey(code), JSON.stringify(lobby), {
      ex: LOBBY_TTL_SECONDS,
    });

    return NextResponse.json({ code, lobby });
  } catch (error) {
    console.error("Error creating lobby:", error);
    return NextResponse.json(
      { error: "Failed to create lobby" },
      { status: 500 }
    );
  }
}
