/* KikoMix — Library
 *
 * window.KM.library = { render(), onShow() }
 *
 * Renders Songs / Artists / Albums sub-tabs into #library-root,
 * all derived from window.KM_DATA.tracks.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  var TAB = 'songs'; // songs | artists | albums

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
  function badgeHTML(sourceId) {
    try {
      if (KM.ui && typeof KM.ui.badge === 'function') return KM.ui.badge(sourceId);
    } catch (e) {}
    var a = (window.KM_ADAPTERS && window.KM_ADAPTERS.byId && window.KM_ADAPTERS.byId[sourceId]) || {};
    return '<span class="badge" data-source="' + esc(sourceId) + '">' + esc(a.name || sourceId) + '</span>';
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function hueOf(t) { return (t && typeof t.hue === 'number') ? t.hue : 210; }

  function trackRow(t) {
    var firstSource = ((t.sources || [])[0]) || 'local';
    var sub = esc(t.artist || 'Unknown artist');
    if (t.album) sub += ' · ' + esc(t.album);
    if (t.durationSec) sub += ' · ' + fmtDur(t.durationSec);
    return '<div class="track-row" data-track="' + esc(t.id) + '">' +
      '<div class="cover" style="--hue:' + hueOf(t) + '"></div>' +
      '<div class="track-meta"><div class="track-title">' + esc(t.title) + '</div>' +
      '<div class="track-sub">' + sub + '</div></div>' +
      badgeHTML(firstSource) +
      '<button class="btn btn-ghost" data-act="play">Play</button>' +
      '<button class="btn btn-ghost" data-act="mix">+Mix</button>' +
      '</div>';
  }

  /* ---------- derived views ---------- */
  function songsHTML(ts) {
    if (!ts.length) return '<div class="empty-state">No songs yet — the mock catalog hasn\'t loaded.</div>';
    return ts.map(trackRow).join('');
  }

  function artistsHTML(ts) {
    if (!ts.length) return '<div class="empty-state">No artists yet.</div>';
    var map = {};
    ts.forEach(function (t) {
      var name = t.artist || 'Unknown artist';
      var e = map[name] || (map[name] = { name: name, n: 0, genres: {}, hue: hueOf(t) });
      e.n++;
      if (t.genre) e.genres[t.genre] = (e.genres[t.genre] || 0) + 1;
    });
    return Object.keys(map).sort().map(function (name) {
      var e = map[name];
      var top = Object.keys(e.genres).sort(function (a, b) { return e.genres[b] - e.genres[a]; })[0];
      return '<div class="track-row">' +
        '<div class="cover" style="--hue:' + e.hue + '"></div>' +
        '<div class="track-meta"><div class="track-title">' + esc(e.name) + '</div>' +
        '<div class="track-sub">' + e.n + ' track' + (e.n === 1 ? '' : 's') +
        (top ? ' · top genre: ' + esc(top) : '') + '</div></div>' +
        '</div>';
    }).join('');
  }

  function albumsHTML(ts) {
    if (!ts.length) return '<div class="empty-state">No albums yet.</div>';
    var map = {};
    ts.forEach(function (t) {
      var album = t.album || 'Unknown album';
      var key = album + '||| ' + (t.artist || '');
      var e = map[key] || (map[key] = { album: album, artist: t.artist || 'Unknown artist', era: t.era || '', n: 0, hue: hueOf(t) });
      e.n++;
      if (!e.era && t.era) e.era = t.era;
    });
    return Object.keys(map).sort().map(function (key) {
      var e = map[key];
      return '<div class="track-row">' +
        '<div class="cover" style="--hue:' + e.hue + '"></div>' +
        '<div class="track-meta"><div class="track-title">' + esc(e.album) + '</div>' +
        '<div class="track-sub">' + esc(e.artist) +
        (e.era ? ' · ' + esc(e.era) : '') + ' · ' + e.n + ' track' + (e.n === 1 ? '' : 's') + '</div></div>' +
        '</div>';
    }).join('');
  }

  /* ---------- render ---------- */
  function chip(id, label) {
    var active = TAB === id;
    return '<button class="chip' + (active ? ' active' : '') + '" role="tab" aria-selected="' + active +
      '" data-libtab="' + id + '">' + esc(label) + '</button>';
  }

  function render() {
    var root = document.getElementById('library-root');
    if (!root) return;
    if (!root._kmLibWired) {
      root.addEventListener('click', onClick);
      root._kmLibWired = true;
    }
    var ts = tracks();
    var body = TAB === 'artists' ? artistsHTML(ts) : TAB === 'albums' ? albumsHTML(ts) : songsHTML(ts);
    root.innerHTML =
      '<div class="chip-row" role="tablist">' +
      chip('songs', 'Songs') + chip('artists', 'Artists') + chip('albums', 'Albums') +
      '</div>' +
      '<div class="library-body">' + body + '</div>';
  }

  function onClick(e) {
    var tab = e.target.closest('[data-libtab]');
    if (tab) { TAB = tab.getAttribute('data-libtab'); render(); return; }
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = btn.closest('.track-row');
    var id = row && row.getAttribute('data-track');
    if (!id) return;
    var act = btn.getAttribute('data-act');
    if (act === 'play') {
      try { if (KM.player && typeof KM.player.play === 'function') KM.player.play(id); } catch (err) {}
    } else if (act === 'mix') {
      var t = byId(id);
      var src = (t && (t.sources || [])[0]) || 'local';
      try { if (KM.mixes && typeof KM.mixes.promptAdd === 'function') KM.mixes.promptAdd(id, src); } catch (err) {}
    }
  }

  /** Called by the shell when the Library tab is shown. */
  function onShow() { render(); }

  KM.library = { render: render, onShow: onShow };
})();
