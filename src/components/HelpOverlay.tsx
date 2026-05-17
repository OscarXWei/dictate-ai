import { useEffect } from "react";

type Props = { open: boolean; onClose: () => void };

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Tab", label: "Replay current audio" },
  { keys: "Esc", label: "Restart segment / passage" },
  { keys: "↵", label: "Skip to next segment / track" },
  { keys: "⌘K", label: "Browse all tracks" },
  { keys: "?", label: "Show this help" },
  { keys: "···", label: "默写 mode — hide letters until typed (in menu)" },
  { keys: "Type", label: "Start a session — the timer begins on first keystroke" },
];

export function HelpOverlay({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/15 backdrop-blur-sm" />
      <div className="relative w-[460px] max-w-[90vw] rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-5 font-mono text-sm text-[var(--color-text-correct)] shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider opacity-50">
            Shortcuts
          </span>
          <kbd className="rounded border border-[var(--color-glass-border)] px-1.5 py-0.5 text-[10px] opacity-50">
            esc
          </kbd>
        </div>
        <div className="flex flex-col gap-2.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between rounded-lg px-1"
            >
              <span className="text-xs opacity-80">{s.label}</span>
              <kbd className="rounded border border-[var(--color-glass-border)] bg-[var(--color-glass-border)]/30 px-2 py-0.5 text-[11px] tabular-nums">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
