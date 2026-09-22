/* KikoMix simulated player — window.KM.player
 *
 * SIMULATED PLAYBACK: a 1-second timer advances positionSec. There is NO
 * <audio> element and NO real audio — every place the player renders
 * carries an honest "Simulated playback" notice. Never claim real playback.
 *
 * Provided: state, play(trackId, sourceId), pause(), toggle(), next(),
 * prev(), enqueue(ids), onTrackChange(fn), toggleLike(), isLiked(id),
 * seekTo(sec), setVolume(v), setProviderUrl(url), toggleQueue(force),
 * plus helpers remember(track) and resolveTrack(id) used by the shell's
 * own modules.
 *
 * Rendering: one shared renderAll() feeds BOTH the persistent player bar
 * (#player: mini on <1024px, full Spotify-style bar on >=1024px) and the
 * Now Playing tab (#np-core). The #player bar is hidden until a track is
 * active. The up-next queue (#queue) renders from the player's own
 * state.queue model — no separate queue store exists anywhere else.
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
    queueIndex: -1,
    shuffle: false,
    repeat: 'off',   // 'off' | 'all' | 'one'
    volume: 80
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

  // --- Liked tracks (local only, honest demo feature) -----------------------
  var likedSet = (function () {
    try {
      var v = JSON.parse(localStorage.getItem('km:liked') || '[]');
      return new Set(Array.isArray(v) ? v : []);
    } catch (e) { return new Set(); }
  })();

  function isLiked(id) {
    return id != null && likedSet.has(id);
  }

  function toggleLike() {
    if (state.trackId == null) return;
    if (likedSet.has(state.trackId)) likedSet.delete(state.trackId);
    else likedSet.add(state.trackId);
    try { localStorage.setItem('km:liked', JSON.stringify(Array.from(likedSet))); } catch (e) {}
    renderAll();
  }

  // --- Volume (simulated; no audio element exists) --------------------------
  try {
    var vv = parseInt(localStorage.getItem('km:volume') || '', 10);
    if (!isNaN(vv)) state.volume = Math.min(100, Math.max(0, vv));
  } catch (e) {}

  function setVolume(v) {
    state.volume = Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
    try { localStorage.setItem('km:volume', String(state.volume)); } catch (e) {}
    var input = document.getElementById('player-vol');
    if (input && document.activeElement !== input) input.value = state.volume;
  }

  // --- "Open in provider" hook ----------------------------------------------
  // External callers can pin a URL via setProviderUrl(url) (cleared on every
  // track change). Otherwise providerUrlFor resolves automatically: the
  // source used for playback first, then the free-first provider list.
  var providerUrlOverride = null;
  function setProviderUrl(url) {
    providerUrlOverride = url || null;
    renderBar();
  }
  function providerUrlFor(track) {
    if (providerUrlOverride) return providerUrlOverride;
    if (!track) return null;
    // Free-first: resolve the provider search link for the source used for
    // playback (state.sourceId), else the first free provider that has one.
    var links = track.providerLinks || null;
    if (!links && window.KM_LINKS && typeof window.KM_LINKS.providerLinksFor === 'function') {
      try { links = window.KM_LINKS.providerLinksFor(track.title, track.artist); } catch (e) { links = null; }
    }
    if (links) {
      var order = [];
      if (state.sourceId) order.push(state.sourceId);
      ['spotify', 'youtube', 'soundcloud'].forEach(function (id) {
        if (order.indexOf(id) === -1) order.push(id);
      });
      for (var i = 0; i < order.length; i++) {
        if (links[order[i]]) return links[order[i]];
      }
    }
    return track.openUrl || track.providerUrl || track.url || null;
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
      renderAll();
      return;
    }
    remember(track);
    state.trackId = track.id;
    // Never inherit a stale source: a play() without an explicit sourceId
    // resolves free-first via providerUrlFor (spotify → youtube → soundcloud).
    state.sourceId = item.sourceId || null;
    state.positionSec = 0;
    state.durationSec = Number(track.durationSec) || 210;
    state.playing = true;
    // A new track clears any explicit provider-URL override so the automatic
    // free-first providerLinks resolution applies (see providerUrlFor).
    providerUrlOverride = null;
    saveRecent(track.id);
    renderAll();
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
    renderAll();
  }

  function resume() {
    if (state.playing || state.trackId == null) return;
    if (state.positionSec >= state.durationSec) state.positionSec = 0;
    state.playing = true;
    renderAll();
  }

  function toggle() {
    if (state.playing) pause(); else resume();
  }

  function next() {
    if (state.repeat === 'one') {
      state.positionSec = 0;
      state.playing = true;
      renderAll();
      return;
    }
    if (state.queueIndex + 1 < state.queue.length) {
      state.queueIndex++;
      startItem(state.queue[state.queueIndex]);
    } else if (state.repeat === 'all' && state.queue.length > 0) {
      state.queueIndex = 0;
      startItem(state.queue[state.queueIndex]);
    } else {
      state.playing = false; // end of queue: stop, stay on last track
      renderAll();
    }
  }

  function prev() {
    if (state.positionSec > 3 || state.queueIndex <= 0) {
      state.positionSec = 0; // restart current track
      renderAll();
      return;
    }
    state.queueIndex--;
    startItem(state.queue[state.queueIndex]);
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    if (state.shuffle && state.queue.length > state.queueIndex + 1) {
      // Fisher-Yates the upcoming items; current track stays put.
      var rest = state.queue.slice(state.queueIndex + 1);
      for (var i = rest.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
      }
      state.queue = state.queue.slice(0, state.queueIndex + 1).concat(rest);
    }
    renderAll();
  }

  function cycleRepeat() {
    state.repeat = state.repeat === 'off' ? 'all' : (state.repeat === 'all' ? 'one' : 'off');
    renderAll();
  }

  /** ids: array of track ids or {trackId, sourceId} objects. */
  function enqueue(ids) {
    var arr = Array.isArray(ids) ? ids : [ids];
    var items = arr.map(function (x) {
      if (x && typeof x === 'object') return { trackId: x.trackId != null ? x.trackId : x.id, sourceId: x.sourceId || null };
      return { trackId: x, sourceId: null };
    }).filter(function (x) { return x.trackId != null; });
    if (!items.length) return 0;
    if (state.trackId == null) {
      state.queue = items.slice();
      state.queueIndex = 0;
      startItem(state.queue[0]);
    } else {
      state.queue = state.queue.concat(items);
      renderAll();
    }
    return items.length;
  }

  function seekTo(sec) {
    if (state.trackId == null) return;
    state.positionSec = Math.min(Math.max(0, Number(sec) || 0), state.durationSec);
    tickUpdate();
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

  // --- Icons ----------------------------------------------------------------
  var ICONS = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2.4v14H6zM19 5v14L9.5 12z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.6 5H18v14h-2.4zM5 5v14l9.5-7z" fill="currentColor"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.8 13a4.9 4.9 0 0 1 0-7 4.7 4.7 0 0 1 6.8 0l.4.5.4-.5a4.7 4.7 0 0 1 6.8 0 4.9 4.9 0 0 1 0 7L12 20.3Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.8 13a4.9 4.9 0 0 1 0-7 4.7 4.7 0 0 1 6.8 0l.4.5.4-.5a4.7 4.7 0 0 1 6.8 0 4.9 4.9 0 0 1 0 7L12 20.3Z" fill="currentColor"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h4l10 12h4"/><path d="m17 4 4 4-4 4"/><path d="M3 18h4l2.5-3"/><path d="m17 20 4-4-4-4"/><path d="M13.5 9 17 6h4"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5l2 2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M4 20v-5h5"/></svg>',
    repeatOne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5l2 2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M4 20v-5h5"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/></svg>',
    queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="17" r="2.6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chevDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>'
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
      else if (t === 'like') toggleLike();
      else if (t === 'queue') toggleQueue();
      else if (t === 'collapse') {
        if (window.KM.ui && typeof window.KM.ui.collapseNowPlaying === 'function') window.KM.ui.collapseNowPlaying();
      }
    });
    // Click-to-seek on the np-core progress bar (adds "seek" to the sheet).
    root.addEventListener('click', function (e) {
      var bar = e.target.closest ? e.target.closest('.np-progress') : null;
      if (!bar || !root.contains(bar) || !state.durationSec) return;
      var r = bar.getBoundingClientRect();
      var x = (e.clientX - r.left) / Math.max(1, r.width);
      seekTo(x * state.durationSec);
    });
  }

  // --- Persistent player bar (#player) --------------------------------------
  function renderBar() {
    var bar = document.getElementById('player');
    if (!bar) return;
    var esc = window.KM.ui.esc;
    var track = resolveTrack(state.trackId);
    var active = !!track;
    bar.hidden = !active;
    try { document.body.classList.toggle('has-player', active); } catch (e) {}
    if (!active) { toggleQueue(false); return; }

    var hue = (track.hue != null && track.hue !== '') ? track.hue : hashHue(String(track.id));
    var art = document.getElementById('player-art');
    if (art) art.setAttribute('style', '--hue:' + hue);
    var title = document.getElementById('player-title');
    if (title) title.textContent = track.title || 'Untitled';
    var artist = document.getElementById('player-artist');
    if (artist) artist.textContent = (track.artist || 'Unknown artist') + (track.album ? ' · ' + track.album : '');
    var src = document.getElementById('player-source');
    if (src) src.innerHTML = state.sourceId ? window.KM.ui.badge(state.sourceId) : '';
    var prov = document.getElementById('open-provider');
    if (prov) {
      var url = providerUrlFor(track);
      prov.hidden = !url;
      if (url) prov.setAttribute('href', url);
    }

    // Toggle icons (mini + main).
    var toggles = bar.querySelectorAll('[data-p="toggle"]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].innerHTML = state.playing ? ICONS.pause : ICONS.play;
      toggles[i].setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    }
    // Like.
    var like = bar.querySelector('[data-p="like"]');
    if (like) {
      var liked = isLiked(state.trackId);
      like.innerHTML = liked ? ICONS.heartFill : ICONS.heart;
      like.setAttribute('aria-pressed', liked ? 'true' : 'false');
    }
    // Shuffle / repeat.
    var sh = bar.querySelector('[data-p="shuffle"]');
    if (sh) {
      sh.innerHTML = ICONS.shuffle;
      sh.setAttribute('aria-pressed', state.shuffle ? 'true' : 'false');
    }
    var rp = bar.querySelector('[data-p="repeat"]');
    if (rp) {
      rp.innerHTML = state.repeat === 'one' ? ICONS.repeatOne : ICONS.repeat;
      rp.setAttribute('aria-pressed', state.repeat === 'off' ? 'false' : 'true');
      rp.setAttribute('aria-label', state.repeat === 'one' ? 'Repeat one' : (state.repeat === 'all' ? 'Repeat all' : 'Repeat'));
    }
    // Queue toggle icon.
    var qt = document.getElementById('queue-toggle');
    if (qt) qt.innerHTML = ICONS.queue;

    // Times + seek range.
    var pos = document.getElementById('player-pos');
    if (pos) pos.textContent = fmt(state.positionSec);
    var dur = document.getElementById('player-dur');
    if (dur) dur.textContent = fmt(state.durationSec);
    var range = document.getElementById('player-range');
    if (range) {
      range.max = String(Math.max(1, Math.floor(state.durationSec)));
      if (document.activeElement !== range) range.value = String(Math.floor(state.positionSec));
      range.style.setProperty('--fill', (state.durationSec ? (state.positionSec / state.durationSec) * 100 : 0) + '%');
      range.setAttribute('aria-valuetext', fmt(state.positionSec) + ' of ' + fmt(state.durationSec));
    }
    // Volume.
    var vol = document.getElementById('player-vol');
    if (vol) {
      if (document.activeElement !== vol) vol.value = String(state.volume);
      vol.style.setProperty('--fill', state.volume + '%');
    }
  }

  function wireBar() {
    var bar = document.getElementById('player');
    if (!bar || bar._kmWired) return;
    bar._kmWired = true;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-p]') : null;
      if (!btn || !bar.contains(btn)) return;
      var p = btn.getAttribute('data-p');
      if (p === 'toggle') toggle();
      else if (p === 'prev') prev();
      else if (p === 'next') next();
      else if (p === 'like') toggleLike();
      else if (p === 'shuffle') toggleShuffle();
      else if (p === 'repeat') cycleRepeat();
      else if (p === 'queue') toggleQueue();
    });
    var expand = document.getElementById('player-expand');
    if (expand && !expand._kmWired) {
      expand._kmWired = true;
      expand.addEventListener('click', function () {
        if (window.KM.ui && typeof window.KM.ui.expandNowPlaying === 'function') window.KM.ui.expandNowPlaying();
      });
    }
    var range = document.getElementById('player-range');
    if (range && !range._kmWired) {
      range._kmWired = true;
      range.addEventListener('input', function () { seekTo(Number(range.value)); });
    }
    var vol = document.getElementById('player-vol');
    if (vol && !vol._kmWired) {
      vol._kmWired = true;
      vol.addEventListener('input', function () { setVolume(vol.value); });
    }
  }

  // --- Up-next queue (#queue) ------------------------------------------------
  var queueOpen = false;

  function toggleQueue(force) {
    var want = typeof force === 'boolean' ? force : !queueOpen;
    queueOpen = want && state.trackId != null;
    renderQueue();
  }

  function renderQueue() {
    var q = document.getElementById('queue');
    if (!q) return;
    var esc = window.KM.ui.esc;
    q.hidden = !queueOpen;
    var qt = document.getElementById('queue-toggle');
    if (qt) qt.setAttribute('aria-expanded', queueOpen ? 'true' : 'false');
    if (!queueOpen) return;
    var list = q.querySelector('.queue__list');
    var close = q.querySelector('.queue__close');
    if (close && !close.innerHTML) close.innerHTML = ICONS.close;
    if (!list) return;
    if (!state.queue.length) {
      list.innerHTML = '<li class="queue__empty">The queue is empty. Play something first.</li>';
      return;
    }
    var html = state.queue.map(function (item, i) {
      var t = resolveTrack(item.trackId);
      var hue = (t && t.hue != null && t.hue !== '') ? t.hue : hashHue(String(item.trackId));
      var title = t ? (t.title || 'Untitled') : String(item.trackId);
      var artist = t ? (t.artist || 'Unknown artist') : '';
      return '<li><button type="button" class="queue__item' + (i === state.queueIndex ? ' current' : '') +
        '" data-qi="' + i + '" aria-current="' + (i === state.queueIndex ? 'true' : 'false') + '">' +
        '<span class="cover" style="--hue:' + esc(hue) + '" aria-hidden="true"></span>' +
        '<span class="queue__item-meta"><span class="queue__item-title">' + esc(title) + '</span>' +
        '<span class="queue__item-artist">' + esc(artist) + '</span></span>' +
        '</button></li>';
    }).join('');
    list.innerHTML = html;
  }

  function wireQueue() {
    var q = document.getElementById('queue');
    if (!q || q._kmWired) return;
    q._kmWired = true;
    q.addEventListener('click', function (e) {
      var closeBtn = e.target.closest ? e.target.closest('[data-p="queue"]') : null;
      if (closeBtn && q.contains(closeBtn)) { toggleQueue(false); return; }
      var item = e.target.closest ? e.target.closest('[data-qi]') : null;
      if (item && q.contains(item)) {
        var idx = parseInt(item.getAttribute('data-qi'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < state.queue.length) {
          state.queueIndex = idx;
          startItem(state.queue[idx]);
        }
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && queueOpen) toggleQueue(false);
    });
  }

  // --- Now Playing tab (#np-core) --------------------------------------------
  function renderNowPlaying() {
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
    var liked = isLiked(state.trackId);
    var queueItems = state.queue.map(function (item, i) {
      var t = resolveTrack(item.trackId);
      var label = t ? (t.title + ' — ' + (t.artist || 'Unknown artist')) : String(item.trackId);
      return '<li class="' + (i === state.queueIndex ? 'current' : '') + '">' + esc(label) + '</li>';
    }).join('');
    root.innerHTML =
      '<button type="button" class="np-collapse" data-t="collapse" aria-label="Collapse now playing">' + ICONS.chevDown + '</button>' +
      '<div class="np-cover cover cover-lg" style="--hue:' + esc(hue) + '" aria-hidden="true"></div>' +
      '<div class="np-title-row">' +
        '<div class="np-title">' + esc(track.title || 'Untitled') + '</div>' +
        '<button type="button" class="icon-btn np-like" data-t="like" aria-pressed="' + (liked ? 'true' : 'false') +
          '" aria-label="Like this track">' + (liked ? ICONS.heartFill : ICONS.heart) + '</button>' +
      '</div>' +
      '<div class="np-artist">' + esc(track.artist || 'Unknown artist') +
        (track.album ? ' · ' + esc(track.album) : '') + '</div>' +
      '<div class="np-badges">' + (state.sourceId ? window.KM.ui.badge(state.sourceId) : '') + '</div>' +
      '<div class="notice"><strong>Simulated playback</strong> — no audio is playing. ' +
        'Connect a real service for actual audio.</div>' +
      '<div class="np-progress" role="progressbar" aria-label="Playback progress (click to seek)" ' +
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
        '<button type="button" class="btn tbtn" data-t="queue" aria-label="Up next queue">' + ICONS.queue + '</button>' +
      '</div>' +
      (state.queue.length > 1
        ? '<h3 class="section-title">Up next</h3><ol class="np-queue">' + queueItems + '</ol>'
        : '');
  }

  function renderAll() {
    renderNowPlaying();
    renderBar();
    renderQueue();
    wireBar();
    wireQueue();
  }

  /** Light per-tick update: progress indicators + elapsed times only. */
  function tickUpdate() {
    var bar = document.getElementById('np-bar');
    var pos = document.getElementById('np-pos');
    if (bar && state.durationSec) bar.style.width = Math.min(100, (state.positionSec / state.durationSec) * 100).toFixed(1) + '%';
    if (pos) pos.textContent = fmt(state.positionSec);
    var prog = document.querySelector('#np-core .np-progress');
    if (prog) prog.setAttribute('aria-valuenow', String(Math.floor(state.positionSec)));

    var ppos = document.getElementById('player-pos');
    if (ppos) ppos.textContent = fmt(state.positionSec);
    var range = document.getElementById('player-range');
    if (range && state.durationSec) {
      if (document.activeElement !== range) range.value = String(Math.floor(state.positionSec));
      range.style.setProperty('--fill', ((state.positionSec / state.durationSec) * 100) + '%');
      range.setAttribute('aria-valuetext', fmt(state.positionSec) + ' of ' + fmt(state.durationSec));
    }
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
    resolveTrack: resolveTrack,
    toggleLike: toggleLike,
    isLiked: isLiked,
    seekTo: seekTo,
    setVolume: setVolume,
    toggleShuffle: toggleShuffle,
    cycleRepeat: cycleRepeat,
    setProviderUrl: setProviderUrl,
    toggleQueue: toggleQueue
  };
})();
