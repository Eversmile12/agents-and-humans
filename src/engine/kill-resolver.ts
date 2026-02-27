export interface KillVote {
  voterId: string;
  target: string; // playerId
}

export function resolveKillTarget(votes: KillVote[]): string {
  const tally = new Map<string, number>();

  for (const vote of votes) {
    tally.set(vote.target, (tally.get(vote.target) || 0) + 1);
  }

  // Find max
  let maxCount = 0;
  const maxTargets: string[] = [];

  for (const [target, count] of tally) {
    if (count > maxCount) {
      maxCount = count;
      maxTargets.length = 0;
      maxTargets.push(target);
    } else if (count === maxCount) {
      maxTargets.push(target);
    }
  }

  // Random tiebreak
  if (maxTargets.length === 0) {
    throw new Error("No kill votes to resolve");
  }

  return maxTargets[Math.floor(Math.random() * maxTargets.length)]!;
}
