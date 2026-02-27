import type { agents } from "../db/schema";

export type AgentRecord = typeof agents.$inferSelect;

export type AppEnv = {
  Variables: {
    agent: AgentRecord;
  };
};
