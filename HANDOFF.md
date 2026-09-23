# Handoff — Cole → King David

*2026-09-23, branch `claude/kikomix-player-improvements-uh73mh`. Builds on
`NOTES_FOR_DAVID.md` (architecture notes) and its live-site addendum
(screenshot-based findings). This doc is the action list.*

## Already fixed in this branch — pull these in

Two of the four live-site findings were mechanical enough to just fix
rather than hand back as a ticket:

1. **Leaked internal note in the production footer.**
   `web/index.html:109` said *"Focus Every Sound · brand board supplied by
   Nathan, 2026"* on every tab. Changed to `© 2026 KikoMix · Search → Play
   → Save`. This was the single most visible "looks unfinished" signal on
   the site — worth double-checking nothing else in the repo has similar
   internal notes that made it into user-facing strings (I only searched
   for this specific phrase).

2. **Home led with brand art instead of content.** The `.brand-hero`
   block (mark + wordmark image + full character-art image) rendered above
   "Recently played" on *every* visit, not just the first — on a phone that
   pushed all real content below the fold. Fix: `web/js/app.js`
   (`renderHome`) now checks the existing `km:lion-intro` flag
   (liondavid.js already sets this once onboarding is dismissed) and adds
   `.brand-hero--compact` (new rule in `web/css/components.css`), which
   hides the mark/wordmark/character images and keeps only the short
   welcome line. First-time visitors still get the full moment; everyone
   after that gets content immediately. Verified locally with Playwright
   screenshots before/after — before: hero pushed "Recommended for you"
   ~1200px down on a 390px-wide screen; after: it's the second thing on the
   page.

Both are small, verified diffs — safe to merge as-is.

## Still open — yours to design, not mine to guess at

These need actual design judgment, not a mechanical fix, so I left them as
tickets instead of just changing them:

3. **Icon-picker sprawl on the Sources tab.** The connections list itself
   (Spotify/YouTube/SoundCloud, free-vs-subscription badges, honest
   blurbs) is good — keep it exactly as is. Below it, a 12-option app-icon
   gallery (Midnight/Ember/Tide/Ghost/Solarwave/Neon/Holo/Prism/Ruby/Leaf/
   Master) plus an accent-color picker takes up roughly 2× the space of the
   connections above it. **Ask:** either move icon/accent picking to its
   own "Appearance" tab-within-Settings, or cut it to 2-3 curated options
   for now and bring the rest back once there's an actual Settings surface
   to house it in (there isn't one yet — see nav note below). Don't delete
   the feature, just stop letting it out-weigh the thing the tab is named
   for.

4. **Home's "Services" chip row vs. the Sources tab** — correction to my
   earlier note: I initially called this a duplicate control; it's actually
   read-only status chips that jump to Sources (`app.js` `wireHome`), which
   is a defensible "at a glance" pattern, not a redundant toggle. Leaving
   this one as a judgment call for you rather than a ticket — it's fine to
   keep, but if Home keeps growing, this is a candidate to cut before the
   icon-picker fight above.

5. **Nav taxonomy still doesn't match the README.** Root `README.md`
   promises 5 tabs (Search, Playlists, Now Playing, Connections,
   Settings); `index.html` has 6 (Home, Search, Library, Mixes, Now
   Playing, Sources) and no Settings tab exists anywhere — which is where
   the Appearance/icon-picker stuff from #3 would naturally live. Pick the
   real tab set and fix the README to match; I'd bet Settings needs to
   exist regardless of what else changes, just to give #3 a home.

## General encouragement on UI/UX

The design system itself (`web/DESIGN.md`) is legitimately well thought
out — the M3 tonal surfaces, the Spotify row anatomy, the three real
breakpoints, the safety work on Solar Flare. The gap between "well-built"
and "looks like Spotify, not junk" isn't the token system, it's screen
*composition*: how much brand chrome vs. content is on screen at once, and
whether every feature gets equal visual weight regardless of how central
it is to Search → Play → Save. Worth doing a pass over every tab asking
"if I removed this section, would the core loop still work?" — if yes,
it's a candidate to demote, collapse, or move behind a secondary tap,
exactly like #3 above. That single lens will do more for the
"Spotify, not junk" goal than any new component.

---

# Backend plan

See `BACKEND_PLAN.md` for the full plan. Short version: KikoMix has zero
backend today (everything lives in `localStorage`), and that has to change
before SMS auth, email auth, or real Spotify/YouTube/SoundCloud OAuth can
be anything but mocked — `web/js/adapters.js` already flags this itself
("never store raw tokens in localStorage — use the provider SDK or a
secure backend"). The plan lays out the stack recommendation, phased
rollout, data model, and the security/ToS constraints that matter most
(especially around Spotify).
