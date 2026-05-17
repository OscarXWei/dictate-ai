import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TypingEngine, type TypingMode } from "./engine/typing";
import { TypingArea } from "./components/TypingArea";
import { StatsPill } from "./components/StatsPill";
import { Header } from "./components/Header";
import { Menu } from "./components/Menu";
import { AudioProgress } from "./components/AudioProgress";
import { TrackPicker } from "./components/TrackPicker";
import { HelpOverlay } from "./components/HelpOverlay";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { audioUrl } from "./lib/audioUrl";
import { loadPosition, savePosition, type DictationMode } from "./lib/persist";
import manifestData from "./data/manifest.json";
import type { Manifest } from "./data/types";

const manifest = manifestData as Manifest;
const tracks = manifest.tracks;

function App() {
  const persisted = useRef(loadPosition()).current;

  const [trackId, setTrackId] = useState<string>(() => {
    if (persisted.trackId && tracks.some((t) => t.id === persisted.trackId)) {
      return persisted.trackId;
    }
    return tracks[0]?.id ?? "";
  });
  const [segmentIndex, setSegmentIndex] = useState<number>(() => {
    const t = tracks.find((tr) => tr.id === persisted.trackId);
    if (t && persisted.segmentIndex < t.segments.length) {
      return persisted.segmentIndex;
    }
    return 0;
  });
  const [mode, setMode] = useState<TypingMode>(persisted.mode);
  const [dictationMode, setDictationMode] = useState<DictationMode>(
    persisted.dictationMode,
  );
  const [rate, setRate] = useState<number>(persisted.rate);
  const [blind, setBlind] = useState<boolean>(persisted.blind);
  const [restartNonce, setRestartNonce] = useState(0);
  const [segmentNonce, setSegmentNonce] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Single source of truth for the auto-advance timer. Cancelled whenever
  // next() or restart() fire from any path (Enter shortcut, menu, etc.) —
  // without this, manual advances race the timer and flash a sentence.
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const track = useMemo(
    () => tracks.find((t) => t.id === trackId) ?? tracks[0],
    [trackId],
  );
  const segment = track.segments[Math.min(segmentIndex, track.segments.length - 1)];

  // Dictation-mode-dependent target text + audio range.
  const target = useMemo(
    () =>
      dictationMode === "sentence"
        ? segment.text
        : track.segments.map((s) => s.text).join(" "),
    [dictationMode, segment.text, track],
  );

  const audioRange = useMemo(
    () =>
      dictationMode === "sentence"
        ? { start: segment.startSec, end: segment.endSec }
        : { start: 0, end: track.durationSec },
    [dictationMode, segment.startSec, segment.endSec, track.durationSec],
  );

  const engine = useMemo(
    () => new TypingEngine(target, mode),
    [target, mode, restartNonce],
  );

  const audioSrc = useMemo(() => audioUrl(track.audioFile), [track.audioFile]);
  const { playSegment, replay, stop, isPlaying } = useAudioPlayer(audioSrc, rate);

  const segmentDurationMs = Math.max(
    0,
    (audioRange.end - audioRange.start + 0.15) * 1000,
  );

  // Persist position whenever it changes.
  useEffect(() => {
    savePosition({ trackId, segmentIndex, mode, dictationMode, rate, blind });
  }, [trackId, segmentIndex, mode, dictationMode, rate, blind]);

  const next = useCallback(() => {
    clearAutoAdvance();
    stop();
    if (dictationMode === "passage") {
      // Advance to next track in the manifest order.
      const idx = tracks.findIndex((t) => t.id === trackId);
      const nextTrack = tracks[Math.min(idx + 1, tracks.length - 1)];
      setTrackId(nextTrack.id);
      setSegmentIndex(0);
      return;
    }
    setSegmentIndex((i) => Math.min(i + 1, track.segments.length - 1));
  }, [clearAutoAdvance, stop, dictationMode, trackId, track.segments.length]);

  const restart = useCallback(() => {
    clearAutoAdvance();
    stop();
    if (dictationMode === "passage") {
      // Restart entire passage.
      setSegmentIndex(0);
    }
    setRestartNonce((n) => n + 1);
  }, [clearAutoAdvance, stop, dictationMode]);

  // Clean up any pending advance on unmount.
  useEffect(() => () => clearAutoAdvance(), [clearAutoAdvance]);

  const replayAudio = useCallback(() => {
    replay();
    setSegmentNonce((n) => n + 1);
  }, [replay]);

  const selectTrack = useCallback(
    (id: string) => {
      stop();
      setTrackId(id);
      setSegmentIndex(0);
      setPickerOpen(false);
    },
    [stop],
  );

  // Auto-play audio whenever the target changes (segment / restart / track / mode swap).
  const lastTargetRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastTargetRef.current !== target || restartNonce > 0) {
      lastTargetRef.current = target;
      playSegment(audioRange.start, audioRange.end);
      setSegmentNonce((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, audioRange.start, audioRange.end, restartNonce]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPickerOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (pickerOpen) return;
      if (helpOpen) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key === "`") {
        e.preventDefault();
        setBlind((b) => !b);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        replayAudio();
      } else if (e.key === "Escape") {
        e.preventDefault();
        restart();
      } else if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, helpOpen, replayAudio, restart, next]);

  return (
    <main className="flex h-full flex-col">
      <Header
        book={track.book}
        trackTitle={track.title}
        segmentIndex={segmentIndex}
        segmentTotal={track.segments.length}
        dictationMode={dictationMode}
      />

      <section className="flex flex-1 items-center justify-center px-[clamp(2rem,8vw,6rem)]">
        <div className="w-full max-w-3xl">
          <div className="dt-textmask">
            <TypingArea
              engine={engine}
              scroll={dictationMode === "passage"}
              blind={blind}
              onComplete={() => {
                clearAutoAdvance();
                autoAdvanceTimerRef.current = window.setTimeout(() => {
                  autoAdvanceTimerRef.current = null;
                  next();
                }, 700);
              }}
            />
          </div>
          <AudioProgress
            isPlaying={isPlaying}
            durationMs={segmentDurationMs}
            segmentNonce={segmentNonce}
          />
        </div>
      </section>

      <footer className="relative flex shrink-0 items-center justify-center pb-10">
        <StatsPill engine={engine} />
        <div className="absolute bottom-10 right-6">
          <Menu
            mode={mode}
            dictationMode={dictationMode}
            rate={rate}
            blind={blind}
            onChangeMode={setMode}
            onChangeDictationMode={setDictationMode}
            onChangeRate={setRate}
            onToggleBlind={() => setBlind((b) => !b)}
            onRestart={restart}
            onNext={next}
            onReplay={replayAudio}
            onOpenPicker={() => setPickerOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
          />
        </div>
      </footer>

      <TrackPicker
        tracks={tracks}
        open={pickerOpen}
        currentTrackId={trackId}
        onSelect={selectTrack}
        onClose={() => setPickerOpen(false)}
      />

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}

export default App;
