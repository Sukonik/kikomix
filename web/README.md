# KikoMix Web — MVP One

The responsive website and installable PWA for KikoMix ("Project TriBeam").
**Vanilla HTML/CSS/JS only. Zero dependencies, no build step.**

## Run locally

```bash
cd web
python3 -m http.server 8000
```

Open http://localhost:8000 — tap through all six tabs. On a phone, use
"Add to Home Screen" to install it as a PWA (iOS meta tags included).

## Deploy

Any static host works — the app is just files:

- **GitHub Pages:** push the repo, enable Pages on `main`, serve from `/web`
  (or move `web/*` to the repo root on a `gh-pages` branch).
- **Netlify:** drag-and-drop the `web/` folder, or connect the repo with
  publish directory `web`.
- **Vercel:** `vercel --cwd web`, or set the project root to `web/`.

No server-side code, no environment variables, no build command.

## Architecture

```
web/
├── index.html          # App shell: 6 tabs (Home, Search, Library, Mixes,
│                       # Now Playing, Sources), iOS/PWA meta tags
├── manifest.json       # PWA manifest (KikoMix, standalone, #06070c)
├── sw.js               # Service worker: cache-first app shell (kikomix-v1)
├── css/                # tokens → base → components → features
├── icons/              # logo.svg + PNG icons (192/512, apple-touch 180)
└── js/
    ├── data.js         # 48-track mock catalog (KM_DATA)
    ├── adapters.js     # ProviderAdapter interface + 5 mock adapters
    ├── ui.js           # tab router, toast, badges, escaping (KM.ui)
    ├── search.js       # unified search, dedupe, source prefs (KM.search)
    ├── player.js       # SIMULATED playback engine (KM.player)
    ├── library.js      # unified songs/artists/albums (KM.library)
    ├── mixes.js        # cross-service playlists + dedupe (KM.mixes)
    ├── liondavid.js    # onboarding + contextual tips (KM.lion)
    ├── sources.js      # mock connect/prioritize (KM.sources)
    ├── mimicry.js      # vibe-queue prototype (KM.mimicry)
    ├── solarflare.js   # safe visual-sync prototype (KM.solarflare)
    ├── techniques.js   # Tri-Beam / Dodon Ray / Four Witches / Multi-Form mocks
    └── app.js          # bootstrap + Home tab rendering
```

Script load order is data → adapters → ui → … → app. Every cross-module
call is optional-chained, so the shell stays up even if a module fails.

## What is mocked vs. what needs real integration

**Mocked in MVP One (all honestly labeled in the UI):**

- All five providers (Spotify, Apple Music, YouTube, SoundCloud, Local Files)
  are `ProviderAdapter` mocks over a 48-track invented catalog. Search fans
  out to every *connected* mock and merges duplicates.
- **Playback is simulated** — a timer drives the progress bar; no audio
  plays. The Now Playing screen always shows:
  "Simulated playback — connect a real service for actual audio."
- Service connections, source priority, mixes, preferences, and LionDavid's
  intro state live in `localStorage` only.
- Mimicry scores mock metadata (mood/tempo/genre/era/energy). Solar Flare is
  a gentle glow — no real beat analysis. Tri-Beam, Dodon Ray, Four Witches,
  and Multi-Form are UI-only prototypes (Multi-Form unlocks only for the
  local public-domain-style track, by design).

**The real-integration seam** (`js/adapters.js`, `REAL INTEGRATION SEAM` comment):

1. Replace mock `search()` with `fetch()` to the provider API using a stored
   access token.
2. `resolve()` should return the provider's playback URI / SDK handle.
3. `playbackCapabilities()` flips `canPlayRealAudio` when a valid token exists.
4. Never store raw tokens in `localStorage` — use the provider SDK or a
   secure backend. Playback must stay on the authorized provider; KikoMix
   never re-hosts, downloads, or alters protected audio.

## Product boundaries honored

- No downloading or altering protected streams; no DRM removal.
- No auth tokens anywhere in the client.
- Solar Flare: strobing stays off by default, gentle pulse only,
  photosensitivity warning on first activation, `prefers-reduced-motion`
  honored plus an in-app toggle, brightness control.
- Tri-Beam never claims to exceed safe hardware limits (85 dB guidance).
- Four Witches promises no unsupported Bluetooth behavior.

## MVP success criteria — how to demo each

1. **Connect ≥2 services** → Sources tab, toggle Spotify + YouTube on.
2. **Search both from one screen** → Search tab, try "midnight".
3. **Identify availability** → every result row carries a source badge.
4. **Save to a unified playlist** → "＋ Mix" on any result → Sunset Drive.
5. **Select playback service** → per-result source switcher; choice is remembered.
6. **Mimicry queue** → Mixes tab → Mimicry panel → "Generate vibe".
7. **Safe Solar Flare** → play a track → Now Playing → enable Solar Flare.
8. **LionDavid's role** → first-run onboarding + tip bar; try the duplicate
   prompt: Mixes → Sunset Drive → "Your playlist contains N duplicates…"

## Roadmap to native iOS

1. Harden the web app against real adapters (swap mocks per the seam above).
2. Wrap the PWA or build a native shell reusing `ProviderAdapter` semantics;
   add lock-screen controls, background playback, Siri/Shortcuts (Phase Two).
3. Playlist transfer/matching, duplicate detection v2, CarPlay (Phase Three).
