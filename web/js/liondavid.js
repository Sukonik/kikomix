/* KikoMix — LionDavid companion (assistant edition)
 *
 * window.KM.lion = { init(), say(text), tip(), open() }
 *
 * LionDavid is a warm, confident, creative musical commander — now an
 * on-demand assistant instead of ambient chrome:
 *  - a floating assistant button (character bust) opens his sheet;
 *  - a slim strip on Home introduces him;
 *  - tips appear inside the sheet, never as auto pop-ups on tab switches.
 * He never auto-plays audio and never blocks the UI.
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

  var BUST = 'assets/brand/character-bust.jpg';

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
  // Tips speak free-tier first: "Free" sources open free on the provider
  // (no subscription needed there), and "Open in provider" takes the
  // listener to that track's provider search page to hear the real thing.
  var TIPS = [
    'I found this free on YouTube and SoundCloud — take your pick.',
    'This one\'s free on SoundCloud — want me to open it there?',
    'Your mixes can hold songs from every service at once — no app-switching required.',
    'Tap +Mix on any song and I\'ll file it into the mix you choose.',
    'Hit Replay on a mix and I\'ll queue it up, top to bottom.',
    'See the "Free" badge on a track? That one opens free on the provider — no subscription needed there.',
    'Spotted duplicates in a mix? I\'ll offer to combine them into one entry.',
    'Mimicry lives below your mixes — give it a seed song and I\'ll find its vibe.'
  ];
  var tipIdx = 0;
  var pendingTip = null; // set by say()/tip() while the sheet is closed; shown as a FAB dot

  function nextTip() {
    var line = null;
    try {
      var st = KM.player && KM.player.state;
      var t = st && st.trackId ? byId(st.trackId) : null;
      if (t) {
        var connected = (t.sources || []).filter(function (s) {
          return !(KM.sources && typeof KM.sources.isConnected === 'function') || KM.sources.isConnected(s) !== false;
        });
        if (connected.length >= 3) line = 'I found this song on three of your connected services — the free ones cost you nothing.';
      }
    } catch (e) {}
    if (!line) { line = TIPS[tipIdx % TIPS.length]; tipIdx++; }
    return line;
  }

  /** Show a message: inside the assistant sheet when open, otherwise as a
   *  toast (so action confirmations are still seen) plus a dot on the FAB. */
  function say(text) {
    var box = document.getElementById('km-lion-tipbox');
    if (box) {
      box.textContent = text;
      return;
    }
    pendingTip = text;
    var fab = document.getElementById('lion-fab');
    if (fab && !fab.querySelector('.fab-dot')) {
      var dot = document.createElement('span');
      dot.className = 'fab-dot';
      dot.setAttribute('aria-hidden', 'true');
      fab.appendChild(dot);
    }
    toast(text);
  }

  /** Pick the next contextual tip and route it through say(). */
  function tip() { say(nextTip()); }

  /* ---------- assistant sheet ---------- */
  function closeSheet() {
    var ov = document.getElementById('km-lion-sheet');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function open() {
    closeSheet();
    pendingTip = null;
    var fab = document.getElementById('lion-fab');
    if (fab) {
      var dot = fab.querySelector('.fab-dot');
      if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
      fab.classList.remove('attn');
      try { localStorage.setItem('km:lion-seen', '1'); } catch (e) {}
    }
    var ov = document.createElement('div');
    ov.className = 'modal show';
    ov.id = 'km-lion-sheet';
    ov.innerHTML =
      '<div class="modal-card card lion-sheet" role="dialog" aria-modal="true" aria-label="LionDavid assistant">' +
      '<div class="lion-sheet__head">' +
      '<img src="' + BUST + '" alt="">' +
      '<div><h3>LionDavid</h3><p>Your musical commander</p></div>' +
      '</div>' +
      '<div class="lion-sheet__tip" id="km-lion-tipbox" aria-live="polite">Ask me anything — or tap below for a tip.</div>' +
      '<button class="btn btn-primary" id="km-lion-tipbtn" type="button">Give me a tip</button>' +
      '<div class="lion-sheet__links">' +
      '<button class="btn btn-ghost" type="button" data-goto="search">Search free music</button>' +
      '<button class="btn btn-ghost" type="button" data-goto="mixes">My mixes</button>' +
      '<button class="btn btn-ghost" type="button" data-goto="nowplaying">Labs</button>' +
      '</div>' +
      '<p class="track-sub" style="margin-top:12px">One search across every connected service. ' +
      'Playback here is simulated — open any track in its provider to hear the real thing. ' +
      info('lion:role',
        'LionDavid keeps your mixes organized, explains free-tier options, and hosts the Labs prototypes. He never auto-plays audio and never sends your listening data anywhere.',
        'What does LionDavid do') +
      '</p>' +
      '<div class="modal-actions"><button class="btn btn-ghost" type="button" data-close>Close</button></div>' +
      '</div>';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeSheet(); });
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeSheet(); return; }
      if (e.target.closest('#km-lion-tipbtn')) { tip(); return; }
      var go = e.target.closest('[data-goto]');
      if (go) {
        closeSheet();
        try { if (KM.ui && typeof KM.ui.showTab === 'function') KM.ui.showTab(go.getAttribute('data-goto')); } catch (err) {}
      }
    });
    document.body.appendChild(ov);
    var key = function (e) {
      if (e.key === 'Escape') { closeSheet(); document.removeEventListener('keydown', key); }
    };
    document.addEventListener('keydown', key);
  }

  /* ---------- floating assistant button ---------- */
  function mountFab() {
    if (document.getElementById('lion-fab')) return;
    var b = document.createElement('button');
    b.id = 'lion-fab';
    b.type = 'button';
    b.setAttribute('aria-label', 'Ask LionDavid');
    b.innerHTML = '<img src="' + BUST + '" alt="">';
    b.addEventListener('click', open);
    document.body.appendChild(b);
    // One gentle nudge on first run so the assistant is discoverable.
    try {
      if (!localStorage.getItem('km:lion-seen')) {
        setTimeout(function () { b.classList.add('attn'); }, 1200);
      }
    } catch (e) {}
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
      '<li><strong>Search free sources first</strong> — one box across every connected service.</li>' +
      '<li><strong>Mixes route each song to its service</strong> — tap "Open in provider" on any track to hear it where it lives; free sources need no subscription.</li>' +
      '<li><strong>Labs holds playful prototypes</strong> — visual mocks, honestly labeled, tucked out of the way.</li>' +
      '</ul>' +
      '<button class="btn btn-primary" id="km-lion-start">Explore the demo</button>' +
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
      // No auto-tip pop-up; the FAB nudges once so the assistant is discoverable.
      var fab = document.getElementById('lion-fab');
      if (fab) fab.classList.add('attn');
    });
  }

  /* ---------- slim home strip (replaces the old intro card) ---------- */
  function renderHomeCard() {
    var host = document.getElementById('home-lion');
    if (!host) return;
    host.classList.remove('card');
    host.innerHTML =
      '<div class="lion-strip">' +
      '<img src="' + BUST + '" alt="">' +
      '<div class="lion-strip__text"><strong>LionDavid</strong>' +
      '<span>Your musical commander — tips, free-tier guidance, Labs.</span></div>' +
      '<button class="btn btn-ghost" id="km-lion-open" type="button">Ask</button>' +
      '</div>';
    var b = host.querySelector('#km-lion-open');
    if (b) b.addEventListener('click', open);
  }

  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    mountFab();
    renderHomeCard();
    // Note: no auto-tips on tab switches anymore — the assistant is
    // on-demand. KM.lion.tip() / say() remain for explicit calls.
    try {
      if (!localStorage.getItem('km:lion-intro')) showOnboarding();
    } catch (e) {}
  }

  KM.lion = { init: init, say: say, tip: tip, open: open };
})();
