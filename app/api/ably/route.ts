import Ably from 'ably';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Hands the Commander life tracker a signed Ably token request.
 *
 * Anyone can call this — there are no accounts — so what it signs is the only
 * thing standing between a stranger and the API key's full reach. The token is
 * therefore pinned to the one thing the app does: talk and show presence on a
 * `commander:<room>` channel. Without a capability a token inherits everything
 * the key can do, on every channel in the Ably app.
 *
 * The key itself should carry the same restriction in the Ably dashboard, so
 * the limit holds even if this file is someday wrong.
 */
const CAPABILITY = JSON.stringify({
  'commander:*': ['publish', 'subscribe', 'presence'],
});

/** An hour: Ably's default, stated so it is a decision rather than an accident. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** What `generateClientId` in the multiplayer page produces, with room to spare. */
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

async function readClientId(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';

  try {
    // Ably sends authParams as application/x-www-form-urlencoded
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return (await request.formData()).get('clientId');
    }
    if (contentType.includes('application/json')) {
      return (await request.json())?.clientId;
    }
  } catch {
    return null;
  }

  return request.nextUrl.searchParams.get('clientId');
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ably API key not configured' },
      { status: 500 }
    );
  }

  const clientId = await readClientId(request);
  if (typeof clientId !== 'string' || !CLIENT_ID.test(clientId)) {
    return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
  }

  const client = new Ably.Rest(apiKey);
  const tokenRequestData = await client.auth.createTokenRequest({
    clientId,
    capability: CAPABILITY,
    ttl: TOKEN_TTL_MS,
  });

  return NextResponse.json(tokenRequestData, {
    headers: { 'cache-control': 'no-store' },
  });
}
