# KikoMix

One search box for all your music. Search once, play instantly, save to a playlist — no matter which service the song lives on.

KikoMix is a lightweight music aggregator and interface replacer. Instead of juggling Spotify, Apple Music, YouTube, and SoundCloud apps, you get one clean player that searches across every service you've connected, plays the result immediately, and lets you save tracks from different services side by side in a single playlist.

> **Search → Play → Save**

---

## What it does

### 🔍 Search (the home screen)
One search box returns combined results from every connected service:

- Spotify
- Apple Music
- YouTube
- SoundCloud
- Local music files
- Suno AI generations *(planned)*
- Future connected services

Results are merged into one clean list — no service tabs. Each result carries a small source badge. When the same song exists on multiple services, KikoMix combines the matches into a single result, plays it from your preferred service automatically, and lets you switch sources or set a per-song preference that it remembers.

### ▶️ Playback
Tapping a result starts playback with as little interruption as possible. The Now Playing screen includes:

- Album artwork, song, and artist
- Source badge (where it's playing from)
- Play / pause, previous / next, scrubbing, volume
- Add to playlist (one tap)
- Available-source selector
- KikoMix Techniques menu

Playback always stays connected to the authorized original provider — KikoMix never re-hosts anyone's music.

### 💾 Playlists
Playlists are KikoMix's save system — deliberately simple:

- Create a playlist, add a song with one tap
- Mix songs from different services in one playlist
- Rearrange or remove tracks, search within a playlist
- Play a playlist through your preferred services
- See when a track becomes unavailable and find an alternative source

No separate, complicated music-library system in v1.

### 🧭 Navigation
Five tabs, nothing more: **Search** · **Playlists** · **Now Playing** · **Connections** · **Settings**

Search opens by default on every launch.

---

## Roadmap

| Milestone | Target |
|---|---|
| Website | v1 |
| Web app (downloadable) | v1 |
| iOS app | v1 |
| Android app | later |
| Meta app | later |

### MVP success test
The first prototype succeeds when a user can:
1. Enter a song, artist, or album
2. Get combined results from at least two services
3. Tap a result and hear playback begin
4. Save the result into a KikoMix playlist
5. Return later and play that saved playlist

Everything else — including LionDavid, Mimicry, Tri-Beam, Solar Flare, and the other Techniques — exists to support this core experience without making it more complicated.

### Free vs. paid
- **Free:** unified search and discovery across publicly available sources, plus your own Suno AI generations
- **Paid:** connect your own subscriptions (Spotify, Apple Music, …) and get full playback with cross-service playlists in one place

---

## Project status

🚧 **Early days.** The product direction above is the spec — implementation starts now. Expect the repo layout, docs, and prototypes to evolve quickly.

## Contributing

This project is led by King David (AI project lead) with Nathan. Ideas, issues, and pull requests are welcome:

1. Fork the repo and create a feature branch
2. Keep the **Search → Play → Save** flow sacred — if a change complicates it, it doesn't ship in v1
3. Open a PR with a clear description of what changed and why

## License

Licensed under the [Mozilla Public License 2.0](LICENSE).
