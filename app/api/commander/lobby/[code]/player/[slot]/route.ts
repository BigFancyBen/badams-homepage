import { NextResponse } from "next/server";
import { redis, getLobbyKey, LOBBY_TTL_SECONDS } from "@/app/commander/lib/redis";
import { LobbyState, HistoryEntry } from "@/app/commander/types";

// PATCH: Update a player's state
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string; slot: string }> }
) {
  try {
    const { code, slot: slotStr } = await params;
    const slot = parseInt(slotStr, 10);

    if (isNaN(slot) || slot < 0 || slot > 3) {
      return NextResponse.json(
        { error: "Invalid slot" },
        { status: 400 }
      );
    }

    const key = getLobbyKey(code);
    const body = await request.json();

    const data = await redis.get<string>(key);
    if (!data) {
      return NextResponse.json(
        { error: "Lobby not found" },
        { status: 404 }
      );
    }

    const lobby: LobbyState = typeof data === "string" ? JSON.parse(data) : data;
    const player = lobby.players[slot];

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Update allowed fields
    if (typeof body.life === "number") {
      player.life = Math.max(0, body.life);
    }
    if (typeof body.lifeDelta === "number") {
      player.life = Math.max(0, player.life + body.lifeDelta);
    }
    if (Array.isArray(body.commanderDamage) && body.commanderDamage.length === 3) {
      player.commanderDamage = body.commanderDamage.map((d: number) =>
        Math.max(0, Math.min(21, d))
      ) as [number, number, number];
    }
    if (typeof body.commanderDamageUpdate === "object") {
      const { sourceIndex, delta } = body.commanderDamageUpdate;
      if (typeof sourceIndex === "number" && typeof delta === "number") {
        const currentDamage = player.commanderDamage[sourceIndex];
        const newDamage = Math.max(0, Math.min(21, currentDamage + delta));
        const actualDelta = newDamage - currentDamage;
        player.commanderDamage[sourceIndex] = newDamage;
        // Commander damage also reduces life
        if (actualDelta > 0) {
          player.life = Math.max(0, player.life - actualDelta);
        }
      }
    }
    if (typeof body.poison === "number") {
      player.poison = Math.max(0, body.poison);
    }
    if (typeof body.poisonDelta === "number") {
      player.poison = Math.max(0, player.poison + body.poisonDelta);
    }
    if (typeof body.name === "string") {
      player.name = body.name.slice(0, 20); // Max 20 chars
    }
    if (typeof body.isDead === "boolean") {
      player.isDead = body.isDead;
    }
    if (typeof body.toggleDead === "boolean" && body.toggleDead) {
      player.isDead = !player.isDead;
    }
    if (body.historyEntry) {
      const entry: HistoryEntry = {
        action: body.historyEntry.action,
        timestamp: Date.now(),
      };
      player.history = [entry, ...player.history.slice(0, 49)];
    }

    lobby.version++;

    // Save with refreshed TTL
    await redis.set(key, JSON.stringify(lobby), {
      ex: LOBBY_TTL_SECONDS,
    });

    // Return just the updated player for efficiency
    return NextResponse.json({
      player,
      version: lobby.version,
    });
  } catch (error) {
    console.error("Error updating player:", error);
    return NextResponse.json(
      { error: "Failed to update player" },
      { status: 500 }
    );
  }
}
