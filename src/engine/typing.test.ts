import { describe, it, expect } from "vitest";
import { TypingEngine, normalizeTarget } from "./typing";

const typeAll = (e: TypingEngine, s: string, t = 0) => {
  let cur = t;
  for (const ch of s) {
    e.typeChar(ch, cur);
    cur += 50;
  }
  return cur;
};

describe("normalizeTarget", () => {
  it("rewrites curly quotes, dashes, ellipses, NBSP", () => {
    expect(normalizeTarget("He said “hi” — it’s fine…")).toBe(
      'He said "hi" - it\'s fine...',
    );
    expect(normalizeTarget("a b")).toBe("a b");
  });
  it("collapses whitespace and trims", () => {
    expect(normalizeTarget("  a  b\t\nc  ")).toBe("a b c");
  });
});

describe("TypingEngine — strict mode (default)", () => {
  it("starts in clean state", () => {
    const e = new TypingEngine("hello");
    expect(e.cursor).toBe(0);
    expect(e.isComplete).toBe(false);
    expect(e.statuses).toEqual(Array(5).fill("untyped"));
    expect(e.stats(0).accuracy).toBe(1);
    expect(e.stats(0).wpm).toBe(0);
  });

  it("advances on correct chars and completes", () => {
    const e = new TypingEngine("hi");
    expect(e.typeChar("h", 0)).toBe(0);
    expect(e.cursor).toBe(1);
    expect(e.statuses[0]).toBe("correct");
    expect(e.isComplete).toBe(false);
    expect(e.typeChar("i", 50)).toBe(1);
    expect(e.isComplete).toBe(true);
    expect(e.cursor).toBe(2);
    expect(e.finishedAt).toBe(50);
  });

  it("does NOT advance on wrong char; flags incorrect", () => {
    const e = new TypingEngine("hi");
    expect(e.typeChar("x", 0)).toBe(0);
    expect(e.cursor).toBe(0);
    expect(e.statuses[0]).toBe("incorrect");
    expect(e.totalKeystrokes).toBe(1);
    expect(e.correctKeystrokes).toBe(0);
  });

  it("typing correct char after wrong recovers position", () => {
    const e = new TypingEngine("hi");
    e.typeChar("x", 0);
    e.typeChar("h", 50);
    expect(e.cursor).toBe(1);
    expect(e.statuses[0]).toBe("correct");
  });

  it("ignores keystrokes after completion", () => {
    const e = new TypingEngine("a");
    e.typeChar("a", 0);
    expect(e.typeChar("b", 50)).toBe(-1);
    expect(e.totalKeystrokes).toBe(1);
  });

  it("rejects multi-char input", () => {
    const e = new TypingEngine("abc");
    expect(e.typeChar("ab", 0)).toBe(-1);
    expect(e.cursor).toBe(0);
    expect(e.totalKeystrokes).toBe(0);
  });

  it("backspace decrements and clears status", () => {
    const e = new TypingEngine("abc");
    e.typeChar("a", 0);
    e.typeChar("b", 50);
    expect(e.cursor).toBe(2);
    expect(e.backspace()).toBe(1);
    expect(e.statuses[1]).toBe("untyped");
    expect(e.cursor).toBe(1);
  });

  it("backspace at position 0 with incorrect clears it", () => {
    const e = new TypingEngine("a");
    e.typeChar("x", 0);
    expect(e.statuses[0]).toBe("incorrect");
    expect(e.backspace()).toBe(0);
    expect(e.statuses[0]).toBe("untyped");
  });

  it("backspace at position 0 with no error is no-op", () => {
    const e = new TypingEngine("a");
    expect(e.backspace()).toBe(-1);
  });

  it("backspace after mistype clears the red marker without moving cursor", () => {
    // Regression: "Are " typed correctly, then 'x' wrong (expected 'y'),
    // then backspace. Cursor must stay at position 4 (still expecting 'y'),
    // and statuses[4] must become 'untyped'.
    const e = new TypingEngine("Are you");
    "Are ".split("").forEach((c, i) => e.typeChar(c, i * 50));
    expect(e.cursor).toBe(4);
    e.typeChar("x", 250);
    expect(e.cursor).toBe(4);
    expect(e.statuses[4]).toBe("incorrect");
    expect(e.backspace()).toBe(4);
    expect(e.cursor).toBe(4);
    expect(e.statuses[4]).toBe("untyped");
    expect(e.statuses[3]).toBe("correct"); // the space is still correct
    e.typeChar("y", 300);
    expect(e.cursor).toBe(5);
    expect(e.statuses[4]).toBe("correct");
  });

  it("second backspace after clearing red moves cursor back", () => {
    const e = new TypingEngine("ab");
    e.typeChar("a", 0);
    e.typeChar("x", 50); // wrong at index 1
    e.backspace(); // first: clear red at index 1
    expect(e.cursor).toBe(1);
    expect(e.statuses[1]).toBe("untyped");
    e.backspace(); // second: move back to index 0
    expect(e.cursor).toBe(0);
    expect(e.statuses[0]).toBe("untyped");
  });
});

