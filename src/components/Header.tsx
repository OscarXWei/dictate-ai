import type { DictationMode } from "../lib/persist";

type Props = {
  book: string;
  trackTitle: string;
  segmentIndex: number;
  segmentTotal: number;
  dictationMode: DictationMode;
};

export function Header({
  book,
  trackTitle,
  segmentIndex,
  segmentTotal,
  dictationMode,
}: Props) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center justify-center pl-20 pr-6 font-mono text-[11px] text-[var(--color-text-dim)]"
    >
      <div className="flex items-center gap-2 tracking-wide tabular-nums">
        <span className="opacity-80">{book}</span>
        <Dot />
        <span className="opacity-80">{trackTitle}</span>
        <Dot />
        {dictationMode === "passage" ? (
          <span className="text-[var(--color-cursor)] opacity-80">passage</span>
        ) : (
          <span className="text-[var(--color-text-correct)] opacity-70">
            {segmentIndex + 1} / {segmentTotal}
          </span>
        )}
      </div>
    </header>
  );
}

function Dot() {
  return <span className="opacity-30">·</span>;
}
