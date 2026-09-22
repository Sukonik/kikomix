/* KikoMix app bootstrap — wires the shell to feature modules.
 * Every feature-module call is optional-chained / try-guarded so the shell
 * works even when a module has not loaded yet (or its script 404s). */
(function () {
  'use strict';

  var TABS = ['home', 'search', 'library', 'mixes', 'nowplaying', 'sources'];

  function safeCall(fn) {
    try { if (typeof fn === 'function') fn(); } catch (e) { /* module failed; shell stays up */ }
  }

  function findTrack(id) {
    if (window.KM && window.KM.player && typeof window.KM.player.resolveTrack === 'function') {
      try { return window.KM.player.resolveTrack(id); } catch (e) { return null; }
    }
    return null;
  }

  function hashHue(str) {
    var h = 0; str = String(str);
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return ((h % 360) + 360) % 360;
  }

  function homeRowHTML(track, sourceId) {
    var esc = window.KM.ui.esc;
    var hue = (track.hue != null && track.hue !== '') ? track.hue : hashHue(String(track.id));
    return '<article class="track-row track-row-sm" data-play-id="' + esc(track.id) + '"' +
      ' data-play-src="' + esc(sourceId || '') + '">' +
      '<div class="cover cover-sm" style="--hue:' + esc(hue) + '" aria-hidden="true"></div>' +
      '<div class="track-meta">' +
        '<div class="track-title">' + esc(track.title || 'Untitled') + '</div>' +
        '<div class="track-artist">' + esc(track.artist || 'Unknown artist') + '</div>' +
      '</div>' +
      '<div class="track-actions"><button type="button" class="btn btn-ghost" data-play>Play</button></div>' +
    '</article>';
  }

  function renderHome() {
    var esc = window.KM.ui.esc;

    // Recently played (localStorage km:recent, ids, max 20) — needs KM_DATA or a resolvable id.
    var recentEl = document.getElementById('home-recent');
    if (recentEl) {
      var ids = [];
      try {
        var v = JSON.parse(localStorage.getItem('km:recent') || '[]');
        if (Array.isArray(v)) ids = v.slice(0, 8);
      } catch (e) {}
      var rows = ids.map(findTrack).filter(Boolean);
      recentEl.innerHTML = rows.length
        ? rows.map(function (t) { return homeRowHTML(t); }).join('')
        : '<p class="empty">Nothing played yet. Press Play on any track and it will show up here.</p>';
    }

    // Recommended: top-energy tracks from the demo catalog.
    var recEl = document.getElementById('home-recommended');
    if (recEl) {
      var tracks = window.KM_DATA && Array.isArray(window.KM_DATA.tracks) ? window.KM_DATA.tracks.slice() : [];
      if (!tracks.length) {
        recEl.innerHTML = '<p class="empty">Demo catalog is still loading.</p>';
      } else {
        tracks.sort(function (a, b) { return (b.energy || 0) - (a.energy || 0); });
        recEl.innerHTML = tracks.slice(0, 6).map(function (t) { return homeRowHTML(t); }).join('');
      }
    }

    // Service chips from the adapter list (honest: mock unless sources module says otherwise).
    var svcEl = document.getElementById('home-services');
    if (svcEl) {
      var list = (window.KM_ADAPTERS && Array.isArray(window.KM_ADAPTERS.list)) ? window.KM_ADAPTERS.list : [];
      if (!list.length) {
        svcEl.innerHTML = '<p class="empty">No services yet — adapters are still loading.</p>';
      } else {
        svcEl.innerHTML = list.map(function (a) {
          var connected = true;
          try {
            if (window.KM.sources && typeof window.KM.sources.isConnected === 'function') {
              connected = !!window.KM.sources.isConnected(a.id);
            }
          } catch (e) {}
          return '<button type="button" class="chip' + (connected ? ' on' : '') + '" data-goto="sources">' +
            '<span class="dot" aria-hidden="true"></span>' + esc(a.name || a.label || a.id) + '</button>';
        }).join('');
      }
    }
  }

  function wireSearch() {
    var KM = window.KM;
    var form = document.getElementById('search-form');
    var input = document.getElementById('search-input');
    var status = document.getElementById('search-status');
    var results = document.getElementById('search-results');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = (input && input.value || '').trim();
      if (!q) {
        if (status) status.textContent = '';
        if (results) results.innerHTML = '';
        return;
      }
      if (!KM.search || typeof KM.search.unifiedSearch !== 'function') {
        if (status) status.textContent = 'Search is still loading — try again in a moment.';
        return;
      }
      if (status) status.textContent = 'Searching for \u201C' + q + '\u201D\u2026';
      KM.search.unifiedSearch(q).then(function (rows) {
        if (status) {
          status.textContent = rows.length
            ? rows.length + ' result' + (rows.length === 1 ? '' : 's') + ' (mock data)'
            : 'No matches (mock data)';
        }
        KM.search.renderInto(results, rows, q);
      }).catch(function () {
        if (status) status.textContent = 'Search failed. Please try again.';
      });
    });
  }

  function wireHome() {
    // Delegated play buttons on home rows + service chips jump to Sources tab.
    ['home-recent', 'home-recommended'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function (e) {
        var row = e.target.closest ? e.target.closest('[data-play-id]') : null;
        if (!row || !el.contains(row)) return;
        var tid = row.getAttribute('data-play-id');
        var src = row.getAttribute('data-play-src') || null;
        if (window.KM.player && typeof window.KM.player.play === 'function') {
          window.KM.player.play(tid, src);
        }
      });
    });
    var svc = document.getElementById('home-services');
    if (svc) svc.addEventListener('click', function (e) {
      var chip = e.target.closest ? e.target.closest('[data-goto]') : null;
      if (chip && svc.contains(chip)) window.KM.ui.showTab(chip.getAttribute('data-goto'));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var KM = (window.KM = window.KM || {});

    // Initial tab from hash (default home).
    var fromHash = (location.hash || '').slice(1);
    KM.ui.showTab(TABS.indexOf(fromHash) !== -1 ? fromHash : 'home');
    window.addEventListener('hashchange', function () {
      var t = (location.hash || '').slice(1);
      if (TABS.indexOf(t) !== -1) KM.ui.showTab(t);
    });

    wireSearch();
    wireHome();

    // Feature modules: each mounts into its own root; all optional.
    safeCall(function () { KM.lion && KM.lion.init && KM.lion.init(); });
    safeCall(function () { KM.sources && KM.sources.render && KM.sources.render(); });
    safeCall(function () { KM.library && KM.library.render && KM.library.render(); });
    safeCall(function () { KM.mixes && KM.mixes.render && KM.mixes.render(); });
    safeCall(function () {
      if (KM.techniques && typeof KM.techniques.renderAll === 'function') {
        KM.techniques.renderAll(document.getElementById('np-extras'));
      }
    });
    safeCall(function () { KM.solarflare && KM.solarflare.init && KM.solarflare.init(); });

    renderHome();

    // Offline shell.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline unsupported; app still runs */ });
    }
  });
})();
