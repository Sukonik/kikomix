# Music search-aggregator plan

*2026-09-23. Written after Nathan shared a large brainstorm (originally
about a different, unrelated project called "Ari Music") proposing KikoMix
become a multi-source search engine: type "Nickelback" or "ska" or "Afro
House" and get normalized, deduplicated results pulled from ~30 different
music APIs/projects.*

## What's true in that brainstorm, and what needed checking

The core idea is right and worth building: **search should classify a
query (artist vs. genre) and fan out to multiple real catalogs, not just
KikoMix's own mock data.** A few specific things needed verification
before building anything, since the brainstorm didn't address them:

- **CORS.** This is the one fact that changes everything and wasn't
  mentioned anywhere in the original brainstorm: Deezer, the iTunes Search
  API, Jamendo, and MusicBrainz all **block direct browser requests** (no
  `Access-Control-Allow-Origin` header — verified for each, September
  2026). None of the ~30 sources listed can be called straight from
  KikoMix's static frontend. Every one of them needs a server-side proxy.
  This isn't a blocker, but it does mean "add a search API" and "stand up
  a backend" are the same task, not sequential ones — and it means the
  very first backend endpoint KikoMix needs isn't auth at all, it's a
  search proxy (see `BACKEND_PLAN.md`, which should be read as needing
  this added to its Phase 0).
- **Unverified specifics.** The brainstorm names several GitHub projects
  (SayaMusicAPI, MusicSeeker, SoulSync, Free Music Search API) and makes
  claims about specific licensing/ToS details (Spotify's 2024 API changes,
  JioSaavn/Gaana availability, various "no key needed" claims) that I
  didn't independently verify line by line. Worth treating as leads to
  study, not as confirmed facts to build against — verify each before
  depending on it, same as I did for CORS.
- **KikoMix already has the right architecture for this.** The brainstorm
  proposes a Search → Normalize → Deduplicate → Rank pipeline as new
  infrastructure. KikoMix's `web/js/search.js` already does exactly this
  today (`unifiedSearch()` fans out to every connected adapter in
  parallel, merges by title+artist, ranks by source count then energy) —
  it just runs it over five mock adapters. Adding a real source is adding
  one more `ProviderAdapter` with a real `search()`, per the "REAL
  INTEGRATION SEAM" comment already at the top of `adapters.js`. No
  rewrite needed, which is why this was buildable today instead of only
  planned.

## What's shipped in this branch

**`backend/search-proxy/`** — a single Cloudflare Worker (free tier, no
database, no auth) that proxies Deezer, iTunes Search, and Jamendo, and
adds the CORS headers none of them provide natively. See its README for
deploy steps (a few minutes, needs a free Cloudflare account).

**`web/js/adapters.js`** — two new real adapters, `deezer` and `jamendo`,
alongside the five existing mocks. Their `search()` calls
`window.KM_SEARCH_PROXY_URL` (configured in the new `web/js/config.js`,
`null` by default) and returns real tracks with real "Open in Deezer" /
"Open in Jamendo" links. **Until that URL is set, these two adapters make
zero network calls and the app behaves exactly as it does today** —
verified locally with a mock proxy standing in for the real Worker: search
results, "Open in Deezer" links, and source badges all render correctly
end-to-end, and a parallel run with the proxy URL unset confirmed the
existing all-mock search path is unaffected.

**`web/js/search.js`** — `normalizeHit()` now folds a real hit's
`externalUrl` into `providerLinks`, so the existing `providerLinkFor()`
logic (unchanged) picks it up automatically. No new UI code was needed for
"Open in provider" to work on real results.

