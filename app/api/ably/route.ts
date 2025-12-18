import Ably from 'ably';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ably API key not configured' },
      { status: 500 }
    );
  }

  // Ably sends authParams as application/x-www-form-urlencoded
  let clientId: string;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    clientId = formData.get('clientId') as string;
  } else if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      clientId = body.clientId;
    } catch {
      clientId = Math.random().toString(36).substring(2, 15);
    }
  } else {
    // Check query params as fallback
    clientId = request.nextUrl.searchParams.get('clientId') || Math.random().toString(36).substring(2, 15);
  }

  const client = new Ably.Rest(apiKey);
  const tokenRequestData = await client.auth.createTokenRequest({
    clientId,
  });

  return NextResponse.json(tokenRequestData);
}

// Also support GET for backwards compatibility
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ably API key not configured' },
      { status: 500 }
    );
  }

  const client = new Ably.Rest(apiKey);
  const tokenRequestData = await client.auth.createTokenRequest({
    clientId,
  });

  return NextResponse.json(tokenRequestData);
}
