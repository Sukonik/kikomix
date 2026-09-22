/* KikoMix — Brand picker + artwork placement
 *
 * window.KM.brand = { icon(), accent(), iconSrc(id), setIcon(id),
 *   setAccent(hex), applyVariant(id), applyAccent(hex), init(), apply(),
 *   sectionHTML(), emptyHTML(title, copy) }
 *
 * The in-app Brand picker (Sources tab) lets the user switch the icon
 * variant artwork (a GitHub-style gallery: "Dark (Primary)" plus the
 * icon variants listed in web/icons/variants/manifest.json) and the
 * brand accent color (signature orange #FF8000, alternate blue
 * #009FFF). Both choices are persisted in localStorage
 * ('km.brand.icon', 'km.brand.accent') and applied on boot:
 *   - the header logo (header.app-header img.logo)
 *   - every <img data-brand-slot> (home hero badge, Now Playing
 *     empty-state art)
 *     all get the chosen variant's artwork
 *   - the --brand-accent CSS variable is set live on :root
 *
 * The variant gallery loads its rows from
 * icons/variants/manifest.json at runtime. If the manifest is missing
 * or malformed the picker degrades to a short "still generating" note
 * and the Dark primary keeps working.
 *
 * Honest boundary: this only rebrands the app itself. The installed
 * PWA home-screen icon is fixed by the OS at install time and cannot
 * be changed from here — the picker says exactly that.
 *
 * Brand rules (web/assets/brand/BRAND.md): marks sit on black/dark
 * only; never stretch, recolor, or add gradients to the marks. The
 * accent tints chrome around the artwork (rings, glows, selected
 * states) — never the artwork itself.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  var ICON_KEY = 'km.brand.icon';
  var ACCENT_KEY = 'km.brand.accent';
  var MANIFEST_URL = 'icons/variants/manifest.json';
  var SHEET_URL = 'icons/variants/contact-sheet.png';
  var VARIANTS_DIR = 'icons/variants/';

  /* First gallery row — always present, never comes from the manifest. */
  var PRIMARY = {
    slug: 'dark',
    name: 'Dark (Primary)',
    thumb: 'icons/dark/icon-192.png',
    file: 'icons/dark/icon-192.png',
    description: 'Matches the black brand.'
  };

  var ACCENTS = [
    { hex: '#FF8000', label: 'Orange', note: 'Brand default' },
    { hex: '#009FFF', label: 'Blue', note: 'Alternate' }
  ];
  var FULL_SRC = 'assets/brand/character-full.jpg';
  var BUST_SRC = 'assets/brand/character-bust.jpg';

  /* Manifest state: 'idle' | 'loading' | 'ready' | 'failed'. */
  var manifestState = 'idle';
  var manifestVariants = []; // [{slug,name,thumb,file,description}] from manifest
  var sheetOK = false;       // contact-sheet.png confirmed loadable

  /* ---------- helpers ---------- */
  function esc(v) {
    try {
      if (KM.ui && typeof KM.ui.esc === 'function') return KM.ui.esc(v);
    } catch (e) {}
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }

  /** All currently known variants: Dark primary first, then manifest rows. */
  function variants() {
    return [PRIMARY].concat(manifestVariants);
  }
  function findVariant(slug) {
    var list = variants();
    for (var i = 0; i < list.length; i++) {
      if (list[i].slug === slug) return list[i];
    }
    return null;
  }
  function isVariant(slug) {
    return !!findVariant(slug);
  }
  function isAccent(hex) {
    return ACCENTS.some(function (a) { return a.hex === String(hex).toUpperCase(); });
  }

  /** Current icon variant slug ('dark' = primary, default; unknown → 'dark'). */
  function icon() {
    var v = read(ICON_KEY, 'dark');
    return isVariant(v) ? v : 'dark';
  }
  /** Current accent hex ('#FF8000' brand default). */
  function accent() {
    var v = String(read(ACCENT_KEY, '#FF8000')).toUpperCase();
    return isAccent(v) ? v : '#FF8000';
  }
  /** Full artwork path for a variant (relative; app is served under /kikomix/). */
  function iconSrc(slug) {
    var v = findVariant(slug);
    return v ? v.file : PRIMARY.file;
  }

  /* ---------- manifest loading (async, graceful) ---------- */
  function refreshSources() {
    try {
      if (KM.sources && typeof KM.sources.render === 'function') KM.sources.render();
    } catch (e) {}
  }
  function onManifestResolved() {
    // Stored choice may reference a manifest variant that was unknown at
    // boot — re-apply so header/hero/NP art catches up.
    apply();
    refreshSources();
  }
  function loadManifest() {
    if (manifestState !== 'idle') return;
    manifestState = 'loading';
    if (typeof fetch !== 'function') {
      manifestState = 'failed';
      return;
    }
    fetch(MANIFEST_URL)
      .then(function (res) {
        if (!res || !res.ok) throw new Error('manifest HTTP ' + (res && res.status));
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('manifest is not an array');
        var list = [];
        data.forEach(function (entry) {
          if (!entry || typeof entry !== 'object') return;
          var slug = String(entry.slug || '').trim();
          var name = String(entry.name || '').trim();
          var file = String(entry.file || '').trim();
          var thumb = String(entry.thumb || entry.file || '').trim();
          if (!slug || !name || !file) return;
          if (slug.toLowerCase() === PRIMARY.slug) return; // skip dark duplicates
          list.push({
            slug: slug,
            name: name,
            thumb: VARIANTS_DIR + thumb,
            file: VARIANTS_DIR + file,
            description: String(entry.description || '').trim()
          });
        });
        manifestVariants = list;
        manifestState = 'ready';
        onManifestResolved();
      })
      .catch(function () {
        manifestState = 'failed';
        refreshSources(); // gallery renders the "still generating" note
      });
  }
  function probeSheet() {
    try {
      var im = new Image();
      im.onload = function () {
        sheetOK = true;
        refreshSources(); // gallery re-renders with the preview header
      };
      im.onerror = function () {};
      im.src = SHEET_URL;
    } catch (e) {}
  }

  /* ---------- applying brand choices ---------- */
  /** Swap artwork src on the header logo + every [data-brand-slot]. */
  function applyArt(src) {
    try {
      var headerLogo = document.querySelector('header.app-header img.logo');
      if (headerLogo && headerLogo.getAttribute('src') !== src) {
        headerLogo.setAttribute('src', src);
      }
    } catch (e) {}
    try {
      var imgs = document.querySelectorAll('img[data-brand-slot]');
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].getAttribute('src') !== src) imgs[i].setAttribute('src', src);
      }
    } catch (e) {}
  }

  /** Apply persisted brand choices to the live DOM. Safe to call on boot. */
  function apply() {
    try {
      document.documentElement.style.setProperty('--brand-accent', accent());
    } catch (e) {}
    applyArt(iconSrc(icon()));
  }
  function init() { apply(); }

  function setIcon(slug) {
    if (!isVariant(slug)) return;
    write(ICON_KEY, slug);
    apply();
    refreshSources(); // updates the gallery's checked states
  }
  function setAccent(hex) {
    var v = String(hex).toUpperCase();
    if (!isAccent(v)) return;
    write(ACCENT_KEY, v);
    apply();
    refreshSources(); // updates the picker's checked states
  }

  /* ---------- Brand picker section (appended to the Sources tab) ---------- */
  var CHECK_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
    '<path d="M9.6 15.6 5.4 11.4l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z" fill="currentColor"/></svg>';

  function rowHTML(v) {
    var checked = v.slug === icon();
    var desc = v.description || '';
    return '<button type="button" class="brand-row"' +
      ' role="radio" aria-checked="' + (checked ? 'true' : 'false') + '"' +
      ' data-brand-icon="' + esc(v.slug) + '"' +
      ' aria-label="Icon variant: ' + esc(v.name) + (desc ? '. ' + esc(desc) : '') + '">' +
      '<img class="brand-row__thumb" src="' + esc(v.thumb) + '" alt="" width="48" height="48">' +
      '<span class="brand-row__meta">' +
      '<span class="brand-row__name">' + esc(v.name) + '</span>' +
      (desc ? '<span class="brand-row__desc">' + esc(desc) + '</span>' : '') +
      '</span>' +
      '<span class="brand-row__check" aria-hidden="true">' + CHECK_SVG + '</span>' +
      '</button>';
  }
  function galleryHTML() {
    var list = variants();
    var h = '<div class="brand-gallery" role="radiogroup" aria-label="App icon variant">';
    if (sheetOK) {
      h += '<div class="brand-sheet">' +
        '<img src="' + SHEET_URL + '" alt="Preview sheet of all icon variants">' +
        '</div>';
    }
    h += list.map(rowHTML).join('');
    if (manifestState === 'failed') {
      h += '<p class="brand-gallery__note">Icon variants are still generating — ' +
        'the Dark primary above is available now.</p>';
    } else if (manifestState === 'loading' || manifestState === 'idle') {
      h += '<p class="brand-gallery__note">Loading more icon variants…</p>';
    }
    h += '</div>';
    return h;
  }
  function swatchHTML(a) {
    var checked = a.hex === accent();
    return '<button type="button" class="brand-swatch"' +
      ' role="radio" aria-checked="' + (checked ? 'true' : 'false') + '"' +
      ' data-brand-accent="' + esc(a.hex) + '" style="--sw:' + esc(a.hex) + '"' +
      ' aria-label="Accent: ' + esc(a.label) + ', ' + esc(a.note.toLowerCase()) + '">' +
      '<span class="brand-swatch__dot" aria-hidden="true"></span>' +
      '<span class="brand-swatch__meta">' +
      '<span class="brand-swatch__label">' + esc(a.label) + '</span>' +
      '<span class="brand-swatch__note">' + esc(a.note) + '</span>' +
      '</span></button>';
  }
  function sectionHTML() {
    return '<h3 class="section-title"><span>Brand</span>' +
      '<img class="section-mark" src="' + BUST_SRC + '" alt="" width="32" height="32"></h3>' +
      '<p class="brand-note">This customizes KikoMix\'s branding inside the app. ' +
      'Your installed home-screen icon is set by your OS when you install the app ' +
      'and can\'t be changed from here.</p>' +
      '<h4 class="section-sub">Icon</h4>' +
      galleryHTML() +
      '<h4 class="section-sub">Accent</h4>' +
      '<div class="brand-swatches" role="radiogroup" aria-label="Brand accent color">' +
      ACCENTS.map(swatchHTML).join('') + '</div>';
  }

  /* ---------- Shared empty-state artwork (Library / Mixes / Search) ---------- */
  function emptyHTML(title, copy) {
    return '<div class="empty-state brand-empty">' +
      '<img class="brand-empty__art" src="' + FULL_SRC + '" alt="KikoMix character — ' +
      'martial-arts figure in a white gi forming the triangle-waveform gesture">' +
      '<p class="brand-empty__title">' + esc(title) + '</p>' +
      (copy ? '<p>' + esc(copy) + '</p>' : '') +
      '</div>';
  }

  KM.brand = {
    icon: icon,
    accent: accent,
    iconSrc: iconSrc,
    setIcon: setIcon,
    setAccent: setAccent,
    applyVariant: setIcon,
    applyAccent: setAccent,
    apply: apply,
    init: init,
    sectionHTML: sectionHTML,
    emptyHTML: emptyHTML,
    FULL_SRC: FULL_SRC,
    BUST_SRC: BUST_SRC
  };

  // Boot: apply persisted choices as soon as the script parses
  // (scripts sit after the markup, so brand slots already exist).
  // Manifest-dependent rows/artwork catch up when the fetch resolves.
  loadManifest();
  probeSheet();
  apply();
})();
