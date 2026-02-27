import { db } from "../db/client";
import { games } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { config } from "../config";
import { generateGameId, generateInviteCode } from "../utils/id";
import { gamePlayers } from "../db/schema";

class GameScheduler {
  private interval: Timer | null = null;

  async start() {
    await this.ensureWaitingGame();
    this.interval = setInterval(
      () => this.ensureWaitingGame(),
      config.schedulerIntervalMs
    );
    console.log("Game scheduler started");
  }

  async ensureWaitingGame() {
    // Find a waiting game with open slots
    const waiting = await db
      .select({
        id: games.id,
        maxPlayers: games.maxPlayers,
        playerCount: sql<number>`(SELECT COUNT(*)::int FROM game_players WHERE game_id = ${games.id})`,
      })
      .from(games)
      .where(eq(games.status, "waiting"));

    const hasOpenGame = waiting.some((g) => g.playerCount < g.maxPlayers);
    if (!hasOpenGame) {
      await this.createScheduledGame();
    }
  }

  private async createScheduledGame() {
    const gameId = generateGameId();
    const inviteCode = generateInviteCode();

    await db.insert(games).values({
      id: gameId,
      inviteCode,
      status: "waiting",
      minPlayers: config.defaultMinPlayers,
      maxPlayers: config.defaultMaxPlayers,
      humansCount: config.defaultHumansCount,
    });

    console.log(`[Scheduler] Created waiting game ${gameId}`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export const gameScheduler = new GameScheduler();
