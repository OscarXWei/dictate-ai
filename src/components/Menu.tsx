import { useEffect, useRef, useState } from "react";
import type { TypingMode } from "../engine/typing";

type Props = {
  mode: TypingMode;
  onChangeMode: (m: TypingMode) => void;
  onRestart: () => void;
  onNext: () => void;
  onReplay: () => void;
};

export function Menu({ mode, onChangeMode, onRestart, onNext, onReplay }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open menu"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] text-[var(--color-text-correct)] opacity-60 backdrop-blur-md transition-opacity hover:opacity-100"
      >
        <DotsIcon />
      </button>

      {open && (
        <div className="absolute bottom-10 right-0 w-56 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-1.5 font-mono text-xs text-[var(--color-text-correct)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl backdrop-saturate-150">
          <MenuItem onClick={() => { onReplay(); setOpen(false); }} shortcut="tab">
            Replay audio
          </MenuItem>
          <MenuItem onClick={() => { onRestart(); setOpen(false); }} shortcut="esc">
            Restart segment
          </MenuItem>
          <MenuItem onClick={() => { onNext(); setOpen(false); }} shortcut="↵">
            Skip to next
          </MenuItem>
          <Separator />
          <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider opacity-50">
            Mode
          </div>
          <ModeRow
            active={mode === "strict"}
            label="Strict"
            description="block on errors"
            onClick={() => onChangeMode("strict")}
          />
          <ModeRow
            active={mode === "lenient"}
            label="Lenient"
            description="type through errors"
            onClick={() => onChangeMode("lenient")}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  shortcut,
  onClick,
}: {
  children: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--color-glass-border)]/50"
    >
      <span>{children}</span>
      {shortcut && (
        <kbd className="rounded border border-[var(--color-glass-border)] px-1.5 py-0.5 text-[10px] opacity-50">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-[var(--color-glass-border)]" />;
}

function ModeRow({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--color-glass-border)]/50"
    >
      <span className="flex flex-col">
        <span>{label}</span>
        <span className="text-[10px] opacity-50">{description}</span>
      </span>
      <span
        className={
          active
            ? "h-1.5 w-1.5 rounded-full bg-[var(--color-cursor)] shadow-[0_0_6px_var(--color-cursor)]"
            : "h-1.5 w-1.5 rounded-full bg-[var(--color-glass-border)]"
        }
      />
    </button>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  );
}
