"use client";

import { ActiveToken } from "../types";
import { TokenCard } from "./TokenCard";

interface TokenGridProps {
  activeTokens: ActiveToken[];
  onToggleTap: (stackId: string) => void;
  onIncrementCount: (stackId: string) => void;
  onDecrementCount: (stackId: string) => void;
  onAddPermanent: (stackId: string) => void;
  onRemovePermanent: (stackId: string) => void;
  onAddTemporary: (stackId: string) => void;
  onRemoveTemporary: (stackId: string) => void;
  onSplit: (stackId: string) => void;
  onRemoveStack: (stackId: string) => void;
  onMerge: (tokenId: string) => void;
}

export function TokenGrid({
  activeTokens,
  onToggleTap,
  onIncrementCount,
  onDecrementCount,
  onAddPermanent,
  onRemovePermanent,
  onAddTemporary,
  onRemoveTemporary,
  onSplit,
  onRemoveStack,
  onMerge,
}: TokenGridProps) {
  if (activeTokens.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-[#6b7280] mb-4">
          <svg
            className="mx-auto h-16 w-16 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-[#cccccc] mb-2">
          No Tokens on Battlefield
        </h3>
        <p className="text-[#9ca3af]">
          Open the token picker to add tokens to the battlefield.
        </p>
      </div>
    );
  }

  // Flatten all stacks into a single list for inline flow
  const allStacks = activeTokens.flatMap((token) =>
    token.stacks.map((stack) => ({
      stack,
      token,
      canMerge: token.stacks.length > 1,
    }))
  );

  return (
    <div className="grid grid-cols-6 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1 items-start">
      {allStacks.map(({ stack, token, canMerge }) => (
        <TokenCard
          key={stack.id}
          stack={stack}
          name={token.name}
          imageUrl={token.imageUrl}
          basePower={token.basePower}
          baseToughness={token.baseToughness}
          canMerge={canMerge}
          onToggleTap={() => onToggleTap(stack.id)}
          onIncrementCount={() => onIncrementCount(stack.id)}
          onDecrementCount={() => onDecrementCount(stack.id)}
          onAddPermanent={() => onAddPermanent(stack.id)}
          onRemovePermanent={() => onRemovePermanent(stack.id)}
          onAddTemporary={() => onAddTemporary(stack.id)}
          onRemoveTemporary={() => onRemoveTemporary(stack.id)}
          onSplit={() => onSplit(stack.id)}
          onRemove={() => onRemoveStack(stack.id)}
          onMerge={() => onMerge(token.tokenId)}
        />
      ))}
    </div>
  );
}
