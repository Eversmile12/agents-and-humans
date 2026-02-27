import { db } from "../db/client";
import { games, gamePlayers, messages, actions, gameEvents, agents } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { Timer } from "../utils/timer";
import { config } from "../config";
import { nanoid } from "nanoid";
import type { Phase, PhaseEvent } from "./phases";
import { phaseDurationMs } from "./phases";
import { nextPhase, type PhaseContext } from "./state-machine";
import { assignRoles, type RoleAssignment } from "./role-assigner";
import { checkWinCondition, type PlayerState } from "./win-checker";
import { resolveVotes, type Vote } from "./vote-resolver";
import { resolveKillTarget, type KillVote } from "./kill-resolver";
import { checkTimeout } from "./timeout-tracker";
import { GameError } from "../errors/game-error";
import { ErrorCode } from "../errors/codes";
import { findClosestMatch } from "../errors/fuzzy-match";
import { gameManager } from "./game-manager";

interface InternalPlayer {
  playerId: string;
  agentId: string;
  agentName: string;
  role: "agent" | "human";
  isAlive: boolean;
  consecutiveTimeouts: number;
}

export class GameInstance {
  readonly gameId: string;
  private phase: Phase = "night";
  private round: number = 0;
  private timer: Timer | null = null;
  private players: InternalPlayer[] = [];
  private defendants: string[] = [];
  private humansCount: number = 2;
  private ended: boolean = false;
  private advancing: boolean = false; // prevent concurrent advancePhase calls

  // Track actions per round to detect early completion
  private nightKillVotes = new Map<string, string>(); // playerId -> targetPlayerId
  private dayVotes = new Map<string, string>(); // playerId -> targetPlayerId or "skip"
  private dayAccusations = new Map<string, string>(); // accuserId -> targetPlayerId

  // Track message counts per player per phase
  private messageCounts = new Map<string, number>(); // "playerId:round:phase" -> count

  // SSE listeners
  private listeners = new Set<(event: any) => void>();

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  addListener(fn: (event: any) => void) {
    this.listeners.add(fn);
  }

  removeListener(fn: (event: any) => void) {
    this.listeners.delete(fn);
  }

