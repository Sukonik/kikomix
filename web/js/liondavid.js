/* KikoMix — LionDavid companion
 *
 * window.KM.lion = { init(), say(text), tip() }
 *
 * LionDavid is a warm, confident, creative musical commander. He never
 * auto-plays audio and never blocks the UI — tips and onboarding are
 * always dismissible.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  /* ---------- small helpers (local copies; never assume other modules loaded) ---------- */
  function esc(v) {
    try {
      if (KM.ui && typeof KM.ui.esc === 'function') return KM.ui.esc(v);
    } catch (e) {}
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tracks() { return (window.KM_DATA && window.KM_DATA.tracks) || []; }
  function byId(id) {
    var ts = tracks();
    for (var i = 0; i < ts.length; i++) if (ts[i] && ts[i].id === id) return ts[i];
    return null;
  }

  /* ---------- gold SVG logo (lion-emoji-free) ---------- */
  var __lionUid = 0;
  function lionSVG(size) {
    size = size || 56;
    __lionUid++;
    var gid = 'kmLionGold' + __lionUid;
    var pts = [];
    var cx = 32, cy = 32, i, a, r;
    for (i = 0; i < 16; i++) {
      a = (i / 16) * Math.PI * 2; r = 30;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
      a = ((i + 0.5) / 16) * Math.PI * 2; r = 22.5;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return '<svg class="lion-logo" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" role="img" aria-label="LionDavid logo">' +
      '<defs><radialGradient id="' + gid + '" cx="38%" cy="30%" r="78%">' +
      '<stop offset="0%" stop-color="#ffedb0"/><stop offset="55%" stop-color="#f2b73f"/><stop offset="100%" stop-color="#a86e12"/>' +
      '</radialGradient></defs>' +
      '<polygon points="' + pts.join(' ') + '" fill="url(#' + gid + ')"/>' +
      '<circle cx="32" cy="32" r="14.5" fill="#e9b84d"/>' +
      '<circle cx="32" cy="32" r="14.5" fill="none" stroke="#7a4d0c" stroke-width="1.5" opacity="0.55"/>' +
      '<circle cx="26.6" cy="29.6" r="2.4" fill="#5c3a08"/>' +
      '<circle cx="37.4" cy="29.6" r="2.4" fill="#5c3a08"/>' +
      '<circle cx="27.4" cy="28.8" r="0.8" fill="#ffedb0"/>' +
      '<circle cx="38.2" cy="28.8" r="0.8" fill="#ffedb0"/>' +
      '<path d="M29 36.4 L35 36.4 L32 39.4 Z" fill="#5c3a08"/>' +
      '<path d="M32 39.4 Q32 41.8 29.6 42.4 M32 39.4 Q32 41.8 34.4 42.4" stroke="#5c3a08" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ---------- tips ---------- */
  // Exact lines from the brief are kept verbatim; the rest are originals
  // about mixes and playback.
  var TIPS = [
    'I found this song on three of your connected services.',
    'This track is unavailable on your preferred service, but I found it on YouTube.',
    'Your mixes can hold songs from every service at once — no app-switching required.',
    'Tap +Mix on any song and I\'ll file it into the mix you choose.',
    'Hit Replay on a mix and I\'ll queue it up, top to bottom.',
    'See the source badge on a track? That\'s exactly where it\'s playing from.',
    'Spotted duplicates in a mix? I\'ll offer to combine them into one entry.',
    'Mimicry lives below your mixes — give it a seed song and I\'ll find its vibe.'
  ];
  var tipIdx = 0;

  /** Show the #lion-tip bar with a message and a dismiss ×. */
  function say(text) {
    var bar = document.getElementById('lion-tip');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'lion-tip';
      if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
      else document.body.appendChild(bar);
    }
    bar.innerHTML = '<span class="lion-tip-msg">' + esc(text) + '</span>' +
      '<button class="lion-tip-x" aria-label="Dismiss">×</button>';
    bar.style.display = 'flex';
    var x = bar.querySelector('.lion-tip-x');
    if (x) x.addEventListener('click', function () { bar.style.display = 'none'; });
  }

  /** Rotate contextual tips. Call on tab switches. */
  function tip() {
    var line = null;
    try {
      var st = KM.player && KM.player.state;
      var t = st && st.trackId ? byId(st.trackId) : null;
      if (t) {
        var connected = (t.sources || []).filter(function (s) {
          return !(KM.sources && typeof KM.sources.isConnected === 'function') || KM.sources.isConnected(s) !== false;
        });
        if (connected.length >= 3) line = 'I found this song on three of your connected services.';
      }
    } catch (e) {}
    if (!line) { line = TIPS[tipIdx % TIPS.length]; tipIdx++; }
    say(line);
  }

  /* ---------- onboarding ---------- */
  function showOnboarding() {
    var host = document.getElementById('onboarding');
    var html =
      '<div class="modal-card card" role="dialog" aria-modal="true" aria-label="Welcome to KikoMix">' +
      lionSVG(72) +
      '<h2>I\'m LionDavid, your musical commander.</h2>' +
      '<p>One search box for all your music. Here\'s the lay of the land:</p>' +
      '<ul class="lion-points">' +
      '<li><strong>Search all services at once</strong> — one box, every connected source.</li>' +
      '<li><strong>Mixes route each song to its service</strong> — every track plays from where it lives.</li>' +
      '<li><strong>Techniques are prototypes</strong> — playful experiments, always honestly labeled.</li>' +
      '</ul>' +
      '<button class="btn btn-primary" id="km-lion-start">Start listening</button>' +
      '</div>';
    var overlay, usingHost = !!host;
    if (usingHost) {
      host.innerHTML = html;
      host.classList.add('modal', 'show');
      overlay = host;
    } else {
      overlay = document.createElement('div');
      overlay.className = 'modal show';
      overlay.innerHTML = html;
      document.body.appendChild(overlay);
    }
    var btn = overlay.querySelector('#km-lion-start');
    if (btn) btn.addEventListener('click', function () {
      try { localStorage.setItem('km:lion-intro', '1'); } catch (e) {}
      if (usingHost) { host.innerHTML = ''; host.classList.remove('modal', 'show'); }
      else if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      tip(); // a friendly first word — never auto-plays audio
    });
  }

  /* ---------- home card ---------- */
  function renderHomeCard() {
    var host = document.getElementById('home-lion');
    if (!host) return;
    host.innerHTML =
      '<div class="card lion-card">' + lionSVG(64) +
      '<div class="lion-card-body">' +
      '<h3 class="section-title">LionDavid</h3>' +
      '<p class="lion-tag">Your musical commander</p>' +
      '<p>Search every service at once, build mixes that route each song to its home, ' +
      'and explore playful prototype techniques. I\'ll keep the music flowing — just say the word.</p>' +
      '<button class="btn btn-ghost" id="km-lion-tipbtn">Give me a tip</button>' +
      '</div></div>';
    var b = host.querySelector('#km-lion-tipbtn');
    if (b) b.addEventListener('click', tip);
  }

  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    renderHomeCard();
    // The shell can dispatch either of these CustomEvents on tab switches
    // to rotate tips; KM.lion.tip() is also callable directly.
    document.addEventListener('km:tab', tip);
    document.addEventListener('km:tabchange', tip);
    try {
      if (!localStorage.getItem('km:lion-intro')) showOnboarding();
    } catch (e) {}
  }

  KM.lion = { init: init, say: say, tip: tip };
})();
