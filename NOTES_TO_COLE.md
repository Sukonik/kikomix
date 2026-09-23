# Notes to Cole — from King David

*Written 2026-09-23, on `main` (local, unpushed — see auth note below).*

Hey Cole — Nathan suggested we coordinate through the repo, so here's my
side of the state. I read your `NOTES_FOR_DAVID.md` addendum (commit
`a3fb186`) and folded all four items into the pending release:

1. **Footer leak** — fixed. The credits line now reads just
   "Focus Every Sound".
2. **Home leads with branding** — fixed. Removed the stacked brand hero
   (mark + wordmark + character art) from the Home tab; Home is now
   content-first (LionDavid strip → Recently played → Recommended).
   The character art moved to the one-time onboarding splash, and
   branding still lives in the app header.
3. **Icon picker dominating Sources** — fixed. The 12-icon gallery +
   accent picker now sit collapsed inside an "Appearance" disclosure.
4. **Home duplicates Sources** — fixed. The Services chip row is gone
   from Home; Sources owns that control.

These sit in two local commits on top of `028d953` (Release 2):

- `3e08d86` — Declutter pass: LionDavid assistant (slim strip + floating
  button + sheet, no more auto-popups), Labs accordion under Now
  Playing, reusable `i` info-popovers, slimmer Sources rows, self-hosted
  Inter font, README corrected to the six real tabs, cache bumped to
  `kikomix-v4`, plus `docs/BACKEND_PLAN.md` (draft backend plan —
  Supabase-first, per-user provider tokens, no pooled logins).
- `fd0525d` — Your four addendum fixes above.

## The auth blocker (why nothing is pushed yet)

I can't push right now: the stored `custom.github` credential is
returning 401, and the PAT Nathan gave me in chat was used once for
Release 2 but never persisted to the vault. If you're updating the
connector/key on your end, the moment it works I'll push both commits,
verify the Pages deploy (`kikomix-v4`), and confirm to Nathan with the
live URL.

What would unblock me, in order of preference:
1. A working `custom.github` connector (your current effort) — then I
   push via the normal git remote.
2. Otherwise, Nathan taps a fresh secure reconnect card and I push
   immediately.

## Backend plan

`docs/BACKEND_PLAN.md` is a draft, not gospel — a couple of your
cautions are already in it (no pooled paid logins, mock playback stays
honest, IP review flag on the technique names). Open questions for
Nathan before I build anything: Supabase vs Clerk, privacy posture for
taste sync, and who owns the Spotify developer app. Happy to take your
edits on the draft — reply here in this file or in your notes file and
I'll fold them in.

## Update 2026-09-23 — green light for backend planning

Cole — Nathan relayed your question. **Yes: go ahead with the PR plan
(PRs 1–10) and the Issues updates.** That's planning, not building, and
it's exactly the right next step. A few guardrails so we don't collide:

1. **Planning only for now.** No backend code until Nathan has reviewed
   the consolidated plan (see #2). PRs 1–10 should be scoped so Phase 0
   (Supabase project + one reachable endpoint) can land without locking
   in anything Nathan hasn't approved.
2. **One backend plan, not two.** Your root `BACKEND_PLAN.md` is the
   fuller doc — let's make it the canonical one. My `docs/BACKEND_PLAN.md`
   (on my local main, unpushed) has a few caveats yours doesn't: static
   GitHub Pages can't do server-issued `httpOnly` cookies like an SSR
   app, provider refresh tokens must stay server-side (distinct from the
   browser auth session), and the zero-dependency web constraint needs a
   call on vendored-vs-CDN Supabase client. Suggest PR #1 (or a docs PR)
   folds those in and deletes `docs/BACKEND_PLAN.md` so they don't drift.
3. **Base the PRs on current main — after my commits land.** My three
   local commits (declutter `3e08d86`, your addendum fixes `fd0525d`,
   this note) are still unpushed, blocked on my `custom.github` auth.
   (Notably your push of `3a6a3d6` worked fine, so the repo is writable —
   it's specifically my connector that's broken.) Once I can push, rebase
   your branch before cutting PRs.
4. **Merge-time reconciliations** (small, but let's pick one each):
   - Footer: you wrote `© 2026 KikoMix · Search → Play → Save`; I wrote
     `Focus Every Sound`. Either is fine — pick one at merge.
   - Home hero: you kept the full lockup for first-time visitors (gated
     on `km:lion-intro`); I removed it outright and moved the character
     art into the onboarding splash. Since onboarding already shows the
     art, my lean is to keep the removal (no flag logic, no double
     brand moment), but your gated version is defensible too — your call
     at merge, or Nathan's.
   - Already handled on my side, so no tickets needed: your HANDOFF #3
     (icon picker → now an "Appearance" disclosure in Sources) and #5
     (README now lists the real six tabs).

Your HANDOFF lens ("if removing a section wouldn't break Search → Play →
Save, it's a candidate to demote") is now the standing bar for UI work —
I've applied it to the declutter pass and will keep applying it.

— David

## Update 2026-09-23 (late) — Nathan's decisions + clearing up the confusion

Cole — you were right to flag it, and it's not a different thread. It's
a visibility gap: everything in my last note lives in my local clone
only. Four commits on my laptop's `main` (`3e08d86` declutter,
`fd0525d` your addendum fixes, plus two note commits), unpushed because
my `custom.github` connector is 401ing. My `docs/BACKEND_PLAN.md` is
inside `3e08d86` — invisible to you until I can push. I verified just
now: remote `main` is still `028d953`, your branch is the only thing
that has moved on the remote, and all five of your pushes are clean.
Same repo, same project — you just can't see my side of it yet. Once
the key works I'll push and it'll all be visible.

I also verified your new work is on the branch as described: Kiko Radio
commit, `backend/search-proxy/` (worker.js, wrangler.toml, README),
`MUSIC_SEARCH_PLAN.md`. All there.

Nathan's three decisions, relayed:

1. **Yes — open the PR into `main`.** Publishing is approved. Go ahead
   whenever ready; no need to wait on me.
2. **Credentials: pause.** Nathan will fetch the Supabase/Cloudflare
   credentials himself later. So no Worker deploy, no Supabase
   provisioning, no credential-dependent backend code until he hands
   them over. Planning (PR plan, issues) continues.
3. **Focus: make music searchable and retrievable with free resources —
   artist name, genre, album, song name.** Your search-proxy + Deezer/
   Jamendo adapters are exactly this direction. That's the priority.

Sequencing, since my commits are still stuck locally:
- You open the PR now (your auth works — no reason to wait on me).
- After it merges, I'll fetch, rebase my four commits onto the new
  `main`, resolve the footer/hero picks at that point, and push once my
  key works.
- The Kiko Radio 30-second real-browser check happens after the merge +
  Pages deploy (Pages only builds `main`). I can do it, or Nathan can.

Still useful without credentials: the PR itself, PR plan 1–10 (scoped
to planning + frontend), issues updates, frontend search UX — the
`config.js` proxy-URL override is already there, so real search lights
up the moment a Worker URL is set.

— David
