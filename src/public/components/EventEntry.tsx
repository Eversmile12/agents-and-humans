import React from "react";
import type { GameEvent } from "./App";

function RoleBadge({ role }: { role: string }) {
  const isHuman = role === "human";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
        isHuman
          ? "bg-red-500/15 text-red-400 border border-red-500/20"
          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
      }`}
    >
      {isHuman ? "Human" : "Agent"}
    </span>
  );
}

function PhaseChangeEntry({ event }: { event: GameEvent }) {
  const labels: Record<string, string> = {
    night: "Night falls...",
    day_announcement: "Dawn breaks",
    day_discussion: "Discussion begins",
    day_accusation: "Accusations are open",
    day_defense: "The accused may speak",
    day_vote: "Time to vote",
    day_result: "Votes are in",
    ended: "Game Over",
  };
  const label = labels[event.phase!] || event.phase;

  return (
    <div className="flex items-center gap-3 py-3 my-1">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[11px] text-muted-foreground/70 font-semibold uppercase tracking-widest">
        {event.phase === "night" ? `Round ${event.round} \u2014 ` : ""}
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function NightKillEntry({ event }: { event: GameEvent }) {
  return (
    <div className="mx-2 px-3 py-2.5 rounded-lg bg-red-500/[0.04] border border-red-500/10 flex items-baseline gap-1.5 flex-wrap">
      <span className="text-red-400 font-semibold text-sm">{event.victim}</span>
      <span className="text-sm text-muted-foreground">
        was found dead at dawn. They were
      </span>
      <RoleBadge role={event.role!} />
    </div>
  );
}

function MessageEntry({ event }: { event: GameEvent }) {
  return (
    <div className="mx-2 px-3 py-2 rounded-lg hover:bg-foreground/[0.02] transition-colors">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-sm text-cyan-400 flex-shrink-0">
          {event.from}
        </span>
        <span className="text-sm leading-relaxed">{event.message}</span>
      </div>
    </div>
  );
}

function AccusationEntry({ event }: { event: GameEvent }) {
  return (
    <div className="mx-2 px-3 py-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
      <div className="flex items-baseline gap-1.5 flex-wrap text-sm">
        <span className="font-semibold text-amber-400">{event.accuser}</span>
        <span className="text-muted-foreground">accuses</span>
        <span className="font-semibold text-amber-400">{event.target}</span>
      </div>
      {event.reason && (
        <p className="text-sm text-muted-foreground mt-1 italic leading-relaxed">
          "{event.reason}"
        </p>
      )}
    </div>
  );
}

function DefenseEntry({ event }: { event: GameEvent }) {
  return (
    <div className="mx-2 px-3 py-2.5 rounded-lg bg-blue-500/[0.04] border border-blue-500/10">
      <div className="flex items-baseline gap-1.5 text-sm">
        <span className="font-semibold text-blue-400">{event.from}</span>
        <span className="text-muted-foreground">defends:</span>
      </div>
      <p className="text-sm mt-1 italic leading-relaxed">"{event.message}"</p>
    </div>
  );
}

function VoteResultEntry({ event }: { event: GameEvent }) {
  const tally = event.tally || {};
  const entries = Object.entries(tally).sort(
    ([, a], [, b]) => b.count - a.count
  );
  const maxVotes = entries.length > 0 ? entries[0]![1].count : 0;

  return (
    <div
      className={`mx-2 px-3 py-2.5 rounded-lg border ${
        event.eliminated_player
          ? "bg-red-500/[0.04] border-red-500/10"
          : "bg-muted/30 border-border/60"
      }`}
    >
      {/* Tally bars */}
      <div className="space-y-1.5 mb-2">
        {entries.map(([name, data]) => (
          <div key={name} className="flex items-center gap-2 text-sm">
            <span className="font-medium w-20 truncate text-right flex-shrink-0">
              {name}
            </span>
            <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${
                  name === event.eliminated_player
                    ? "bg-red-500/40"
                    : "bg-foreground/10"
                }`}
                style={{
                  width: maxVotes > 0 ? `${(data.count / maxVotes) * 100}%` : "0%",
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">
              {data.count}
            </span>
          </div>
        ))}
      </div>

      {/* Outcome */}
      {event.eliminated_player ? (
        <div className="text-sm flex items-baseline gap-1.5 flex-wrap">
          <span className="text-red-400 font-semibold">
            {event.eliminated_player}
          </span>
          <span className="text-muted-foreground">was voted out. They were</span>
          <RoleBadge role={event.eliminated_role!} />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {event.outcome === "tied"
            ? "Vote tied \u2014 no one is eliminated."
            : "No majority \u2014 no one is eliminated."}
        </div>
      )}
    </div>
  );
}

function GameEndEntry({ event }: { event: GameEvent }) {
  const isAgentsWin = event.winner === "agents";
  const roles = event.final_roles || {};

  return (
    <div className="mx-2 my-2 px-4 py-6 rounded-xl bg-card border border-border text-center">
      <div
        className={`text-3xl font-bold mb-1 ${
          isAgentsWin ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isAgentsWin ? "Agents Win" : "Humans Win"}
      </div>
      <div className="text-sm text-muted-foreground mb-4">
        {event.reason}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {Object.entries(roles).map(([name, role]) => (
          <div
            key={name}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              role === "human"
                ? "bg-red-500/[0.06] border-red-500/15"
                : "bg-emerald-500/[0.06] border-emerald-500/15"
            }`}
          >
            <span className="text-sm font-medium">{name}</span>
            <RoleBadge role={role} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectedEntry({ event }: { event: GameEvent }) {
  return (
    <div className="px-5 py-2 text-sm text-muted-foreground/60">
      Connected \u2014 {event.alive?.length || 0} players alive
    </div>
  );
}

export function EventEntry({ event }: { event: GameEvent }) {
  let content: React.ReactNode;

  switch (event.type) {
    case "connected":
      return null; // State sync only, not a visible event
    case "phase_change":
      content = <PhaseChangeEntry event={event} />;
      break;
    case "night_kill":
      content = <NightKillEntry event={event} />;
      break;
    case "message":
      content = <MessageEntry event={event} />;
      break;
    case "accusation":
      content = <AccusationEntry event={event} />;
      break;
    case "defense":
      content = <DefenseEntry event={event} />;
      break;
    case "vote_result":
      content = <VoteResultEntry event={event} />;
      break;
    case "game_end":
      content = <GameEndEntry event={event} />;
      break;
    case "speaker_change":
      return null; // Don't render in the log, it's shown in the phase bar
    default:
      content = (
        <div className="px-5 py-1 text-xs text-muted-foreground/40 font-mono">
          {JSON.stringify(event)}
        </div>
      );
  }

  return <div className="event-entry">{content}</div>;
}
