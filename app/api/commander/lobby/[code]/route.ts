import { NextResponse } from "next/server";
import { redis, getLobbyKey, LOBBY_TTL_SECONDS } from "@/app/commander/lib/redis";
import { LobbyState } from "@/app/commander/types";

// GET: Get lobby state
export async function GET(
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
    return NextResponse.json(lobby);
  } catch (error) {
    console.error("Error getting lobby:", error);
    return NextResponse.json(
      { error: "Failed to get lobby" },
      { status: 500 }
    );
  }
}

// PATCH: Update lobby settings (QR overlay, etc.)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
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

    // Update allowed fields
    if (typeof body.showQrOverlay === "boolean") {
      lobby.showQrOverlay = body.showQrOverlay;
    }

    lobby.version++;

    // Save with refreshed TTL
    await redis.set(key, JSON.stringify(lobby), {
      ex: LOBBY_TTL_SECONDS,
    });

    return NextResponse.json(lobby);
  } catch (error) {
    console.error("Error updating lobby:", error);
    return NextResponse.json(
      { error: "Failed to update lobby" },
      { status: 500 }
    );
  }
}
