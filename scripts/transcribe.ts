#!/usr/bin/env tsx
/**
 * Transcribe IELTS MP3s with local whisper.cpp into src/data/manifest.json.
 *
 *   pnpm transcribe                       # process all unseen files in default dir
 *   pnpm transcribe --dir <path>          # override input directory
 *   pnpm transcribe --limit 1             # only first N (for smoke tests)
 *   pnpm transcribe --only "C17-T1-P1"    # transcribe one file by id
 *   pnpm transcribe --dry                 # preview the plan, no transcription
 *   pnpm transcribe --force               # re-transcribe even if already in manifest
 *   pnpm transcribe --model <path>        # override model path
 *
 * Resumable: manifest is rewritten atomically after each track.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, spawn } from "node:child_process";
import type { Manifest, Track, Segment } from "../src/data/types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "src/data/manifest.json");
const DEFAULT_MODEL = path.join(REPO_ROOT, "models/ggml-small.en.bin");
const DEFAULT_DIR = path.join(os.homedir(), "Downloads", "ielts");

type Args = {
  dir: string;
  model: string;
  limit: number | null;
  only: string | null;
  dry: boolean;
  force: boolean;
};

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (name: string) => {
    const i = a.indexOf(name);
    return i >= 0 ? a[i + 1] : null;
  };
  return {
    dir: get("--dir") ?? DEFAULT_DIR,
    model: get("--model") ?? DEFAULT_MODEL,
    limit: get("--limit") ? Number(get("--limit")) : null,
    only: get("--only"),
    dry: a.includes("--dry"),
    force: a.includes("--force"),
  };
}

function trackIdFromFilename(filename: string): string {
  return filename
    .replace(/\.mp3$/i, "")
    .replace(/\s*\(\s*(\d+)\s*\)/g, "-$1")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function guessBook(filename: string): string {
  if (/^C(\d+)-/i.test(filename)) {
    return `Cambridge IELTS ${filename.match(/^C(\d+)-/i)![1]}`;
  }
  if (/^IELTS(\d+)_/i.test(filename)) {
    return `Cambridge IELTS ${filename.match(/^IELTS(\d+)_/i)![1]}`;
  }
  if (/^C(\d+)T(\d+)S(\d+)/i.test(filename)) {
    return `Cambridge IELTS ${filename.match(/^C(\d+)T/i)![1]}`;
  }
  if (/^Test\s*\d+/i.test(filename) || /^Test\d+\./i.test(filename))
    return "Generic IELTS practice";
  if (/^test\d+_section\d+/i.test(filename)) return "Generic IELTS practice";
  if (/^T\d+S\d+/i.test(filename)) return "Generic IELTS practice";
  if (/^\d+ Track \d+/.test(filename)) return "Listening tracks";
  return "IELTS";
}

/** Drop Whisper artifacts like `[BLANK_AUDIO]`, `[music]`, `♪♫`. */
function stripWhisperArtifacts(text: string): string {
  return text
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\([^)]*(music|applause|laughter|noise)[^)]*\)/gi, "")
    .replace(/[♪♫]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function audioDurationSec(filePath: string): number | null {
  try {
    const out = execSync(`afinfo ${JSON.stringify(filePath)} 2>/dev/null`, {
      encoding: "utf8",
    });
    const m = out.match(/estimated duration:\s*([\d.]+)\s*sec/);
    return m ? parseFloat(m[1]) : null;
  } catch {
    return null;
  }
}

function loadManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { version: 1, generatedAt: null, tracks: [] };
  }
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  const m = JSON.parse(raw) as Manifest;
  if (!m.version) m.version = 1;
  if (!m.tracks) m.tracks = [];
  return m;
}

function saveManifest(m: Manifest) {
  m.generatedAt = new Date().toISOString();
  const tmp = MANIFEST_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2) + "\n");
  fs.renameSync(tmp, MANIFEST_PATH);
}

type WhisperToken = { from: number; to: number; text: string };
type WhisperJson = {
  transcription: { offsets: { from: number; to: number }; text: string }[];
};

function runWhisper(
  filePath: string,
  modelPath: string,
): Promise<WhisperToken[]> {
  return new Promise((resolve, reject) => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "whisper-"));
    const outBase = path.join(workDir, "out");
    const proc = spawn(
      "whisper-cli",
      [
        "-m", modelPath,
        "-f", filePath,
        "-l", "en",
        "-oj",            // output JSON
        "-of", outBase,
        "-ml", "1",       // one token per "segment" → word-level timestamps
        "-nt",            // quiet stdout
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`whisper-cli exit ${code}: ${stderr.slice(-300)}`));
        return;
      }
      try {
        const jsonPath = outBase + ".json";
        const json = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as WhisperJson;
        fs.rmSync(workDir, { recursive: true, force: true });
        const tokens: WhisperToken[] = json.transcription.map((s) => ({
          from: s.offsets.from,
          to: s.offsets.to,
          text: s.text,
        }));
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });
    proc.on("error", reject);
  });
}

const SENTENCE_END = /[.!?]/;
// Fallback splits when Whisper produced no punctuation. Tuned for IELTS
// listening: people pause noticeably between utterances, and even in
// lectures sentences are typically <200 chars.
const GAP_SPLIT_MS = 900;
const MAX_LEN_HARD = 240;

