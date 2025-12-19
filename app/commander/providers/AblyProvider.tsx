"use client";

import * as Ably from 'ably';
import { AblyProvider as AblyReactProvider, ChannelProvider } from 'ably/react';
import { ReactNode, useMemo } from 'react';

interface AblyProviderProps {
  children: ReactNode;
  clientId: string;
  channelName?: string;
}

export function AblyProvider({ children, clientId, channelName }: AblyProviderProps) {
  const client = useMemo(() => {
    return new Ably.Realtime({
      authUrl: '/api/ably',
      authMethod: 'POST',
      authParams: { clientId },
      clientId,
    });
  }, [clientId]);

  if (channelName) {
    return (
      <AblyReactProvider client={client}>
        <ChannelProvider channelName={channelName}>
          {children}
        </ChannelProvider>
      </AblyReactProvider>
    );
  }

  return (
    <AblyReactProvider client={client}>
      {children}
    </AblyReactProvider>
  );
}
