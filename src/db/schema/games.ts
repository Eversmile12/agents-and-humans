import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: text("id").primaryKey(),
  inviteCode: text("invite_code").unique(),
  status: text("status").notNull().default("waiting"), // waiting | in_progress | ended
  phase: text("phase"), // null when waiting
  round: integer("round").notNull().default(0),
  minPlayers: integer("min_players").notNull().default(5),
  maxPlayers: integer("max_players").notNull().default(7),
  humansCount: integer("humans_count").notNull().default(2),
  winner: text("winner"), // agents | humans, null until ended
  winReason: text("win_reason"),
  phaseEndsAt: timestamp("phase_ends_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
