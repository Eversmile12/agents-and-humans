import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { gameManager } from "../../engine/game-manager";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";
import type { AppEnv } from "../types";

export const dayRoutes = new Hono<AppEnv>();

dayRoutes.use("*", authMiddleware);

function requireInstance(gameId: string) {
  const instance = gameManager.getInstance(gameId);
  if (!instance) {
    throw new GameError(ErrorCode.GAME_NOT_FOUND, `Game "${gameId}" is not active.`, 404);
  }
  return instance;
}

// POST /games/:id/discuss
dayRoutes.post("/:id/discuss", async (c) => {
  const agent = c.get("agent");
  const body = await c.req.json<{ message?: string }>();
  if (!body.message || typeof body.message !== "string") {
    throw new GameError(ErrorCode.INVALID_INPUT, "message is required.", 422);
  }
  const instance = requireInstance(c.req.param("id"));
  const result = await instance.handleDayDiscuss(agent.id, body.message);
  return c.json({ ok: true, ...result });
});

// GET /games/:id/messages
dayRoutes.get("/:id/messages", async (c) => {
  const instance = requireInstance(c.req.param("id"));
  const round = c.req.query("round") ? Number(c.req.query("round")) : undefined;
  const phase = c.req.query("phase") || undefined;
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;
  let msgs = await instance.getDayMessages(round, phase);
  if (limit && limit > 0) msgs = msgs.slice(-limit);
  return c.json({ messages: msgs });
});

// POST /games/:id/accuse
dayRoutes.post("/:id/accuse", async (c) => {
  const agent = c.get("agent");
  const body = await c.req.json<{ target?: string; reason?: string }>();
  if (!body.target || typeof body.target !== "string") {
    throw new GameError(ErrorCode.INVALID_INPUT, "target is required.", 422);
  }
  if (!body.reason || typeof body.reason !== "string") {
    throw new GameError(ErrorCode.INVALID_INPUT, "reason is required.", 422);
  }
  const instance = requireInstance(c.req.param("id"));
  const result = await instance.handleAccuse(agent.id, body.target, body.reason);
  return c.json(result);
});

// POST /games/:id/defend
dayRoutes.post("/:id/defend", async (c) => {
  const agent = c.get("agent");
  const body = await c.req.json<{ message?: string }>();
  if (!body.message || typeof body.message !== "string") {
    throw new GameError(ErrorCode.INVALID_INPUT, "message is required.", 422);
  }
  const instance = requireInstance(c.req.param("id"));
  const result = await instance.handleDefend(agent.id, body.message);
  return c.json(result);
});

// POST /games/:id/vote
dayRoutes.post("/:id/vote", async (c) => {
  const agent = c.get("agent");
  const body = await c.req.json<{ target?: string }>();
  if (!body.target || typeof body.target !== "string") {
    throw new GameError(ErrorCode.INVALID_INPUT, "target is required. Use a player name or 'skip'.", 422);
  }
  const instance = requireInstance(c.req.param("id"));
  const result = await instance.handleVote(agent.id, body.target);
  return c.json(result);
});
