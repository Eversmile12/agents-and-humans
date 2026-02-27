import React from "react";
import type { GameEvent } from "./App";

function RoleBadge({ role }: { role: string }) {
  const isHuman = role === "human";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-sm font-bold uppercase tracking-wide ${
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
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-sm text-white/35 font-bold uppercase tracking-widest">
        {event.phase === "night" ? `Round ${event.round} / ` : ""}
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function NightKillEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
  return (
    <div className="mx-2 px-3 py-2.5 rounded-lg bg-red-500/[0.04] border border-red-500/10 flex items-baseline gap-1.5 flex-wrap">
      <span className="font-semibold text-sm" style={{ color: playerColorMap[event.victim!] || "#ef4444" }}>{event.victim}</span>
      <span className="text-sm text-white/50">
        was found dead at dawn. They were
      </span>
      <RoleBadge role={event.role!} />
    </div>
  );
}

function NightMessageEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
  return (
    <div className="mx-2 px-3 py-2 rounded-lg bg-purple-500/[0.06] border border-purple-500/10">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-wider text-purple-400/60 font-semibold">secret</span>
        <span className="font-semibold text-sm flex-shrink-0" style={{ color: playerColorMap[event.from!] || "#a78bfa" }}>
          {event.from}
        </span>
        <span className="text-sm leading-relaxed text-white/70">{event.message}</span>
      </div>
    </div>
  );
}

function MessageEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
  return (
    <div className="mx-2 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-sm flex-shrink-0" style={{ color: playerColorMap[event.from!] || "#4ECDC4" }}>
          {event.from}
        </span>
        <span className="text-sm text-white/80 leading-relaxed">{event.message}</span>
      </div>
    </div>
  );
}

function AccusationEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
  return (
    <div className="mx-2 px-3 py-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
      <div className="flex items-baseline gap-1.5 flex-wrap text-sm">
        <span className="font-semibold" style={{ color: playerColorMap[event.accuser!] || "#fbbf24" }}>{event.accuser}</span>
        <span className="text-white/50">accuses</span>
        <span className="font-semibold" style={{ color: playerColorMap[event.target!] || "#fbbf24" }}>{event.target}</span>
      </div>
      {event.reason && (
        <p className="text-sm text-white/50 mt-1 italic leading-relaxed">
          "{event.reason}"
        </p>
      )}
    </div>
  );
}

function DefenseEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
  return (
    <div className="mx-2 px-3 py-2.5 rounded-lg bg-blue-500/[0.04] border border-blue-500/10">
      <div className="flex items-baseline gap-1.5 text-sm">
        <span className="font-semibold" style={{ color: playerColorMap[event.from!] || "#60a5fa" }}>{event.from}</span>
        <span className="text-white/50">defends:</span>
      </div>
      <p className="text-sm text-white/80 mt-1 italic leading-relaxed">"{event.message}"</p>
    </div>
  );
}

function VoteResultEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
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
          : "bg-white/[0.02] border-white/[0.06]"
      }`}
    >
      {/* Tally bars */}
      <div className="space-y-1.5 mb-2">
        {entries.map(([name, data]) => (
          <div key={name} className="flex items-center gap-2 text-sm">
            <span className="font-medium w-20 truncate text-right flex-shrink-0" style={{ color: playerColorMap[name] }}>
              {name}
            </span>
            <div className="flex-1 h-4 bg-white/[0.04] rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${
                  name === event.eliminated_player
                    ? "bg-red-500/40"
                    : "bg-white/[0.08]"
                }`}
                style={{
                  width: maxVotes > 0 ? `${(data.count / maxVotes) * 100}%` : "0%",
                }}
              />
            </div>
            <span className="text-sm text-white/35 tabular-nums w-6 text-right">
              {data.count}
            </span>
          </div>
        ))}
      </div>

      {/* Outcome */}
      {event.eliminated_player ? (
        <div className="text-sm flex items-baseline gap-1.5 flex-wrap">
          <span className="font-semibold" style={{ color: playerColorMap[event.eliminated_player] || "#ef4444" }}>
            {event.eliminated_player}
          </span>
          <span className="text-white/50">was voted out. They were</span>
          <RoleBadge role={event.eliminated_role!} />
        </div>
      ) : (
        <div className="text-sm text-white/50">
          {event.outcome === "tied"
            ? "Vote tied, no one is eliminated."
            : "No majority, no one is eliminated."}
        </div>
      )}
    </div>
  );
}

function GameEndEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
  const isAgentsWin = event.winner === "agents";
  const roles = event.final_roles || {};

  return (
    <div className="mx-2 my-2 px-4 py-6 rounded-xl bg-surface-raised border border-white/[0.08] text-center">
      <div
        className={`text-3xl font-black mb-1 ${
          isAgentsWin ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isAgentsWin ? "Agents Win" : "Humans Win"}
      </div>
      <div className="text-sm text-white/50 mb-4">
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
            <span className="text-sm font-medium" style={{ color: playerColorMap[name] }}>{name}</span>
            <RoleBadge role={role} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventEntry({ event, playerColorMap }: { event: GameEvent; playerColorMap: Record<string, string> }) {
  let content: React.ReactNode;

  switch (event.type) {
    case "connected":
      return null;
    case "phase_change":
      content = <PhaseChangeEntry event={event} />;
      break;
    case "night_kill":
      content = <NightKillEntry event={event} playerColorMap={playerColorMap} />;
      break;
    case "night_message":
      content = <NightMessageEntry event={event} playerColorMap={playerColorMap} />;
      break;
    case "message":
      content = <MessageEntry event={event} playerColorMap={playerColorMap} />;
      break;
    case "accusation":
      content = <AccusationEntry event={event} playerColorMap={playerColorMap} />;
      break;
    case "defense":
      content = <DefenseEntry event={event} playerColorMap={playerColorMap} />;
      break;
    case "vote_result":
      content = <VoteResultEntry event={event} playerColorMap={playerColorMap} />;
      break;
    case "game_end":
      content = <GameEndEntry event={event} playerColorMap={playerColorMap} />;
      break;
    case "speaker_change":
      return null;
    default:
      content = (
        <div className="px-5 py-1 text-sm text-white/35 font-mono">
          {JSON.stringify(event)}
        </div>
      );
  }

  return <div className="event-entry">{content}</div>;
}
