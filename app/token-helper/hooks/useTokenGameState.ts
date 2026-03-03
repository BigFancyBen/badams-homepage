"use client";

import { useState, useCallback } from "react";
import {
  ActiveToken,
  TokenStack,
  TokenGameState,
  DiscoveredToken,
} from "../types";

function generateId(): string {
  return `stack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface UseTokenGameStateOptions {
  initialState: TokenGameState | null;
  onStateChange: (state: TokenGameState) => void;
}

export function useTokenGameState({
  initialState,
  onStateChange,
}: UseTokenGameStateOptions) {
  // initialState is guaranteed to be loaded before this hook mounts
  // (page.tsx returns early until isLoaded is true)
  const [activeTokens, setActiveTokens] = useState<ActiveToken[]>(
    initialState?.activeTokens ?? []
  );

  // Persist on every change
  const persist = useCallback(
    (tokens: ActiveToken[]) => {
      onStateChange({
        activeTokens: tokens,
        updatedAt: Date.now(),
      });
    },
    [onStateChange]
  );

  const updateTokens = useCallback(
    (updater: (prev: ActiveToken[]) => ActiveToken[]) => {
      setActiveTokens((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addToken = useCallback(
    (token: DiscoveredToken) => {
      updateTokens((prev) => {
        const existing = prev.find((t) => t.tokenId === token.scryfallId);
        if (existing) {
          // Add a new stack to existing token
          return prev.map((t) =>
            t.tokenId === token.scryfallId
              ? {
                  ...t,
                  stacks: [
                    ...t.stacks,
                    {
                      id: generateId(),
                      tokenId: token.scryfallId,
                      count: 1,
                      isTapped: false,
                      permanentCounters: 0,
                      temporaryCounters: 0,
                    },
                  ],
                }
              : t
          );
        }

        const newToken: ActiveToken = {
          tokenId: token.scryfallId,
          name: token.name,
          typeLine: token.typeLine,
          imageUrl: token.imageUrl,
          basePower: token.basePower,
          baseToughness: token.baseToughness,
          stacks: [
            {
              id: generateId(),
              tokenId: token.scryfallId,
              count: 1,
              isTapped: false,
              permanentCounters: 0,
              temporaryCounters: 0,
            },
          ],
        };
        return [...prev, newToken];
      });
    },
    [updateTokens]
  );

  const removeStack = useCallback(
    (stackId: string) => {
      updateTokens((prev) => {
        return prev
          .map((token) => ({
            ...token,
            stacks: token.stacks.filter((s) => s.id !== stackId),
          }))
          .filter((token) => token.stacks.length > 0);
      });
    },
    [updateTokens]
  );

  const removeToken = useCallback(
    (tokenId: string) => {
      updateTokens((prev) => prev.filter((t) => t.tokenId !== tokenId));
    },
    [updateTokens]
  );

  const updateStack = useCallback(
    (stackId: string, updater: (stack: TokenStack) => TokenStack) => {
      updateTokens((prev) =>
        prev.map((token) => ({
          ...token,
          stacks: token.stacks.map((s) =>
            s.id === stackId ? updater(s) : s
          ),
        }))
      );
    },
    [updateTokens]
  );

  const toggleTap = useCallback(
    (stackId: string) => {
      updateStack(stackId, (s) => ({ ...s, isTapped: !s.isTapped }));
    },
    [updateStack]
  );

  const incrementCount = useCallback(
    (stackId: string) => {
      updateStack(stackId, (s) => ({ ...s, count: s.count + 1 }));
    },
    [updateStack]
  );

  const decrementCount = useCallback(
    (stackId: string) => {
      updateTokens((prev) => {
        return prev
          .map((token) => ({
            ...token,
            stacks: token.stacks
              .map((s) =>
                s.id === stackId ? { ...s, count: s.count - 1 } : s
              )
              .filter((s) => s.count > 0),
          }))
          .filter((token) => token.stacks.length > 0);
      });
    },
    [updateTokens]
  );

  const addPermanentCounter = useCallback(
    (stackId: string) => {
      updateStack(stackId, (s) => ({
        ...s,
        permanentCounters: s.permanentCounters + 1,
      }));
    },
    [updateStack]
  );

  const removePermanentCounter = useCallback(
    (stackId: string) => {
      updateStack(stackId, (s) => ({
        ...s,
        permanentCounters: Math.max(0, s.permanentCounters - 1),
      }));
    },
    [updateStack]
  );

  const addTemporaryCounter = useCallback(
    (stackId: string) => {
      updateStack(stackId, (s) => ({
        ...s,
        temporaryCounters: s.temporaryCounters + 1,
      }));
    },
    [updateStack]
  );

  const removeTemporaryCounter = useCallback(
    (stackId: string) => {
      updateStack(stackId, (s) => ({
        ...s,
        temporaryCounters: Math.max(0, s.temporaryCounters - 1),
      }));
    },
    [updateStack]
  );

  const splitStack = useCallback(
    (stackId: string) => {
      updateTokens((prev) =>
        prev.map((token) => {
          const stackIndex = token.stacks.findIndex((s) => s.id === stackId);
          if (stackIndex === -1) return token;

          const stack = token.stacks[stackIndex];
          if (stack.count < 2) return token;

          const newStack: TokenStack = {
            id: generateId(),
            tokenId: stack.tokenId,
            count: 1,
            isTapped: stack.isTapped,
            permanentCounters: stack.permanentCounters,
            temporaryCounters: stack.temporaryCounters,
          };

          const updatedStacks = [...token.stacks];
          updatedStacks[stackIndex] = { ...stack, count: stack.count - 1 };
          updatedStacks.splice(stackIndex + 1, 0, newStack);

          return { ...token, stacks: updatedStacks };
        })
      );
    },
    [updateTokens]
  );

  const mergeStacks = useCallback(
    (tokenId: string) => {
      updateTokens((prev) =>
        prev.map((token) => {
          if (token.tokenId !== tokenId) return token;
          if (token.stacks.length <= 1) return token;

          const totalCount = token.stacks.reduce((sum, s) => sum + s.count, 0);
          const maxPermanent = Math.max(
            ...token.stacks.map((s) => s.permanentCounters)
          );
          const maxTemporary = Math.max(
            ...token.stacks.map((s) => s.temporaryCounters)
          );
          const anyTapped = token.stacks.some((s) => s.isTapped);

          const mergedStack: TokenStack = {
            id: generateId(),
            tokenId,
            count: totalCount,
            isTapped: anyTapped,
            permanentCounters: maxPermanent,
            temporaryCounters: maxTemporary,
          };

          return { ...token, stacks: [mergedStack] };
        })
      );
    },
    [updateTokens]
  );

  const clearTemporaryCounters = useCallback(() => {
    updateTokens((prev) =>
      prev.map((token) => ({
        ...token,
        stacks: token.stacks.map((s) => ({ ...s, temporaryCounters: 0 })),
      }))
    );
  }, [updateTokens]);

  const hasTemporaryCounters = activeTokens.some((token) =>
    token.stacks.some((s) => s.temporaryCounters > 0)
  );

  const addPermanentCounterAll = useCallback(() => {
    updateTokens((prev) =>
      prev.map((token) => ({
        ...token,
        stacks: token.stacks.map((s) => ({
          ...s,
          permanentCounters: s.permanentCounters + 1,
        })),
      }))
    );
  }, [updateTokens]);

  const removePermanentCounterAll = useCallback(() => {
    updateTokens((prev) =>
      prev.map((token) => ({
        ...token,
        stacks: token.stacks.map((s) => ({
          ...s,
          permanentCounters: Math.max(0, s.permanentCounters - 1),
        })),
      }))
    );
  }, [updateTokens]);

  const addTemporaryCounterAll = useCallback(() => {
    updateTokens((prev) =>
      prev.map((token) => ({
        ...token,
        stacks: token.stacks.map((s) => ({
          ...s,
          temporaryCounters: s.temporaryCounters + 1,
        })),
      }))
    );
  }, [updateTokens]);

  const hasPTTokens = activeTokens.some(
    (token) => token.basePower !== null && token.baseToughness !== null
  );

  const untapAll = useCallback(() => {
    updateTokens((prev) =>
      prev.map((token) => ({
        ...token,
        stacks: token.stacks.map((s) => ({ ...s, isTapped: false })),
      }))
    );
  }, [updateTokens]);

  const hasTappedTokens = activeTokens.some((token) =>
    token.stacks.some((s) => s.isTapped)
  );

  const resetGame = useCallback(() => {
    setActiveTokens([]);
    persist([]);
  }, [persist]);

  return {
    activeTokens,
    addToken,
    removeToken,
    removeStack,
    toggleTap,
    incrementCount,
    decrementCount,
    addPermanentCounter,
    removePermanentCounter,
    addTemporaryCounter,
    removeTemporaryCounter,
    splitStack,
    mergeStacks,
    clearTemporaryCounters,
    hasTemporaryCounters,
    addPermanentCounterAll,
    removePermanentCounterAll,
    addTemporaryCounterAll,
    hasPTTokens,
    untapAll,
    hasTappedTokens,
    resetGame,
  } as const;
}
