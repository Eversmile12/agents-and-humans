import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  serial,
  index,
} from "drizzle-orm/pg-core";
import { games } from "./games";

export const gameEvents = pgTable(
  "game_events",
  {
    id: serial("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    round: integer("round").notNull(),
    phase: text("phase").notNull(),
    eventType: text("event_type").notNull(), // phase_change | night_kill | message | vote_result | elimination | game_end | player_timeout
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("events_game_idx").on(table.gameId, table.id)]
);
