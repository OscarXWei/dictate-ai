# Shipping Dictate.ai

Three routes, in order of effort.

---

## 1. Personal install (do this first)

Build the app once, drag it to `/Applications`, done. No Apple Developer account needed.

```bash
pnpm tauri build
```

That produces:

- `src-tauri/target/release/bundle/macos/Dictate.ai.app` — the executable bundle
- `src-tauri/target/release/bundle/dmg/Dictate.ai_0.1.0_aarch64.dmg` — the installer

To install:

1. Open the `.dmg`
2. Drag `Dictate.ai` into the `Applications` shortcut
3. First launch: macOS will block with "Dictate.ai can't be opened because it is from an unidentified developer." Right-click the app in `/Applications`, choose **Open**, then **Open** in the confirmation dialog. You only need to do this once.

The audio files live at `~/Downloads/ielts/` (the asset-protocol scope in `tauri.conf.json` already allows this). If you move them, edit `src/lib/audioUrl.ts` and `src-tauri/tauri.conf.json` scope.

The whisper.cpp binary is NOT bundled with the app — only the JSON manifest is. The app doesn't need whisper at runtime; it only needs the MP3s + `src/data/manifest.json`. The transcribe script is dev-only tooling.

---

## 2. Distribute via Developer ID (signed, notarized .dmg)

This produces a `.dmg` that anyone on macOS can open without right-click bypass. **Not the App Store** — just a properly signed download.

### Requirements

- Apple Developer Program enrollment ($99/yr)
- A "Developer ID Application" certificate, installed in your Keychain
- An app-specific password for `notarytool`

### Workflow

```bash
# 1. Build
pnpm tauri build

# 2. Sign (Tauri can do this automatically — add to tauri.conf.json)
```

In `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
      "providerShortName": "TEAMID"
    }
  }
}
```

```bash
# 3. Notarize the produced .dmg
xcrun notarytool submit \
  src-tauri/target/release/bundle/dmg/Dictate.ai_0.1.0_aarch64.dmg \
  --keychain-profile "NOTARY_PROFILE" \
  --wait

# 4. Staple the notarization ticket
xcrun stapler staple \
  src-tauri/target/release/bundle/dmg/Dictate.ai_0.1.0_aarch64.dmg
```

Set up `NOTARY_PROFILE` once with `xcrun notarytool store-credentials`.

---

## 3. Mac App Store submission

**Before you start: this is a long road, and you have a copyright problem.**

### The copyright reality

Your `~/Downloads/ielts/` folder contains Cambridge IELTS audio (books 4, 11, 15, 17) plus other practice tests. **Those recordings are copyrighted by Cambridge University Press / Cambridge English Language Assessment.** Bundling them into an App Store binary is straightforward copyright infringement — Apple's review will not catch it, but Cambridge's lawyers eventually will.

You have three honest options:

| Approach | Verdict |
|---|---|
| Ship the .app with the MP3s bundled | **Don't.** Copyright violation. |
| Ship without audio + add a "Choose your audio folder" picker; user supplies their own files | **Legal, but requires:** a folder-picker UI, a way for the user to run transcription (bundle `whisper.cpp` as a Tauri sidecar — Phase 9 work), and the user has to source their own audio. |
| License the IELTS content from Cambridge | Practically impossible for an indie app. |

If you're going to ship to the Store, build option B. Until then keep the app private.

### App Store technical requirements (option B)

Assuming you've ripped out the bundled audio and replaced it with a folder picker:

1. **Apple Developer Program enrollment** — $99/yr, includes the Mac App Store entitlement
2. **App-specific certificates**:
   - "3rd Party Mac Developer Application" — for signing the .app
   - "3rd Party Mac Developer Installer" — for signing the .pkg
3. **Sandbox the app**. Mac App Store apps must run in App Sandbox. In `src-tauri/Info.plist` (you'll need to create one), enable `com.apple.security.app-sandbox`. Add only the entitlements you need:
   - `com.apple.security.files.user-selected.read-only` — for the folder picker
   - `com.apple.security.network.client` — only if you ever need internet (you don't)
4. **App icons in all required sizes**: 16, 32, 64, 128, 256, 512, 1024 px (1x + 2x for each). Tauri can generate these from a single 1024px PNG via `pnpm tauri icon path/to/icon.png`.
5. **Bundle metadata**:
   - Bundle identifier: `com.oscarwei.dictate-ai` (already set)
   - Category: Education (probably)
   - Version + build number
   - Copyright string
6. **App Store Connect setup**:
   - Create the app record at https://appstoreconnect.apple.com
   - Fill out: name, subtitle, description, keywords, support URL, marketing URL, privacy policy URL (must be a real web page — Apple will reject placeholder URLs)
   - Screenshots: at least 3 in 1280×800 or 1440×900 or higher
   - Age rating questionnaire
7. **Upload via Xcode or `xcrun altool`**:
   ```bash
   xcrun altool --upload-app \
     --type osx \
     --file Dictate.ai.pkg \
     --apiKey $API_KEY \
     --apiIssuer $ISSUER_ID
   ```
8. **Submit for review**. Usually 1–3 days. Apple will reject for:
   - Missing privacy policy or vague description
   - Sandbox violations (your code tries to read paths outside the user-selected scope)
   - Unstable behavior (test on a clean macOS first)

### Tauri-specific gotchas for the Store

- Tauri's bundle target needs to be `app` only (not `dmg`) for the App Store, then wrapped in a `.pkg` via `productbuild`
- The webview gets sandboxed too — `__TAURI_INTERNALS__` is still available but you cannot use `convertFileSrc` for arbitrary paths; only paths within the sandbox
- WebKit content security on macOS may need explicit CSP — set in `tauri.conf.json` under `app.security.csp` (currently `null` for dev convenience)

---

## Recommended path for you

- **Today**: Run `pnpm tauri build`, install the `.app` from the `.dmg`, use it personally with the audio you already have. This is what you actually want.
- **If you want a public-facing app**: Strip the IELTS audio dependency, add a "your audio folder" picker, decide what audio source you'll legally point users at (their own IELTS books they've ripped, or a permissively-licensed corpus), then revisit the Store path.

Don't submit a copyright-infringing app to the Store. The bookkeeping isn't worth the takedown notice.
