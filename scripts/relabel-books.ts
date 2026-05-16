#!/usr/bin/env tsx
/**
 * Re-derive the `book` field for every track in the manifest using the
 * current guessBook() rules. Useful when transcribe.ts's regex catalogue
 * grows and we don't want to re-run whisper.
 */
import fs from "node:fs";
import path from "node:path";
import type { Manifest } from "../src/data/types.ts";

function guessBook(filename: string): string {
  if (/^C(\d+)-/i.test(filename))
    return `Cambridge IELTS ${filename.match(/^C(\d+)-/i)![1]}`;
  if (/^IELTS(\d+)_/i.test(filename))
    return `Cambridge IELTS ${filename.match(/^IELTS(\d+)_/i)![1]}`;
  if (/^C(\d+)T(\d+)S(\d+)/i.test(filename))
    return `Cambridge IELTS ${filename.match(/^C(\d+)T/i)![1]}`;
  if (/^Test\s*\d+/i.test(filename) || /^Test\d+\./i.test(filename))
    return "Generic IELTS practice";
  if (/^test\d+_section\d+/i.test(filename)) return "Generic IELTS practice";
  if (/^T\d+S\d+/i.test(filename)) return "Generic IELTS practice";
  if (/^\d+ Track \d+/.test(filename)) return "Listening tracks";
  return "IELTS";
}

const manifestPath = path.join(
  path.resolve(import.meta.dirname, ".."),
  "src/data/manifest.json",
);
const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
let changed = 0;
for (const t of m.tracks) {
  const newBook = guessBook(t.audioFile);
  if (t.book !== newBook) {
    console.log(`  ${t.id}: "${t.book}" → "${newBook}"`);
    t.book = newBook;
    changed++;
  }
}
m.generatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n");
console.log(`Relabeled ${changed} tracks.`);
