export interface PlayerState {
  playerId: string;
  agentName: string;
  role: "agent" | "human";
  isAlive: boolean;
}

export type WinResult =
  | { gameOver: false }
  | { gameOver: true; winner: "agents" | "humans"; reason: string };

export function checkWinCondition(players: PlayerState[]): WinResult {
  const aliveHumans = players.filter(
    (p) => p.isAlive && p.role === "human"
  ).length;
  const aliveAgents = players.filter(
    (p) => p.isAlive && p.role === "agent"
  ).length;

  if (aliveHumans === 0) {
    return {
      gameOver: true,
      winner: "agents",
      reason: "All Humans have been eliminated",
    };
  }

  if (aliveHumans >= aliveAgents) {
    return {
      gameOver: true,
      winner: "humans",
      reason: "Humans equal or outnumber Agents",
    };
  }

  return { gameOver: false };
}