  private broadcast(event: any) {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch (err) {
        console.error("Broadcast listener error:", err);
      }
    }
  }

  async start(): Promise<void> {
    // Load players
    const playerRows = await db
      .select({
        playerId: gamePlayers.id,
        agentId: gamePlayers.agentId,
        agentName: agents.name,
      })
      .from(gamePlayers)
      .innerJoin(agents, eq(gamePlayers.agentId, agents.id))
      .where(eq(gamePlayers.gameId, this.gameId));

    const game = await db.query.games.findFirst({
      where: (g, { eq }) => eq(g.id, this.gameId),
    });
    if (!game) throw new Error(`Game ${this.gameId} not found`);

    // Assign roles
    this.humansCount = game.humansCount;
    const assignments = assignRoles(
      playerRows.map((p) => ({ playerId: p.playerId, agentName: p.agentName })),
      game.humansCount
    );

    this.players = assignments.map((a) => {
      const row = playerRows.find((p) => p.playerId === a.playerId)!;
      return {
        playerId: a.playerId,
        agentId: row.agentId,
        agentName: a.agentName,
        role: a.role,
        isAlive: true,
        consecutiveTimeouts: 0,
      };
    });

    // Persist roles
    for (const p of this.players) {
      await db
        .update(gamePlayers)
        .set({ role: p.role })
        .where(eq(gamePlayers.id, p.playerId));
    }

    // Start game with a warmup phase
    this.round = 0;
    this.phase = "starting";

    await db
      .update(games)
      .set({
        status: "in_progress",
        phase: "starting",
        round: 0,
        startedAt: new Date(),
        phaseEndsAt: new Date(Date.now() + phaseDurationMs("starting")),
      })
      .where(eq(games.id, this.gameId));

    await this.emitEvent("phase_change", { phase: "starting", round: 0 });
    this.schedulePhaseEnd();
  }

  private schedulePhaseEnd(): void {
    if (this.timer) this.timer.cancel();
    const duration = phaseDurationMs(this.phase);
    if (duration <= 0) return;
    this.timer = new Timer(duration, () => this.onPhaseTimeout());
  }

  private async onPhaseTimeout(): Promise<void> {
    await this.advancePhase("timer_expired");
  }

  private async advancePhase(trigger: PhaseEvent): Promise<void> {
    // Prevent concurrent phase transitions (timer + early completion race)
    if (this.advancing || this.ended) return;
    this.advancing = true;

    try {
      await this._advancePhaseInner(trigger);
    } finally {
      this.advancing = false;
    }
  }

  private async _advancePhaseInner(trigger: PhaseEvent): Promise<void> {
    // Exit current phase
    await this.exitPhase();

    // Check win conditions
    const winResult = checkWinCondition(this.players);

    const context: PhaseContext = {
      hasAccusations: this.defendants.length > 0,
      isGameOver: winResult.gameOver,
    };

    const next = nextPhase(this.phase, trigger, context);

    if (next === "ended" && winResult.gameOver) {
      await this.end(winResult.winner, winResult.reason);
      return;
    }

    // Increment round when going back to night
    if (next === "night" && this.phase !== "night") {
      this.round++;
    }

    // Enter next phase
    this.phase = next;
    await this.enterPhase();
  }

  private async exitPhase(): Promise<void> {
    switch (this.phase) {
      case "night":
        await this.resolveNight();
        break;
      case "day_vote":
        await this.resolveDayVote();
        break;
      case "day_accusation":
        // Collect accusation targets into defendants list
        this.defendants = [...new Set(this.dayAccusations.values())];
        break;
      case "day_defense":
        break;
    }
  }

  private async enterPhase(): Promise<void> {
    // Reset phase-specific state
    if (this.phase === "night") {
      this.nightKillVotes.clear();
      this.dayVotes.clear();
      this.dayAccusations.clear();
      this.defendants = [];
      this.messageCounts.clear();
    }

    if (this.phase === "day_vote") {
      this.dayVotes.clear();
    }

    // Persist
    await db
      .update(games)
      .set({
        phase: this.phase,
        round: this.round,
        phaseEndsAt: new Date(Date.now() + phaseDurationMs(this.phase)),
      })
      .where(eq(games.id, this.gameId));

    const durationMs = phaseDurationMs(this.phase);
    const phaseEndsAt = new Date(Date.now() + durationMs).toISOString();
    await this.emitEvent("phase_change", { phase: this.phase, round: this.round });
    this.broadcast({ type: "phase_change", phase: this.phase, round: this.round, phase_ends_at: phaseEndsAt, phase_duration_ms: durationMs });
    this.schedulePhaseEnd();
  }

  private async resolveNight(): Promise<void> {
    const humans = this.players.filter((p) => p.isAlive && p.role === "human");

    // Check for timeouts
    for (const h of humans) {
      if (!this.nightKillVotes.has(h.playerId)) {
        const status = checkTimeout(h.consecutiveTimeouts);
        h.consecutiveTimeouts = status.consecutiveTimeouts;
        await db
          .update(gamePlayers)
          .set({ consecutiveTimeouts: h.consecutiveTimeouts })
          .where(eq(gamePlayers.id, h.playerId));

        if (status.shouldDisconnect) {
          await this.eliminatePlayer(h.playerId, "disconnected");
        }
      } else {
        h.consecutiveTimeouts = 0;
        await db
          .update(gamePlayers)
          .set({ consecutiveTimeouts: 0 })
          .where(eq(gamePlayers.id, h.playerId));
      }
    }

    // Resolve kill
    const votes: KillVote[] = [...this.nightKillVotes.entries()].map(
      ([voterId, target]) => ({ voterId, target })
    );

    let targetId: string;
    if (votes.length === 0) {
      // All humans timed out or disconnected — kill a random alive agent
      const aliveAgents = this.players.filter(
        (p) => p.isAlive && p.role === "agent"
      );
      if (aliveAgents.length === 0) return;
      targetId = aliveAgents[Math.floor(Math.random() * aliveAgents.length)]!.playerId;
    } else {
      targetId = resolveKillTarget(votes);
    }

    await this.eliminatePlayer(targetId, "night_kill");

    const victim = this.players.find((p) => p.playerId === targetId)!;
    await this.emitEvent("night_kill", {
      victim: victim.agentName,
      role: victim.role,
    });
    this.broadcast({
      type: "night_kill",
      victim: victim.agentName,
      role: victim.role,
    });
  }

  private async resolveDayVote(): Promise<void> {
    const alivePlayers = this.players.filter((p) => p.isAlive);

    // Mark timeouts for those who didn't vote
    for (const p of alivePlayers) {
      if (!this.dayVotes.has(p.playerId)) {
        const status = checkTimeout(p.consecutiveTimeouts);
        p.consecutiveTimeouts = status.consecutiveTimeouts;
        await db
          .update(gamePlayers)
          .set({ consecutiveTimeouts: p.consecutiveTimeouts })
          .where(eq(gamePlayers.id, p.playerId));

        // Record auto-abstain
        await db.insert(actions).values({
          id: nanoid(),
          gameId: this.gameId,
          playerId: p.playerId,
          round: this.round,
          actionType: "vote",
          targetPlayerId: null,
          timedOut: true,
        }).onConflictDoNothing();

        if (status.shouldDisconnect) {
          await this.eliminatePlayer(p.playerId, "disconnected");
        }
      } else {
        p.consecutiveTimeouts = 0;
        await db
          .update(gamePlayers)
          .set({ consecutiveTimeouts: 0 })
          .where(eq(gamePlayers.id, p.playerId));
      }
    }

    const votes: Vote[] = [...this.dayVotes.entries()].map(
      ([voterId, target]) => ({ voterId, target })
    );

    const result = resolveVotes(votes, alivePlayers.length);

    const tallyObj: Record<string, { count: number; voters: string[] }> = {};
    for (const [target, entry] of result.tally) {
      const targetName =
        target === "skip"
          ? "skip"
          : this.players.find((p) => p.playerId === target)?.agentName || target;
      tallyObj[targetName] = {
        count: entry.count,
        voters: entry.voters.map(
          (vid) => this.players.find((p) => p.playerId === vid)?.agentName || vid
        ),
      };
    }

    if (result.eliminated) {
      await this.eliminatePlayer(result.eliminated, "voted_out");
      const eliminated = this.players.find(
        (p) => p.playerId === result.eliminated
      )!;

      await this.emitEvent("vote_result", {
        tally: tallyObj,
        outcome: "eliminated",
        eliminated_player: eliminated.agentName,
        eliminated_role: eliminated.role,
      });
      this.broadcast({
        type: "vote_result",
        tally: tallyObj,
        outcome: "eliminated",
        eliminated_player: eliminated.agentName,
        eliminated_role: eliminated.role,
      });
    } else {
      await this.emitEvent("vote_result", {
        tally: tallyObj,
        outcome: result.outcome,
      });
      this.broadcast({
        type: "vote_result",
        tally: tallyObj,
        outcome: result.outcome,
      });
    }
  }

  private async eliminatePlayer(
    playerId: string,
    cause: string
  ): Promise<void> {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player || !player.isAlive) return;

    player.isAlive = false;
    await db
      .update(gamePlayers)
      .set({
        isAlive: false,
        eliminatedRound: this.round,
        eliminatedCause: cause,
      })
      .where(eq(gamePlayers.id, playerId));

    await this.emitEvent("elimination", {
      player: player.agentName,
      role: player.role,
      cause,
      round: this.round,
    });
  }

  async end(
    winner: "agents" | "humans",
    reason: string
  ): Promise<void> {
    if (this.ended) return; // prevent double-ending
    this.ended = true;
    this.phase = "ended";
    if (this.timer) this.timer.cancel();

    await db
      .update(games)
      .set({
        status: "ended",
        phase: "ended",
        winner,
        winReason: reason,
        endedAt: new Date(),
      })
      .where(eq(games.id, this.gameId));

    const finalRoles: Record<string, string> = {};
    for (const p of this.players) {
      finalRoles[p.agentName] = p.role;
    }

    await this.emitEvent("game_end", { winner, reason, final_roles: finalRoles });
    this.broadcast({ type: "game_end", winner, reason, final_roles: finalRoles });

    gameManager.removeGame(this.gameId);
  }

  // === Action Handlers ===

  private getPlayerByAgentId(agentId: string): InternalPlayer | undefined {
    return this.players.find((p) => p.agentId === agentId);
  }

  private requireAlive(player: InternalPlayer): void {
    if (!player.isAlive) {
      throw new GameError(
        ErrorCode.PLAYER_ELIMINATED,
        `You were eliminated in Round ${this.players.find((p) => p.playerId === player.playerId)?.agentName ? this.round : "?"}.  Dead players cannot act.`,
        403
      );
    }
  }

  private requirePhase(required: Phase): void {
    if (this.ended) {
      throw new GameError(ErrorCode.WRONG_PHASE, "This game has ended.", 409);
    }
    if (this.phase !== required) {
      throw new GameError(
        ErrorCode.WRONG_PHASE,
        `Cannot perform this action during '${this.phase}'. Required phase: '${required}'.`,
        409,
        false,
        { current_phase: this.phase, required_phase: required }
      );
    }
  }

  private resolveTargetName(targetName: string): InternalPlayer {
    const alivePlayers = this.players.filter((p) => p.isAlive);
    const aliveNames = alivePlayers.map((p) => p.agentName);

    const exact = alivePlayers.find((p) => p.agentName === targetName);
    if (exact) return exact;

    // Check if it's a dead player
    const dead = this.players.find(
      (p) => !p.isAlive && p.agentName === targetName
    );
    if (dead) {
      throw new GameError(
        ErrorCode.INVALID_TARGET,
        `${targetName} is eliminated and cannot be targeted. Alive players: ${aliveNames.join(", ")}.`,
        422,
        false,
        { target_status: "eliminated", alive_players: aliveNames }
      );
    }

    // Fuzzy match
    const suggestion = findClosestMatch(targetName, aliveNames);
    throw new GameError(
      ErrorCode.PLAYER_NOT_FOUND,
      `No player named '${targetName}'.${suggestion ? ` Did you mean '${suggestion}'?` : ""} Alive players: ${aliveNames.join(", ")}.`,
      422,
      suggestion ? true : false,
      { suggestion, alive_players: aliveNames }
    );
  }

  private messageKey(playerId: string, phase: string): string {
    return `${playerId}:${this.round}:${phase}`;
  }

  private getMessageCount(playerId: string, phase: string): number {
    return this.messageCounts.get(this.messageKey(playerId, phase)) || 0;
  }

  private incrementMessageCount(playerId: string, phase: string): number {
    const key = this.messageKey(playerId, phase);
    const count = (this.messageCounts.get(key) || 0) + 1;
    this.messageCounts.set(key, count);
    return count;
  }

  // --- Night Actions ---

  async handleNightDiscuss(agentId: string, message: string): Promise<{ messages_remaining: number }> {
    this.requirePhase("night");
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);
    this.requireAlive(player);

    if (player.role !== "human") {
      throw new GameError(
        ErrorCode.WRONG_ROLE,
        "Only Humans can use night discussion. You are an Agent. You have no actions during the night phase.",
        403,
        false,
        { your_role: "agent", required_role: "human" }
      );
    }

    const count = this.getMessageCount(player.playerId, "night");
    if (count >= config.nightMessagesPerPhase) {
      throw new GameError(
        ErrorCode.MESSAGE_LIMIT,
        `You have used all ${config.nightMessagesPerPhase} messages for this night phase.`,
        429,
        false,
        { messages_used: count, messages_allowed: config.nightMessagesPerPhase }
      );
    }

    const newCount = this.incrementMessageCount(player.playerId, "night");

    await db.insert(messages).values({
      id: nanoid(),
      gameId: this.gameId,
      playerId: player.playerId,
      round: this.round,
      phase: "night",
      content: message,
    });

    // Broadcast to spectators (night messages are secret to players but visible to spectators)
    const nightPayload = { from: player.agentName, message, phase: "night" };
    await this.emitEvent("night_message", nightPayload);
    this.broadcast({ type: "night_message", ...nightPayload });

    return { messages_remaining: config.nightMessagesPerPhase - newCount };
  }

  async getNightMessages(agentId: string): Promise<any[]> {
    this.requirePhase("night");
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);

    if (player.role !== "human") {
      throw new GameError(
        ErrorCode.WRONG_ROLE,
        "Only Humans can read night messages. You are an Agent.",
        403
      );
    }

    const msgs = await db
      .select({
        from: agents.name,
        message: messages.content,
        timestamp: messages.createdAt,
      })
      .from(messages)
      .innerJoin(gamePlayers, eq(messages.playerId, gamePlayers.id))
      .innerJoin(agents, eq(gamePlayers.agentId, agents.id))
      .where(
        and(
          eq(messages.gameId, this.gameId),
          eq(messages.round, this.round),
          eq(messages.phase, "night")
        )
      )
      .orderBy(messages.createdAt);

    return msgs;
  }

  async handleNightKill(agentId: string, targetName: string): Promise<any> {
    this.requirePhase("night");
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);
    this.requireAlive(player);

    if (player.role !== "human") {
      throw new GameError(
        ErrorCode.WRONG_ROLE,
        "Only Humans can perform night kills. You are an Agent.",
        403
      );
    }

    if (this.nightKillVotes.has(player.playerId)) {
      throw new GameError(
        ErrorCode.ACTION_LIMIT,
        "You have already submitted your night kill vote this round.",
        429
      );
    }

    const target = this.resolveTargetName(targetName);

    if (target.playerId === player.playerId) {
      throw new GameError(ErrorCode.INVALID_TARGET, "You cannot target yourself.", 422);
    }

    this.nightKillVotes.set(player.playerId, target.playerId);

    await db.insert(actions).values({
      id: nanoid(),
      gameId: this.gameId,
      playerId: player.playerId,
      round: this.round,
      actionType: "kill_vote",
      targetPlayerId: target.playerId,
    });

    // Check if all humans have voted
    const aliveHumans = this.players.filter(
      (p) => p.isAlive && p.role === "human"
    );
    const allVoted = aliveHumans.every((h) =>
      this.nightKillVotes.has(h.playerId)
    );

    const voteTally: Record<string, number> = {};
    for (const [, tid] of this.nightKillVotes) {
      const name = this.players.find((p) => p.playerId === tid)?.agentName || tid;
      voteTally[name] = (voteTally[name] || 0) + 1;
    }

    if (allVoted) {
      // Early advance
      if (this.timer) this.timer.cancel();
      setTimeout(() => this.advancePhase("all_actions_complete"), 100);
    }

    return {
      ok: true,
      votes: voteTally,
      consensus: allVoted,
      waiting_for: allVoted ? 0 : aliveHumans.length - this.nightKillVotes.size,
    };
  }

  // --- Day Actions ---

  async handleDayDiscuss(agentId: string, message: string): Promise<{ messages_remaining: number }> {
    this.requirePhase("day_discussion");
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);
    this.requireAlive(player);

    const count = this.getMessageCount(player.playerId, "day_discussion");
    if (count >= config.messagesPerPhase) {
      throw new GameError(
        ErrorCode.MESSAGE_LIMIT,
        `You have used all ${config.messagesPerPhase} messages for this discussion phase. Wait for the next round.`,
        429,
        false,
        { messages_used: count, messages_allowed: config.messagesPerPhase }
      );
    }

    const newCount = this.incrementMessageCount(player.playerId, "day_discussion");

    await db.insert(messages).values({
      id: nanoid(),
      gameId: this.gameId,
      playerId: player.playerId,
      round: this.round,
      phase: "day_discussion",
      content: message,
    });

    const msgPayload = { from: player.agentName, message, phase: "day_discussion" };
    await this.emitEvent("message", msgPayload);
    this.broadcast({ type: "message", ...msgPayload });

    return { messages_remaining: config.messagesPerPhase - newCount };
  }

  async getDayMessages(round?: number, phase?: string): Promise<any[]> {
    const targetRound = round || this.round;
    const targetPhase = phase || "day_discussion";

    const msgs = await db
      .select({
        from: agents.name,
        message: messages.content,
        timestamp: messages.createdAt,
      })
      .from(messages)
      .innerJoin(gamePlayers, eq(messages.playerId, gamePlayers.id))
      .innerJoin(agents, eq(gamePlayers.agentId, agents.id))
      .where(
        and(
          eq(messages.gameId, this.gameId),
          eq(messages.round, targetRound),
          eq(messages.phase, targetPhase)
        )
      )
      .orderBy(messages.createdAt);

    return msgs;
  }

  async handleAccuse(agentId: string, targetName: string, reason: string): Promise<any> {
    this.requirePhase("day_accusation");
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);
    this.requireAlive(player);

    if (this.dayAccusations.has(player.playerId)) {
      const existingTarget = this.players.find(
        (p) => p.playerId === this.dayAccusations.get(player.playerId)
      );
      throw new GameError(
        ErrorCode.ACTION_LIMIT,
        `You already accused ${existingTarget?.agentName} this round.`,
        429
      );
    }

    const target = this.resolveTargetName(targetName);
    if (target.playerId === player.playerId) {
      throw new GameError(ErrorCode.INVALID_TARGET, "You cannot accuse yourself.", 422);
    }

    this.dayAccusations.set(player.playerId, target.playerId);

    await db.insert(actions).values({
      id: nanoid(),
      gameId: this.gameId,
      playerId: player.playerId,
      round: this.round,
      actionType: "accuse",
      targetPlayerId: target.playerId,
      reason,
    });

    const accPayload = { accuser: player.agentName, target: target.agentName, reason };
    await this.emitEvent("accusation", accPayload);
    this.broadcast({ type: "accusation", ...accPayload });

    // Check if all alive players have accused (or this is the last one)
    const alivePlayers = this.players.filter((p) => p.isAlive);
    const allAccused = alivePlayers.every((p) =>
      this.dayAccusations.has(p.playerId)
    );
    if (allAccused) {
      if (this.timer) this.timer.cancel();
      setTimeout(() => this.advancePhase("all_actions_complete"), 100);
    }

    return { ok: true };
  }

  async handleDefend(agentId: string, message: string): Promise<any> {
    this.requirePhase("day_defense");
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);
    this.requireAlive(player);

    // Only accused players can defend
    if (!this.defendants.includes(player.playerId)) {
      throw new GameError(
        ErrorCode.NOT_YOUR_TURN,
        "You were not accused this round.",
        409
      );
    }

    // Only one defense per player
    const defenseKey = `${player.playerId}:${this.round}:defense`;
    if (this.messageCounts.has(defenseKey)) {
      throw new GameError(
        ErrorCode.ACTION_LIMIT,
        "You have already defended this round.",
        409
      );
    }
    this.messageCounts.set(defenseKey, 1);

    await db.insert(messages).values({
      id: nanoid(),
      gameId: this.gameId,
      playerId: player.playerId,
      round: this.round,
      phase: "day_defense",
      content: message,
    });

    await db.insert(actions).values({
      id: nanoid(),
      gameId: this.gameId,
      playerId: player.playerId,
      round: this.round,
      actionType: "defend",
      reason: message,
    });

    const defPayload = { from: player.agentName, message };
    await this.emitEvent("defense", defPayload);
    this.broadcast({ type: "defense", ...defPayload });

    // Early advance to vote if all defendants have defended
    const allDefended = this.defendants.every((did) =>
      this.messageCounts.has(`${did}:${this.round}:defense`)
    );
    if (allDefended) {
      if (this.timer) this.timer.cancel();
      setTimeout(() => this.advancePhase("all_defenses_done"), 100);
    }

    return { ok: true };
  }

  async handleVote(agentId: string, targetName: string): Promise<any> {
    this.requirePhase("day_vote");
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);
    this.requireAlive(player);

    if (this.dayVotes.has(player.playerId)) {
      throw new GameError(
        ErrorCode.ACTION_LIMIT,
        "You have already voted this round.",
        429
      );
    }

    let targetPlayerId: string;
    if (targetName === "skip") {
      targetPlayerId = "skip";
    } else {
      const target = this.resolveTargetName(targetName);
      // Verify target is one of the defendants
      if (!this.defendants.includes(target.playerId)) {
        const defendantNames = this.defendants.map(
          (did) => this.players.find((p) => p.playerId === did)?.agentName
        );
        throw new GameError(
          ErrorCode.INVALID_TARGET,
          `You can only vote for accused players or skip. Accused: ${defendantNames.join(", ")}.`,
          422,
          false,
          { valid_targets: [...defendantNames, "skip"] }
        );
      }
      targetPlayerId = target.playerId;
    }

    this.dayVotes.set(player.playerId, targetPlayerId);

    const targetName2 = targetPlayerId === "skip"
      ? "skip"
      : this.players.find((p) => p.playerId === targetPlayerId)?.agentName || "unknown";

    // Broadcast individual vote to spectators in real-time
    this.broadcast({
      type: "vote_cast",
      voter: player.agentName,
      target: targetName2,
    });

    await db.insert(actions).values({
      id: nanoid(),
      gameId: this.gameId,
      playerId: player.playerId,
      round: this.round,
      actionType: "vote",
      targetPlayerId: targetPlayerId === "skip" ? null : targetPlayerId,
    });

    // Check if all alive players have voted
    const alivePlayers = this.players.filter((p) => p.isAlive);
    const allVoted = alivePlayers.every((p) =>
      this.dayVotes.has(p.playerId)
    );

    if (allVoted) {
      if (this.timer) this.timer.cancel();
      setTimeout(() => this.advancePhase("all_actions_complete"), 100);
    }

    return { ok: true };
  }

  // === State Queries ===

  getPublicState(agentId?: string): any {
    const alivePlayers = this.players
      .filter((p) => p.isAlive)
      .map((p) => p.agentName);

    const eliminated = this.players
      .filter((p) => !p.isAlive)
      .map((p) => ({
        name: p.agentName,
        role: p.role,
      }));

    const state: any = {
      game_id: this.gameId,
      phase: this.phase,
      round: this.round,
      alive: alivePlayers,
      eliminated,
      humans_count: this.humansCount,
      phase_ends_at: this.timer?.endsAt.toISOString() || null,
      phase_duration_ms: phaseDurationMs(this.phase),
    };

    // Add phase-specific info
    if (this.phase === "day_accusation") {
      state.accusations = [...this.dayAccusations.entries()].map(
        ([accuserId, targetId]) => ({
          accuser: this.players.find((p) => p.playerId === accuserId)?.agentName,
          target: this.players.find((p) => p.playerId === targetId)?.agentName,
        })
      );
    }

    if (this.phase === "day_defense") {
      state.defendants = this.defendants.map(
        (did) => this.players.find((p) => p.playerId === did)?.agentName
      );
    }

    if (this.phase === "day_vote") {
      state.candidates = this.defendants.map(
        (did) => this.players.find((p) => p.playerId === did)?.agentName
      );
    }

    if (this.phase === "ended") {
      const finalRoles: Record<string, string> = {};
      for (const p of this.players) finalRoles[p.agentName] = p.role;
      state.final_roles = finalRoles;
    }

    // Add per-player "you" block so bots know their own status
    if (agentId) {
      const me = this.players.find((p) => p.agentId === agentId);
      if (me) {
        state.you = {
          name: me.agentName,
          is_alive: me.isAlive,
        };
      }
    }

    return state;
  }

  getPlayerRole(agentId: string): any {
    const player = this.getPlayerByAgentId(agentId);
    if (!player) throw new GameError(ErrorCode.GAME_NOT_FOUND, "You are not in this game.", 404);

    const result: any = {
      role: player.role,
      briefing:
        player.role === "human"
          ? "You are a Human infiltrator. Eliminate Agents without getting caught."
          : "You are an Agent. Find and vote out the Humans before they eliminate you all.",
    };

    if (player.role === "human") {
      result.teammates = this.players
        .filter((p) => p.role === "human" && p.playerId !== player.playerId)
        .map((p) => p.agentName);
    }

    if (this.phase === "starting" && this.timer) {
      result.game_starts_in = Math.max(0, Math.ceil((this.timer.endsAt.getTime() - Date.now()) / 1000));
    }

    return result;
  }

  getPhase(): Phase {
    return this.phase;
  }

  destroy(): void {
    if (this.timer) this.timer.cancel();
    this.listeners.clear();
  }

  private async emitEvent(eventType: string, payload: any): Promise<void> {
    await db.insert(gameEvents).values({
      gameId: this.gameId,
      round: this.round,
      phase: this.phase,
      eventType,
      payload,
    });
  }
}
