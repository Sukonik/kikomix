# KikoMix GitHub Issues 1–5 (drafts)

Filed to `Sukonik/kikomix` once the GitHub connector holds a working token.
Each section below is one issue: `## Issue N` line gives the title, the rest is the body.

---

## Issue 1

**Title:** Unified search: one query across every connected service

**Body:**
### Goal
One search box queries every connected music service at the same time and returns a single combined result list.

### Scope
- Fan out each query to the Spotify, Apple Music, YouTube, SoundCloud, and local-file adapters simultaneously.
- Merge into one ranked list — no separate per-service tabs.
- Every result carries a source badge identifying which service(s) have it.
- Duplicate merging: the same recording found on multiple services becomes one row, with a source switcher and a remembered per-user preferred source.
- Per-source loading, empty, and error states that don't break the whole list.
- Debounced input; cancel stale requests.

### Acceptance
- Prototype success criteria 2 & 3: search two connected services from one screen; clearly identify where each result is available.

### Boundaries
- Approved provider APIs/integrations only — no scraping, no unofficial endpoints.
- Never expose authentication tokens in client code, logs, or URLs.

---

## Issue 2

**Title:** Sources: connect services, choose playback source, consistent Now Playing

**Body:**
### Goal
A Sources tab to connect, disconnect, and prioritize music services, plus one consistent Now Playing screen no matter which service plays the track.

### Scope
- Connect/disconnect/prioritize: Spotify, Apple Music, YouTube, SoundCloud (extensible to future connectors).
- OAuth through each provider's approved flow; tokens stored securely, never in client-visible state.
- Preferred-service selection used for playback by default.
- Now Playing shows the active service badge and uses that provider's approved playback controls (provider SDK/embed or deep link where required).
- Graceful fallback: if a track is unavailable on the preferred service, say so plainly and offer the services where it was found (LionDavid line: "This track is unavailable on your preferred service, but I found it on YouTube.").

### Acceptance
- Prototype success criteria 1 & 5: connect at least two services; select the service used for playback.

### Boundaries
- Never promise playback capabilities a provider doesn't support.
- Respect each provider's terms of service and playback permissions.

---

## Issue 3

**Title:** Library + Mixes: unified collection and cross-service playlists

**Body:**
### Goal
A unified Library (artists, albums, songs across services) and Mixes (cross-service playlists) as the primary save system.

### Scope
- Save any search result into a KikoMix playlist from one action.
- Playlists store per-track service routing so a mix can span Spotify, Apple Music, SoundCloud, etc.
- Replaying a playlist resolves each track through the preferred/available service.
- Duplicate detection with a combine prompt ("Your playlist contains seven duplicates. Would you like me to combine them?").
- Local persistence first; account sync comes later.
- Keep it simple for v1 — no complicated standalone library beyond unified artists/albums/songs views.

### Acceptance
- Prototype success criterion 4: save songs into a unified KikoMix playlist and replay it later.

### Boundaries
- Playlists reference provider content; never copy, re-host, download, or alter protected audio.

---

## Issue 4

**Title:** LionDavid introduction and Mimicry vibe-generator prototype

**Body:**
### Goal
Introduce LionDavid as KikoMix's musical commander and curator, and ship a working Mimicry prototype that builds a queue from one seed song.

### Scope
- LionDavid onboarding intro explaining his role: confident, creative, warm, helpful.
- Contextual, non-interrupting assistance during normal use, e.g.:
  - "I found this song on three of your connected services."
  - "Your playlist contains seven duplicates. Would you like me to combine them?"
  - "I completed your Sunset Drive mix using Spotify, Apple Music, and SoundCloud."
  - "This track is unavailable on your preferred service, but I found it on YouTube."
- LionDavid assists without interrupting ordinary playback.
- Mimicry: one seed song generates a matching queue based on mood, tempo, genre, era, energy, instrumentation, listening history, and available connected services.
- Mimicry finds similar songs — it never copies or recreates the original recording.

### Acceptance
- Prototype success criteria 6 & 8: generate a Mimicry queue from one song; the user understands LionDavid's role without the character obstructing the interface.

---

## Issue 5

**Title:** Technique prototypes (Solar Flare first) and the KikoMix visual system

**Body:**
### Goal
Ship a safe Solar Flare visual prototype, mock interfaces for the remaining techniques, and establish the dark high-energy visual system.

### Scope
- Visual system: midnight-black background; GoldenSun gold for LionDavid; crimson for Tri-Beam; bright solar yellow for Solar Flare; electric blue for Dodon Ray; clean album artwork with minimal clutter; beam and waveform animations connecting music sources.
- Logo: three audio beams converging into one golden waveform. Original mark only — must not reproduce Dragon Ball characters, poses, symbols, or artwork.
- Solar Flare prototype: beat-reactive visuals using album-art colors, animated backgrounds, screen glow; reduced-motion mode; brightness controls; photosensitivity warning. Rapid strobing stays disabled by default.
- Tri-Beam mock (Max Power listening preset): bass/clarity/spatial/device-EQ/normalization UI, battery-use indicator, hearing-safety limits. Must never claim to exceed a device's safe hardware limitations.
- Dodon Ray mock (precision jump): chorus / bridge / solo / beat-drop / favorite-timestamp / user-marker jumping. Availability may vary by connected service and its playback permissions.
- Four Witches mock (group output): AirPlay, Chromecast, Spotify Connect, smart-speaker groups, manufacturer multiroom. Must not promise simultaneous output to arbitrary Bluetooth devices the OS doesn't support.
- Multi-Form mock (stem studio): enabled only for local files, creator uploads, public-domain, or otherwise authorized audio; protected streaming audio must not be extracted or altered — the UI must explain why it's unavailable there.
- Note: final public names for the techniques require intellectual-property review before launch.

### Acceptance
- Prototype success criterion 7: activate a safe Solar Flare visual mode.

### Boundaries (apply to all KikoMix work)
- No downloading protected streams; no removing DRM; no mixing raw audio from services that prohibit alteration.
- No unsafe volume or flashing-light behavior, ever.
