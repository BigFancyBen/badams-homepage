import { NextRequest, NextResponse } from "next/server";

interface ArchidektCard {
  quantity: number;
  card: {
    oracleCard: {
      name: string;
    };
  };
}

interface ArchidektDeckResponse {
  id: number;
  name: string;
  cards: ArchidektCard[];
}

function extractDeckId(input: string): string | null {
  const trimmed = input.trim();

  // If it's just a number, use it directly
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Match archidekt.com/decks/{id} patterns
  const match = trimmed.match(
    /archidekt\.com\/decks\/(\d+)/i
  );
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  const deckId = extractDeckId(url);

  if (!deckId) {
    return NextResponse.json(
      { error: "Invalid Archidekt URL. Expected format: https://archidekt.com/decks/12345/deck-name" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://archidekt.com/api/decks/${deckId}/`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Deck not found. Make sure the deck exists and is public." },
        { status: 404 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Archidekt returned status ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as ArchidektDeckResponse;

    const cards = data.cards
      .filter((c) => c.card?.oracleCard?.name)
      .map((c) => ({
        quantity: c.quantity,
        name: c.card.oracleCard.name,
      }));

    return NextResponse.json({
      name: data.name,
      cards,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch deck from Archidekt" },
      { status: 502 }
    );
  }
}
