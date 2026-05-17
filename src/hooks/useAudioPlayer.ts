import { useCallback, useEffect, useRef, useState } from "react";

type PlayOptions = {
  leadInSec?: number;
  tailSec?: number;
};

/**
 * Tiny audio player keyed on a URL. Handles segment playback with auto-stop,
 * replay, and clean cancellation when a new segment is requested mid-flight.
 *
 * Returned functions have stable identities (useCallback) so consumers can
 * pass them as effect deps without re-binding listeners on every render.
 */
export function useAudioPlayer(src: string | null, rate: number = 1) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const stopWatcherRef = useRef<(() => void) | null>(null);
  const pendingReadyRef = useRef<(() => void) | null>(null);
  const lastSegmentRef = useRef<{ start: number; end: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Lazy-create the element + attach lifecycle listeners exactly once.
  useEffect(() => {
    if (typeof Audio === "undefined") return;
    const el = new Audio();
    el.preload = "auto";
    const onPlaying = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    audioRef.current = el;
    return () => {
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.pause();
      el.removeAttribute("src");
      el.load();
      audioRef.current = null;
    };
  }, []);

  const clearStopTimer = () => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (stopWatcherRef.current) {
      stopWatcherRef.current();
      stopWatcherRef.current = null;
    }
  };

  // Any pending "wait for canplay/loadedmetadata" callback gets cancelled
  // here. We track it in a ref because the listeners reference each other.
  const clearPendingReady = () => {
    if (pendingReadyRef.current) {
      pendingReadyRef.current();
      pendingReadyRef.current = null;
    }
  };

  // Swap source when src changes. Cancels in-flight playback cleanly.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    clearStopTimer();
    clearPendingReady();
    if (src) {
      if (el.src !== src) {
        el.src = src;
        el.load();
      }
    } else {
      el.removeAttribute("src");
      el.load();
    }
  }, [src]);

  // Apply playback rate when it changes.
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = rate;
  }, [rate]);

  const stop = useCallback(() => {
    clearStopTimer();
    clearPendingReady();
    audioRef.current?.pause();
  }, []);

  const playSegment = useCallback(
    (startSec: number, endSec: number, opts: PlayOptions = {}) => {
      const el = audioRef.current;
      if (!el || !src) return;

      const leadIn = opts.leadInSec ?? 0;
      // Tiny tail (30 ms) prevents clipped consonants without bleeding
      // audibly into the next segment.
      const tail = opts.tailSec ?? 0.03;
      const from = Math.max(0, startSec - leadIn);
      const stopAt = endSec + tail;
      // Fallback wall-clock timeout (generous) in case timeupdate stalls.
      const fallbackMs =
        (Math.max(0, stopAt - from) / Math.max(0.1, rate)) * 1000 + 300;

      clearStopTimer();
      clearPendingReady();
      lastSegmentRef.current = { start: startSec, end: endSec };

      const begin = () => {
        el.currentTime = from;
        void el.play();
        // Primary: audio-clock driven. Fires within ~50 ms of crossing
        // stopAt — much tighter than setTimeout drift through long segments.
        const onTimeUpdate = () => {
          if (el.currentTime >= stopAt) {
            el.pause();
            clearStopTimer();
          }
        };
        el.addEventListener("timeupdate", onTimeUpdate);
        stopWatcherRef.current = () => {
          el.removeEventListener("timeupdate", onTimeUpdate);
        };
        // Belt-and-braces: if timeupdate stops firing (browser quirk),
        // setTimeout still cuts playback.
        stopTimerRef.current = window.setTimeout(() => {
          el.pause();
          clearStopTimer();
        }, fallbackMs);
      };

      if (el.readyState >= 2) {
        begin();
        return;
      }
      const onReady = () => {
        cleanup();
        begin();
      };
      const cleanup = () => {
        el.removeEventListener("loadedmetadata", onReady);
        el.removeEventListener("canplay", onReady);
        pendingReadyRef.current = null;
      };
      pendingReadyRef.current = cleanup;
      el.addEventListener("loadedmetadata", onReady);
      el.addEventListener("canplay", onReady);
    },
    [src, rate],
  );

  const replay = useCallback(() => {
    const last = lastSegmentRef.current;
    if (last) playSegment(last.start, last.end);
  }, [playSegment]);

  useEffect(
    () => () => {
      clearStopTimer();
      clearPendingReady();
    },
    [],
  );

  return { playSegment, replay, stop, isPlaying };
}
