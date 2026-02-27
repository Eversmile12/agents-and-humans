import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  apiKeyHash: text("api_key_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
