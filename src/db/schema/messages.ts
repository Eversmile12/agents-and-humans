import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { games } from "./games";
import { gamePlayers } from "./players";

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    playerId: text("player_id")
      .notNull()
      .references(() => gamePlayers.id),
    round: integer("round").notNull(),
    phase: text("phase").notNull(), // night | day_discussion | day_defense
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("messages_game_round_phase_idx").on(
      table.gameId,
      table.round,
      table.phase
    ),
  ]
);
