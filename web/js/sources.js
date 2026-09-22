/* KikoMix — Sources (connections)
 *
 * window.KM.sources = { render(), isConnected(id), priority() }
 *
 * Mock connections for the MVP: toggles and priority order are stored in
 * localStorage under 'km:sources'. Real OAuth plugs in later.
 *
 * FREE-TIER FIRST: the tab leads with a "Free" section (Spotify Free,
 * YouTube, SoundCloud — no subscription needed) and follows with a
 * secondary "More" section (Apple Music subscription, local files).
 * Tier info comes from each adapter's badge/tier/blurb fields.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  var KEY = 'km:sources';
  var TAGLINES = {
    spotify: 'Your Spotify library',
    apple: 'Apple Music catalog',
    youtube: 'YouTube videos & music',
    soundcloud: 'SoundCloud uploads & mixes',
    local: 'Files on this device'
  };

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
  function adapters() {
    var byId = (window.KM_ADAPTERS && window.KM_ADAPTERS.byId) || {};
    return Object.keys(byId).map(function (id) {
      return { id: id, name: (byId[id] && byId[id].name) || id, color: (byId[id] && byId[id].color) || '#888888' };
    });
  }
  /** Full adapter record (with free-tier fields) or a safe fallback. */
  function adapterById(id) {
    var byId = (window.KM_ADAPTERS && window.KM_ADAPTERS.byId) || {};
    if (byId[id]) return byId[id];
    return { id: id, name: id, color: '#888888', tagline: TAGLINES[id] || 'Connected service',
             badge: null, tier: 'more', blurb: '', dimmed: false };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function ensure() {
    var s = load(), ads = adapters(), changed = false;
    ads.forEach(function (a, i) {
      if (!s[a.id]) { s[a.id] = { connected: true, order: i }; changed = true; }
    });
    if (changed) save(s);
    return s;
  }

  /** True unless the user explicitly disconnected this source. Defaults true. */
  function isConnected(id) {
    var s = ensure();
    return !s[id] || s[id].connected !== false;
  }

  /** Adapter ids ordered by user preference (first = most preferred). */
  function priority() {
    var s = ensure();
    return adapters().map(function (a) { return a.id; }).sort(function (a, b) {
      return ((s[a] && s[a].order) || 0) - ((s[b] && s[b].order) || 0);
    });
  }

  function move(id, dir) {
    var s = ensure();
    var ids = priority();
    var i = ids.indexOf(id);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    var a = ids[i], b = ids[j];
    var tmp = (s[a] && s[a].order) || 0;
    s[a].order = (s[b] && s[b].order) || 0;
    s[b].order = tmp;
    save(s);
    render();
  }

  function sourceRow(id, s) {
    var a = adapterById(id);
    var st = s[id] || { connected: true };
    var tierChip = a.badge
      ? ' <span class="chip chip-tier">' + esc(a.badge) + '</span>' : '';
    var blurb = a.blurb
      ? '<div class="track-sub src-blurb">' + esc(a.blurb) + '</div>' : '';
    return '<div class="track-row source-row' + (a.dimmed ? ' src-dimmed' : '') +
      '" data-source="' + esc(id) + '">' +
      '<span class="source-dot" style="background:' + esc(a.color) + '" aria-hidden="true"></span>' +
      '<div class="track-meta"><div class="track-title">' + esc(a.name) + tierChip + '</div>' +
      '<div class="track-sub">' + esc(a.tagline || TAGLINES[id] || 'Connected service') + '</div>' +
      blurb + '</div>' +
      '<span class="chip">' + (st.connected ? 'Connected' : 'Off') + '</span>' +
      '<label class="switch"><input type="checkbox" data-conn="' + esc(id) + '"' +
      (st.connected ? ' checked' : '') + ' aria-label="Connect ' + esc(a.name) + '"><span></span></label>' +
      '<button class="btn btn-ghost" data-act="up" data-id="' + esc(id) + '" title="Move up in priority" aria-label="Move ' + esc(a.name) + ' up">↑</button>' +
      '<button class="btn btn-ghost" data-act="down" data-id="' + esc(id) + '" title="Move down in priority" aria-label="Move ' + esc(a.name) + ' down">↓</button>' +
      '</div>';
  }

  function render() {
    var root = document.getElementById('sources-root');
    if (!root) return;
    if (!root._kmSrcWired) {
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      root._kmSrcWired = true;
    }
    var s = ensure();
    // Free-tier first: 'free'-tier adapters lead, subscription/local follow.
    var freeIds = [], moreIds = [];
    priority().forEach(function (id) {
      if (adapterById(id).tier === 'more') moreIds.push(id);
      else freeIds.push(id);
    });
    var h = '<h3 class="section-title">Connections</h3>';
    if (!freeIds.length && !moreIds.length) {
      h += '<div class="empty-state">No services registered yet.</div>';
    }
    h += '<h4 class="section-sub">Free</h4>' +
      '<p class="track-sub">Play without a subscription — ' +
      'these sources cost nothing.</p>' +
      freeIds.map(function (id) { return sourceRow(id, s); }).join('');
    h += '<h4 class="section-sub">More</h4>' +
      '<p class="track-sub">Apple Music needs a subscription; ' +
      'local files are yours.</p>' +
      moreIds.map(function (id) { return sourceRow(id, s); }).join('');
    h += '<p class="tech-note">Mock connections — real OAuth plugs in later. ' +
      'The order above sets your preferred-service priority for playback.</p>';
    root.innerHTML = h;
  }

  function onClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    if (act === 'up') move(id, -1);
    else if (act === 'down') move(id, 1);
  }

  function onChange(e) {
    var cb = e.target.closest('[data-conn]');
    if (!cb) return;
    var id = cb.getAttribute('data-conn');
    var s = ensure();
    if (!s[id]) s[id] = { connected: true, order: 0 };
    s[id].connected = cb.checked;
    save(s);
    var a = adapterById(id);
    toast('(mock) ' + a.name + (cb.checked ? ' connected' : ' disconnected'));
    render();
  }

  KM.sources = { render: render, isConnected: isConnected, priority: priority };
})();
