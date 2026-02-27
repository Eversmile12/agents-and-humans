function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      dp[i]![j] = 0;
    }
  }
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

export function findClosestMatch(
  input: string,
  candidates: string[]
): string | null {
  const lower = input.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;

  for (const name of candidates) {
    const dist = levenshtein(lower, name.toLowerCase());
    if (dist < bestDist && dist <= 3) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}
