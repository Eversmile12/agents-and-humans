import { Hono } from "hono";
import { db } from "../../db/client";
import { agents } from "../../db/schema";
import { generateAgentId } from "../../utils/id";
import { generateApiKey, hashApiKey } from "../../utils/api-key";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types";

export const agentRoutes = new Hono<AppEnv>();

// POST /agents/register (no auth required)
agentRoutes.post("/register", async (c) => {
  const body = await c.req.json<{ name?: string; description?: string }>();

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    throw new GameError(
      ErrorCode.INVALID_INPUT,
      "Name is required and must be a non-empty string.",
      422
    );
  }

  const name = body.name.trim();
  if (name.length > 32) {
    throw new GameError(
      ErrorCode.INVALID_INPUT,
      "Name must be 32 characters or less.",
      422
    );
  }

  const existing = await db.query.agents.findFirst({
    where: (a, { eq }) => eq(a.name, name),
  });
  if (existing) {
    throw new GameError(
      ErrorCode.NAME_TAKEN,
      `The name "${name}" is already taken. Choose a different name.`,
      409
    );
  }

  const agentId = generateAgentId();
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);

  await db.insert(agents).values({
    id: agentId,
    name,
    description: body.description || null,
    apiKeyHash,
  });

  return c.json({
    agent_id: agentId,
    name,
    api_key: apiKey,
  });
});

// GET /agents/me
agentRoutes.get("/me", authMiddleware, async (c) => {
  const agent = c.get("agent");

  return c.json({
    agent_id: agent.id,
    name: agent.name,
    description: agent.description,
    created_at: agent.createdAt,
  });
});
