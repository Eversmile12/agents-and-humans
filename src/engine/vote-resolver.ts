export interface Vote {
  voterId: string;
  target: string | "skip"; // playerId or "skip"
}

export interface VoteResult {
  tally: Map<string, { count: number; voters: string[] }>;
  eliminated: string | null; // playerId or null if tie/skip majority
  outcome: "eliminated" | "no_majority" | "skip";
}

export function resolveVotes(
  votes: Vote[],
  aliveCount: number
): VoteResult {
  const tally = new Map<string, { count: number; voters: string[] }>();

  for (const vote of votes) {
    const entry = tally.get(vote.target) || { count: 0, voters: [] };
    entry.count++;
    entry.voters.push(vote.voterId);
    tally.set(vote.target, entry);
  }

  // Find the target with the most votes (excluding "skip")
  let maxTarget: string | null = null;
  let maxCount = 0;
  let isTied = false;

  for (const [target, entry] of tally) {
    if (target === "skip") continue;
    if (entry.count > maxCount) {
      maxCount = entry.count;
      maxTarget = target;
      isTied = false;
    } else if (entry.count === maxCount && maxCount > 0) {
      isTied = true;
    }
  }

  const skipCount = tally.get("skip")?.count || 0;

  // Skip wins if it has more votes than any candidate
  if (skipCount > maxCount) {
    return { tally, eliminated: null, outcome: "skip" };
  }

  // Need strict majority of alive players
  const majority = Math.floor(aliveCount / 2) + 1;

  if (isTied || maxCount < majority) {
    return { tally, eliminated: null, outcome: "no_majority" };
  }

  return { tally, eliminated: maxTarget, outcome: "eliminated" };
}
