import React, { useRef, useState, useEffect } from "react";
import type { GameEvent } from "./App";
import { EventEntry } from "./EventEntry";

interface EventLogProps {
  events: GameEvent[];
  playerColorMap: Record<string, string>;
}

export function EventLog({ events, playerColorMap }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, autoScroll]);

  // Detect if user scrolled away from bottom
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  };

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/35 text-sm">Waiting for events...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="event-log h-full overflow-y-auto px-2 py-3 space-y-0.5"
      >
        {events.map((event, i) => (
          <EventEntry key={i} event={event} playerColorMap={playerColorMap} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && (
        <button
          onClick={() => {
            endRef.current?.scrollIntoView({ behavior: "smooth" });
            setAutoScroll(true);
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-white/[0.06] text-white/50 text-sm font-medium hover:bg-white/[0.1] hover:text-white/70 transition-colors border border-white/[0.08] shadow-lg"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
