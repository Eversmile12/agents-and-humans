import { db } from "../db/client";
import { games, gamePlayers, agents } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { GameInstance } from "./game-instance";

class GameManager {
  private instances = new Map<string, GameInstance>();

  getInstance(gameId: string): GameInstance | undefined {
    return this.instances.get(gameId);
  }

  async startGame(gameId: string): Promise<GameInstance> {
    // Guard: if an instance already exists (race from concurrent joins), return it
    const existing = this.instances.get(gameId);
    if (existing) return existing;

    // Set the instance synchronously BEFORE any awaits to prevent
    // other async handlers from also creating an instance
    const instance = new GameInstance(gameId);
    this.instances.set(gameId, instance);

    try {
      await instance.start();
    } catch (err) {
      this.instances.delete(gameId);
      throw err;
    }
    return instance;
  }

  removeGame(gameId: string): void {
    const instance = this.instances.get(gameId);
    if (instance) {
      instance.destroy();
      this.instances.delete(gameId);
    }
  }

  async checkAndStartGame(gameId: string): Promise<boolean> {
    // Already running — another join beat us to it
    if (this.instances.has(gameId)) return false;

    const game = await db.query.games.findFirst({
      where: (g, { eq }) => eq(g.id, gameId),
    });
    if (!game || game.status !== "waiting") return false;

    const playerCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId));

    const count = playerCount[0]?.count || 0;

    if (count >= game.maxPlayers) {
      await this.startGame(gameId);

      // Fire-and-forget: ensure a new waiting game exists
      import("./game-scheduler").then(({ gameScheduler }) =>
        gameScheduler.ensureWaitingGame().catch(() => {})
      );

      return true;
    }

    return false;
  }

  // Restore in-progress games on server restart
  async restoreActiveGames(): Promise<void> {
    const activeGames = await db
      .select()
      .from(games)
      .where(eq(games.status, "in_progress"));

    for (const game of activeGames) {
      console.log(`Restoring game ${game.id}...`);
      // For now, end stale games on restart rather than resuming mid-phase
      await db
        .update(games)
        .set({
          status: "ended",
          winner: null,
          winReason: "Server restarted — game ended prematurely",
          endedAt: new Date(),
        })
        .where(eq(games.id, game.id));
    }
  }

  getActiveGameCount(): number {
    return this.instances.size;
  }

  getActiveGames(): { gameId: string; phase: string; round: number; alive: number; total: number }[] {
    return Array.from(this.instances.entries()).map(([gameId, instance]) => {
      const state = instance.getPublicState();
      return {
        gameId,
        phase: state.phase,
        round: state.round,
        alive: state.alive.length,
        total: state.alive.length + state.eliminated.length,
      };
    });
  }
}

export const gameManager = new GameManager();
