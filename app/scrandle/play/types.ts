/**
 * The weekly puzzle, as the Worker writes it into the bucket. The other half
 * of this contract is scrandle-worker/src/weekly.ts — keep them in step.
 */
export interface WeeklyPlate {
  id: number;
  image: string;
  name: string;
  chef: string;
  /** Rounded, as it stood when the puzzle was drawn. */
  rating: number;
  /** Where the food is in the frame, as fractions of it. */
  focus?: [number, number];
}

export interface WeeklyRound {
  a: WeeklyPlate;
  b: WeeklyPlate;
}

export interface WeeklyPuzzle {
  number: number;
  postedAt: number;
  rounds: WeeklyRound[];
}

export type Side = "a" | "b";

function isPlate(value: unknown): value is WeeklyPlate {
  const plate = value as WeeklyPlate | null;
  return (
    typeof plate === "object" &&
    plate !== null &&
    typeof plate.image === "string" &&
    typeof plate.rating === "number"
  );
}

/** A file from a public bucket is still a file from somewhere else. */
export function isWeeklyPuzzle(value: unknown): value is WeeklyPuzzle {
  const puzzle = value as WeeklyPuzzle | null;
  return (
    typeof puzzle === "object" &&
    puzzle !== null &&
    typeof puzzle.number === "number" &&
    Array.isArray(puzzle.rounds) &&
    puzzle.rounds.length > 0 &&
    puzzle.rounds.every((round) => isPlate(round?.a) && isPlate(round?.b))
  );
}

/** Which side the channel rated higher. The draw guarantees it is not a tie. */
export function answer(round: WeeklyRound): Side {
  return round.a.rating >= round.b.rating ? "a" : "b";
}