Note: `deezer`'s and `jamendo`'s `previewUrl`/`durationSec`/`artwork`
fields are captured in the proxy response and passed through the adapter,
but **not wired to real inline playback yet** — that would mean giving
`web/js/player.js` an actual `<audio>` element, which today is
deliberately, entirely simulated (see its own header comment: "NO
`<audio>` element and NO real audio"). That's a bigger, riskier change
than this PR (it touches the core transport/state machine every other
screen reads from) and deserves its own focused pass rather than being
folded in here. For now, real results are genuinely real (real metadata,
real "Open in ___" links, real audio *available* via `previewUrl`) but
play through the same simulated timer as everything else until that
follow-up lands.

## Searching by artist name, genre, album, and song name (2026-09-23 update)

Nathan asked specifically for this: search and retrieval that works when
the query is an artist name, a genre, an album name, or a song name. The
proxy now supports an explicit `field=artist|album|track|genre` parameter
(default `auto`), using each provider's verified real syntax:

- **iTunes**: `attribute=artistTerm|albumTerm|songTerm|genreTerm` —
  verified live against the real API for `artist` and `album`, both
  returned correct, exact results (e.g. `field=artist&q=Nickelback`
  returns Nickelback's own tracks; `field=album&q=Silver Side Up` returns
  tracks from that exact album).
- **Jamendo**: dedicated `artist_name=` / `album_name=` / `namesearch=`
  (track) / `tags=` (genre) filter params, confirmed against the official
  docs (developer.jamendo.com) rather than assumed. Also added Jamendo's
  broad `search=` param (matches track+artist+album+tags at once) as the
  `auto` default, replacing the earlier `namesearch`-only default, which
  would have missed artist-name queries entirely.
- **Deezer — a real bug found and fixed**: the commonly-documented
  advanced query operators (`q=artist:"x"`, `album:"x"`, `track:"x"`) were
  tested directly against the live API and **returned zero results even
  for exact, well-known names** (`artist:"Daft Punk"` → empty). What
  actually works, also verified live: Deezer's dedicated REST endpoints
  (`/search/artist`, `/search/album`, `/search/track`) — the artist/album
  cases need a follow-up call (`/artist/{id}/top`, `/album/{id}/tracks`)
  to get actual playable tracks, since the search endpoints return the
  entity, not its tracks. Worth remembering next time a tutorial cites the
  `field:"value"` syntax: it didn't work here, don't trust it without
  testing.

Query classification into these four types is a `GENRE_WORDS` membership
check (~30 terms) for genre auto-detection, plus the `field` param for
explicit control (not yet wired to any frontend UI — the single search box
still sends `auto`, which already benefits from Jamendo's improved
`search=` default and each provider's already-broad general search). A
filter-chip UI ("Artist / Album / Song / Genre") to expose `field`
explicitly would be a small, separate frontend addition if wanted later —
not built now since it wasn't asked for and the `auto` default already
covers all four query types reasonably well.

## Tier 1 (shipped) vs. later

**Tier 1 — shipped this branch:** Deezer (commercial catalog, previews),
iTunes Search (commercial catalog, previews, currently proxied but not yet
wired to an adapter — trivial to add, same pattern as Deezer), Jamendo
(independent/Creative Commons, full streams).

**Tier 2 — real, worth adding next, each is its own small PR once Tier 1
is deployed and proven:**
- **MusicBrainz** — identity/dedup layer ("are these three results the
  same artist?"), no audio value on its own. Also has no CORS (verified);
  would be a fourth proxy route.
- **Last.fm** — "similar artists"/genre-tag enrichment. Needs a free API
  key; verify its CORS situation before assuming it's proxy-only too.
- **Odesli/Songlink** — turns one provider's link into "here's where else
  to listen." High value for the "we don't have to host audio" model
  already in `BACKEND_PLAN.md`.
- **Radio Browser** — "find stations playing ska" — a genuinely different,
  fun feature, not just more search results.

**Tier 3 — plausible but needs real verification before committing to
it, not just because a brainstorm named it:** Audius, Internet Archive,
Openverse, Discogs, Cover Art Archive, ListenBrainz, AudD/AcoustID
(reverse audio ID), Genius (lyrics), Mixcloud. Each of these is a real
service, but "verify CORS, verify current ToS, verify the specific claims"
should happen per-source before building, the same way it happened for
Tier 1 — don't take the brainstorm's ranking table as pre-verified.

**Deliberately not pursuing without a much stronger reason:** Spotify Web
API as a search source specifically (KikoMix already has a real Spotify
integration path planned in `BACKEND_PLAN.md` via OAuth — adding it again
as an anonymous search-only source duplicates that effort for less
value), YouTube Data API for search (the API key/quota model is a worse
fit than the IFrame Player API KikoMix already uses for playback in Kiko
Radio), and JioSaavn/Gaana (no verified-stable public API surface found;
worth a dedicated feasibility check before scoping any work here).

## Next step

Deploy `backend/search-proxy`, register a free Jamendo client_id, set
`KM_SEARCH_PROXY_URL`, and confirm real results on the live site. Then
pick one Tier 2 item and repeat the same pattern: verify first, build
second.
