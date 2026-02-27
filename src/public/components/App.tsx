import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PhaseBar } from "./PhaseBar";
import { EventLog } from "./EventLog";
import { PlayerArena } from "./PlayerArena";

const PLAYER_COLORS = [
  "#4ECDC4", "#A78BFA", "#84CC16", "#FF6B6B",
  "#F59E0B", "#EC4899", "#38BDF8", "#F97316",
];

export interface GameState {
  game_id: string;
  phase: string;
  round: number;
  alive: string[];
  eliminated: { name: string; role: string }[];
  phase_ends_at: string | null;
  phase_duration_ms: number;
  winner?: string;
  win_reason?: string;
  final_roles?: Record<string, string>;
}

export interface GameEvent {
  type: string;
  // phase_change
  phase?: string;
  round?: number;
  phase_ends_at?: string;
  phase_duration_ms?: number;
  // night_kill
  victim?: string;
  role?: string;
  // message / defense
  from?: string;
  message?: string;
  // accusation
  accuser?: string;
  target?: string;
  reason?: string;
  // vote_cast
  voter?: string;
  // vote_result
  tally?: Record<string, { count: number; voters: string[] }>;
  outcome?: string;
  eliminated_player?: string;
  eliminated_role?: string;
  // game_end
  winner?: string;
  final_roles?: Record<string, string>;
  // connected (carries full state)
  alive?: string[];
  eliminated?: { name: string; role: string }[];
  game_id?: string;
  // historical replay marker
  _history?: boolean;
}

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<string[]>([]);
  const [lastSpeaker, setLastSpeaker] = useState<string | null>(null);
  const retryCount = useRef(0);

  // Extract gameId from URL: /spectate/game_xyz
  const gameId = window.location.pathname.split("/spectate/")[1]?.split("/")[0];

  const connectSSE = useCallback(() => {
    if (!gameId) {
      setError("No game ID in URL. Navigate to /spectate/<game_id>");
      return;
    }

    const sse = new EventSource(`/api/v1/spectate/${gameId}/stream`);
    // Buffer history events until "connected" arrives, then replace the array
    const historyBuffer: GameEvent[] = [];

    sse.onopen = () => {
      setConnected(true);
      setError(null);
      retryCount.current = 0;
    };

    sse.onmessage = (e) => {
      const event: GameEvent = JSON.parse(e.data);

      // Historical events are buffered until "connected" finalizes the replay
      if (event._history) {
        historyBuffer.push(event);
        return;
      }

      // "connected" means history replay is done — replace events with buffer
      if (event.type === "connected") {
        setEvents([...historyBuffer]);
        historyBuffer.length = 0;
      } else {
        setEvents((prev) => [...prev, event]);
      }

      switch (event.type) {
        case "connected":
          {
            const aliveNames = event.alive || [];
            const elimNames = (event.eliminated || []).map((e) => e.name);
            setAllPlayers([...aliveNames, ...elimNames]);
          }
          setState({
            game_id: event.game_id || gameId,
            phase: event.phase || "",
            round: event.round || 0,
            alive: event.alive || [],
            eliminated: event.eliminated || [],
            phase_ends_at: event.phase_ends_at || null,
            phase_duration_ms: event.phase_duration_ms || 0,
          });
          break;

        case "phase_change":
          setLastSpeaker(null);
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  phase: event.phase!,
                  round: event.round!,
                  phase_ends_at: event.phase_ends_at || null,
                  phase_duration_ms: event.phase_duration_ms || 0,
                }
              : prev
          );
          break;

        case "message":
        case "defense":
        case "night_message":
          if (event.from) setLastSpeaker(event.from);
          break;

        case "speaker_change":
          break; // legacy, ignored

        case "night_kill":
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              alive: prev.alive.filter((n) => n !== event.victim),
              eliminated: [
                ...prev.eliminated,
                { name: event.victim!, role: event.role! },
              ],
            };
          });
          break;

        case "vote_result":
          if (event.eliminated_player) {
            setState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                alive: prev.alive.filter(
                  (n) => n !== event.eliminated_player
                ),
                eliminated: [
                  ...prev.eliminated,
                  {
                    name: event.eliminated_player!,
                    role: event.eliminated_role!,
                  },
                ],
              };
            });
          }
          break;

        case "game_end":
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "ended",
                  winner: event.winner,
                  final_roles: event.final_roles,
                }
              : prev
          );
          break;
      }
    };

    sse.onerror = () => {
      sse.close();
      setConnected(false);

      // Exponential backoff retry
      const delay = Math.min(1000 * 2 ** retryCount.current, 10000);
      retryCount.current++;
      setTimeout(connectSSE, delay);
    };

    return () => sse.close();
  }, [gameId]);

  useEffect(() => {
    const cleanup = connectSSE();
    return cleanup;
  }, [connectSSE]);

  const playerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    allPlayers.forEach((name, i) => {
      map[name] = PLAYER_COLORS[i % PLAYER_COLORS.length]!;
    });
    return map;
  }, [allPlayers]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-2 text-white">Agents & Humans</h1>
          <p className="text-white/50 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-2 text-white">Agents & Humans</h1>
          <p className="text-white/50 text-sm">
            {connected ? "Loading game state..." : "Connecting..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PhaseBar
        phase={state.phase}
        round={state.round}
        phaseEndsAt={state.phase_ends_at}
        phaseDurationMs={state.phase_duration_ms}
        alive={state.alive.length}
        connected={connected}
        winner={state.winner}
      />
      <div className="flex-1 flex min-h-0">
        <div className="w-1/2 flex flex-col border-r border-white/[0.06]">
          <PlayerArena
            allPlayers={allPlayers}
            alive={state.alive}
            eliminated={state.eliminated}
            playerColorMap={playerColorMap}
            lastSpeaker={lastSpeaker}
            phase={state.phase}
            finalRoles={state.final_roles}
          />
        </div>
        <div className="w-1/2 flex flex-col min-h-0">
          <EventLog events={events} playerColorMap={playerColorMap} />
        </div>
      </div>
    </>
  );
}
