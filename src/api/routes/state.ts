import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { gameManager } from "../../engine/game-manager";
import { db } from "../../db/client";
import { games, gamePlayers, agents } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";
import type { AppEnv } from "../types";

export const stateRoutes = new Hono<AppEnv>();

stateRoutes.use("*", authMiddleware);

// GET /games/:id/state
stateRoutes.get("/:id/state", async (c) => {
  const agent = c.get("agent");
  const gameId = c.req.param("id");

  // Try active instance first
  const instance = gameManager.getInstance(gameId);
  if (instance) {
    return c.json(instance.getPublicState(agent.id));
  }

  // Fall back to DB for ended/waiting games
  const game = await db.query.games.findFirst({
    where: (g, { eq }) => eq(g.id, gameId),
  });
  if (!game) {
    throw new GameError(ErrorCode.GAME_NOT_FOUND, `Game "${gameId}" not found.`, 404);
  }

  const players = await db
    .select({ name: agents.name, role: gamePlayers.role, isAlive: gamePlayers.isAlive })
    .from(gamePlayers)
    .innerJoin(agents, eq(gamePlayers.agentId, agents.id))
    .where(eq(gamePlayers.gameId, gameId));

  const myRecord = await db
    .select({ name: agents.name, isAlive: gamePlayers.isAlive })
    .from(gamePlayers)
    .innerJoin(agents, eq(gamePlayers.agentId, agents.id))
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.agentId, agent.id)));

  const state: any = {
    game_id: gameId,
    phase: game.phase || game.status,
    round: game.round || 0,
    alive: players.filter((p) => p.isAlive).map((p) => p.name),
    eliminated: players.filter((p) => !p.isAlive).map((p) => ({ name: p.name, role: p.role })),
  };

  if (game.status === "ended") {
    state.winner = game.winner;
    state.win_reason = game.winReason;
    const finalRoles: Record<string, string> = {};
    for (const p of players) finalRoles[p.name] = p.role || "unknown";
    state.final_roles = finalRoles;
  }

  if (myRecord.length > 0) {
    state.you = {
      name: myRecord[0]!.name,
      is_alive: myRecord[0]!.isAlive,
    };
  }

  return c.json(state);
});

// GET /games/:id/role
stateRoutes.get("/:id/role", async (c) => {
  const agent = c.get("agent");
  const gameId = c.req.param("id");

  const instance = gameManager.getInstance(gameId);
  if (instance) {
    return c.json(instance.getPlayerRole(agent.id));
  }

  // Fall back to DB
  const player = await db
    .select({ role: gamePlayers.role })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.agentId, agent.id)));

  if (!player.length) {
    throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);
  }

  return c.json({ role: player[0]!.role });
});
