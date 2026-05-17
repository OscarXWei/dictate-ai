import { useEffect, useMemo, useRef } from "react";
import type { TypingEngine } from "../engine/typing";

type Props = {
  engine: TypingEngine;
  /** When true (passage mode), cap the height and auto-scroll the cursor
   *  into view as it advances. Default false (sentence mode). */
  scroll?: boolean;
  /** 默写模式 — hide letters & digits behind underscores until typed
   *  correctly. Spaces and punctuation stay visible as a skeleton. */
  blind?: boolean;
  onComplete?: () => void;
};

/** Chars that stay visible in blind mode (spaces, punctuation, etc.). */
const ALWAYS_VISIBLE = /[^A-Za-z0-9]/;

/**
 * For blind mode: precompute which letter positions get revealed as hints.
 * Deterministic per (target, position) so the same word reveals the same
 * letters every time — no jarring shuffles on restart.
 *
 * Reveal rate:
 *   1–2 letter "words": no hints (too short to bother).
 *   3–5 letters:        1 hint.
 *   6+ letters:         2 hints.
 */
function buildHintMask(target: string): boolean[] {
  const mask = new Array(target.length).fill(false);
  let wordStart = -1;
  const flushWord = (end: number) => {
    if (wordStart < 0) return;
    const len = end - wordStart;
    const n = len >= 6 ? 2 : len >= 3 ? 1 : 0;
    if (n === 0) {
      wordStart = -1;
      return;
    }
    // 32-bit string hash
    let h = 5381;
    for (let i = wordStart; i < end; i++) {
      h = ((h * 33) ^ target.charCodeAt(i)) | 0;
    }
    h = Math.abs(h);
    const picked = new Set<number>();
    for (let i = 0; i < n; i++) {
      const offset = (h + i * 7) % len;
      picked.add(offset);
    }
    for (const off of picked) mask[wordStart + off] = true;
    wordStart = -1;
  };
  for (let i = 0; i <= target.length; i++) {
    const isLetter = i < target.length && /[A-Za-z0-9]/.test(target[i]);
    if (isLetter && wordStart < 0) wordStart = i;
    else if (!isLetter && wordStart >= 0) flushWord(i);
  }
  return mask;
}

/**
 * Renders the target text as one <span> per character, with an absolutely
 * positioned cursor that glides via CSS transition.
 *
 * Updates happen via imperative DOM writes keyed on the index returned by the
 * engine — React doesn't re-render on keystrokes.
 */
