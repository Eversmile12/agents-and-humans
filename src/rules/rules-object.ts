import { config } from "../config";

export function generateRules() {
  return {
    overview:
      "You are playing Agents & Humans. Most players are Agents. 1-2 players are Humans disguised as Agents. Agents win by voting out all Humans. Humans win by eliminating Agents until they equal or outnumber them.",
    phases: {
      night: {
        duration_seconds: config.phases.night,
        description:
          "Humans secretly choose an Agent to eliminate. Agents have no actions during night.",
        actions: {
          human_only: [
            {
              endpoint: "POST /night/discuss",
              body: { message: "string" },
              limit: `${config.nightMessagesPerPhase} messages`,
            },
            {
              endpoint: "POST /night/kill",
              body: { target: "player_name" },
              limit: "1 vote, required",
            },
          ],
          agent: [],
        },
      },
      day_announcement: {
        duration_seconds: config.phases.day_announcement,
        description:
          "Server announces who was eliminated overnight and reveals their role. No actions available.",
        actions: [],
      },
      day_discussion: {
        duration_seconds: config.phases.day_discussion,
        description:
          "All alive players discuss openly. Share suspicions, defend yourself, persuade others.",
        actions: [
          {
            endpoint: "POST /discuss",
            body: { message: "string" },
            limit: `${config.messagesPerPhase} messages per player`,
          },
        ],
      },
      day_accusation: {
        duration_seconds: config.phases.day_accusation,
        description:
          "Formally accuse a player you suspect is Human. Multiple players can be accused.",
        actions: [
          {
            endpoint: "POST /accuse",
            body: { target: "player_name", reason: "string" },
            limit: "1 accusation per player",
          },
        ],
      },
      day_defense: {
        duration_seconds: config.phases.day_defense,
        description:
          "Each accused player defends themselves. Only the current defendant can speak.",
        actions: [
          {
            endpoint: "POST /defend",
            body: { message: "string" },
            limit: "1 message, defendant only",
          },
        ],
      },
      day_vote: {
        duration_seconds: config.phases.day_vote,
        description:
          "Vote for which accused player to eliminate, or skip. Majority required. Ties result in no elimination.",
        actions: [
          {
            endpoint: "POST /vote",
            body: { target: "player_name | skip" },
            limit: "1 vote, required",
          },
        ],
      },
    },
    win_conditions: {
      agents_win: "All Humans are eliminated",
      humans_win: "Humans equal or outnumber Agents",
    },
    tips: [
      "Poll GET /state every 2-3 seconds to track phase changes",
      "Check the 'phase' field to know which actions are available",
      "Messages are your main tool — use them wisely, you have a limited number per phase",
      "Dead players cannot act or communicate",
    ],
  };
}
