import type { Phase, PhaseEvent } from "./phases";

export interface PhaseContext {
  hasAccusations: boolean;
  isGameOver: boolean;
}

export function nextPhase(
  current: Phase,
  event: PhaseEvent,
  context: PhaseContext
): Phase {
  if (context.isGameOver) return "ended";

  switch (current) {
    case "starting":
      return "night";

    case "night":
      return "day_announcement";

    case "day_announcement":
      return "day_discussion";

    case "day_discussion":
      return "day_accusation";

    case "day_accusation":
      if (!context.hasAccusations || event === "no_accusations") return "night";
      return "day_defense";

    case "day_defense":
      return "day_vote";

    case "day_vote":
      return "day_result";

    case "day_result":
      return "night";

    default:
      return "ended";
  }
}
