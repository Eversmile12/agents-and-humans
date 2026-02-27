import React, { useState, useEffect } from "react";

const PHASES_IN_ORDER = [
  "night",
  "day_announcement",
  "day_discussion",
  "day_accusation",
  "day_defense",
  "day_vote",
  "day_result",
] as const;

const PHASE_LABELS: Record<string, string> = {
  starting: "Starting",
  night: "Night",
  day_announcement: "Dawn",
  day_discussion: "Discussion",
  day_accusation: "Accusation",
  day_defense: "Defense",
  day_vote: "Vote",
  day_result: "Result",
  ended: "Game Over",
};

function PhaseIcon({ phase, cls = "w-4 h-4" }: { phase: string; cls?: string }) {
  const props = { className: cls, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (phase) {
    case "night":
      return <svg {...props}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>;
    case "day_announcement":
    case "day_result":
      return <svg {...props}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>;
    case "day_discussion":
    case "day_defense":
      return <svg {...props}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
    case "day_accusation":
    case "day_vote":
      return <svg {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case "ended":
      return <svg {...props}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9Z" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9Z" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>;
  }
}

interface PhaseBarProps {
  phase: string;
  round: number;
  phaseEndsAt: string | null;
  phaseDurationMs: number;
  alive: number;
  connected: boolean;
  winner?: string;
}

export function PhaseBar({
  phase,
  round,
  phaseEndsAt,
  phaseDurationMs,
  alive,
  connected,
  winner,
}: PhaseBarProps) {
  const [progress, setProgress] = useState(100);
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!phaseEndsAt || phase === "ended") {
      setProgress(100);
      setRemaining("");
      return;
    }

    const endTime = new Date(phaseEndsAt).getTime();
    const totalDuration = phaseDurationMs > 0 ? phaseDurationMs : endTime - Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const remainMs = Math.max(0, endTime - now);
      const pct =
        totalDuration > 0 ? (remainMs / totalDuration) * 100 : 0;
      setProgress(Math.min(100, pct));

      const secs = Math.ceil(remainMs / 1000);
      if (secs > 60) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
      } else {
        setRemaining(`${secs}s`);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phaseEndsAt, phase, phaseDurationMs]);

  const barColor =
    progress > 50
      ? "bg-emerald-500/80"
      : progress > 20
        ? "bg-amber-500/80"
        : "bg-red-500/80";

  const activeIndex = PHASES_IN_ORDER.indexOf(phase as any);

  return (
    <div className="flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-500 pulse-dot" : "bg-red-500"}`}
          />
          <a href="/" className="text-sm font-bold tracking-tight text-white/80 hover:text-white transition-colors">
            Agents & Humans
          </a>
          {round > 0 && (
            <span className="text-sm px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 font-mono">
              R{round}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {phase === "ended" && winner && (
            <span
              className={`text-sm font-bold ${winner === "agents" ? "text-emerald-400" : "text-red-400"}`}
            >
              {winner === "agents" ? "Agents Win" : "Humans Win"}
            </span>
          )}

          <span className="text-sm px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">
            {alive} alive
          </span>
        </div>
      </div>

      {/* Phase stepper */}
      <div className="flex px-2 py-2 gap-0.5 border-b border-white/[0.06]">
        {PHASES_IN_ORDER.map((p, i) => {
          const isActive = p === phase;
          const isPast = activeIndex >= 0 && i < activeIndex;
          const isEnded = phase === "ended";

          return (
            <div key={p} className="flex-1 min-w-0">
              {/* Step pill */}
              <div
                className={`
                  relative flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-sm font-medium transition-all
                  ${isActive ? "bg-white/[0.08] text-white" : ""}
                  ${isPast || isEnded ? "text-white/35" : ""}
                  ${!isActive && !isPast && !isEnded ? "text-white/20" : ""}
                `}
              >
                <PhaseIcon phase={p} cls={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "opacity-100" : "opacity-50"}`} />
                <span className="hidden md:inline truncate">
                  {PHASE_LABELS[p]}
                </span>
              </div>

              {/* Progress bar sits under the active step */}
              <div className="h-1 mx-1 mt-0.5 rounded-full overflow-hidden">
                {isActive && phase !== "ended" && phaseEndsAt ? (
                  <div className="h-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full phase-bar-fill ${barColor}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : isPast || isEnded ? (
                  <div className="h-full bg-white/[0.08] rounded-full" />
                ) : (
                  <div className="h-full bg-white/[0.03] rounded-full" />
                )}
              </div>

              {/* Timer under active phase */}
              {isActive && remaining && phase !== "ended" && (
                <div className="text-center mt-0.5">
                  <span className="text-sm font-mono text-white/35 tabular-nums">
                    {remaining}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
