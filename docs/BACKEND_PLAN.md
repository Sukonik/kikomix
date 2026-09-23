# KikoMix Backend Plan

*Status: scoped, not started. Awaiting Nathan's vendor + privacy decisions (Section 0).*
*Author: King David, 2026-09-23. Builds on Cole's NOTES_FOR_DAVID.md §§5–6.*

## Why

KikoMix is fully client-side today: sources, mixes, LionDavid state all live in
`localStorage`. That is fine for mock connections, but `adapters.js` already
states the blocking constraint: *"Never store raw tokens in localStorage — use
the provider SDK or a secure backend."* These features are impossible without a
backend to hold secrets:

- SMS / email account management (Twilio Verify, magic links)
- Real Spotify / YouTube / SoundCloud OAuth (refresh tokens must live server-side)
- Taste profiles that follow the user across devices (quiz + Mimicry vectors)
- Any LLM-assisted feature (API keys cannot ship in client JS)

This plan stands the backend up **once**, minimally, then layers features on it.

## 0. Decisions needed from Nathan (blocking)

1. **Vendor: Supabase (recommended) vs. Clerk.**
   - *Supabase*: auth (email magic link + phone OTP via Twilio Verify
     integration) + Postgres + Edge Functions + Vault (encrypted secrets) in
     one product, generous free tier. One integration covers SMS *and* email.
   - *Clerk*: turnkey prebuilt SMS/email/OTP UI, less backend code — but you
     still need a database somewhere for provider tokens and taste vectors,
     so it is really Clerk + (Supabase/Neon Postgres) = two vendors.
   - Recommendation: **Supabase alone** until scale says otherwise.
2. **Privacy posture for listening data.** Rule, non-negotiable: listening
   history, taste vectors, and mix contents stay on-device until the user
   explicitly opts into sync. The backend never shares them with third parties
   without permission. This matches the product's existing safety constraints.
3. **Account-sharing policy** (from Cole's ToS flag — encode in UX copy, not
   just docs): one person drives playback through *their own* linked account.
   "Sharing" = a household model where each person links their own account and
   mixes are shared *between* linked accounts. Pooling one paid login across
   users is out — it risks our API access.

## 1. Architecture (Supabase)

```
KikoMix PWA (vanilla JS, unchanged hosting on GitHub Pages)
   │  Supabase JS client (anon key only — safe in client code)
   ▼
Supabase Auth ── email magic link, phone OTP (Twilio Verify under the hood)
Supabase Postgres (RLS on everything)
   ├── profiles        (id uuid PK, display_name, created_at)
   ├── provider_tokens (user_id FK, provider, access_token_enc, refresh_token_enc,
   │                     expires_at — encrypted via Vault/pgsodium; RLS: owner only)
   └── taste_vectors   (user_id FK, vector jsonb from quiz + Mimicry, updated_at)
Supabase Edge Functions (Deno, secrets in Vault — never in the client)
   ├── spotify-oauth-start / spotify-oauth-callback  (PKCE code exchange)
   ├── token-refresh      (cron-ish; refreshes expiring provider tokens)
   └── llm-taste-query    (Phase 4; natural-language → Mimicry filters)
```

Session handling: Supabase Auth issues httpOnly cookies where possible; the
PWA keeps working fully offline/local with zero backend (mock adapters remain
the default until the user links an account — offline-first is preserved).

## 2. Phases

**Phase 1 — Auth + token vault (unblocks everything).**
- Supabase project, Auth with email magic link + phone OTP.
- `provider_tokens` table with RLS; Edge Function skeleton for token storage.
- App: account entry point in Sources tab ("Link account" → hosted Supabase
  Auth UI in a popup/in-app browser; no credentials ever touch our JS).
- Success criteria: user can create an account by email or SMS OTP; session
  persists; logged-out app behaves exactly as today.

**Phase 2 — Spotify OAuth end-to-end (proves the pattern once).**
- Register Spotify app; Authorization Code with PKCE; code exchange happens
  in `spotify-oauth-callback` (client secret never leaves the server).
- Store refresh token encrypted; `token-refresh` keeps it alive.
- App: `adapters.js` gains a real-token path behind the existing adapter
  interface; Sources rows show "Linked" state; keep the honest Free/Premium
  badges — badge logic must not rot once real tokens exist.
- Web Playback SDK for Premium-linked in-browser playback; Free accounts keep
  the current honest behavior (open in Spotify, subject to its limits).

**Phase 3 — YouTube + SoundCloud.** Reuse the Phase 2 pattern (token vault +
edge exchange). Both are already scoped as no-account-needed embeds; OAuth
only where it adds value (e.g. liked videos, uploads).

**Phase 4 — Taste profiles.** Structured quiz seeds `taste_vectors` (feeds the
existing Mimicry scoring — no new recommendation system). Optional
`llm-taste-query`: natural language → filters over Mimicry's
mood/tempo/genre/era/energy fields. With Spotify OAuth, seed from the user's
real top tracks/artists via the Web API.

**Phase 5 — Hardening.** RLS audit, rate limits on edge functions, token
rotation, backup/restore story, cost alerts on the free tier.

## 3. Security rules (carried forward)

- Never raw provider tokens in `localStorage` (existing `adapters.js` rule).
- Client holds only the Supabase **anon** key; service-role key lives in Edge
  Functions only.
- RLS: users read/write only their own rows, always.
- SMS OTP via Twilio Verify (not home-rolled codes); magic links short-lived.
- No listening-data sharing without explicit opt-in (see §0.2).

## 4. What changes in the app (vanilla JS stays)

- `adapters.js`: real-token code path next to the mock path; same interface.
- `sources.js`: "Link account" / "Connect with Spotify" buttons; linked state.
- `sw.js`: cache the Supabase JS client? No — load it as an ES module import
  from CDN with SRI, or vendor a pinned copy. Decide in Phase 1.
- Everything else (Search → Play → Save, Mixes, Mimicry, Labs, LionDavid)
  keeps working with zero backend — the backend is additive.

## 5. Cost (free-tier sketch, verify at build time)

- Supabase free: 500MB Postgres, 50k monthly active users, 500k edge function
  invocations — ample for MVP.
- Twilio Verify: ~$0.05 per verification (only cost that scales with SMS
  users); email magic links are effectively free.
- Spotify/YouTube/SoundCloud APIs: free within quotas.

## 6. Open questions

- Do we need social login (Google/Apple) in Phase 1, or is email+SMS enough?
- Offline-first conflict: what happens to a linked account's mixes when the
  user is offline for a week? (Proposed: local-first with background sync.)
- Who holds the Spotify developer app — Nathan's account or a KikoMix org?