describe("TypingEngine — lenient mode", () => {
  it("advances even on wrong char and marks incorrect", () => {
    const e = new TypingEngine("hi", "lenient");
    e.typeChar("x", 0);
    expect(e.cursor).toBe(1);
    expect(e.statuses[0]).toBe("incorrect");
    e.typeChar("i", 50);
    expect(e.cursor).toBe(2);
    expect(e.isComplete).toBe(true);
    expect(e.statuses).toEqual(["incorrect", "correct"]);
  });
});

describe("TypingEngine — stats", () => {
  it("wpm uses 5-char-per-word convention against correct chars", () => {
    const e = new TypingEngine("aaaaaaaaaa"); // 10 chars
    typeAll(e, "aaaaaaaaaa", 0); // last keystroke at t = 450ms (9 increments of 50)
    // elapsedMs = finishedAt - startedAt = 450 - 0 = 450ms = 0.0075 min
    // wpm = 10/5 / 0.0075 = 266.67
    const s = e.stats(1000);
    expect(s.wpm).toBeCloseTo(266.67, 1);
    expect(s.accuracy).toBe(1);
    expect(s.isComplete).toBe(true);
  });

  it("accuracy = correct / total keystrokes (strict)", () => {
    const e = new TypingEngine("ab");
    e.typeChar("a", 0); // correct
    e.typeChar("x", 50); // wrong, stays
    e.typeChar("b", 100); // correct
    expect(e.stats(200).accuracy).toBeCloseTo(2 / 3);
  });

  it("elapsedMs is from first keystroke, not from construction", () => {
    const e = new TypingEngine("ab");
    e.typeChar("a", 1000); // starts here
    const s = e.stats(2000);
    expect(s.elapsedMs).toBe(1000);
  });

  it("isComplete reflected in stats", () => {
    const e = new TypingEngine("a");
    expect(e.stats(0).isComplete).toBe(false);
    e.typeChar("a", 50);
    expect(e.stats(100).isComplete).toBe(true);
  });
});

describe("TypingEngine — reset", () => {
  it("clears everything to fresh state", () => {
    const e = new TypingEngine("hi");
    e.typeChar("h", 0);
    e.typeChar("x", 50);
    e.reset();
    expect(e.cursor).toBe(0);
    expect(e.totalKeystrokes).toBe(0);
    expect(e.correctKeystrokes).toBe(0);
    expect(e.startedAt).toBeNull();
    expect(e.finishedAt).toBeNull();
    expect(e.statuses).toEqual(["untyped", "untyped"]);
  });
});

describe("TypingEngine — typedChars tracking", () => {
  it("records what the user typed at each position", () => {
    const e = new TypingEngine("ab", "lenient");
    e.typeChar("a", 0);
    e.typeChar("Z", 50);
    expect(e.typedChars).toEqual(["a", "Z"]);
    expect(e.statuses).toEqual(["correct", "incorrect"]);
  });
  it("clears typedChars on backspace", () => {
    const e = new TypingEngine("abc");
    e.typeChar("a", 0);
    e.typeChar("b", 50);
    e.backspace();
    expect(e.typedChars).toEqual(["a", null, null]);
    e.backspace();
    expect(e.typedChars).toEqual([null, null, null]);
  });
  it("reset wipes typedChars", () => {
    const e = new TypingEngine("ab");
    e.typeChar("a", 0);
    e.typeChar("X", 50);
    e.reset();
    expect(e.typedChars).toEqual([null, null]);
  });
});

describe("TypingEngine — real IELTS sentence", () => {
  it("types a Whisper-produced sentence cleanly", () => {
    const sentence = "Are you the right person to talk to about the Buckworth Conservation Group?";
    const e = new TypingEngine(sentence);
    typeAll(e, sentence, 0);
    expect(e.isComplete).toBe(true);
    expect(e.stats(0).accuracy).toBe(1);
  });
});