export function TypingArea({ engine, scroll = false, blind = false, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);
  const lastEngineRef = useRef<TypingEngine | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  /** Latches once per engine so onComplete fires exactly once even if more
   *  keystrokes arrive after the last char is typed. Without this, extra
   *  keys queue additional setTimeouts → advances skip past segments. */
  const completeFiredRef = useRef(false);

  // Reset the char-span array on engine change, BEFORE the ref callbacks below
  // run during this render — otherwise stale spans from a previous longer
  // target would linger at the high indices.
  if (lastEngineRef.current !== engine) {
    charsRef.current = new Array(engine.target.length);
    lastEngineRef.current = engine;
  }

  const moveCursor = (index: number) => {
    const container = containerRef.current;
    const cursor = cursorRef.current;
    if (!container || !cursor) return;

    // We compute positions in *scroll space* (offsetParent-relative), not
    // viewport-relative, so the cursor stays aligned with its target span
    // when the container is scrolled.
    const cRect = container.getBoundingClientRect();
    const scrollY = container.scrollTop;
    const scrollX = container.scrollLeft;
    let activeSpan: HTMLSpanElement | null = null;
    let left: number;
    let top: number;
    let height: number;

    if (index < charsRef.current.length) {
      const span = charsRef.current[index];
      if (!span) return;
      activeSpan = span;
      const r = span.getBoundingClientRect();
      left = r.left - cRect.left + scrollX;
      top = r.top - cRect.top + scrollY;
      height = r.height;
    } else {
      const last = charsRef.current[charsRef.current.length - 1];
      if (!last) return;
      activeSpan = last;
      const r = last.getBoundingClientRect();
      left = r.right - cRect.left + scrollX;
      top = r.top - cRect.top + scrollY;
      height = r.height;
    }

    cursor.style.transform = `translate(${left}px, ${top}px)`;
    cursor.style.height = `${height}px`;

    // Passage mode: keep the active char in view.
    if (scroll && activeSpan) {
      activeSpan.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  useEffect(() => {
    completeFiredRef.current = false;
    const cursor = cursorRef.current;
    if (cursor) cursor.dataset.snap = "1";
    requestAnimationFrame(() => {
      moveCursor(0);
      // Re-enable the gliding transition on the very next frame.
      requestAnimationFrame(() => {
        if (cursor) cursor.dataset.snap = "0";
      });
    });
  }, [engine]);

  useEffect(() => {
    const ro = new ResizeObserver(() => moveCursor(engine.cursor));
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [engine]);

  // Blind toggle shifts every char's x-position (letter-spacing kicks in /
  // out), but doesn't fire a keystroke — re-measure the cursor.
  useEffect(() => {
    requestAnimationFrame(() => moveCursor(engine.cursor));
  }, [blind, engine]);

  // Precompute the per-position hint mask whenever the target changes.
  const hintMask = useMemo(() => buildHintMask(engine.target), [engine.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Backtick is reserved as the global blind-mode toggle — App owns it.
      if (e.key === "`") return;

      let changedIdx = -1;
      let typedKey: string | null = null;
      if (e.key === "Backspace") {
        e.preventDefault();
        changedIdx = engine.backspace();
      } else if (e.key.length === 1) {
        e.preventDefault();
        typedKey = e.key;
        changedIdx = engine.typeChar(e.key);
      } else {
        return;
      }

      if (changedIdx >= 0) {
        const span = charsRef.current[changedIdx];
        if (span) {
          span.dataset.status = engine.statuses[changedIdx];
          // In blind mode, render the position based on its new status:
          //   correct   → reveal the target letter
          //   incorrect → show what the user TYPED (not the target). This
          //               respects "don't cover my input" — they need to
          //               see their own typo to recognise it.
          //   untyped   → re-hide unless it's a hint position
          if (blind) {
            const ch = engine.target[changedIdx];
            const status = engine.statuses[changedIdx];
            let display: string;
            if (status === "correct") display = ch;
            else if (status === "incorrect") display = typedKey ?? ch;
            else
              display =
                ALWAYS_VISIBLE.test(ch) || hintMask[changedIdx] ? ch : "_";
            span.textContent = display;
          }
        }
      }
      moveCursor(engine.cursor);

      const cursor = cursorRef.current;
      if (cursor) {
        cursor.dataset.typing = "1";
        if (typingTimeoutRef.current !== null) {
          window.clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = window.setTimeout(() => {
          cursor.dataset.typing = "0";
        }, 250);
      }

      if (engine.isComplete && !completeFiredRef.current) {
        completeFiredRef.current = true;
        onCompleteRef.current?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [engine]);

  // Group consecutive non-space chars into "word" spans (inline-block) so
  // words wrap as a unit and the line never breaks mid-word. Spaces are
  // siblings between words, giving the browser valid break opportunities.
  // The flat per-char index that the engine uses is preserved in charsRef.
  const chars = Array.from(engine.target);
  const groups: { startIndex: number; isSpace: boolean; length: number }[] = [];
  for (let i = 0; i < chars.length; ) {
    const isSpace = chars[i] === " ";
    let j = i;
    while (j < chars.length && (chars[j] === " ") === isSpace) j++;
    groups.push({ startIndex: i, isSpace, length: j - i });
    i = j;
  }

  const renderChar = (flat: number, ch: string, isSpace: boolean) => {
    const isLetter = !isSpace && !ALWAYS_VISIBLE.test(ch);
    const isHint = blind && isLetter && hintMask[flat];
    const isMasked = blind && isLetter && !hintMask[flat];
    const display = isSpace ? " " : isMasked ? "_" : ch;
    return (
      <span
        key={flat}
        ref={(el) => {
          if (el) charsRef.current[flat] = el;
        }}
        className="dt-char"
        data-status="untyped"
        data-space={isSpace ? "1" : "0"}
        data-blind={isMasked ? "1" : "0"}
        data-hint={isHint ? "1" : "0"}
      >
        {display}
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      data-blind={blind ? "1" : "0"}
      className={
        "dt-typing-area relative font-mono leading-[1.55] tracking-tight text-[var(--color-text-dim)]" +
        (scroll
          ? " max-h-[60vh] overflow-y-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "")
      }
      style={{ fontSize: "clamp(1.5rem, 3.2vw, 2.25rem)" }}
    >
      <span
        ref={cursorRef}
        className="dt-cursor"
        data-typing="0"
        aria-hidden="true"
      />
      {groups.map((g, gi) => {
        if (g.isSpace) {
          const out = [];
          for (let k = 0; k < g.length; k++) {
            out.push(renderChar(g.startIndex + k, " ", true));
          }
          return out;
        }
        const wordChars = [];
        for (let k = 0; k < g.length; k++) {
          const flat = g.startIndex + k;
          wordChars.push(renderChar(flat, chars[flat], false));
        }
        return (
          <span key={`w-${gi}`} className="inline-block whitespace-nowrap">
            {wordChars}
          </span>
        );
      })}
    </div>
  );
}
