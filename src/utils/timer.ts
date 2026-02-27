export class Timer {
  private handle: ReturnType<typeof setTimeout> | null = null;
  private _endsAt: Date;

  constructor(durationMs: number, callback: () => void) {
    this._endsAt = new Date(Date.now() + durationMs);
    this.handle = setTimeout(callback, durationMs);
  }

  cancel(): void {
    if (this.handle) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }

  remaining(): number {
    return Math.max(0, this._endsAt.getTime() - Date.now());
  }

  get endsAt(): Date {
    return this._endsAt;
  }
}
