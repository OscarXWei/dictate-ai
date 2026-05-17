import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Resolve a manifest `audioFile` (bare filename like "C17-T1-P1.mp3") to a
 * URL the <audio> element can load.
 *
 * - `pnpm dev`: served from public/audio (a symlink to ~/Downloads/ielts).
 * - Tauri shell: convertFileSrc on the absolute on-disk path, served through
 *   the asset:// protocol. The scope is declared in tauri.conf.json under
 *   `app.security.assetProtocol`.
 */

const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// In Tauri the IELTS folder lives at the original location for personal use.
// Resolved at startup so the URL is stable across renders.
const TAURI_AUDIO_DIR = `${getHome()}/Downloads/ielts`;

function getHome(): string {
  // Vite exposes import.meta.env.HOME only when explicitly set. We rely on
  // userland being able to override via VITE_AUDIO_DIR if they relocate the
  // folder; otherwise default to the standard macOS Downloads path under the
  // current user. The `$HOME` placeholder in tauri.conf.json's scope expands
  // at runtime, so the file load is safe.
  const env = import.meta.env.VITE_HOME as string | undefined;
  if (env) return env;
  // Fallback: best-effort using the same path Tauri's $HOME resolves to.
  return "/Users/oscarwei";
}

export function audioUrl(filename: string): string {
  if (IS_TAURI) {
    return convertFileSrc(`${TAURI_AUDIO_DIR}/${filename}`);
  }
  return `/audio/${encodeURIComponent(filename)}`;
}
