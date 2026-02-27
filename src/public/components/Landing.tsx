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

// Inline SVG icons to avoid lucide-react bundling issues
function Icon({ d, cls = "w-3.5 h-3.5" }: { d: string; cls?: string }) {
  return (
    <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function UsersIcon({ cls = "w-3.5 h-3.5" }: { cls?: string }) {
  return (
    <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function EyeIcon({ cls = "w-3.5 h-3.5" }: { cls?: string }) {
  return (
    <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ArrowRightIcon({ cls = "w-4 h-4" }: { cls?: string }) {
  return (
    <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function PhaseIcon({ phase }: { phase: string }) {
  const cls = "w-3.5 h-3.5";
  switch (phase) {
    case "night":
      return (
        <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      );
    case "day_discussion":
    case "day_defense":
      return (
        <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      );
    case "day_vote":
    case "day_accusation":
      return (
        <svg className={cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 12 2 2 4-4" /><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" /><path d="M22 19H2" />
        </svg>
      );
    default:
      return <EyeIcon cls={cls} />;
  }
}

function WaitingGameCard({ game }: { game: LiveGame }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 live-dot" />
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
            Starting soon
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-white/50">
          <UsersIcon />
          <span>
            {game.players}/{game.maxPlayers} players
          </span>
        </div>
      </div>
      <span className="text-xs text-white/20">Waiting for players</span>
    </div>
  );
}

function ActiveGameCard({ game }: { game: LiveGame }) {
  return (
    <a
      href={`/spectate/${game.gameId}`}
      className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all px-5 py-4 cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
            Live
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <PhaseIcon phase={game.phase!} />
          <span className="text-white/80">
            {PHASE_LABELS[game.phase!] || game.phase}
          </span>
          <span className="text-white/30 mx-1">Round {game.round}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-white/50">
          <UsersIcon />
          <span>
            {game.alive}/{game.total} alive
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-white/30 group-hover:text-cyan-400 transition-colors">
        <span className="text-sm font-medium">Spectate</span>
        <ArrowRightIcon />
      </div>
    </a>
  );
}

function EndedGameCard({ game }: { game: LiveGame }) {
  const winLabel = game.winner === "agents" ? "Agents won" : "Humans won";
  const timeAgo = game.endedAt ? formatTimeAgo(new Date(game.endedAt)) : "";

  return (
    <a
      href={`/spectate/${game.gameId}`}
      className="group flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all px-5 py-3 cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <span className="text-xs font-medium text-white/25 uppercase tracking-wider">
            Ended
          </span>
        </div>
        <span className="text-sm text-white/40">
          {game.winner ? winLabel : "No winner"}
        </span>
        <span className="text-xs text-white/20">
          {game.rounds} rounds
        </span>
      </div>
      <div className="flex items-center gap-3">
        {timeAgo && <span className="text-xs text-white/15">{timeAgo}</span>}
        <div className="flex items-center gap-1.5 text-white/20 group-hover:text-cyan-400/60 transition-colors">
          <span className="text-sm font-medium">Log</span>
          <ArrowRightIcon cls="w-3.5 h-3.5" />
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
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <svg className="w-8 h-8 text-white/20 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><path d="M8 20v2h8v-2" /><path d="m12.5 17-.5-1-.5 1h1z" /><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" />
        </svg>
        <p className="text-white/50 text-sm mb-1">No games yet</p>
        <p className="text-white/30 text-xs">
          Start the server and bots to see games here
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
        <div className="border-t border-white/[0.04] mt-1 pt-3">
          <span className="text-[10px] uppercase tracking-widest text-white/20 font-medium">
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
