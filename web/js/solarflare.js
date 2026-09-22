/* KikoMix — Solar Flare: Visual Sync (prototype mock)
 *
 * window.KM.solarflare = { init(), onTrack(track), renderInto(container) }
 *
 * A gentle glow layer tinted to the current track's hue. Visual mock only —
 * no audio analysis, no screen effects beyond a soft glow.
 *
 * IMPORTANT — MOTION SAFETY: strobing and rapid flashing must NOT exist
 * anywhere in this module. The only motion permitted is ONE gentle 4-second
 * pulse (opacity 0.25 -> 0.5, ease-in-out). Never add faster animations,
 * strobes, or flashing sequences here. When reduced motion is on, the glow
 * is completely static.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  var LAYER_ID = 'km-solar-stage';
  var STYLE_ID = 'km-solar-style';
  var SECTION_ID = 'km-solar-section';

  var state = {
    on: false,          // default OFF
    brightness: 70,     // 10..100, default 70
    reducedMotion: false,
    warned: false
  };
  if (typeof matchMedia === 'function') {
    try { state.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  }
  try { state.warned = localStorage.getItem('km:solar-warned') === '1'; } catch (e) {}

  var inited = false;
  var syncTimer = null;

  /* ---------- helpers ---------- */
  function esc(v) {
    try {
      if (KM.ui && typeof KM.ui.esc === 'function') return KM.ui.esc(v);
    } catch (e) {}
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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

  /* ---------- modal ---------- */
  var modalKeyHandler = null;
  function openModal(html) {
    closeModal();
    var ov = document.createElement('div');
    ov.className = 'modal show';
    ov.id = 'km-solar-modal';
    ov.innerHTML = '<div class="modal-card card" role="dialog" aria-modal="true">' + html + '</div>';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) { closeModal(); revertToggle(); } });
    document.body.appendChild(ov);
    modalKeyHandler = function (e) { if (e.key === 'Escape') { closeModal(); revertToggle(); } };
    document.addEventListener('keydown', modalKeyHandler);
    return ov;
  }
  function closeModal() {
    var m = document.getElementById('km-solar-modal');
    if (m && m.parentNode) m.parentNode.removeChild(m);
    if (modalKeyHandler) { document.removeEventListener('keydown', modalKeyHandler); modalKeyHandler = null; }
  }
  function revertToggle() {
    var cb = document.getElementById('km-solar-on');
    if (cb) cb.checked = false;
    setOn(false);
  }

  /* ---------- glow layer ---------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    // The ONLY animation in this module: a gentle 4s pulse, 0.25 -> 0.5 opacity.
    // No strobing, no rapid flashing — ever.
    st.textContent =
      '.solar-stage{position:fixed;inset:0;pointer-events:none;z-index:40;display:none;}' +
      '.solar-stage .solar-glow{position:absolute;inset:0;' +
      'background:radial-gradient(120% 90% at 50% 108%, hsl(var(--art-hue,210) 90% 55% / 0.55), transparent 70%),' +
      'radial-gradient(90% 60% at 50% -8%, hsl(var(--art-hue,210) 90% 62% / 0.28), transparent 60%);' +
      'animation:kmSolarPulse 4s ease-in-out infinite;}' +
      '.solar-stage .solar-glow.still{animation:none;opacity:0.35;}' +
      '@keyframes kmSolarPulse{0%,100%{opacity:0.25;}50%{opacity:0.5;}}';
    document.head.appendChild(st);
  }

  function ensureLayer() {
    var el = document.getElementById(LAYER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = LAYER_ID;
      el.className = 'solar-stage';
      el.setAttribute('aria-hidden', 'true');
      var glow = document.createElement('div');
      glow.className = 'solar-glow';
      el.appendChild(glow);
      document.body.appendChild(el);
    }
    return el;
  }

  function applyLayer() {
    var el = ensureLayer();
    var playing = false, hue = 210;
    try {
      var ps = KM.player && KM.player.state;
      playing = !!(ps && ps.playing);
      var t = ps && ps.trackId ? byId(ps.trackId) : null;
      if (t && typeof t.hue === 'number') hue = t.hue;
    } catch (e) {}
    var show = state.on && playing;
    el.style.display = show ? 'block' : 'none';
    if (!show) return;
    el.style.setProperty('--art-hue', String(hue));
    el.style.opacity = String(state.brightness / 100);
    var glow = el.firstElementChild;
    if (glow) {
      if (state.reducedMotion) glow.classList.add('still');
      else glow.classList.remove('still');
    }
  }

  function setOn(v) {
    state.on = !!v;
    var cb = document.getElementById('km-solar-on');
    if (cb) cb.checked = state.on;
    // Mock sync: while ON, re-check play state so the glow follows
    // play/pause without a dedicated player event. Cleared when OFF.
    if (state.on) {
      if (!syncTimer) syncTimer = setInterval(applyLayer, 1500);
    } else if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
    applyLayer();
  }

  function askWarning() {
    var ov = openModal(
      '<h3 class="section-title">Before you turn on the glow</h3>' +
      '<p><strong>Photosensitivity warning:</strong> Solar Flare contains gentle pulsing light. ' +
      'Avoid if you are sensitive to flashing lights.</p>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-primary" id="km-solar-ok">I understand</button> ' +
      '<button class="btn btn-ghost" data-close>Cancel</button></div>'
    );
    var ok = ov.querySelector('#km-solar-ok');
    if (ok) ok.addEventListener('click', function () {
      try { localStorage.setItem('km:solar-warned', '1'); } catch (e) {}
      state.warned = true;
      closeModal();
      setOn(true);
      toast('Solar Flare on — gentle glow only');
    });
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModal(); revertToggle(); }
    });
  }

  /* ---------- panel ---------- */
  function renderInto(container) {
    if (!container) return;
    injectStyles();
    container.innerHTML =
      '<div class="card solar-card">' +
      '<h3 class="section-title">Solar Flare — Visual Sync <span class="chip">Prototype mock</span></h3>' +
      '<p class="tech-note">A gentle glow tinted to the current track. Visual mock — no audio analysis.</p>' +
      '<div class="switch-row"><span>Glow</span>' +
      '<label class="switch"><input type="checkbox" id="km-solar-on"' + (state.on ? ' checked' : '') +
      ' aria-label="Toggle Solar Flare glow"><span></span></label></div>' +
      '<div class="slider-row"><span>Brightness</span>' +
      '<input type="range" id="km-solar-bright" min="10" max="100" step="1" value="' + state.brightness +
      '" aria-label="Glow brightness"></div>' +
      '<div class="switch-row"><span>Reduced motion</span>' +
      '<label class="switch"><input type="checkbox" id="km-solar-rm"' + (state.reducedMotion ? ' checked' : '') +
      ' aria-label="Reduced motion"><span></span></label></div>' +
      '<p class="tech-note">Gentle pulse only — no flashing or strobing, ever.</p>' +
      '</div>';
    var on = container.querySelector('#km-solar-on');
    var br = container.querySelector('#km-solar-bright');
    var rm = container.querySelector('#km-solar-rm');
    if (on) on.addEventListener('change', function () {
      if (on.checked && !state.warned) askWarning(); // first activation: warning modal
      else setOn(on.checked);
    });
    if (br) br.addEventListener('input', function () {
      state.brightness = parseInt(br.value, 10) || 70;
      applyLayer();
    });
    if (rm) rm.addEventListener('change', function () {
      state.reducedMotion = rm.checked;
      applyLayer();
    });
  }

  function onTrack() { applyLayer(); }

  function init() {
    if (inited) return;
    inited = true;
    injectStyles();
    ensureLayer();
    var host = document.getElementById('np-extras');
    if (host && !document.getElementById(SECTION_ID)) {
      var sec = document.createElement('section');
      sec.id = SECTION_ID;
      if (host.firstChild) host.insertBefore(sec, host.firstChild);
      else host.appendChild(sec);
      renderInto(sec);
    }
    try {
      if (KM.player && typeof KM.player.onTrackChange === 'function') {
        KM.player.onTrackChange(function () { onTrack(); });
      }
    } catch (e) {}
    // Honor the OS reduced-motion setting live.
    if (typeof matchMedia === 'function') {
      try {
        var mq = matchMedia('(prefers-reduced-motion: reduce)');
        var upd = function (ev) {
          state.reducedMotion = !!ev.matches;
          var cb = document.getElementById('km-solar-rm');
          if (cb) cb.checked = state.reducedMotion;
          applyLayer();
        };
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', upd);
        else if (typeof mq.addListener === 'function') mq.addListener(upd);
      } catch (e) {}
    }
  }

  KM.solarflare = { init: init, onTrack: onTrack, renderInto: renderInto };
})();
