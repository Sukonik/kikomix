# Backend plan — from mock adapters to real accounts

*2026-09-23. Companion to `HANDOFF.md` and `NOTES_FOR_DAVID.md`.*

## Why this has to happen before SMS/email/OAuth

KikoMix today is a fully static site — zero servers, zero databases,
everything in `localStorage` (sources, mixes, LionDavid state). That's the
right call for a mock-adapter MVP. It stops being viable the moment any of
these ship for real:

- **SMS or email login** — needs a server to hold the Twilio/email-provider
  secret key and issue sessions; a client-only OTP flow can't keep a secret.
- **Real Spotify/YouTube/SoundCloud OAuth** — `web/js/adapters.js` already
  says it outright: *"Never store raw tokens in localStorage — use the
  provider SDK or a secure backend."* Refresh tokens need server-side,
  encrypted storage.
- **Cross-device state** — mixes/playlists currently die with the browser
  profile. Real accounts imply the data lives somewhere durable.

So "add Twilio" and "add email login" are really one task: **stand up a
minimal backend + database first**, then both auth methods plug into it in
parallel.

## Stack recommendation

Two real options; pick one, don't split effort across both.

### Option A — Auth-as-a-service (recommended to start)

**Supabase**: Postgres + built-in Auth (email/password, magic-link email,
phone/SMS OTP via a Twilio integration it manages for you, and custom
OAuth providers) + Edge Functions for anything bespoke (e.g. the Spotify
token-refresh cron). One vendor, one free tier, and it gives you the
database you need for account linking and taste profiles at the same time
as auth — not a separate integration.

Alternative in the same category: **Clerk** — best prebuilt SMS/email
UI components, less backend code, but you'd still need a separate database
(or its user metadata store, which gets cramped fast) for linked-provider
tokens and taste data. Supabase is the better fit here specifically
because KikoMix needs a real database regardless.

### Option B — Roll it yourself

Twilio Verify (phone OTP) + Postmark/SendGrid (magic-link email) + your own
sessions, sitting behind a small serverless backend (Cloudflare Workers or
Vercel Functions — lowest friction in front of a currently-static site) +
a managed Postgres (Neon, Supabase-as-database-only, or RDS).

**Recommendation: Option A (Supabase).** More control isn't worth much
here — nothing about KikoMix's auth needs is unusual, and Option B is
strictly more integration surface for the same outcome.

## Phased rollout

### Phase 0 — Foundation (no user-visible change)
- Stand up the Supabase project (Postgres + Auth).
- Data model (see below).
- One serverless endpoint deployed and reachable from `web/` — prove the
  static site can talk to a backend at all before building features on it.

### Phase 1 — Accounts (email + SMS)
- Email magic-link and phone/SMS OTP via Supabase Auth.
- KikoMix session replaces the current no-login state; `localStorage` data
  (mixes, source prefs) migrates to the account on first login rather than
  being thrown away — write a one-time migration that reads the existing
  `km:*` keys and POSTs them to the new backend.

### Phase 2 — Real provider linking, Spotify first
- Spotify: Authorization Code + PKCE, refresh tokens encrypted at rest,
  never sent to the client after the initial exchange. Web Playback SDK
  for in-browser playback where the linked account is Premium; free-linked
  accounts keep today's "Open in Spotify" behavior, badges unchanged.
- This is where the `adapters.js` real-integration seam gets filled in for
  real, for one provider — prove the pattern once.
- YouTube (IFrame Player API) and SoundCloud (HTML5 widget) next — both are
  no-account/no-OAuth per the existing docs, so they're additive once the
  Spotify pattern (link → store → refresh → play) exists.

### Phase 3 — Taste profile
- A `taste_profile` table seeded by the onboarding quiz from
  `NOTES_FOR_DAVID.md` §7, extended by real listening data once Spotify's
  Web API is reachable (top tracks/artists) instead of relying only on the
  mock catalog's mood/tempo/genre/era/energy fields.

## Data model (sketch)

```
users
  id, created_at, email (nullable), phone (nullable)

linked_accounts
  id, user_id → users.id, provider ('spotify' | 'youtube' | 'soundcloud' | 'apple')
  access_token_enc, refresh_token_enc, expires_at, scopes, connected_at

taste_profile
  user_id → users.id, seed_genres (jsonb), seed_artists (jsonb),
  mood_weights (jsonb)  -- mirrors Mimicry's mood/tempo/genre/era/energy axes

mixes
  id, user_id → users.id, name, created_at

mix_tracks
  mix_id → mixes.id, track_ref (provider + provider_track_id), position
```

`access_token_enc`/`refresh_token_enc`: encrypted at the application layer
(not just relying on Postgres row security) before they touch the
database — this is the one field where "secure enough for an MVP" isn't
good enough, since a leak here is a leak of someone's real Spotify account
access.

## API surface (sketch)

```
POST /auth/email/start          { email }
POST /auth/email/verify         { email, token }
POST /auth/sms/start            { phone }
POST /auth/sms/verify           { phone, code }
GET  /me
GET  /providers                 -> linked_accounts (no raw tokens returned)
POST /providers/spotify/connect -> OAuth redirect / PKCE start
GET  /providers/spotify/callback
POST /providers/spotify/disconnect
GET  /mixes
POST /mixes
POST /mixes/:id/tracks
GET  /taste-profile
PUT  /taste-profile
```

Auth endpoints are Supabase Auth's own (don't hand-roll these); the
`/providers/*` and `/mixes` endpoints are the custom Edge Functions this
project actually needs to write.

## Security / ToS constraints (non-negotiable)

- Never return a raw provider token to the client after the initial
  exchange; the client gets a KikoMix session, the backend holds provider
  tokens.
- PKCE for every OAuth flow that supports it (Spotify does).
- **Account sharing**: one KikoMix user controlling playback through
  *their own* linked account is the only supported model. Do not build
  anything that lets multiple separate KikoMix users share one provider
  login/session — this violates Spotify's and Apple Music's developer
  terms and risks API access being revoked for the whole app, not just one
  user. If "sharing" is meant as a household/shared-mixes model, that's
  mixes shared *between* linked accounts (Phase 2/3 territory), not shared
  credentials.
- Rate-limit `/auth/sms/start` and `/auth/email/start` per phone/email and
  per IP from day one — OTP-start endpoints are a standard abuse target
  (SMS pumping) the moment they're public.

## What this unblocks

Once Phase 1 lands, SMS account management and email account management
from Nathan's original ask are both just "which Supabase Auth method is
enabled" — not two separate builds. Phase 2 unblocks real Spotify-first
account linking (the stated MVP target) with YouTube/SoundCloud following
the same pattern. Phase 3 unblocks "tell Kiko what music you like" with
real data instead of only the mock catalog.
