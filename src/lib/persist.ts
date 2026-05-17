/**
 * localStorage-backed persistence of the user's last position and mode.
 * One key per concern so we can evolve the schema without invalidating
 * everything.
 */
import type { TypingMode } from "../engine/typing";

export type DictationMode = "sentence" | "passage";

const KEY_TRACK = "dictate.lastTrackId";
const KEY_SEGMENT = "dictate.lastSegmentIndex";
const KEY_MODE = "dictate.mode";
const KEY_DICTATION = "dictate.dictationMode";
const KEY_RATE = "dictate.rate";
const KEY_BLIND = "dictate.blind";
const KEY_HINTS = "dictate.hints";

const RATES = [0.5, 0.75, 1, 1.25];

export type PersistedPosition = {
  trackId: string | null;
  segmentIndex: number;
  mode: TypingMode;
  dictationMode: DictationMode;
  rate: number;
  /** 默写模式 — letters & digits hidden until typed correctly. */
  blind: boolean;
  /** When blind is on: also reveal 1–2 hint letters per word as a crutch. */
  hints: boolean;
};

export function loadPosition(): PersistedPosition {
  try {
    const trackId = localStorage.getItem(KEY_TRACK);
    const segmentIndex = Number(localStorage.getItem(KEY_SEGMENT) ?? "0");
    const modeRaw = localStorage.getItem(KEY_MODE);
    const mode: TypingMode = modeRaw === "lenient" ? "lenient" : "strict";
    const dictRaw = localStorage.getItem(KEY_DICTATION);
    const dictationMode: DictationMode = dictRaw === "passage" ? "passage" : "sentence";
    const rateRaw = Number(localStorage.getItem(KEY_RATE) ?? "1");
    const rate = RATES.includes(rateRaw) ? rateRaw : 1;
    const blind = localStorage.getItem(KEY_BLIND) === "1";
    const hints = localStorage.getItem(KEY_HINTS) === "1";
    return {
      trackId,
      segmentIndex: Number.isFinite(segmentIndex) ? Math.max(0, segmentIndex) : 0,
      mode,
      dictationMode,
      rate,
      blind,
      hints,
    };
  } catch {
    return {
      trackId: null,
      segmentIndex: 0,
      mode: "strict",
      dictationMode: "sentence",
      rate: 1,
      blind: false,
      hints: false,
    };
  }
}

export function savePosition(p: Partial<PersistedPosition>) {
  try {
    if (p.trackId !== undefined && p.trackId !== null)
      localStorage.setItem(KEY_TRACK, p.trackId);
    if (p.segmentIndex !== undefined)
      localStorage.setItem(KEY_SEGMENT, String(p.segmentIndex));
    if (p.mode !== undefined) localStorage.setItem(KEY_MODE, p.mode);
    if (p.dictationMode !== undefined)
      localStorage.setItem(KEY_DICTATION, p.dictationMode);
    if (p.rate !== undefined) localStorage.setItem(KEY_RATE, String(p.rate));
    if (p.blind !== undefined)
      localStorage.setItem(KEY_BLIND, p.blind ? "1" : "0");
    if (p.hints !== undefined)
      localStorage.setItem(KEY_HINTS, p.hints ? "1" : "0");
  } catch {
    // localStorage may throw in private mode or when full. Ignore.
  }
}
