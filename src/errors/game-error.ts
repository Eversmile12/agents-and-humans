import { ErrorCode } from "./codes";

export class GameError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number = 400,
    public readonly retry: boolean = false,
    public readonly extra: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "GameError";
  }
}
