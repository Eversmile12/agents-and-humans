import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { gameManager } from "../../engine/game-manager";
import { db } from "../../db/client";
import { games, gamePlayers, gameEvents } from "../../db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";

export const spectatorRoutes = new Hono();

// GET /spectate/games — list all games for landing page (public)
spectatorRoutes.get("/games", async (c) => {
  const activeGames = gameManager.getActiveGames().map((g) => ({
    ...g,
    status: "in_progress" as const,
  }));

  // Waiting games with player counts
  const waitingRows = await db
    .select({
      id: games.id,
      maxPlayers: games.maxPlayers,
      playerCount: count(gamePlayers.id),
      createdAt: games.createdAt,
    })
    .from(games)
    .leftJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
    .where(eq(games.status, "waiting"))
    .groupBy(games.id);

  const waitingGames = waitingRows.map((g) => ({
    gameId: g.id,
    status: "waiting" as const,
    players: g.playerCount,
    maxPlayers: g.maxPlayers,
    createdAt: g.createdAt,
  }));

  // Recent ended games (last 10)
  const endedRows = await db
    .select({
      id: games.id,
      winner: games.winner,
      winReason: games.winReason,
      round: games.round,
      maxPlayers: games.maxPlayers,
      endedAt: games.endedAt,
    })
    .from(games)
    .where(eq(games.status, "ended"))
    .orderBy(desc(games.endedAt))
    .limit(10);

  const endedGames = endedRows.map((g) => ({
    gameId: g.id,
    status: "ended" as const,
    winner: g.winner,
    winReason: g.winReason,
    rounds: g.round,
    maxPlayers: g.maxPlayers,
    endedAt: g.endedAt,
  }));

  return c.json({ games: [...waitingGames, ...activeGames, ...endedGames] });
});

// GET /spectate/:id — snapshot of current state
spectatorRoutes.get("/:id", async (c) => {
  const instance = gameManager.getInstance(c.req.param("id"));
  if (!instance) {
    throw new GameError(ErrorCode.GAME_NOT_FOUND, `Game "${c.req.param("id")}" is not active.`, 404);
  }
  return c.json(instance.getPublicState());
});

// GET /spectate/:id/stream — SSE event stream
spectatorRoutes.get("/:id/stream", async (c) => {
  const gameId = c.req.param("id");
  const instance = gameManager.getInstance(gameId);
  if (!instance) {
    throw new GameError(ErrorCode.GAME_NOT_FOUND, `Game "${gameId}" is not active.`, 404);
  }

  return streamSSE(c, async (stream) => {
    const listener = (event: any) => {
      stream.writeSSE({ data: JSON.stringify(event) });
    };

    // Attach listener first so no live events are missed
    instance.addListener(listener);

    // Replay historical events from DB
    const history = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.gameId, gameId))
      .orderBy(gameEvents.id);

    for (const row of history) {
      // Skip elimination events — they're redundant with night_kill/vote_result
      if (row.eventType === "elimination") continue;
      await stream.writeSSE({
        data: JSON.stringify({
          type: row.eventType,
          ...(row.payload as Record<string, unknown>),
          _history: true,
        }),
      });
    }

    // Send current state snapshot
    await stream.writeSSE({
      data: JSON.stringify({ type: "connected", ...instance.getPublicState() }),
    });

    stream.onAbort(() => {
      instance.removeListener(listener);
    });

    // Keep connection alive
    await new Promise(() => {});
  });
});

// GET /spectate/:id/log — full game transcript
spectatorRoutes.get("/:id/log", async (c) => {
  const gameId = c.req.param("id");

  const events = await db
    .select()
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId))
    .orderBy(gameEvents.id);

  return c.json({
    game_id: gameId,
    events: events.map((e) => ({
      round: e.round,
      phase: e.phase,
      type: e.eventType,
      payload: e.payload,
      timestamp: e.createdAt,
    })),
  });
});
