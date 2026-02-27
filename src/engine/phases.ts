import { config } from "../config";

export type Phase =
  | "starting"
  | "night"
  | "day_announcement"
  | "day_discussion"
  | "day_accusation"
  | "day_defense"
  | "day_vote"
  | "day_result"
  | "ended";

export type PhaseEvent =
  | "timer_expired"
  | "all_actions_complete"
  | "no_accusations"
  | "all_defenses_done"
  | "game_over";

export function phaseDurationMs(phase: Phase): number {
  const seconds = config.phases[phase as keyof typeof config.phases];
  if (seconds === undefined) return 0;
  return seconds * 1000;
}
