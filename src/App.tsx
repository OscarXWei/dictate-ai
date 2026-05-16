import { useEffect, useMemo, useRef, useState } from "react";
import { TypingEngine, type TypingMode } from "./engine/typing";
import { TypingArea } from "./components/TypingArea";
import { StatsPill } from "./components/StatsPill";
import { Header } from "./components/Header";
import { Menu } from "./components/Menu";
import { AudioProgress } from "./components/AudioProgress";
import { useAudioPlayer } from "./hooks/useAudioPlayer";

// Phase-4/5 demo wiring. Phase 6 will replace this with the full
// manifest-driven track picker.
const DEMO = {
  book: "Cambridge IELTS 17",
  trackTitle: "Test 1 · Part 1",
  audioFile: "C17-T1-P1.mp3",
  segments: [
    { startSec: 90.0, endSec: 90.68, text: "Hello." },
    { startSec: 90.68, endSec: 91.66, text: "Oh hello." },
    { startSec: 91.66, endSec: 92.65, text: "My name's Jan." },
    {
      startSec: 92.65,
      endSec: 98.07,
      text: "Are you the right person to talk to about the Buckworth Conservation Group?",
    },
    { startSec: 98.07, endSec: 99.39, text: "Yes, I'm Peter." },
    { startSec: 99.39, endSec: 100.88, text: "I'm the Secretary." },
    {
      startSec: 101.54,
      endSec: 106.36,
      text: "I've just moved to this area and I'm interested in getting involved.",
    },
  ],
};

function App() {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<TypingMode>("strict");
  const [restartNonce, setRestartNonce] = useState(0);
  const [segmentNonce, setSegmentNonce] = useState(0);
  const segment = DEMO.segments[index];

  const engine = useMemo(
    () => new TypingEngine(segment.text, mode),
    [segment.text, mode, restartNonce],
  );

  const audioSrc = `/audio/${encodeURIComponent(DEMO.audioFile)}`;
  const { playSegment, replay, stop, isPlaying } = useAudioPlayer(audioSrc);

  const segmentDurationMs = Math.max(
    0,
    (segment.endSec - segment.startSec + 0.15) * 1000,
  );

  const next = () => {
    stop();
    setIndex((i) => (i + 1) % DEMO.segments.length);
  };
  const restart = () => {
    stop();
    setRestartNonce((n) => n + 1);
  };
  const replayAudio = () => {
    replay();
    setSegmentNonce((n) => n + 1);
  };

  // Auto-play segment audio whenever it changes (next / restart).
  const lastSegmentRef = useRef<typeof segment | null>(null);
  useEffect(() => {
    if (lastSegmentRef.current !== segment || restartNonce > 0) {
      lastSegmentRef.current = segment;
      playSegment(segment.startSec, segment.endSec);
      setSegmentNonce((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, restartNonce]);

  // Keyboard shortcuts: Tab (replay), Esc (restart), Enter (skip ahead).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  return (
    <main className="flex h-full flex-col">
      <Header
        book={DEMO.book}
        trackTitle={DEMO.trackTitle}
        segmentIndex={index}
        segmentTotal={DEMO.segments.length}
      />

      <section className="flex flex-1 items-center justify-center px-[clamp(2rem,8vw,6rem)]">
        <div className="w-full max-w-3xl">
          <div className="dt-textmask">
            <TypingArea
              engine={engine}
              onComplete={() => window.setTimeout(next, 700)}
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
            onChangeMode={setMode}
            onRestart={restart}
            onNext={next}
            onReplay={replayAudio}
          />
        </div>
      </footer>
    </main>
  );
}

export default App;
