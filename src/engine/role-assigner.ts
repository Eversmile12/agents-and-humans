export interface PlayerSlot {
  playerId: string;
  agentName: string;
}

export interface RoleAssignment {
  playerId: string;
  agentName: string;
  role: "agent" | "human";
}

export function assignRoles(
  players: PlayerSlot[],
  humansCount: number
): RoleAssignment[] {
  // Fisher-Yates shuffle
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled.map((p, i) => ({
    playerId: p.playerId,
    agentName: p.agentName,
    role: i < humansCount ? "human" : "agent",
  }));
}
