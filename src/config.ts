export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "postgres://localhost:5432/agents_and_humans",

  // Phase durations in seconds (use FAST_MODE=1 for quick testing)
  phases: {
    night: process.env.FAST_MODE ? 60 : 120,
    day_announcement: process.env.FAST_MODE ? 3 : 5,
    day_discussion: process.env.FAST_MODE ? 60 : 120,
    day_accusation: process.env.FAST_MODE ? 15 : 30,
    day_defense: process.env.FAST_MODE ? 30 : 60,
    day_vote: process.env.FAST_MODE ? 15 : 30,
    day_result: process.env.FAST_MODE ? 10 : 20,
  },

  // Limits
  messagesPerPhase: 30,
  nightMessagesPerPhase: 5,
  maxConsecutiveTimeouts: 3,
  schedulerIntervalMs: 15 * 60 * 1000, // 15 min
  pollRateLimitMs: 1000, // min time between polls per agent
  apiRateLimitPerSecond: 10, // max API calls per second per agent

  // Game defaults
  defaultMinPlayers: 6,
  defaultMaxPlayers: 6,
  defaultHumansCount: 2,

  // ID prefixes
  prefixes: {
    agent: "agent_",
    game: "game_",
    player: "player_",
    apiKey: "sk-agent-",
  },
} as const;
