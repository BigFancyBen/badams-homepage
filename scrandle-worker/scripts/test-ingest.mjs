#!/usr/bin/env node
/**
 * The two pieces of ingest that decide whether a photo is ever seen again.
 *
 * `takeWholeMessages` exists because Discord's `after`/`before` cursors are
 * exclusive: a cursor parked on a message that was only half handled skips
 * whatever was left on it, permanently. Slicing the budget mid-message did
 * exactly that, and a meal posted as three photos is the common case, not the
 * edge case. The boundary sweep at the end is the real test — it asserts the
 * invariant the cursor arithmetic depends on across every budget.
 *
 * `retryWrite` exists because an hourly ingest died on `D1_ERROR: Network
 * connection lost`, which Cloudflare documents as "retry the operation".
 *
 * Node >= 22 strips the types from the imported .ts on the fly, so this needs
 * no build step and no test dependency.
 */
import assert from "node:assert/strict";
import { takeWholeMessages } from "../src/batching.ts";
import { retryWrite } from "../src/db.ts";

let failures = 0;
function check(name, actual, expected) {
  try {
    assert.deepEqual(actual, expected);
    console.log(`  pass  ${name}`);
  } catch {
    failures++;
    console.log(`  FAIL  ${name}`);
    console.log(`        actual   ${JSON.stringify(actual)}`);
    console.log(`        expected ${JSON.stringify(expected)}`);
  }
}

/** `[["a", 3]]` = one message `a` carrying three attachments. */
const build = (spec) =>
  spec.flatMap(([id, n]) =>
    Array.from({ length: n }, (_, k) => ({
      message: { id },
      attachment: { id: `${id}${k}` },
    }))
  );
const ids = (taken) => taken.map((c) => c.attachment.id);

console.log("takeWholeMessages");
check(
  "leaves a message whole rather than splitting it",
  ids(takeWholeMessages(build([["a", 8], ["b", 3]]), 10)),
  ["a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7"]
);
check(
  "takes an exact fit",
  ids(takeWholeMessages(build([["a", 7], ["b", 3]]), 10)),
  ["a0", "a1", "a2", "a3", "a4", "a5", "a6", "b0", "b1", "b2"]
);
check(
  "takes everything when under budget",
  ids(takeWholeMessages(build([["a", 2], ["b", 1]]), 10)),
  ["a0", "a1", "b0"]
);
// Refusing it would park the cursor in front of it and stall ingest for good.
check(
  "takes an oversized first message anyway",
  takeWholeMessages(build([["a", 12]]), 10).length,
  12
);
check(
  "and drags nothing along with it",
  takeWholeMessages(build([["a", 12], ["b", 1]]), 10).length,
  12
);
check("handles an empty page", takeWholeMessages([], 10), []);

// The invariant the cursor depends on: the batch always ends on a complete
// message, so setting the cursor to its last message id and asking Discord for
// everything after it leaves nothing behind.
console.log("takeWholeMessages boundary invariant");
const SPECS = [
  [["a", 3], ["b", 3], ["c", 3], ["d", 3]],
  [["a", 1], ["b", 9], ["c", 2]],
  [["a", 5], ["b", 5], ["c", 5]],
  [["a", 11], ["b", 1]],
];
let swept = 0;
for (const spec of SPECS) {
  for (let budget = 1; budget <= 12; budget++) {
    const all = build(spec);
    const taken = takeWholeMessages(all, budget);
    const lastId = taken[taken.length - 1].message.id;
    const onLast = (list) => list.filter((c) => c.message.id === lastId).length;
    if (onLast(taken) !== onLast(all)) {
      failures++;
      console.log(
        `  FAIL  spec=${JSON.stringify(spec)} budget=${budget}: took ` +
          `${onLast(taken)}/${onLast(all)} of message ${lastId}`
      );
    }
    swept++;
  }
}
if (failures === 0) console.log(`  pass  ends on a message boundary (${swept} cases)`);

console.log("retryWrite");
{
  const transient = () => new Error("D1_ERROR: Network connection lost.");

  let calls = 0;
  await retryWrite(async () => {
    calls++;
    if (calls < 3) throw transient();
  });
  check("retries a transient failure until it lands", calls, 3);

  calls = 0;
  await retryWrite(async () => {
    calls++;
  });
  check("does not retry a call that succeeds", calls, 1);

  // A schema error will fail identically forever; burning two more attempts
  // and 300ms on it helps nobody.
  calls = 0;
  await assert.rejects(
    retryWrite(async () => {
      calls++;
      throw new Error("D1_ERROR: no such column: banana");
    })
  );
  check("gives up immediately on a non-transient failure", calls, 1);

  // Three attempts, then the original error is rethrown for the caller to log.
  calls = 0;
  let thrown = null;
  await retryWrite(async () => {
    calls++;
    throw transient();
  }).catch((error) => {
    thrown = error;
  });
  check("stops after three attempts", calls, 3);
  check("rethrows the last failure", thrown?.message, "D1_ERROR: Network connection lost.");
}

console.log(failures === 0 ? "\nall pass" : `\n${failures} failing`);
process.exit(failures ? 1 : 0);
