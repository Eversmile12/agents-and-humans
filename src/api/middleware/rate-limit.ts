import type { Context, Next } from "hono";
import { config } from "../../config";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";

const requestLog = new Map<string, number[]>();

export async function rateLimitMiddleware(c: Context, next: Next) {
  const agent = c.get("agent") as { id: string } | undefined;
  if (!agent) {
    await next();
    return;
  }

  const now = Date.now();
  const windowMs = 1000;
  const key = agent.id;

  let timestamps = requestLog.get(key) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= config.apiRateLimitPerSecond) {
    throw new GameError(
      ErrorCode.RATE_LIMITED,
      `Too many requests. Maximum ${config.apiRateLimitPerSecond} requests per second.`,
      429,
      true,
      { retry_after_seconds: 1 }
    );
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);

  await next();
}
