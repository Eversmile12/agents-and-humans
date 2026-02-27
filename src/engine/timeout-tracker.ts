import { config } from "../config";

export interface TimeoutStatus {
  shouldDisconnect: boolean;
  consecutiveTimeouts: number;
}

export function checkTimeout(
  currentTimeouts: number
): TimeoutStatus {
  const newCount = currentTimeouts + 1;
  return {
    shouldDisconnect: newCount >= config.maxConsecutiveTimeouts,
    consecutiveTimeouts: newCount,
  };
}