function groupIntoSentences(tokens: WhisperToken[]): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  let bufStart = 0;
  let bufLastEnd = 0;
  let starting = true;
  const flush = () => {
    const cleaned = stripWhisperArtifacts(buf);
    if (cleaned.length >= 2) {
      out.push({
        id: out.length,
        startSec: bufStart / 1000,
        endSec: bufLastEnd / 1000,
        text: cleaned,
      });
    }
    buf = "";
    starting = true;
  };

  for (const t of tokens) {
    if (!t.text || !t.text.trim()) continue;

    // Temporal gap split: pause longer than GAP_SPLIT_MS between tokens
    // probably means a new utterance. Only force-flush if the buffer
    // already has reasonable content (don't split off a single word).
    if (!starting && t.from - bufLastEnd >= GAP_SPLIT_MS && buf.trim().length >= 20) {
      flush();
    }

    if (starting) {
      bufStart = t.from;
      starting = false;
    }
    buf += t.text;
    bufLastEnd = t.to;

    if (SENTENCE_END.test(t.text)) {
      flush();
      continue;
    }

    // Hard length cap as a safety net for punctuation-free transcripts.
    // Split at the most recent space so we don't break mid-word.
    if (buf.length >= MAX_LEN_HARD) {
      const lastSpace = buf.lastIndexOf(" ");
      if (lastSpace > 40) {
        const carry = buf.slice(lastSpace + 1);
        buf = buf.slice(0, lastSpace);
        flush();
        // Re-seed buffer with the carry word so we don't lose it. We
        // approximate its start time as bufLastEnd minus a hair.
        buf = " " + carry;
        bufStart = bufLastEnd;
        starting = false;
      } else {
        flush();
      }
    }
  }
  flush();
  return out;
}

async function main() {
  const args = parseArgs();
  console.log(`📁 dir:    ${args.dir}`);
  console.log(`🧠 model:  ${args.model}`);
  if (!fs.existsSync(args.dir)) {
    console.error(`❌ directory not found: ${args.dir}`);
    process.exit(1);
  }
  if (!fs.existsSync(args.model)) {
    console.error(`❌ model not found: ${args.model}`);
    process.exit(1);
  }

  const allFiles = fs
    .readdirSync(args.dir)
    .filter((f) => f.toLowerCase().endsWith(".mp3"))
    .sort();
  console.log(`🎧 ${allFiles.length} MP3 files found`);

  const manifest = loadManifest();
  const existingIds = new Set(manifest.tracks.map((t) => t.id));

  type Job = { filename: string; id: string; filePath: string; durSec: number };
  const jobs: Job[] = [];
  const skipped: string[] = [];
  for (const filename of allFiles) {
    const id = trackIdFromFilename(filename);
    if (args.only && id !== args.only) continue;
    if (!args.force && existingIds.has(id)) continue;
    const filePath = path.join(args.dir, filename);
    const durSec = audioDurationSec(filePath);
    if (durSec === null) {
      skipped.push(filename);
      continue;
    }
    jobs.push({ filename, id, filePath, durSec });
    if (args.limit && jobs.length >= args.limit) break;
  }
  if (skipped.length > 0) {
    console.log(`⚠  ${skipped.length} unreadable file(s) skipped:`);
    skipped.forEach((f) => console.log(`     ${f}`));
  }

  const totalSec = jobs.reduce((a, j) => a + j.durSec, 0);
  const totalMin = totalSec / 60;
  // M-series with small.en: ~10x realtime
  const estMin = totalMin / 10;
  console.log(
    `⏱  to process: ${jobs.length} files · ${totalMin.toFixed(1)} min audio · ~${estMin.toFixed(0)} min compute`,
  );

  if (jobs.length === 0) {
    console.log("✅ nothing to do (use --force to re-transcribe)");
    return;
  }
  if (args.dry) {
    console.log("(dry run — exiting)");
    return;
  }

  let done = 0;
  const t0 = Date.now();
  for (const job of jobs) {
    done++;
    const tag = `[${done}/${jobs.length}] ${job.id}`;
    process.stdout.write(`${tag} (${(job.durSec / 60).toFixed(1)} min)... `);
    const startedAt = Date.now();
    try {
      const tokens = await runWhisper(job.filePath, args.model);
      const segments = groupIntoSentences(tokens);
      if (segments.length === 0) throw new Error("no segments");
      const track: Track = {
        id: job.id,
        title: job.filename.replace(/\.mp3$/i, ""),
        book: guessBook(job.filename),
        audioFile: job.filename,
        durationSec: job.durSec,
        segments,
      };
      const idx = manifest.tracks.findIndex((t) => t.id === job.id);
      if (idx >= 0) manifest.tracks[idx] = track;
      else manifest.tracks.push(track);
      saveManifest(manifest);
      const took = ((Date.now() - startedAt) / 1000).toFixed(1);
      const realtime = (job.durSec / ((Date.now() - startedAt) / 1000)).toFixed(1);
      console.log(`✓ ${segments.length} segments · ${took}s (${realtime}x realtime)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${msg}`);
    }
  }

  const totalTook = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`🏁 done in ${totalTook}s · manifest has ${manifest.tracks.length} tracks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
