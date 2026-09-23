/* KikoMix — Labs (technique prototypes, all mocks)
 *
 * window.KM.techniques = { renderAll(container), onTrack(track) }
 *
 * The four technique prototypes plus Solar Flare live behind a single
 * "Labs" card as collapsible rows — accessible but out of the way.
 * Every panel is honestly labeled as a "Prototype mock": sliders and
 * toggles are visual only — no audio is processed, no hardware
 * capabilities are claimed. Long explanations hide behind ⓘ info-tips.
 *
 * Note: technique names are pending IP review before public launch.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  var lastContainer = null;
  var STYLE_ID = 'km-tech-style';
  var OUTPUTS = ['AirPlay', 'Chromecast', 'Spotify Connect', 'Smart-speaker group'];

  /* ---------- helpers ---------- */
  function esc(v) {
    try {
      if (KM.ui && typeof KM.ui.esc === 'function') return KM.ui.esc(v);
    } catch (e) {}
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function info(key, text, label) {
    try {
      if (KM.ui && typeof KM.ui.info === 'function') return KM.ui.info(key, text, label);
    } catch (e) {}
    return '';
  }
  function toast(msg) {
    try { if (KM.ui && typeof KM.ui.toast === 'function') KM.ui.toast(msg); } catch (e) {}
  }
  function tracks() { return (window.KM_DATA && window.KM_DATA.tracks) || []; }
  function byId(id) {
    var ts = tracks();
    for (var i = 0; i < ts.length; i++) if (ts[i] && ts[i].id === id) return ts[i];
    return null;
  }
  function currentTrack() {
    var id = null;
    try { id = KM.player && KM.player.state && KM.player.state.trackId; } catch (e) {}
    return (id && byId(id)) || tracks()[0] || null;
  }
  function fmtAt(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  // Minimal functional styles the panels need (marker positioning).
  // Decorative styling belongs to the CSS owner.
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.timeline{position:relative;height:10px;border-radius:5px;background:rgba(127,127,127,.25);margin:14px 4px 4px;}' +
      '.timeline-marker{position:absolute;top:50%;width:16px;height:16px;border-radius:50%;' +
      'transform:translate(-50%,-50%);border:2px solid #fff;background:var(--tech,#888);cursor:pointer;padding:0;}' +
      '.timeline-labels{display:flex;justify-content:space-between;gap:4px;flex-wrap:wrap;font-size:.78em;opacity:.85;}';
    document.head.appendChild(st);
  }

  function mockSlider(label, val) {
    val = (val == null) ? 50 : val;
    return '<label class="slider-row"><span>' + esc(label) + '</span>' +
      '<input type="range" min="0" max="100" value="' + val + '" data-mock-slider aria-label="' + esc(label) + '">' +
      '<output>' + val + '</output></label>';
  }

  /* ---------- Tri-Beam (crimson) ---------- */
  function triBeam() {
    return '<section class="tech-panel" style="--tech:#e5484d">' +
      '<p>Max Power listening preset (mock).</p>' +
      mockSlider('Bass') + mockSlider('Clarity') + mockSlider('Space') +
      '<div class="battery-mock">Battery use: <span class="battery-bar"><span style="width:10%"></span></span> ~2%/hr display only</div>' +
      '</section>';
  }
  var TRIBREAM_INFO = 'Prototype mock — visual only, no audio processing; these sliders don\'t change any sound. ' +
    'Never exceeds your device\'s safe limits — keep volume under 85dB for long sessions.';

  /* ---------- Dodon Ray (electric blue) ---------- */
  function dodonRay(t) {
    var h = '<section class="tech-panel" style="--tech:#2f7cf6">' +
      '<p>Precision Jump (mock) — hop between sections of the current track.</p>';
    if (t && t.sections && t.sections.length) {
      var dur = t.durationSec || 1;
      h += '<p class="track-sub">' + esc(t.title) + ' — ' + esc(t.artist || 'Unknown artist') + '</p>' +
        '<div class="timeline" role="group" aria-label="Track sections">';
      t.sections.forEach(function (s) {
        var pct = Math.max(0, Math.min(100, ((s.at || 0) / dur) * 100));
        h += '<button class="timeline-marker" style="left:' + pct.toFixed(1) + '%" data-act="jump" ' +
          'data-at="' + (s.at || 0) + '" data-name="' + esc(s.name) + '" title="' + esc(s.name) +
          ' (' + fmtAt(s.at) + ')" aria-label="Jump to ' + esc(s.name) + '"></button>';
      });
      h += '</div><div class="timeline-labels">' +
        t.sections.map(function (s) { return '<span>' + esc(s.name) + '</span>'; }).join('') + '</div>';
    } else {
      h += '<div class="empty-state">No section data for the current track.</div>';
    }
    return h + '</section>';
  }
  var DODON_INFO = 'Prototype mock — simulated seek, no real playback position changes. ' +
    'Availability varies by connected service and its playback permissions.';

  /* ---------- Four Witches (teal) ---------- */
  function fourWitches() {
    var rows = OUTPUTS.map(function (name) {
      return '<div class="switch-row"><span>' + esc(name) + '</span>' +
        '<label class="switch"><input type="checkbox" data-output="' + esc(name) + '" ' +
        'aria-label="Route to ' + esc(name) + '"><span></span></label></div>';
    }).join('');
    return '<section class="tech-panel" style="--tech:#14b8a6">' +
      '<p>Group Output (mock) — send the music everywhere at once.</p>' +
      rows +
      '</section>';
  }
  var WITCHES_INFO = 'Prototype mock — toggling shows a mock routing toast. ' +
    'KikoMix can\'t promise simultaneous output to arbitrary Bluetooth devices — that depends on your OS.';

  /* ---------- Multi-Form (violet) ---------- */
  function multiForm(t) {
    var localTrack = null;
    var ts = tracks();
    for (var i = 0; i < ts.length; i++) {
      if (ts[i] && (ts[i].sources || []).indexOf('local') !== -1) { localTrack = ts[i]; break; }
    }
    var ok = !!(t && localTrack && t.id === localTrack.id && (t.sources || []).indexOf('local') !== -1);
    var h = '<section class="tech-panel" style="--tech:#8b5cf6">' +
      '<p>Stem Studio (mock).</p>';
    if (ok) {
      h += '<p class="track-sub">' + esc(t.title) + ' — local file</p>' +
        mockSlider('Vocals') + mockSlider('Drums') + mockSlider('Bass') + mockSlider('Melody');
    } else {
      h += '<div class="notice">Stem separation is only available for local files, your own uploads, ' +
        'or public-domain recordings — protected streaming audio is never extracted or altered.</div>';
      if (localTrack) {
        h += '<p class="track-sub">Try it with: ' + esc(localTrack.title) + ' (' +
          esc(localTrack.artist || 'Unknown artist') + ').</p>';
      }
    }
    return h + '</section>';
  }
  var MULTIFORM_INFO = 'Prototype mock — visual only, no audio processing. Stem separation only applies to ' +
    'local files, your own uploads, or public-domain recordings.';

  /* ---------- Labs card ---------- */
  function labsRow(id, name, bodyHTML, infoText) {
    return '<details class="labs-row" data-tech="' + id + '">' +
      '<summary><span>' + esc(name) + '</span>' +
      '<span class="chip">Prototype mock</span>' +
      info('labs:' + id, infoText, name) +
      '</summary>' +
      '<div class="labs-body">' + bodyHTML + '</div>' +
      '</details>';
  }

  function renderAll(container) {
    if (!container) return;
    injectStyles();
    lastContainer = container;
    if (!container._kmTechWired) {
      container.addEventListener('click', onClick);
      container.addEventListener('input', onInput);
      container.addEventListener('change', onChange);
      container._kmTechWired = true;
    }
    // Preserve open rows across re-renders (e.g. track changes).
    var openIds = [];
    try {
      var prev = container.querySelectorAll('details.labs-row[open]');
      for (var pi = 0; pi < prev.length; pi++) openIds.push(prev[pi].getAttribute('data-tech'));
    } catch (e) {}
    var t = currentTrack();
    container.innerHTML =
      '<section class="card labs-card" aria-label="Labs">' +
      '<h3 class="section-title labs-head">Labs' +
      info('labs:about',
        'Labs holds KikoMix\'s playful prototypes. Everything here is a visual mock — no audio is processed, ' +
        'no hardware capabilities are claimed. Technique names are pending IP review before public launch.',
        'About Labs') +
      '</h3>' +
      '<p class="labs-sub">Prototype playground — expand a row to play.</p>' +
      labsRow('solar', 'Solar Flare', '<div data-labs-mount="solar"></div>',
        'Prototype mock — a gentle glow tinted to the current track. No audio analysis. ' +
        'Gentle pulse only — no flashing or strobing, ever.') +
      labsRow('tribeam', 'Tri-Beam', triBeam(), TRIBREAM_INFO) +
      labsRow('dodon', 'Dodon Ray', dodonRay(t), DODON_INFO) +
      labsRow('witches', 'Four Witches', fourWitches(), WITCHES_INFO) +
      labsRow('multiform', 'Multi-Form', multiForm(t), MULTIFORM_INFO) +
      '</section>';
    // Restore open rows.
    try {
      openIds.forEach(function (id) {
        var d = container.querySelector('details.labs-row[data-tech="' + id + '"]');
        if (d) d.open = true;
      });
    } catch (e) {}
    // Solar Flare renders its controls into the Labs row (guarded).
    try {
      var mount = container.querySelector('[data-labs-mount="solar"]');
      if (mount && KM.solarflare && typeof KM.solarflare.renderInto === 'function') {
        KM.solarflare.renderInto(mount, true);
      }
    } catch (e) {}
  }

  function onClick(e) {
    var jump = e.target.closest('[data-act="jump"]');
    if (!jump) return;
    var at = parseFloat(jump.getAttribute('data-at')) || 0;
    var name = jump.getAttribute('data-name') || 'section';
    try {
      if (KM.player && KM.player.state) KM.player.state.positionSec = at; // simulated seek
    } catch (err) {}
    toast('Jumped to ' + name + ' (simulated)');
  }

  function onInput(e) {
    var s = e.target.closest('[data-mock-slider]');
    if (!s) return;
    var out = s.parentNode && s.parentNode.querySelector('output');
    if (out) out.textContent = s.value;
  }

  function onChange(e) {
    var cb = e.target.closest('[data-output]');
    if (!cb) return;
    var name = cb.getAttribute('data-output');
    toast(cb.checked ? '(mock) routing to ' + name : '(mock) ' + name + ' disconnected');
  }

  /** Re-render the dynamic panels (Dodon Ray timeline, Multi-Form) on track change. */
  function onTrack() {
    if (lastContainer) renderAll(lastContainer);
  }

  KM.techniques = { renderAll: renderAll, onTrack: onTrack };
})();
