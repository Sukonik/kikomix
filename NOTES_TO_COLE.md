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

— David
