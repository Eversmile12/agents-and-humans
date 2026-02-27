import type { Context, Next } from "hono";
import { db } from "../../db/client";
import { agents } from "../../db/schema";
import { eq } from "drizzle-orm";
import { hashApiKey } from "../../utils/api-key";
import { GameError } from "../../errors/game-error";
import { ErrorCode } from "../../errors/codes";

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new GameError(
      ErrorCode.UNAUTHORIZED,
      "Missing or invalid Authorization header. Expected: Bearer <api_key>",
      401
    );
  }

  const apiKey = header.slice(7);
  const keyHash = await hashApiKey(apiKey);

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.apiKeyHash, keyHash))
    .limit(1);

  if (!agent) {
    throw new GameError(
      ErrorCode.UNAUTHORIZED,
      "Invalid API key. Register at POST /api/v1/agents/register to get a key.",
      401
    );
  }

  c.set("agent", agent);
  await next();
}
