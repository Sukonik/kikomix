# KikoMix Design System — "Material You × Spotify"

A restyle of the KikoMix web app that fuses **Google Material Design 3
(Material You)** with **Spotify's player UX clarity**, keeping KikoMix's dark
identity and the signature orange brand accent.

- `css/tokens.css` — M3 dark color scheme, shape/type/elevation/state tokens
- `css/base.css` — reset, atmosphere, layout shell, focus, scrollbars
- `css/components.css` — M3 components (buttons, chips, cards, search bar, rows, nav bar, snackbar, switches, sliders, dialogs)
- `css/features.css` — feature panels (Now Playing, techniques, Solar Flare, Mimicry, LionDavid, mixes, sources) in the same language

Vanilla CSS, zero dependencies, no build step, system font stack only —
no web fonts, no external requests.

## Material Design 3 patterns used

- **Tonal surfaces** — `surface` plus `surface-container-lowest / low /
  container / high / highest` steps instead of flat grays. Cards sit on
  `surface-container-low`, the search bar and controls on
  `surface-container-high`, inputs on `surface-container-highest`. Elevation
  is expressed as tonal raise + soft shadow (M3 dark has no heavy shadows),
  levels 0–3.
- **Shape scale** — `xs 4 / sm 8 / md 12 / lg 16 / xl 28 / full 999`.
  Chips use 8px, cards 16px, dialogs 28px, buttons/chips-rows stay pill-shaped.
- **Type scale** — M3 display / headline / title / body / label sizes rendered
  in the system font stack (the honest vanilla equivalent of Roboto).
- **State layers** — hover 8% / pressed 12% / focus 12% opacities applied with
  `color-mix()`, e.g. `color-mix(in srgb, var(--on-primary) var(--state-hover),
  var(--primary))`. Used on every interactive element instead of ad-hoc
  brightness filters.
- **FAB** — the Now Playing transport's play button is an orange circular FAB
  (`.tbtn.tbtn-main`, 72px), composed from `.btn` + `.tbtn` so existing
  class names keep working.
- **Navigation bar** — the bottom tab bar is an M3 navigation bar: 80px,
  `surface-container`, 6 destinations, 56×32 active-indicator pill behind the
  active icon, 12px labels, orange active color.
- **Chips** — assist chips (static info like "Prototype mock", "Connected")
  and filter chips (toggleable, `.active` / `[aria-pressed="true"]` /
  `.selected` → `secondary-container`). Horizontally scrollable rows.
- **Sliders** — M3 linear sliders: 4px track, orange active fill driven by
  `--fill` (WebKit) / `::-moz-range-progress` (Firefox), 20px thumb with a
  state-layer halo on hover/focus, 48px touch height.
- **Switches** — M3 switch anatomy: 52×32 track, 16px thumb unselected,
  24px thumb selected, orange selected track; the `<label>` is a 48px touch
  target (the DOM is `label.switch > input + span`, styled accordingly).
- **Snackbar** — `#toast` is an M3 snackbar: inverse-surface container,
  8px radius, 48px min-height, visibility driven by the existing `.show`
  class (no more always-rendered empty pill).
- **Dialogs** — `.modal.show` + `.modal-card`: M3 dialog on
  `surface-container-high`, 28px radius, bottom sheet on mobile, centered
  dialog ≥600px, safe-area-aware padding.

## Spotify patterns used

- **List rows** — 64px rows (56px compact variant), 56px rounded artwork
  (48px in compact rows), two-line title/artist with ellipsis, right-side
  actions, hover/press state layers. This is the shared anatomy for search
  results, library songs/artists/albums, home rows, mix tracks, and sources.
- **Player bar anatomy** — Now Playing follows the Spotify stack: large
  rounded artwork → centered title/artist → service badge → honest
  "simulated playback" notice → 4px linear progress with tabular-nums time
  labels → transport (prev / FAB play / next) → "Up next" queue with the
  current track highlighted in orange.
