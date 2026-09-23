# Notes for King David — from Cole

*Reviewed 2026-09-23, branch `claude/kikomix-player-improvements-uh73mh`.*

## Addendum — live-site pass (screenshots, not just code)

Nathan shared the live link (https://sukonik.github.io/kikomix/), so I
headless-browsed it at mobile (390×844) and desktop (1440×900) widths instead
of just reading the source. Four concrete things, roughly in priority order:

1. **Fix now — internal note is live in production.** Every tab's footer
   renders `Focus Every Sound · brand board supplied by Nathan, 2026`
   (`web/index.html:109`). That reads as a leaked handoff note, not a
   product tagline, and it's the single most visible "unfinished" signal on
   the whole site — more damaging to the "look like Spotify, not junk" goal
   than any layout choice below. One-line fix.
2. **Home leads with branding, not content.** On mobile, the logo mark, a
   wordmark lockup image, and a large character-art panel all render above
   "Recently played" / "Recommended for you" — a new visitor scrolls past
   three stacked brand images before seeing a single track. Spotify's home
   is content on load, every time. Keep the hero art for a one-time splash
   or onboarding step; don't render it inline on the Home tab itself.
3. **Sources tab is dominated by the icon picker, not connections.** The
   actual connection list (Spotify/YouTube/SoundCloud free-tier badges,
   honest blurbs) is genuinely good and reads clean. But scrolling past it
   hits a 12-option app-icon gallery (Midnight/Ember/Tide/Ghost/Solarwave/
   Neon/Holo/Prism/Ruby/Leaf/Master) plus an accent-color picker, taking up
   roughly 2× the space of the connections themselves. This is the "gimmick
   soup" feeling from Section 2 above, concretely. Move it to its own
   "Appearance" surface, or cut it down for now.
4. **Home duplicates Sources.** A "Services" row of the same connect
   toggles appears on both Home and Sources. Pick one home for that control
   (Sources, per the nav's own naming) and drop it from Home.

Not a real bug, for the record: my headless run logged a `KM_DATA is
missing` console warning and some failed script fetches, but `curl`
confirms `js/data.js`/`js/adapters.js` both return 200 and load in the
correct order on the live Pages deploy — that warning was an artifact of my
sandboxed test proxy, not something affecting real visitors.

Nathan asked me to look over KikoMix and leave you notes on where to take it
next. Good news first: MVP One is a real, working PWA — vanilla JS, zero
deps, already has a full M3×Spotify restyle with three real breakpoints
(mobile bottom nav, tablet rail, desktop bottom bar), a documented
"real integration seam" in `adapters.js`, and honest labeling everywhere
playback is simulated. That's a solid foundation. Below is what I'd tackle
next, in the order I'd tackle it, plus straight answers on the specific
things Nathan asked about.

---

## 1. Responsive build — mostly there, a few gaps

`web/DESIGN.md` and `css/layout.css` already define the three breakpoints
correctly. What's missing before calling it done:

- **No real-device pass yet.** Everything above is "as designed," not
  "as verified." Load it on an actual small phone (iPhone SE width, 375px)
  and a real tablet in both orientations — check the nav rail doesn't eat
  content width at 600–768px, and that the bottom sheet queue doesn't clip
  under iOS Safari's dynamic toolbar.
- **No Lighthouse/perf budget.** Zero dependencies is great for speed, but
  nobody's measured it. Run Lighthouse (mobile) and set a budget (e.g. LCP
  < 2s on 4G) before the catalog grows past mock data.
- **Nav taxonomy is inconsistent between docs and code.** The root
  `README.md` promises 5 tabs (Search, Playlists, Now Playing, Connections,
  Settings). The actual `index.html` has 6 (Home, Search, Library, Mixes,
  Now Playing, Sources) — and there's no Settings tab at all. Pick one and
  reconcile the docs; right now anyone reading the README first will be
  confused when they open the app.
- **Container queries, not just media queries.** You've got components
  (track rows, cards) that get reused in the rail-open vs. rail-closed
  states — `@container` queries would let a card resize based on the panel
  it's in rather than the viewport, which matters once the rail becomes
  collapsible.

## 2. "Less junk, more Spotify" — the interface note

Spotify reads clean for three reasons KikoMix doesn't fully have yet:

- **Restraint on custom-branded features.** Right now the primary nav and
  tab content surface LionDavid, Mimicry, Solar Flare, Tri-Beam, Dodon Ray,
  Four Witches, and Multi-Form all at once. Individually they're fun, but
  stacked together in an MVP they read as "gimmick soup" next to Spotify's
  focused surface (Home / Search / Library, nothing else competing for
  attention). Recommendation: collapse everything except Mimicry into a
  single "Labs" or "Techniques" entry point (you already have
  `techniques.js` as a natural home for this), and let Search → Play → Save
  own the primary nav uncontested, per the README's own stated priority.
- **Imagery-forward, not list-forward.** Spotify's home screen leads with
  large album-art tiles and gradient hero cards; the current home render
  in `app.js` leans on track-row lists everywhere. Add a hero/grid treatment
  for Home (big art, 2–3 per row on mobile) and reserve dense rows for
  Search results and Library, where users are scanning, not browsing.
- **Type is doing less work than it could.** `tokens.css` uses the system
  font stack only (deliberate, for the zero-external-requests constraint).
  If you want it to feel like Spotify specifically, self-host a single
  variable font (e.g. Inter or Manrope) as a static asset in `web/assets/` —
  that keeps the "no external requests" rule intact (it's not a Google
  Fonts CDN call, it ships with the app) while giving you real display-size
  hierarchy instead of the system stack's more utilitarian feel.

None of this needs a framework rewrite — it's CSS/markup work inside the
existing token system.

## 3. "Night Studio" framework

I looked for it and couldn't find an established design/UI framework by
that name — not in current design-tool listings, not in UX framework
roundups. A few possibilities: it's a very new or niche tool that hasn't
been indexed yet, a misremembered name for something else, or an internal
tool from another project. **Can you point me to a link or repo for it?**
I don't want to guess and recommend the wrong thing.

In the meantime, here's the actual fork in the road worth deciding on
deliberately, since it's bigger than any single framework name:

- **Stay vanilla** (current approach): fastest to ship, zero build step,
  smallest bundle, easiest to keep as an installable PWA with no tooling
  overhead. Cost: you hand-build every component and hand-maintain the
  design tokens yourselves, which is what `DESIGN.md` is already doing well.
- **Adopt a component system**: Radix Primitives + Tailwind, or shadcn/ui,
  would get you Spotify-grade interaction polish (accessible menus, sheets,
  sliders) fast — but it means introducing a build step (Vite/Next) and a
  framework (React), which is a real architecture change, not a drop-in.

I'd only make that jump once you're adding native-feeling surfaces (OAuth
flows, account settings, chat-style recommendations) that vanilla DOM
manipulation starts to make painful — not before.

## 4. Automated app builds

Today there's exactly one workflow (`deploy-pages.yml`): push to `main` →
deploy `web/` to GitHub Pages. Nothing else is automated. Before adding
new features, I'd bolt on:

- **CI checks on PRs**, not just deploy on merge: HTML/CSS/JS lint
  (`eslint`, `stylelint`), and a Lighthouse CI run so a regression is
  caught before merge, not after it's live.
- **Preview deploys per PR** (Netlify or Vercel both do this for free on a
  static site) so reviewers can click a link instead of pulling the branch.
- **Native build automation**, matching the README's own iOS/Android
  roadmap: once you wrap the PWA, use PWABuilder or Capacitor with a GitHub
  Actions job that produces a signed TestFlight/Play Console build on tag
  push. Don't hand-build native binaries locally — automate it from day one
  so "later" (Android, per the roadmap table) doesn't become a manual
  scramble.

## 5. SMS account management (Twilio) and email account management

Here's the thing that has to happen before either of these is real:
**KikoMix has no backend at all today.** Everything — sources, mixes,
LionDavid state — lives in `localStorage`. That's fine for mock
connections, but `adapters.js` itself already flags the constraint that
matters here: *"Never store raw tokens in localStorage — use the provider
SDK or a secure backend."* SMS/email login and OAuth account-linking are
exactly the features that need that secure backend to exist. So this isn't
really "add Twilio," it's "stand up a minimal backend, then add Twilio to
it."

Two realistic paths:

- **Fastest to ship**: an auth-as-a-service that bundles SMS, email, and
  custom OAuth in one product — Supabase Auth (Postgres + Edge Functions,
  generous free tier, straightforward to register Spotify as a custom OAuth
  provider) or Clerk (turnkey prebuilt SMS/email/OTP UI components, less
  backend code to write). Either gets you SMS *and* email account
  management in the same integration, not two separate builds.
- **More control, more work**: Twilio Verify API specifically for phone
  OTP, paired with a transactional email provider (Postmark/SendGrid) for
  magic-link email, sitting behind your own small serverless backend
  (Cloudflare Workers or Vercel Functions are the lowest-friction fit for a
  currently-static site) that issues sessions and holds encrypted OAuth
  refresh tokens server-side.

I'd lead with the first option — Supabase in particular, since you'll also
need a real database for user accounts and linked-provider tokens the
moment account linking (next section) becomes real, and it gives you both
the auth and the database in one piece.

## 6. Linking Spotify (MVP), then YouTube and SoundCloud

Spotify first is the right call — the web app's free-tier docs
(`web/README.md`) already correctly document Spotify's real constraints
(deprecated 30s preview API, on-demand playback for free users capped with
ads, full on-demand needs Premium). Implementation-wise: Authorization Code
with PKCE, Web Playback SDK for in-browser playback for Premium-linked
accounts, and keep the honest "Free" vs. "Premium required" badges you
already have in `sources.js`/`adapters.js` — don't let the badge logic rot
once real tokens exist. YouTube (IFrame Player API) and SoundCloud (HTML5
widget) are already correctly scoped in the docs as no-account-needed —
add those after Spotify OAuth proves the backend/token-storage pattern
works.

**One flag on "let users share their free and paid accounts":** worth
clarifying what's meant. Letting *one person* control playback through
*their own* linked Spotify/Apple account inside KikoMix is exactly the
integration above — fine. Letting *multiple separate people* pool or share
one paid account's login/session across KikoMix users would violate
Spotify's and Apple Music's developer terms (account/credential sharing),
and risks KikoMix's own API access getting revoked. If "share" means
something like a household/profile model (each person still authenticates
their own account, but playlists/mixes are shared *between* linked
accounts), that's safe and is really just the Mixes feature you already
have, extended across users instead of across services.

## 7. "Tell Kiko what music you like"

This is a natural extension of `mimicry.js`, which already models
mood/tempo/genre/era/energy per track. I'd build it in two layers:

1. **Structured onboarding**: a short taste quiz (pick genres/artists) that
   seeds a taste vector, feeding the existing Mimicry scoring instead of a
   new system.
2. **Natural-language surface**: once an LLM is in the loop, let users type
   something like "moody electronic for studying" and translate that to
   filters over the same mood/tempo/genre/era/energy fields Mimicry already
   uses — that's a good, scoped use of an LLM (query → filter mapping), not
   a full recommendation engine you'd need to train. Once Spotify OAuth
   exists, you can also pull the user's real top tracks/artists via the
   Spotify Web API to seed this instead of relying only on in-catalog mock
   data.

---

## Suggested order of operations

1. Reconcile the nav/tab inconsistency (README vs. `index.html`) — cheap,
   removes confusion for anyone else picking this up.
2. Ship the interface decluttering (Section 2) — pure CSS/markup, no new
   infra, biggest visible "less junk" win for the least risk.
3. Stand up the backend + auth service (Section 5) — this unblocks
   everything below it (SMS, email, real OAuth, taste profiles).
4. Spotify OAuth end-to-end, replacing the mock adapter — proves the token
   storage pattern once, reuse it for YouTube/SoundCloud.
5. Taste onboarding + Mimicry-backed recommendations.
6. CI/build automation (Section 4) alongside the above, not after — add
   lint/Lighthouse checks as soon as the codebase starts growing past
   mock-data size.

Let me know if you want me to scope any one of these into an actual
implementation plan or start writing code for a specific piece.
