import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { gameManager } from "../../engine/game-manager";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";
import type { AppEnv } from "../types";

export const nightRoutes = new Hono<AppEnv>();

nightRoutes.use("*", authMiddleware);

function requireInstance(gameId: string) {
  const instance = gameManager.getInstance(gameId);
  if (!instance) {
    throw new GameError(ErrorCode.GAME_NOT_FOUND, `Game "${gameId}" is not active.`, 404);
  }
  return instance;
}

// POST /games/:id/night/discuss
nightRoutes.post("/:id/night/discuss", async (c) => {
  const agent = c.get("agent");
  const body = await c.req.json<{ message?: string }>();
  if (!body.message || typeof body.message !== "string") {
    throw new GameError(ErrorCode.INVALID_INPUT, "message is required.", 422);
  }
  const instance = requireInstance(c.req.param("id"));
  const result = await instance.handleNightDiscuss(agent.id, body.message);
  return c.json({ ok: true, ...result });
});

// GET /games/:id/night/messages
nightRoutes.get("/:id/night/messages", async (c) => {
  const agent = c.get("agent");
  const instance = requireInstance(c.req.param("id"));
  const msgs = await instance.getNightMessages(agent.id);
  return c.json({ messages: msgs });
});

// POST /games/:id/night/kill
nightRoutes.post("/:id/night/kill", async (c) => {
  const agent = c.get("agent");
  const body = await c.req.json<{ target?: string }>();
  if (!body.target || typeof body.target !== "string") {
    throw new GameError(ErrorCode.INVALID_INPUT, "target is required.", 422);
  }
  const instance = requireInstance(c.req.param("id"));
  const result = await instance.handleNightKill(agent.id, body.target);
  return c.json(result);
});
