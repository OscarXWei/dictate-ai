import { useEffect, useRef } from "react";
import type { TypingEngine } from "../engine/typing";

type Props = { engine: TypingEngine };

/**
 * Frosted-glass pill: gauge · check · A · clock.
 * RAF loop reads engine stats and writes directly to DOM to avoid 60 Hz
 * React re-renders.
 */
export function StatsPill({ engine }: Props) {
  const wpmRef = useRef<HTMLSpanElement>(null);
  const accRef = useRef<HTMLSpanElement>(null);
  const charsRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = engine.stats();
      if (wpmRef.current) wpmRef.current.textContent = `${Math.round(s.wpm)}`;
      if (accRef.current)
        accRef.current.textContent = `${Math.round(s.accuracy * 100)}%`;
      if (charsRef.current) charsRef.current.textContent = `${s.charsCorrect}`;
      if (timeRef.current)
        timeRef.current.textContent = `${Math.floor(s.elapsedMs / 1000)}s`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-4 py-2 font-mono text-xs text-[var(--color-text-dim)] shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-2xl backdrop-saturate-150">
      <Stat icon={<GaugeIcon />} suffix=" WPM">
        <span ref={wpmRef}>0</span>
      </Stat>
      <Divider />
      <Stat icon={<CheckIcon />}>
        <span ref={accRef}>100%</span>
      </Stat>
      <Divider />
      <Stat icon={<CharIcon />} suffix=" chars">
        <span ref={charsRef}>0</span>
      </Stat>
      <Divider />
      <Stat icon={<ClockIcon />}>
        <span ref={timeRef}>0s</span>
      </Stat>
    </div>
  );
}

function Stat({
  icon,
  suffix,
  children,
}: {
  icon: React.ReactNode;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="text-[var(--color-text-correct)] opacity-50">
        {icon}
      </span>
      <span className="text-[var(--color-text-correct)]">{children}</span>
      {suffix && (
        <span className="text-[10px] uppercase tracking-wider opacity-50">
          {suffix.trim()}
        </span>
      )}
    </span>
  );
}

function Divider() {
  return <span className="opacity-25">|</span>;
}

/* ── icons ────────────────────────────────────────────────────────────── */

const iconCls = "h-3.5 w-3.5";

function GaugeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconCls}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 8L11.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconCls}>
      <path
        d="M3.5 8.5L6.5 11.5L12.5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CharIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconCls}>
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <text
        x="8"
        y="11.2"
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        fill="currentColor"
        fontFamily="ui-monospace, monospace"
      >
        A
      </text>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={iconCls}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 4.5V8L10.5 9.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
