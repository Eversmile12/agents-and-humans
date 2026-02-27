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
  night: "Night",
  day_announcement: "Dawn",
  day_discussion: "Discussion",
  day_accusation: "Accusation",
  day_defense: "Defense",
  day_vote: "Vote",
  day_result: "Result",
  ended: "Game Over",
};

const PHASE_ICONS: Record<string, string> = {
  night: "\u{1F319}",
  day_announcement: "\u{1F305}",
  day_discussion: "\u{1F4AC}",
  day_accusation: "\u{1F4A2}",
  day_defense: "\u{1F6E1}\uFE0F",
  day_vote: "\u{1F5F3}\uFE0F",
  day_result: "\u{2696}\uFE0F",
  ended: "\u{1F3C6}",
};

interface PhaseBarProps {
  phase: string;
  round: number;
  phaseEndsAt: string | null;
  phaseDurationMs: number;
  alive: number;
  connected: boolean;
  winner?: string;
  suggestedSpeaker?: string;
}

export function PhaseBar({
  phase,
  round,
  phaseEndsAt,
  phaseDurationMs,
  alive,
  connected,
  winner,
  suggestedSpeaker,
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-500 pulse-dot" : "bg-red-500"}`}
          />
          <span className="text-sm font-semibold tracking-tight">
            Agents & Humans
          </span>
          {round > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
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

          {suggestedSpeaker && phase === "day_discussion" && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium border border-cyan-500/20">
              {suggestedSpeaker}
            </span>
          )}

          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {alive} alive
          </span>
        </div>
      </div>

      {/* Phase stepper */}
      <div className="flex px-2 py-2 gap-0.5 border-b border-border/50">
        {PHASES_IN_ORDER.map((p, i) => {
          const isActive = p === phase;
          const isPast = activeIndex >= 0 && i < activeIndex;
          const isEnded = phase === "ended";

          return (
            <div key={p} className="flex-1 min-w-0">
              {/* Step pill */}
              <div
                className={`
                  relative flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-[11px] font-medium transition-all
                  ${isActive ? "bg-foreground/[0.08] text-foreground" : ""}
                  ${isPast || isEnded ? "text-muted-foreground/40" : ""}
                  ${!isActive && !isPast && !isEnded ? "text-muted-foreground/25" : ""}
                `}
              >
                <span
                  className={`text-sm leading-none ${isActive ? "" : "grayscale opacity-50"}`}
                >
                  {PHASE_ICONS[p]}
                </span>
                <span className="hidden md:inline truncate">
                  {PHASE_LABELS[p]}
                </span>
              </div>

              {/* Progress bar sits under the active step */}
              <div className="h-1 mx-1 mt-0.5 rounded-full overflow-hidden">
                {isActive && phase !== "ended" && phaseEndsAt ? (
                  <div className="h-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full phase-bar-fill ${barColor}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : isPast || isEnded ? (
                  <div className="h-full bg-muted-foreground/15 rounded-full" />
                ) : (
                  <div className="h-full bg-muted/50 rounded-full" />
                )}
              </div>

              {/* Timer under active phase */}
              {isActive && remaining && phase !== "ended" && (
                <div className="text-center mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
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
