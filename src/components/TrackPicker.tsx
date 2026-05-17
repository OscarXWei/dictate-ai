import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "../data/types";

type Props = {
  tracks: Track[];
  open: boolean;
  currentTrackId: string;
  onSelect: (trackId: string) => void;
  onClose: () => void;
};

export function TrackPicker({
  tracks,
  open,
  currentTrackId,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter + group.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks
      .filter((t) => {
        if (!q) return true;
        return (
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.book.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.book === b.book) return a.id.localeCompare(b.id);
        return a.book.localeCompare(b.book);
      });
  }, [tracks, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const idx = tracks.findIndex((t) => t.id === currentTrackId);
      setFocused(Math.max(0, idx));
      // Focus the input next tick so the search filter starts clean.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, tracks, currentTrackId]);

  // Reset focused row when filter changes.
  useEffect(() => {
    setFocused(0);
  }, [query]);

  // Scroll the focused row into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-row="${focused}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((f) => Math.min(filtered.length - 1, f + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((f) => Math.max(0, f - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const t = filtered[focused];
        if (t) onSelect(t.id);
      }
    };
    // Capture phase so Esc/Enter never reach the App-level handlers below.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, filtered, focused, onSelect, onClose]);

  if (!open) return null;

  // Group filtered rows by book, but flat-index them so focus state lines up.
  const groups: { book: string; rows: { track: Track; index: number }[] }[] = [];
  let currentBook = "";
  filtered.forEach((t, i) => {
    if (t.book !== currentBook) {
      groups.push({ book: t.book, rows: [] });
      currentBook = t.book;
    }
    groups[groups.length - 1].rows.push({ track: t, index: i });
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      onMouseDown={(e) => {
        // Click backdrop closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
      <div className="relative flex w-[640px] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] font-mono text-sm text-[var(--color-text-correct)] shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center gap-2 border-b border-[var(--color-glass-border)] px-4 py-3">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-dim)]"
          />
          <kbd className="rounded border border-[var(--color-glass-border)] px-1.5 py-0.5 text-[10px] opacity-50">
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[55vh] overflow-y-auto py-1"
        >
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[var(--color-text-dim)]">
              No tracks match.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.book}>
              <div className="sticky top-0 z-10 bg-[var(--color-glass-bg)]/80 px-4 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] backdrop-blur-md">
                {g.book}
              </div>
              {g.rows.map(({ track, index }) => (
                <button
                  key={track.id}
                  data-row={index}
                  onMouseEnter={() => setFocused(index)}
                  onClick={() => onSelect(track.id)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left transition-colors ${
                    index === focused
                      ? "bg-[var(--color-glass-border)]/60"
                      : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {track.id === currentTrackId && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-cursor)] shadow-[0_0_6px_var(--color-cursor)]" />
                    )}
                    <span>{track.title}</span>
                  </span>
                  <span className="text-[10px] tabular-nums opacity-50">
                    {track.segments.length} seg · {Math.round(track.durationSec / 60)}m
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-glass-border)] px-4 py-2 text-[10px] text-[var(--color-text-dim)]">
          <span>{filtered.length} of {tracks.length} tracks</span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-[var(--color-glass-border)] px-1.5 py-0.5">↑↓</kbd>
            <span>navigate</span>
            <kbd className="rounded border border-[var(--color-glass-border)] px-1.5 py-0.5">↵</kbd>
            <span>select</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-[var(--color-text-dim)]">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
