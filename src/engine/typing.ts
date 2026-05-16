/**
 * Pure typing engine. No React, no DOM. Mutable for keystroke performance.
 *
 * Two modes:
 *   "strict"  — wrong char does NOT advance; user must keep trying. Best for
 *               pedagogical dictation.
 *   "lenient" — wrong char advances anyway, marked incorrect. Best for shadow
 *               typing where the audio is the pacemaker (ProTypist feel).
 */

export type CharStatus = "untyped" | "correct" | "incorrect";
export type TypingMode = "strict" | "lenient";

export type Stats = {
  wpm: number;
  accuracy: number; // 0..1
  charsCorrect: number;
  charsTotal: number;
  charsRemaining: number;
  elapsedMs: number;
  isComplete: boolean;
};

/**
 * Normalize text so typing on a US/UK keyboard always matches. Whisper output
 * is ASCII-clean in practice, but be defensive about smart-quotes / dashes /
 * NBSP / ellipsis that might slip in from copy-pasted text.
 */
export function normalizeTarget(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class TypingEngine {
  readonly target: string;
  readonly mode: TypingMode;
  readonly statuses: CharStatus[];

  cursor = 0;
  totalKeystrokes = 0;
  correctKeystrokes = 0;
  startedAt: number | null = null;
  finishedAt: number | null = null;

  constructor(target: string, mode: TypingMode = "strict") {
    this.target = normalizeTarget(target);
    this.mode = mode;
    this.statuses = new Array(this.target.length).fill("untyped");
  }

  get isComplete(): boolean {
    return this.target.length > 0 && this.cursor >= this.target.length;
  }

  /** Type one character. Returns the index whose status changed, or -1 if
   *  nothing happened (e.g. typing past the end). Idempotent on complete. */
  typeChar(ch: string, nowMs: number = Date.now()): number {
    if (this.isComplete) return -1;
    if (ch.length !== 1) return -1;

    if (this.startedAt === null) this.startedAt = nowMs;

    const expected = this.target[this.cursor];
    const correct = ch === expected;
    const idx = this.cursor;
    this.totalKeystrokes++;

    if (correct) {
      this.correctKeystrokes++;
      this.statuses[idx] = "correct";
      this.cursor++;
      if (this.cursor >= this.target.length) this.finishedAt = nowMs;
      return idx;
    }

    // wrong char
    this.statuses[idx] = "incorrect";
    if (this.mode === "lenient") {
      this.cursor++;
      if (this.cursor >= this.target.length) this.finishedAt = nowMs;
    }
    return idx;
  }

  /** Backspace one char. Returns the index whose status changed, or -1.
   *
   *  In strict mode, a wrong keystroke marks the *current* cursor position
   *  as "incorrect" without advancing. The first backspace should clear that
   *  flag in place; only a second backspace should move the cursor back. */
  backspace(): number {
    if (this.isComplete) return -1;
    if (
      this.mode === "strict" &&
      this.cursor < this.target.length &&
      this.statuses[this.cursor] === "incorrect"
    ) {
      this.statuses[this.cursor] = "untyped";
      return this.cursor;
    }
    if (this.cursor === 0) return -1;
    this.cursor--;
    this.statuses[this.cursor] = "untyped";
    return this.cursor;
  }

  reset(): void {
    this.cursor = 0;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.startedAt = null;
    this.finishedAt = null;
    for (let i = 0; i < this.statuses.length; i++) {
      this.statuses[i] = "untyped";
    }
  }

  stats(nowMs: number = Date.now()): Stats {
    const endedAt = this.finishedAt ?? nowMs;
    const elapsedMs = this.startedAt === null ? 0 : Math.max(0, endedAt - this.startedAt);
    const minutes = elapsedMs / 60_000;
    const wpm = minutes > 0 ? this.correctKeystrokes / 5 / minutes : 0;
    const accuracy =
      this.totalKeystrokes === 0
        ? 1
        : this.correctKeystrokes / this.totalKeystrokes;
    return {
      wpm,
      accuracy,
      charsCorrect: this.correctKeystrokes,
      charsTotal: this.totalKeystrokes,
      charsRemaining: this.target.length - this.cursor,
      elapsedMs,
      isComplete: this.isComplete,
    };
  }
}
