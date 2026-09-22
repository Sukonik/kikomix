/* KikoMix simulated player — window.KM.player
 *
 * SIMULATED PLAYBACK: a 1-second timer advances positionSec. There is NO
 * <audio> element and NO real audio — the Now Playing tab always carries an
 * honest "Simulated playback" notice. Never claim real playback.
 *
 * Provided: state, play(trackId, sourceId), pause(), toggle(), next(),
 * prev(), enqueue(ids), onTrackChange(fn), plus helpers remember(track)
 * and resolveTrack(id) used by the shell's own modules.
 *
 * Track resolution order: remember() registry (e.g. search results) ->
 * KM_DATA.tracks (array or id-keyed object) -> adapter.getTrack(id).
 * Guards when KM_DATA is missing.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};

  var known = new Map(); // trackId -> track object (search results etc.)
  var listeners = [];

  var state = {
    trackId: null,
    sourceId: null,
    playing: false,
    positionSec: 0,
    durationSec: 0,
    queue: [],       // [{ trackId, sourceId }]
    queueIndex: -1
  };

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function hashHue(str) {
    var h = 0; str = String(str);
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return ((h % 360) + 360) % 360;
  }

  function remember(track) {
    if (track && track.id != null) known.set(track.id, track);
  }

  function resolveTrack(id) {
    if (id == null) return null;
    if (known.has(id)) return known.get(id);
    var tracks = window.KM_DATA ? window.KM_DATA.tracks : null;
    if (Array.isArray(tracks)) {
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i] && tracks[i].id === id) return tracks[i];
      }
    } else if (tracks && typeof tracks === 'object') {
      if (tracks[id]) return tracks[id];
    }
    var list = (window.KM_ADAPTERS && Array.isArray(window.KM_ADAPTERS.list)) ? window.KM_ADAPTERS.list : [];
    for (var j = 0; j < list.length; j++) {
      try {
        var t = list[j] && typeof list[j].getTrack === 'function' ? list[j].getTrack(id) : null;
        if (t) return t;
      } catch (e) { /* keep looking */ }
    }
    return null;
  }

  function loadRecent() {
    try {
      var v = JSON.parse(localStorage.getItem('km:recent') || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function saveRecent(id) {
    if (id == null) return;
    var r = [id].concat(loadRecent().filter(function (x) { return x !== id; })).slice(0, 20);
    try { localStorage.setItem('km:recent', JSON.stringify(r)); } catch (e) {}
  }

  function notify(track) {
    listeners.forEach(function (fn) {
      try { fn(track, state); } catch (e) {}
    });
    try { if (window.KM.solarflare && typeof window.KM.solarflare.onTrack === 'function') window.KM.solarflare.onTrack(track, state.sourceId); } catch (e) {}
    try { if (window.KM.techniques && typeof window.KM.techniques.onTrack === 'function') window.KM.techniques.onTrack(track, state.sourceId); } catch (e) {}
  }

  function startItem(item) {
    var track = resolveTrack(item.trackId);
    if (!track) {
      window.KM.ui.toast('Track not found — demo data may still be loading.');
      state.playing = false;
      render();
      return;
    }
    remember(track);
    state.trackId = track.id;
    state.sourceId = item.sourceId || state.sourceId || null;
    state.positionSec = 0;
    state.durationSec = Number(track.durationSec) || 210;
    state.playing = true;
    saveRecent(track.id);
    render();
    notify(track);
  }

  function play(trackId, sourceId) {
    var track = resolveTrack(trackId);
    if (!track) {
      window.KM.ui.toast('Track not found — demo data may still be loading.');
      return;
    }
    state.queue = [{ trackId: track.id, sourceId: sourceId || null }];
    state.queueIndex = 0;
    startItem(state.queue[0]);
  }

  function pause() {
    if (!state.playing) return;
    state.playing = false;
    render();
  }

  function resume() {
    if (state.playing || state.trackId == null) return;
    if (state.positionSec >= state.durationSec) state.positionSec = 0;
    state.playing = true;
    render();
  }

  function toggle() {
    if (state.playing) pause(); else resume();
  }

  function next() {
    if (state.queueIndex + 1 < state.queue.length) {
      state.queueIndex++;
      startItem(state.queue[state.queueIndex]);
    } else {
      state.playing = false; // end of queue: stop, stay on last track
      render();
    }
  }

  function prev() {
    if (state.positionSec > 3 || state.queueIndex <= 0) {
      state.positionSec = 0; // restart current track
      render();
      return;
    }
    state.queueIndex--;
    startItem(state.queue[state.queueIndex]);
  }

  /** ids: array of track ids or {trackId, sourceId} objects. */
  function enqueue(ids) {
    var arr = Array.isArray(ids) ? ids : [ids];
    var items = arr.map(function (x) {
      if (x && typeof x === 'object') return { trackId: x.trackId != null ? x.trackId : x.id, sourceId: x.sourceId || null };
      return { trackId: x, sourceId: state.sourceId };
    }).filter(function (x) { return x.trackId != null; });
    if (!items.length) return 0;
    if (state.trackId == null) {
      state.queue = items.slice();
      state.queueIndex = 0;
      startItem(state.queue[0]);
    } else {
      state.queue = state.queue.concat(items);
      render();
    }
    return items.length;
  }

  /** Register a listener called with (track, state) on every track change. Returns an unsubscribe fn. */
  function onTrackChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  // --- Now Playing tab rendering -------------------------------------------

  var ICONS = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2.4v14H6zM19 5v14L9.5 12z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.6 5H18v14h-2.4zM5 5v14l9.5-7z" fill="currentColor"/></svg>'
  };

  function ensureWired(root) {
    if (!root || root._kmWired) return;
    root._kmWired = true;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-t]') : null;
      if (!btn || !root.contains(btn)) return;
      var t = btn.getAttribute('data-t');
      if (t === 'prev') prev();
      else if (t === 'toggle') toggle();
      else if (t === 'next') next();
    });
  }

  function render() {
    var root = document.getElementById('np-core');
    if (!root) return;
    ensureWired(root);
    var esc = window.KM.ui.esc;
    var track = resolveTrack(state.trackId);
    if (!track) {
      root.innerHTML = '<div class="np-empty"><p>Nothing playing yet.</p>' +
        '<p class="hint">Search or browse, then press Play. Playback here is simulated.</p></div>';
      return;
    }
    var hue = (track.hue != null && track.hue !== '') ? track.hue : hashHue(String(track.id));
    var pct = state.durationSec ? Math.min(100, (state.positionSec / state.durationSec) * 100) : 0;
    var queueItems = state.queue.map(function (item, i) {
      var t = resolveTrack(item.trackId);
      var label = t ? (t.title + ' — ' + (t.artist || 'Unknown artist')) : String(item.trackId);
      return '<li class="' + (i === state.queueIndex ? 'current' : '') + '">' + esc(label) + '</li>';
    }).join('');
    root.innerHTML =
      '<div class="np-cover cover cover-lg" style="--hue:' + esc(hue) + '" aria-hidden="true"></div>' +
      '<div class="np-title">' + esc(track.title || 'Untitled') + '</div>' +
      '<div class="np-artist">' + esc(track.artist || 'Unknown artist') +
        (track.album ? ' · ' + esc(track.album) : '') + '</div>' +
      '<div class="np-badges">' + (state.sourceId ? window.KM.ui.badge(state.sourceId) : '') + '</div>' +
      '<div class="notice"><strong>Simulated playback</strong> — no audio is playing. ' +
        'Connect a real service for actual audio.</div>' +
      '<div class="np-progress" role="progressbar" aria-label="Playback progress" ' +
        'aria-valuemin="0" aria-valuemax="' + state.durationSec + '" aria-valuenow="' + Math.floor(state.positionSec) + '">' +
        '<div class="np-bar" id="np-bar" style="width:' + pct.toFixed(1) + '%"></div>' +
      '</div>' +
      '<div class="np-times"><span id="np-pos">' + fmt(state.positionSec) + '</span>' +
        '<span>' + fmt(state.durationSec) + '</span></div>' +
      '<div class="np-transport">' +
        '<button type="button" class="btn tbtn" data-t="prev" aria-label="Previous track">' + ICONS.prev + '</button>' +
        '<button type="button" class="btn btn-primary tbtn tbtn-main" data-t="toggle" aria-label="' +
          (state.playing ? 'Pause' : 'Play') + '">' + (state.playing ? ICONS.pause : ICONS.play) + '</button>' +
        '<button type="button" class="btn tbtn" data-t="next" aria-label="Next track">' + ICONS.next + '</button>' +
      '</div>' +
      (state.queue.length > 1
        ? '<h3 class="section-title">Up next</h3><ol class="np-queue">' + queueItems + '</ol>'
        : '');
  }

  /** Light per-tick update: progress bar + elapsed time only. */
  function tickUpdate() {
    var bar = document.getElementById('np-bar');
    var pos = document.getElementById('np-pos');
    if (bar && state.durationSec) bar.style.width = Math.min(100, (state.positionSec / state.durationSec) * 100).toFixed(1) + '%';
    if (pos) pos.textContent = fmt(state.positionSec);
  }

  // Simulated clock: advances 1s per tick while playing; auto-advances queue at track end.
  setInterval(function () {
    if (!state.playing || state.trackId == null) return;
    state.positionSec += 1;
    if (state.positionSec >= state.durationSec) { next(); return; }
    tickUpdate();
  }, 1000);

  window.KM.player = {
    state: state,
    play: play,
    pause: pause,
    toggle: toggle,
    next: next,
    prev: prev,
    enqueue: enqueue,
    onTrackChange: onTrackChange,
    remember: remember,
    resolveTrack: resolveTrack
  };
})();