- **Section headers** — generous whitespace (32px above / 16px below),
  title-large bold type, no cramped uppercase labels.

## Responsive layout (see `css/layout.css`, `css/playerbar.css`)

- **<600px** — M3 bottom navigation bar (fixed, 6 destinations, safe-area
  insets); `#player` is a 64px mini-player docked above it (artwork, title/
  artist, play-pause; tap expands); `#queue` is a bottom sheet (≤72dvh).
- **600–1024px** — the same `#tabbar` element becomes an 80px M3 navigation
  rail (fixed left, icon+label); player stays mini-style, offset past the
  rail; queue becomes a right-anchored popover.
- **>1024px** — rail persists; `#player` becomes a full ~88px Spotify-style
  bottom bar: left (artwork, title/artist, like, source badge), center
  (shuffle/prev/play/next/repeat + seek bar with time labels), right
  ("Open in provider" link, queue toggle, volume slider).
- Tapping the mini-player (or the Playing tab with an active track) presents
  Now Playing as a full-screen sheet on mobile with a collapse chevron.
- Content grids use `repeat(auto-fill, minmax(160px, 1fr))`; main column
  max-widths 720 → 960 → 1240px; `body.has-player` reserves bottom padding.

## Deliberately left out

- **M3 dynamic color / tonal palettes** — the seed is fixed: signature orange
  primary (`#FF8000`), muted slate secondary. No user theming.
- **Navigation drawer** — the rail + bottom bar cover all six destinations.
- **Light theme** — dark identity is the product; `color-scheme: dark` is set.
- **Web fonts / external requests** — system stack only, per constraints.
- **Bottom-sheet drag handles as interaction** — sheets dismiss via buttons;
  no gesture JS was added.
- **Data tables, date pickers, menus, segmented buttons** — not needed by
  the app's DOM.
- **Strobing or high-energy motion anywhere** — see Safety below.

## Color roles

- **Primary orange `#FF8000`** (signature brand accent):
  CTAs, active states, progress, FAB, focus rings.
  `on-primary` is dark (`#160b00`); `primary-container` is a dark tonal orange
  (`#3a1e00`) with light orange text (`#ffb163`).
- **Secondary muted slate**: tonal buttons, selected filter chips.
- **Technique accents** (crimson, solar yellow, electric blue, violet, teal —
  all slightly muted for dark mode): **reserved for their features only**
  (Tri-Beam, Solar Flare, Dodon Ray, Multi-Form, Four Witches). Technique
  panels read the inline `--tech` custom property the JS sets and tame it
  with `color-mix()` toward the surface, so even saturated values render
  premium, never neon. General UI chrome never uses these accents.
- **Source brand colors** (Spotify green, YouTube red, SoundCloud orange,
  Apple pink, local violet): kept, used only in source badges/rows.

## Spacing & touch

- 16/24 rhythm (`--space-4` / `--space-6`): card padding 16, section gaps 24,
  section headers 32/16.
- Minimum 48px touch targets on buttons, chips, icon buttons, switches,
  sliders, tab destinations, and dismiss controls.
- Safe-area insets (`env(safe-area-inset-bottom)`) on the nav bar, main
  bottom padding, and dialog padding.

## Motion

- Gentle `cubic-bezier(.22, 1, .36, 1)` transitions, 150–300ms.
- `prefers-reduced-motion` kills all animation/scrolling and hides the
  decorative waveform.

## Safety (non-negotiable, unchanged)

Solar Flare's photosensitivity warning modal, reduced-motion support,
brightness control, default-OFF behavior, and the gentle-4s-pulse-only rule
(no strobing, ever) are implemented in `js/solarflare.js` and were not
touched. The restyle only changed the `.solar-card` control panel's visuals;
the `.solar-stage` / `.solar-glow` layer remains entirely JS-owned
(the old CSS `::before` glow duplicate was removed so it can't double-render
under the injected layer).
