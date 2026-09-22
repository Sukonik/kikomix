/* KikoMix unified search — window.KM.search = { unifiedSearch(q), renderInto(container, rows, q) }
 *
 * Fans out to every CONNECTED adapter in parallel, merges duplicate
 * songs (same title + artist) into one row, and ranks deterministically:
 *   1. more sources first,
 *   2. then higher track.energy first,
 *   3. then dedupe key ascending (stable tie-break).
 *
 * Dedupe key: lowercase title + '|' + lowercase artist.
 * Preferred source per row: localStorage "km:pref:<key>" (the row's dedupe
 * key acts as its canonical track id), when still among the row's sources;
 * otherwise the first source in the user's priority order
 * (KM.sources.priority() or adapter list order).
 */
(function () {
  'use strict';
  window.KM = window.KM || {};

  function esc(s) { return window.KM.ui.esc(s); }

  function adapters() {
    return (window.KM_ADAPTERS && Array.isArray(window.KM_ADAPTERS.list))
      ? window.KM_ADAPTERS.list.filter(function (a) { return a && a.id; })
      : [];
  }

  function isConnected(id) {
    try {
      if (window.KM && window.KM.sources && typeof window.KM.sources.isConnected === 'function') {
        return !!window.KM.sources.isConnected(id);
      }
    } catch (e) { /* default below */ }
    return true; // sources module absent -> treat every adapter as connected
  }

  function sourcePriority() {
    try {
      var p = window.KM && window.KM.sources && typeof window.KM.sources.priority === 'function'
        ? window.KM.sources.priority() : null;
      if (Array.isArray(p) && p.length) return p.slice();
    } catch (e) { /* fall through */ }
    return adapters().map(function (a) { return a.id; });
  }

  function sourceName(id) {
    var list = adapters();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].name || list[i].label || id;
    }
    return id;
  }

  function dedupeKey(t) {
    return String(t.title || '').toLowerCase().trim() + '|' + String(t.artist || '').toLowerCase().trim();
  }

  // Adapter search() hits are shaped { trackId, sourceId, title, artist, album, durationSec }.
  // Normalize to the catalog's { id, ... } shape so play(trackId) resolves.
  function normalizeHit(h) {
    return {
      id: h.trackId != null ? h.trackId : h.id,
      title: h.title,
      artist: h.artist,
      album: h.album,
      durationSec: h.durationSec,
      energy: h.energy,
      hue: h.hue
    };
  }

  function findCatalogTrack(id) {
    var tracks = window.KM_DATA ? window.KM_DATA.tracks : null;
    if (!Array.isArray(tracks)) return null;
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i] && tracks[i].id === id) return tracks[i];
    }
    return null;
  }

  function hashHue(str) {
    var h = 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return ((h % 360) + 360) % 360;
  }

  function pickPreferred(row, priority) {
    var pref = null;
    try { pref = localStorage.getItem('km:pref:' + encodeURIComponent(row.key)); } catch (e) {}
    if (pref && row.sources.indexOf(pref) !== -1) return pref;
    for (var i = 0; i < priority.length; i++) {
      if (row.sources.indexOf(priority[i]) !== -1) return priority[i];
    }
    return row.sources[0] || null;
  }

  async function unifiedSearch(q) {
    var query = String(q == null ? '' : q).trim();
    if (!query) return [];
    var connected = adapters().filter(function (a) { return isConnected(a.id); });
    var settled = await Promise.all(connected.map(function (a) {
      return Promise.resolve()
        .then(function () { return typeof a.search === 'function' ? a.search(query) : []; })
        .then(function (hits) { return { id: a.id, hits: hits }; },
              function () { return { id: a.id, hits: [] }; }); // one bad adapter never kills search
    }));

    var merged = new Map();
    settled.forEach(function (r) {
      if (!r || !Array.isArray(r.hits)) return;
      r.hits.forEach(function (h) {
        if (!h || !h.title) return;
        var key = dedupeKey(h);
        var row = merged.get(key);
        if (!row) {
          row = { key: key, track: normalizeHit(h), sources: [], preferred: null };
          merged.set(key, row);
        }
        if (row.sources.indexOf(r.id) === -1) row.sources.push(r.id);
      });
    });

    // Enrich each row's representative track with the full KM_DATA record when
    // available (adds energy/hue/duration for ranking and covers), and register
    // it with the player so play(trackId) resolves even for adapter-only hits.
    merged.forEach(function (row) {
      var full = findCatalogTrack(row.track.id);
      if (full) row.track = full;
      try {
        if (window.KM.player && typeof window.KM.player.remember === 'function') window.KM.player.remember(row.track);
      } catch (e) {}
    });

    var priority = sourcePriority();
    var rows = Array.from(merged.values());
    rows.forEach(function (row) { row.preferred = pickPreferred(row, priority); });
    return rows;
  }

  function rowHTML(row) {
    var t = row.track || {};
    var hue = (t.hue != null && t.hue !== '') ? t.hue : hashHue(row.key);
    var options = row.sources.map(function (id) {
      return '<option value="' + esc(id) + '"' + (id === row.preferred ? ' selected' : '') + '>' +
        esc(sourceName(id)) + '</option>';
    }).join('');
    return '<article class="track-row" data-key="' + esc(row.key) + '">' +
      '<div class="cover" style="--hue:' + esc(hue) + '" aria-hidden="true"></div>' +
      '<div class="track-meta">' +
        '<div class="track-title">' + esc(t.title || 'Untitled') + '</div>' +
        '<div class="track-artist">' + esc(t.artist || 'Unknown artist') + '</div>' +
        '<div class="track-sub">' + window.KM.ui.badge(row.preferred || '') +
          ' <label class="src-switch"><span>Source</span> ' +
          '<select data-pref aria-label="Choose source for ' + esc(t.title || 'track') + '">' +
          options + '</select></label>' +
        '</div>' +
      '</div>' +
      '<div class="track-actions">' +
        '<button type="button" class="btn btn-primary" data-action="play">Play</button>' +
        '<button type="button" class="btn btn-ghost" data-action="mix">\uFF0B Mix</button>' +
      '</div>' +
    '</article>';
  }

  /** Wire one container (delegated): Play / + Mix buttons and the source switcher. */
  function ensureWired(container) {
    if (!container || container._kmWired) return;
    container._kmWired = true;

    container.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn || !container.contains(btn)) return;
      var rowEl = btn.closest('[data-key]');
      var row = rowEl && container._kmRows ? container._kmRows.get(rowEl.getAttribute('data-key')) : null;
      if (!row) return;
      var action = btn.getAttribute('data-action');
      if (action === 'play') {
        if (window.KM.player && typeof window.KM.player.play === 'function') {
          window.KM.player.play(row.track.id, row.preferred);
        } else {
          window.KM.ui.toast('Player is still loading — try again in a moment.');
        }
      } else if (action === 'mix') {
        if (window.KM.mixes && typeof window.KM.mixes.promptAdd === 'function') {
          window.KM.mixes.promptAdd(row.track.id, row.preferred);
        } else {
          window.KM.ui.toast('Mixes module is still loading — try again in a moment.');
        }
      }
    });

    container.addEventListener('change', function (e) {
      var sel = e.target.closest ? e.target.closest('select[data-pref]') : null;
      if (!sel || !container.contains(sel)) return;
      var rowEl = sel.closest('[data-key]');
      var key = rowEl ? rowEl.getAttribute('data-key') : null;
      var row = key && container._kmRows ? container._kmRows.get(key) : null;
      if (!row || row.sources.indexOf(sel.value) === -1) return;
      row.preferred = sel.value;
      try { localStorage.setItem('km:pref:' + encodeURIComponent(row.key), sel.value); } catch (err) {}
      // Re-render just this row so its badge follows the new preferred source.
      var tmp = document.createElement('div');
      tmp.innerHTML = rowHTML(row);
      if (tmp.firstElementChild) rowEl.replaceWith(tmp.firstElementChild);
      window.KM.ui.toast('Preferred source: ' + sourceName(sel.value));
    });
  }

  /** Render ranked rows into container. Deterministic order (see header). */
  function renderInto(container, rows, q) {
    if (!container) return;
    ensureWired(container);
    var list = Array.isArray(rows) ? rows.slice() : [];
    list.sort(function (a, b) {
      return (b.sources.length - a.sources.length) ||
        ((b.track.energy || 0) - (a.track.energy || 0)) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    });
    container._kmRows = new Map(list.map(function (r) { return [r.key, r]; }));
    if (!list.length) {
      container.innerHTML = '<p class="empty">' +
        (q ? 'No results for &ldquo;' + esc(q) + '&rdquo;. ' : 'No results. ') +
        'Try another title or artist. (Mock data)</p>';
      return;
    }
    container.innerHTML = list.map(rowHTML).join('');
  }

  window.KM.search = { unifiedSearch: unifiedSearch, renderInto: renderInto };
})();
