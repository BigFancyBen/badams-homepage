/**
 * Budget arithmetic for ingest, kept apart from it so it can be tested without
 * a Worker runtime — same arrangement as `schedule.ts`.
 */

/** Anything ingest batches: the message it came from is what the cursor names. */
interface FromMessage {
  message: { id: string };
}

/**
 * As much of the budget as can be spent without splitting a message.
 *
 * Discord's `after` and `before` cursors are exclusive, so a cursor parked on
 * a half-handled message skips whatever is left on it forever — and people
 * post three photos of one meal constantly. Taking a message either entirely
 * or not at all keeps the cursor on a boundary where it means what it says.
 *
 * The first message is taken even when it alone exceeds the budget. Refusing
 * it would park the cursor in front of it and stall ingest permanently, which
 * is a far worse failure than one oversized run.
 *
 * Assumes items from one message are adjacent, which they are: the list is
 * built by flat-mapping the page in order.
 */
export function takeWholeMessages<T extends FromMessage>(
  items: T[],
  budget: number
): T[] {
  const taken: T[] = [];

  for (let i = 0; i < items.length; ) {
    const messageId = items[i].message.id;
    let end = i;
    while (end < items.length && items[end].message.id === messageId) end++;

    const group = items.slice(i, end);
    if (taken.length > 0 && taken.length + group.length > budget) break;
    taken.push(...group);
    if (taken.length >= budget) break;
    i = end;
  }

  return taken;
}
