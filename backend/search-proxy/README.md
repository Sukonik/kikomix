# KikoMix search-proxy

A single Cloudflare Worker that makes Deezer, the iTunes Search API, and
Jamendo callable from KikoMix's static frontend. All three are real,
genuinely free/keyless-or-near-keyless catalogs — but **none of them send
CORS headers**, so a browser calling them directly gets blocked
(confirmed by testing each in September 2026). This Worker calls them
server-side, where CORS doesn't apply, and adds its own CORS headers so
`web/js/adapters.js` can call it.

This is deliberately the smallest possible backend: one file, no database,
no auth, free Cloudflare tier. It is **not** the account/auth backend from
`BACKEND_PLAN.md` — that's a separate, larger effort. This just makes
search real.

## Deploy (a few minutes, free tier)

1. Create a free Cloudflare account if you don't have one, and install
   Wrangler: `npm install -g wrangler` (or use `npx wrangler` below without
   installing globally).
2. From this directory: `npx wrangler login`, then `npx wrangler deploy`.
   Wrangler prints your Worker's URL, e.g.
   `https://kikomix-search-proxy.<your-subdomain>.workers.dev`.
3. **Optional but recommended** — register a free Jamendo client_id at
   https://devportal.jamendo.com (catalog read access is free, no approval
   wait), then: `npx wrangler secret put JAMENDO_CLIENT_ID` and paste it
   when prompted. Deezer and iTunes work with zero setup; skipping this
   step just means Jamendo results stay empty (the Worker returns `[]` for
   that provider, per `searchJamendo`'s early-return — it won't break
   Deezer/iTunes).
4. Point the frontend at it: in `web/js/config.js`, set
   `window.KM_SEARCH_PROXY_URL` to the URL from step 2. That's the only
   frontend change needed — `web/js/adapters.js`'s `deezer`/`jamendo`
   adapters already call whatever URL is configured there, and do nothing
   (no network calls at all) while it's `null`.

## Test it once deployed

```
curl "https://<your-worker-url>/search?provider=deezer&q=nickelback"
curl "https://<your-worker-url>/search?provider=itunes&q=ska"
curl "https://<your-worker-url>/search?provider=jamendo&q=afro%20house"

# Field-scoped search (artist name / album name / song name / genre),
# verified against the live APIs during development:
curl "https://<your-worker-url>/search?provider=deezer&q=Nickelback&field=artist"
curl "https://<your-worker-url>/search?provider=deezer&q=Silver%20Side%20Up&field=album"
curl "https://<your-worker-url>/search?provider=itunes&q=Daft%20Punk&field=artist"
```

Each should return `{ query, provider, field, results: [...] }` with real tracks.

**A real bug worth knowing about**: Deezer's commonly-documented advanced
query operators (`q=artist:"x"`, `album:"x"`, `track:"x"`) were tested
directly against the live API during development and returned **zero
results even for exact, well-known names** (e.g. `artist:"Daft Punk"`).
What actually works — also verified live — is Deezer's dedicated REST
endpoints (`/search/artist`, `/search/album`, `/search/track`), which this
Worker uses instead. If you see tutorials citing the `field:"value"`
syntax, don't trust it without testing — it didn't work here.

## Why only these three, not the other ~27 in the original brainstorm

See `MUSIC_SEARCH_PLAN.md` at the repo root for the full reasoning and the
Tier 2/3 backlog (Last.fm, Discogs, Audius, Odesli, Radio Browser, etc.).
Short version: these three cover real commercial-catalog search (Deezer,
iTunes) and real independent/Creative-Commons audio (Jamendo) with the
least integration risk, and prove the pattern before adding more.
