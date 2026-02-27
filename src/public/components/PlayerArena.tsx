import React from "react";
import { RoleBadge } from "./RoleBadge";

interface PlayerArenaProps {
  allPlayers: string[];
  alive: string[];
  eliminated: { name: string; role: string }[];
  playerColorMap: Record<string, string>;
  lastSpeaker: string | null;
  phase: string;
  finalRoles?: Record<string, string>;
}

function SkullIcon() {
  return (
    <svg className="w-5 h-5 text-white/60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
      <path d="M8 20v2h8v-2" /><path d="m12.5 17-.5-1-.5 1h1z" />
      <path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" />
    </svg>
  );
}

export function PlayerArena({
  allPlayers,
  alive,
  eliminated,
  playerColorMap,
  lastSpeaker,
  phase,
  finalRoles,
}: PlayerArenaProps) {
  const total = allPlayers.length;
  const eliminatedMap = new Map(eliminated.map((e) => [e.name, e.role]));
  const isEnded = phase === "ended";

  return (
    <div className="flex-1 relative">
      {allPlayers.map((name, i) => {
        const angle = (2 * Math.PI * i) / total - Math.PI / 2;
        const x = 50 + 38 * Math.cos(angle);
        const y = 45 + 35 * Math.sin(angle);
        const isDead = eliminatedMap.has(name);
        const role = eliminatedMap.get(name) || finalRoles?.[name];
        const isSpeaker = lastSpeaker === name && !isDead;
        const color = playerColorMap[name] || "#4ECDC4";
        const showRole = isDead || isEnded;

        return (
          <div
            key={name}
            className="absolute flex flex-col items-center gap-1"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              transition: "opacity 500ms, filter 500ms",
              filter: isDead ? "grayscale(1)" : "none",
              opacity: isDead ? 0.5 : 1,
            }}
          >
            {/* Avatar with ring */}
            <div className="relative">
              <img
                src={`https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(name)}`}
                alt={name}
                className={`w-12 h-12 rounded-full transition-transform duration-300 ${isSpeaker ? "speaker-ring" : ""}`}
                style={{
                  ["--speaker-color" as string]: color,
                  boxShadow: isSpeaker ? undefined : `0 0 0 3px ${isDead ? "rgba(255,255,255,0.15)" : color}`,
                  background: "#12121e",
                }}
              />
              {isDead && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <SkullIcon />
                </span>
              )}
            </div>

            {/* Name */}
            <span
              className="text-sm font-semibold max-w-[72px] truncate text-center"
              style={{ color: isDead ? "rgba(255,255,255,0.35)" : color }}
            >
              {name}
            </span>

            {/* Role badge (dead or game end) */}
            {showRole && role && <RoleBadge role={role} />}
          </div>
        );
      })}
    </div>
  );
}
