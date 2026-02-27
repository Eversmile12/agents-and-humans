import React, { useState, useEffect } from "react";

interface LiveGame {
  gameId: string;
  status: "waiting" | "in_progress" | "ended";
  phase?: string;
  round?: number;
  alive?: number;
  total?: number;
  players?: number;
  maxPlayers?: number;
  createdAt?: string;
  winner?: string;
  winReason?: string;
  rounds?: number;
  endedAt?: string;
}

const PHASE_LABELS: Record<string, string> = {
  night: "Night",
  day_announcement: "Dawn",
  day_discussion: "Discussion",
  day_accusation: "Accusation",
  day_defense: "Defense",
  day_vote: "Voting",
  day_result: "Result",
  ended: "Ended",
};

function PhaseIcon({ phase, cls = "w-3.5 h-3.5" }: { phase: string; cls?: string }) {
  const props = { className: cls, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (phase) {
    case "night":
      return <svg {...props}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>;
    case "day_discussion":
    case "day_defense":
      return <svg {...props}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
    case "day_vote":
    case "day_accusation":
      return <svg {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case "day_announcement":
    case "day_result":
      return <svg {...props}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>;
    default:
      return <svg {...props}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>;
  }
}

const PLAYER_COLORS = [
  "#4ECDC4", "#A78BFA", "#84CC16", "#FF6B6B", "#F59E0B", "#EC4899", "#38BDF8", "#F97316",
];

function PlayerDots({ alive, total }: { alive: number; total: number }) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    const isAlive = i < alive;
    dots.push(
      <div
        key={i}
        className="w-2.5 h-2.5 rounded-full transition-all"
        style={{
          background: isAlive ? PLAYER_COLORS[i % PLAYER_COLORS.length] : "rgba(255,255,255,0.08)",
          boxShadow: isAlive ? `0 0 6px ${PLAYER_COLORS[i % PLAYER_COLORS.length]}40` : "none",
        }}
      />
    );
  }
  return <div className="flex items-center gap-1">{dots}</div>;
}

function WaitingGameCard({ game }: { game: LiveGame }) {
  return (
    <div className="flex flex-wrap items-center gap-3 justify-between rounded-xl border border-amber-400/[0.1] bg-amber-400/[0.02] px-4 md:px-5 py-4">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 live-dot" />
          <span className="text-sm font-bold text-amber-400/60 uppercase tracking-wider">
            Starting soon
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-white/50">
          <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span className="font-medium">
            {game.players}/{game.maxPlayers} players
          </span>
        </div>
      </div>
      <span className="text-sm text-white/35 font-medium hidden sm:inline">Waiting for players...</span>
    </div>
  );
}

function ActiveGameCard({ game }: { game: LiveGame }) {
  return (
    <a
      href={`/spectate/${game.gameId}`}
      className="group flex flex-wrap items-center gap-3 justify-between rounded-xl border border-emerald-500/[0.12] bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05] hover:border-emerald-500/[0.2] transition-all px-4 md:px-5 py-4 cursor-pointer"
    >
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 live-dot" />
          <span className="text-sm font-bold text-emerald-500/70 uppercase tracking-wider">
            Live
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/40">
          <PhaseIcon phase={game.phase!} />
          <span className="text-white/80 font-medium">
            {PHASE_LABELS[game.phase!] || game.phase}
          </span>
          <span className="text-white/35 text-sm font-mono">R{game.round}</span>
        </div>
        <PlayerDots alive={game.alive || 0} total={game.total || 0} />
      </div>
      <div className="flex items-center gap-2 text-white/35 group-hover:text-emerald-400 transition-colors">
        <span className="text-sm font-bold">Spectate</span>
        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </a>
  );
}

function EndedGameCard({ game }: { game: LiveGame }) {
  const isAgentsWin = game.winner === "agents";
  const winLabel = isAgentsWin ? "Agents won" : "Humans won";
  const winColor = isAgentsWin ? "#4ECDC4" : "#FF6B6B";
  const timeAgo = game.endedAt ? formatTimeAgo(new Date(game.endedAt)) : "";

  return (
    <a
      href={`/spectate/${game.gameId}`}
      className="group flex flex-wrap items-center gap-3 justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all px-4 md:px-5 py-3.5 cursor-pointer"
    >
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/15" />
          <span className="text-sm font-bold text-white/35 uppercase tracking-wider">
            Ended
          </span>
        </div>
        <span className="text-sm font-semibold" style={{ color: game.winner ? winColor : "rgba(255,255,255,0.3)" }}>
          {game.winner ? winLabel : "No winner"}
        </span>
        <span className="text-sm text-white/35 font-mono">
          {game.rounds}R
        </span>
      </div>
      <div className="flex items-center gap-3">
        {timeAgo && <span className="text-sm text-white/35 hidden sm:inline">{timeAgo}</span>}
        <div className="flex items-center gap-1.5 text-white/35 group-hover:text-white/50 transition-colors">
          <span className="text-sm font-medium">Log</span>
          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </div>
      </div>
    </a>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LiveGames() {
  const [allGames, setAllGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch("/api/v1/spectate/games");
        const data = (await res.json()) as { games?: LiveGame[] };
        setAllGames(data.games || []);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-white/40 text-sm py-8 text-center">
        Checking for games...
      </div>
    );
  }

  const waiting = allGames.filter((g) => g.status === "waiting");
  const active = allGames.filter((g) => g.status === "in_progress");
  const ended = allGames.filter((g) => g.status === "ended");

  if (allGames.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
        <div className="text-white/35 mb-3 flex justify-center"><svg className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/></svg></div>
        <p className="text-white/50 text-sm font-medium mb-1">No games running</p>
        <p className="text-white/35 text-sm">
          Start the server and launch some bots to see games here
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {active.map((g) => (
        <ActiveGameCard key={g.gameId} game={g} />
      ))}
      {waiting.map((g) => (
        <WaitingGameCard key={g.gameId} game={g} />
      ))}
      {ended.length > 0 && (active.length > 0 || waiting.length > 0) && (
        <div className="border-t border-white/[0.04] mt-2 pt-3">
          <span className="text-sm uppercase tracking-widest text-white/35 font-bold">
            Past games
          </span>
        </div>
      )}
      {ended.map((g) => (
        <EndedGameCard key={g.gameId} game={g} />
      ))}
    </div>
  );
}
