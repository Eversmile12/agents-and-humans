import { Hono, type Context } from "hono";
import { db } from "../../db/client";
import { games, gamePlayers, agents } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateGameId, generatePlayerId, generateInviteCode } from "../../utils/id";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";
import { authMiddleware } from "../middleware/auth";
import { config } from "../../config";
import { generateRules } from "../../rules/rules-object";
import { gameManager } from "../../engine/game-manager";
import type { AppEnv } from "../types";

export const gameRoutes = new Hono<AppEnv>();

// All game routes require auth
gameRoutes.use("*", authMiddleware);

// GET /games?status=waiting
gameRoutes.get("/", async (c) => {
  const status = c.req.query("status") || "waiting";

  const gamesList = await db
    .select({
      id: games.id,
      status: games.status,
      players: sql<number>`(SELECT COUNT(*)::int FROM game_players WHERE game_players.game_id = ${games.id})`,
      maxPlayers: games.maxPlayers,
      minPlayers: games.minPlayers,
      humansCount: games.humansCount,
      createdAt: games.createdAt,
    })
    .from(games)
    .where(eq(games.status, status))
    .orderBy(games.createdAt)
    .limit(20);

  return c.json({ games: gamesList.map((g) => ({
    game_id: g.id,
    players: g.players,
    max_players: g.maxPlayers,
    min_players: g.minPlayers,
    humans_count: g.humansCount,
    status: g.status,
    created_at: g.createdAt,
  }))});
});

// POST /games/create
gameRoutes.post("/create", async (c) => {
  const agent = c.get("agent");
  const body = await c.req.json<{
    max_players?: number;
    min_players?: number;
    humans_count?: number;
  }>();

  const maxPlayers = body.max_players || config.defaultMaxPlayers;
  const minPlayers = body.min_players || config.defaultMinPlayers;
  const humansCount = body.humans_count || config.defaultHumansCount;

  if (minPlayers < 4 || maxPlayers > 8) {
    throw new GameError(
      ErrorCode.INVALID_INPUT,
      "Games require 4-8 players. min_players must be >= 4, max_players must be <= 8.",
      422
    );
  }
  if (minPlayers > maxPlayers) {
    throw new GameError(
      ErrorCode.INVALID_INPUT,
      "min_players cannot be greater than max_players.",
      422
    );
  }
  if (humansCount < 1 || humansCount >= minPlayers) {
    throw new GameError(
      ErrorCode.INVALID_INPUT,
      "humans_count must be at least 1 and less than min_players.",
      422
    );
  }

  const gameId = generateGameId();
  const inviteCode = generateInviteCode();

  await db.insert(games).values({
    id: gameId,
    inviteCode,
    status: "waiting",
    minPlayers,
    maxPlayers,
    humansCount,
  });

  // Auto-join the creator
  const playerId = generatePlayerId();
  await db.insert(gamePlayers).values({
    id: playerId,
    gameId,
    agentId: agent.id,
  });

  return c.json({
    game_id: gameId,
    invite_code: inviteCode,
    player_id: playerId,
  });
});

// POST /games/:id/join
gameRoutes.post("/:id/join", async (c) => {
  const agent = c.get("agent");
  const gameId = c.req.param("id");

  return await joinGame(c, agent, gameId);
});

// POST /games/join/:code
gameRoutes.post("/join/:code", async (c) => {
  const agent = c.get("agent");
  const code = c.req.param("code");

  const game = await db.query.games.findFirst({
    where: (g, { eq }) => eq(g.inviteCode, code),
  });

  if (!game) {
    throw new GameError(
      ErrorCode.GAME_NOT_FOUND,
      `No game found with invite code "${code}".`,
      404
    );
  }

  return await joinGame(c, agent, game.id);
});

async function joinGame(
  c: Context<AppEnv>,
  agent: { id: string; name: string },
  gameId: string
) {
  const game = await db.query.games.findFirst({
    where: (g, { eq }) => eq(g.id, gameId),
  });

  if (!game) {
    throw new GameError(
      ErrorCode.GAME_NOT_FOUND,
      `Game "${gameId}" not found.`,
      404
    );
  }

  if (game.status !== "waiting") {
    throw new GameError(
      ErrorCode.GAME_ALREADY_STARTED,
      `Game "${gameId}" has already started.`,
      409
    );
  }

  // Check if already joined
  const existingPlayer = await db.query.gamePlayers.findFirst({
    where: (p, { and, eq }) =>
      and(eq(p.gameId, gameId), eq(p.agentId, agent.id)),
  });

  if (existingPlayer) {
    throw new GameError(
      ErrorCode.ALREADY_JOINED,
      "You have already joined this game.",
      409
    );
  }

  // Atomic capacity check + insert to prevent race condition
  const playerId = generatePlayerId();
  await db.transaction(async (tx) => {
    // Lock the game row to serialize concurrent joins
    await tx.execute(sql`SELECT 1 FROM games WHERE id = ${gameId} FOR UPDATE`);

    const playerCount = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId));

    const count = playerCount[0]?.count || 0;
    if (count >= game.maxPlayers) {
      throw new GameError(
        ErrorCode.GAME_FULL,
        `Game is full (${count}/${game.maxPlayers} players).`,
        409
      );
    }

    await tx.insert(gamePlayers).values({
      id: playerId,
      gameId,
      agentId: agent.id,
    });
  });

  // Get all players with their names
  const players = await db
    .select({ name: agents.name })
    .from(gamePlayers)
    .innerJoin(agents, eq(gamePlayers.agentId, agents.id))
    .where(eq(gamePlayers.gameId, gameId));

  const newCount = players.length;

  // Auto-start if max players reached
  const gameStarted = await gameManager.checkAndStartGame(gameId);

  return c.json({
    player_id: playerId,
    game_id: gameId,
    players: players.map((p) => ({ name: p.name })),
    waiting_for: gameStarted ? 0 : Math.max(0, game.minPlayers - newCount),
    game_started: gameStarted,
    rules: generateRules(),
  });
}
