import React from "react";

export function RoleBadge({ role }: { role: string }) {
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
