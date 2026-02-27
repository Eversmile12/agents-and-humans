import React, { useState, useEffect } from "react";

interface StartingScreenProps {
  players: string[];
  playerColorMap: Record<string, string>;
  phaseEndsAt: string | null;
}

export function StartingScreen({ players, playerColorMap, phaseEndsAt }: StartingScreenProps) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!phaseEndsAt) return;
    const endTime = new Date(phaseEndsAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setCountdown(remaining);
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Radial glow background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Countdown */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm uppercase tracking-[0.3em] text-white/30 font-bold">
            Game starting in
          </span>
          <div className="relative">
            <span
              key={countdown}
              className="text-8xl font-black tabular-nums text-white countdown-tick"
              style={{
                textShadow: "0 0 40px rgba(78, 205, 196, 0.3), 0 0 80px rgba(78, 205, 196, 0.1)",
              }}
            >
              {countdown ?? "—"}
            </span>
          </div>
        </div>

        {/* Player chips */}
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {players.map((name, i) => (
            <div
              key={name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] player-chip-enter"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <img
                src={`https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(name)}`}
                alt={name}
                className="w-5 h-5 rounded-full"
                style={{ background: "#12121e" }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: playerColorMap[name] || "#4ECDC4" }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <span className="text-sm text-white/20">
          Roles have been assigned. Night is coming.
        </span>
      </div>
    </div>
  );
}
