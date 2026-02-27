import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { games } from "./games";
import { gamePlayers } from "./players";

export const actions = pgTable(
  "actions",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    playerId: text("player_id")
      .notNull()
      .references(() => gamePlayers.id),
    round: integer("round").notNull(),
    actionType: text("action_type").notNull(), // kill_vote | accuse | vote | defend
    targetPlayerId: text("target_player_id").references(() => gamePlayers.id), // null for skip
    reason: text("reason"),
    timedOut: boolean("timed_out").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("action_unique").on(
      table.gameId,
      table.playerId,
      table.round,
      table.actionType
    ),
  ]
);
