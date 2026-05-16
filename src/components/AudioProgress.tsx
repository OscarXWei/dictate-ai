import { useEffect, useRef } from "react";

type Props = {
  isPlaying: boolean;
  /** Total ms the current segment is expected to play for. Used to animate
   *  the bar width — independent of the audio element's currentTime so we
   *  don't bind a 60 Hz reader to it. */
  durationMs: number;
  /** Bumped by the parent every time a new playSegment fires, so the bar
   *  resets even when the duration happens to match the previous one. */
  segmentNonce: number;
};

export function AudioProgress({ isPlaying, durationMs, segmentNonce }: Props) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;

    if (isPlaying) {
      // Reset instantly to 0, then animate to 100% over durationMs.
      fill.style.transition = "none";
      fill.style.transform = "scaleX(0)";
      fill.style.opacity = "1";
      // Force a layout flush so the next transition takes effect.
      void fill.offsetWidth;
      fill.style.transition = `transform ${durationMs}ms linear, opacity 250ms ease-out 0ms`;
      fill.style.transform = "scaleX(1)";
    } else {
      // Fade out the bar; keep its width so the user sees where it stopped.
      fill.style.transition = "opacity 300ms ease-out";
      fill.style.opacity = "0";
    }
  }, [isPlaying, durationMs, segmentNonce]);

  return (
    <div className="relative mt-6 h-[2px] w-full overflow-hidden rounded-full bg-[var(--color-glass-border)]/40">
      <div
        ref={fillRef}
        className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--color-cursor)]"
        style={{
          transform: "scaleX(0)",
          opacity: 0,
          boxShadow: "0 0 8px var(--color-cursor)",
        }}
      />
    </div>
  );
}
