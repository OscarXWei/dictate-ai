import { useEffect, useRef, useState } from "react";
import type { TypingMode } from "../engine/typing";
import type { DictationMode } from "../lib/persist";

type Props = {
  mode: TypingMode;
  dictationMode: DictationMode;
  rate: number;
  onChangeMode: (m: TypingMode) => void;
  onChangeDictationMode: (d: DictationMode) => void;
  onChangeRate: (r: number) => void;
  onRestart: () => void;
  onNext: () => void;
  onReplay: () => void;
  onOpenPicker: () => void;
  onOpenHelp: () => void;
};

const RATES = [0.5, 0.75, 1, 1.25];

export function Menu({
  mode,
  dictationMode,
  rate,
  onChangeMode,
  onChangeDictationMode,
  onChangeRate,
  onRestart,
  onNext,
  onReplay,
  onOpenPicker,
  onOpenHelp,
}: Props) {
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
        <div className="absolute bottom-10 right-0 w-60 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-1.5 font-mono text-xs text-[var(--color-text-correct)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl backdrop-saturate-150">
          <MenuItem
            onClick={() => { onOpenPicker(); setOpen(false); }}
            shortcut="⌘K"
          >
            Browse tracks
          </MenuItem>
          <Separator />
          <MenuItem onClick={() => { onReplay(); setOpen(false); }} shortcut="tab">
            Replay audio
          </MenuItem>
          <MenuItem onClick={() => { onRestart(); setOpen(false); }} shortcut="esc">
            {dictationMode === "passage" ? "Restart passage" : "Restart segment"}
          </MenuItem>
          <MenuItem onClick={() => { onNext(); setOpen(false); }} shortcut="↵">
            {dictationMode === "passage" ? "Next track" : "Skip to next"}
          </MenuItem>

          <Separator />
          <SectionLabel>Speed</SectionLabel>
          <div className="flex gap-1 px-2 py-1">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => onChangeRate(r)}
                className={
                  "flex-1 rounded-md py-1 text-[11px] tabular-nums transition-colors " +
                  (r === rate
                    ? "bg-[var(--color-cursor)]/30 text-[var(--color-text-correct)]"
                    : "opacity-60 hover:bg-[var(--color-glass-border)]/50 hover:opacity-100")
                }
              >
                {r}×
              </button>
            ))}
          </div>

          <Separator />
          <SectionLabel>Dictation</SectionLabel>
          <ModeRow
            active={dictationMode === "sentence"}
            label="Sentence"
            description="one at a time"
            onClick={() => onChangeDictationMode("sentence")}
          />
          <ModeRow
            active={dictationMode === "passage"}
            label="Passage"
            description="whole track, shadow"
            onClick={() => onChangeDictationMode("passage")}
          />

          <Separator />
          <SectionLabel>Typing</SectionLabel>
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

          <Separator />
          <MenuItem
            onClick={() => { onOpenHelp(); setOpen(false); }}
            shortcut="?"
          >
            Keyboard shortcuts
          </MenuItem>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider opacity-50">
      {children}
    </div>
  );
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
