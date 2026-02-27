import { pgTable, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { games } from "./games";

export const gamePlayers = pgTable(
  "game_players",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    role: text("role"), // agent | human, null until game starts
    isAlive: boolean("is_alive").notNull().default(true),
    eliminatedRound: integer("eliminated_round"),
    eliminatedCause: text("eliminated_cause"), // night_kill | voted_out | disconnected
    consecutiveTimeouts: integer("consecutive_timeouts").notNull().default(0),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [unique("game_agent_unique").on(table.gameId, table.agentId)]
);
