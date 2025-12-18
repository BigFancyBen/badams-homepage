import { NextResponse } from "next/server";
import { redis, getLobbyKey, LOBBY_TTL_SECONDS } from "@/app/commander/lib/redis";
import { LobbyState } from "@/app/commander/types";

// POST: Reset the game
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const key = getLobbyKey(code);

    const data = await redis.get<string>(key);
    if (!data) {
      return NextResponse.json(
        { error: "Lobby not found" },
        { status: 404 }
      );
    }

    const lobby: LobbyState = typeof data === "string" ? JSON.parse(data) : data;
    const startingLife = lobby.settings.startingLife;

    // Reset all players
    lobby.players = lobby.players.map((player, index) => ({
      ...player,
      life: startingLife,
      commanderDamage: [0, 0, 0] as [number, number, number],
      poison: 0,
      isDead: false,
      history: [],
    }));

    lobby.version++;

    // Save with refreshed TTL
    await redis.set(key, JSON.stringify(lobby), {
      ex: LOBBY_TTL_SECONDS,
    });

    return NextResponse.json(lobby);
  } catch (error) {
    console.error("Error resetting game:", error);
    return NextResponse.json(
      { error: "Failed to reset game" },
      { status: 500 }
    );
  }
}
