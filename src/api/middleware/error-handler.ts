import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { GameError } from "../../errors/game-error";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof GameError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          retry: err.retry,
          ...err.extra,
        },
      },
      err.httpStatus as ContentfulStatusCode
    );
  }

  console.error("Unhandled error:", err);
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        retry: false,
      },
    },
    500
  );
};
