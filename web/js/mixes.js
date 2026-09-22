/* KikoMix — Mixes (playlists)
 *
 * window.KM.mixes = { render(), create(name), promptAdd(trackId, sourceId), detectDuplicates(mix) }
 *
 * Storage: localStorage 'km:mixes' -> [{ id, name, items: [{ trackId, sourceId, addedAt }] }]
 * Mixes can hold songs from different services side by side; each item
 * remembers the service it plays from.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  var KEY = 'km:mixes';

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

  /* ---------- modal ---------- */
  var modalKeyHandler = null;
  function openModal(html) {
    closeModal();
    var ov = document.createElement('div');
    ov.className = 'modal show';
    ov.id = 'km-modal';
    ov.innerHTML = '<div class="modal-card card" role="dialog" aria-modal="true">' + html + '</div>';
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    modalKeyHandler = function (e) { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', modalKeyHandler);
    var first = ov.querySelector('input, button');
    if (first) { try { first.focus(); } catch (err) {} }
    return ov;
  }
  function closeModal() {
    var m = document.getElementById('km-modal');
    if (m && m.parentNode) m.parentNode.removeChild(m);
    if (modalKeyHandler) { document.removeEventListener('keydown', modalKeyHandler); modalKeyHandler = null; }
  }

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw != null) return JSON.parse(raw) || [];
    } catch (e) {}
    return null; // null = never seeded
  }
  function save(mixes) { try { localStorage.setItem(KEY, JSON.stringify(mixes)); } catch (e) {} }

  function mkItem(t, sourceId, addedAt) {
    return { trackId: t.id, sourceId: sourceId || ((t.sources || [])[0]) || 'local', addedAt: addedAt || Date.now() };
  }

  /** Seed the demo mix "Sunset Drive" on first run. */
  function seedIfNeeded() {
    var existing = load();
    if (existing !== null) return existing;
    var ts = tracks();
    var mixes = [];
    if (ts.length) {
      var items = [];
      var n = Math.min(5, ts.length);
      for (var i = 0; i < n; i++) items.push(mkItem(ts[i], null, Date.now() - (n - i) * 60000));
      // Two intentional duplicates: same recording as items[0], different source.
      if (ts.length >= 5) {
        var t0 = ts[0], srcs = t0.sources || ['local'];
        items.push(mkItem(t0, srcs[1] || srcs[0], Date.now()));
      }
      mixes.push({ id: 'mix-sunset-drive', name: 'Sunset Drive', items: items });
    }
    save(mixes);
    return mixes;
  }

  function getMix(id) {
    var mixes = seedIfNeeded();
    for (var i = 0; i < mixes.length; i++) if (mixes[i].id === id) return mixes[i];
    return null;
  }

  /* ---------- duplicates ---------- */
  /**
   * Group a mix's items by lowercase title|artist. Returns groups with
   * more than one item (same recording, different sources).
   */
  function detectDuplicates(mix) {
    var groups = {};
    (mix.items || []).forEach(function (it, idx) {
      var t = byId(it.trackId);
      if (!t) return;
      var k = String(t.title || '').toLowerCase() + '|' + String(t.artist || '').toLowerCase();
      (groups[k] = groups[k] || []).push({ item: it, index: idx, track: t });
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .filter(function (g) { return g.length > 1; });
  }

  // Preferred-source key must match search.js: 'km:pref:' + encodeURIComponent(dedupeKey).
  function preferredSource(track) {
    try {
      var key = String(track.title || '').toLowerCase().trim() + '|' +
                String(track.artist || '').toLowerCase().trim();
      return localStorage.getItem('km:pref:' + encodeURIComponent(key));
    } catch (e) { return null; }
  }

  function combineDuplicates(mixId) {
    var mixes = seedIfNeeded();
    var m = getMix(mixId);
    if (!m) return;
    var groups = detectDuplicates(m);
    var removed = 0;
    groups.forEach(function (g) {
      var pref = preferredSource(g[0].track);
      var keepIdx = 0;
      if (pref) {
        for (var i = 0; i < g.length; i++) {
          if (g[i].item.sourceId === pref) { keepIdx = i; break; }
        }
      }
      g.forEach(function (x, i) {
        if (i !== keepIdx) {
          var at = m.items.indexOf(x.item);
          if (at !== -1) { m.items.splice(at, 1); removed++; }
        }
      });
    });
    save(mixes);
    render();
    toast('Duplicates combined');
    try {
      if (KM.lion && typeof KM.lion.say === 'function') {
        KM.lion.say('Done — I combined ' + removed + ' duplicate ' +
          (removed === 1 ? 'entry' : 'entries') + ' into one, keeping your preferred source.');
      }
    } catch (e) {}
  }

  /* ---------- actions ---------- */
  function create(name, quiet) {
    var mixes = seedIfNeeded();
    var m = { id: 'mix-' + Date.now().toString(36), name: String(name).slice(0, 60), items: [] };
    mixes.push(m);
    save(mixes);
    render();
    if (!quiet) toast('Mix "' + m.name + '" created');
    return m;
  }

  function addToMix(mixId, trackId, sourceId) {
    var mixes = seedIfNeeded();
    var m = getMix(mixId);
    if (!m) return;
    var t = byId(trackId);
    m.items.push(mkItem(t || { id: trackId, sources: [sourceId] }, sourceId));
    save(mixes);
    render();
    toast('Added to "' + m.name + '"');
    try {
      if (KM.lion && typeof KM.lion.say === 'function') KM.lion.say('Filed away in "' + m.name + '".');
    } catch (e) {}
  }

  function replayMix(mixId) {
    var m = getMix(mixId);
    if (!m || !m.items.length) { toast('This mix is empty.'); return; }
    var ids = m.items.map(function (it) { return it.trackId; });
    try {
      if (KM.player && typeof KM.player.enqueue === 'function') KM.player.enqueue(ids);
      if (KM.player && typeof KM.player.play === 'function') KM.player.play(ids[0]);
    } catch (e) {}
    toast('Replaying "' + m.name + '" (simulated)');
    try {
      if (KM.lion && typeof KM.lion.say === 'function') KM.lion.say('Rolling "' + m.name + '" from the top — enjoy the ride.');
    } catch (e) {}
  }

  function removeItem(mixId, idx) {
    var mixes = seedIfNeeded();
    var m = getMix(mixId);
    if (!m || !m.items[idx]) return;
    m.items.splice(idx, 1);
    save(mixes);
    render();
  }

  function playItem(mixId, idx) {
    var m = getMix(mixId);
    if (!m || !m.items[idx]) return;
    try {
      if (KM.player && typeof KM.player.play === 'function') KM.player.play(m.items[idx].trackId);
    } catch (e) {}
  }

  /**
   * Modal (or inline) picker: existing mixes + a "new mix" option.
   */
  function promptAdd(trackId, sourceId) {
    var t = byId(trackId);
    if (!t) return;
    var src = sourceId || ((t.sources || [])[0]) || 'local';
    var mixes = seedIfNeeded();
    var list = mixes.map(function (m) {
      return '<button class="btn btn-ghost mix-pick" data-pick="' + esc(m.id) + '">' + esc(m.name) +
        ' <span class="chip">' + m.items.length + '</span></button>';
    }).join('') || '<div class="empty-state">No mixes yet — create one below.</div>';
    var ov = openModal(
      '<h3 class="section-title">Add to mix</h3>' +
      '<p class="track-sub">' + esc(t.title) + ' — ' + esc(t.artist) + '</p>' +
      '<div class="mix-pick-list">' + list + '</div>' +
      '<form id="km-mix-quicknew" class="mix-new">' +
      '<input name="name" placeholder="Or create a new mix…" maxlength="60" aria-label="New mix name">' +
      '<button class="btn btn-primary" type="submit">Create &amp; add</button></form>' +
      '<button class="btn btn-ghost" data-close>Cancel</button>'
    );
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      var pick = e.target.closest('[data-pick]');
      if (pick) { addToMix(pick.getAttribute('data-pick'), trackId, src); closeModal(); }
    });
    var f = ov.querySelector('#km-mix-quicknew');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (f.name.value || '').trim();
      if (!name) return;
      var m = create(name, true);
      addToMix(m.id, trackId, src);
      closeModal();
    });
  }

  /* ---------- render ---------- */
  function mixCard(m) {
    var dups = detectDuplicates(m);
    var extra = dups.reduce(function (n, g) { return n + g.length - 1; }, 0);
    var h = '<div class="card mix-card" data-mix="' + esc(m.id) + '">';
    h += '<div class="mix-head"><h4>' + esc(m.name) + '</h4>' +
      '<span class="chip">' + m.items.length + ' track' + (m.items.length === 1 ? '' : 's') + '</span></div>';
    if (extra > 0) {
      h += '<div class="notice dup-notice"><strong>LionDavid:</strong> ' +
        'Your playlist contains ' + extra + ' duplicate' + (extra === 1 ? '' : 's') +
        '. Would you like me to combine them? ' +
        '<button class="btn btn-primary" data-act="combine" data-mix="' + esc(m.id) + '">Combine</button></div>';
    }
    if (!m.items.length) {
      h += '<div class="empty-state">Empty mix — add songs from Search or Library.</div>';
    }
    m.items.forEach(function (it, idx) {
      var t = byId(it.trackId);
      if (!t) return;
      h += '<div class="track-row" data-mix="' + esc(m.id) + '" data-idx="' + idx + '">' +
        '<div class="cover" style="--hue:' + ((typeof t.hue === 'number') ? t.hue : 210) + '"></div>' +
        '<div class="track-meta"><div class="track-title">' + esc(t.title) + '</div>' +
        '<div class="track-sub">' + esc(t.artist || 'Unknown artist') + '</div></div>' +
        badgeHTML(it.sourceId) +
        '<button class="btn btn-ghost" data-act="play-item" title="Play">Play</button>' +
        '<button class="btn btn-ghost" data-act="remove" title="Remove" aria-label="Remove from mix">×</button>' +
        '</div>';
    });
    h += '<div class="mix-actions"><button class="btn btn-primary" data-act="replay" data-mix="' + esc(m.id) + '">Replay mix</button></div>';
    h += '</div>';
    return h;
  }

  function render() {
    var root = document.getElementById('mixes-root');
    if (!root) return;
    if (!root._kmMixWired) {
      root.addEventListener('click', onClick);
      root._kmMixWired = true;
    }
    var mixes = seedIfNeeded();
    var h = '<h3 class="section-title">Mixes</h3>' +
      '<form class="mix-new" id="km-mix-new">' +
      '<input name="name" placeholder="New mix name…" maxlength="60" aria-label="New mix name">' +
      '<button class="btn btn-primary" type="submit">New mix</button></form>';
    if (!mixes.length) h += '<div class="empty-state">No mixes yet — create one above, or tap +Mix on any song.</div>';
    mixes.forEach(function (m) { h += mixCard(m); });
    h += '<div id="mimicry-root"></div>';
    root.innerHTML = h;
    var form = root.querySelector('#km-mix-new');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (form.name.value || '').trim();
      if (name) { create(name); form.name.value = ''; }
    });
    // Mimicry panel below the mixes list. Guarded: mimicry.js may load after mixes.js.
    try {
      var mroot = root.querySelector('#mimicry-root');
      if (mroot && KM.mimicry && typeof KM.mimicry.renderPanel === 'function') {
        var seedId = (mixes[0] && mixes[0].items[0] && mixes[0].items[0].trackId) ||
          ((tracks()[0] && tracks()[0].id) || null);
        KM.mimicry.renderPanel(mroot, seedId);
      }
    } catch (e) {}
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var row = e.target.closest('.track-row');
    var mixId = el.getAttribute('data-mix') || (row && row.getAttribute('data-mix'));
    var idx = row ? parseInt(row.getAttribute('data-idx'), 10) : -1;
    if (act === 'replay') replayMix(mixId);
    else if (act === 'remove' && mixId && idx >= 0) removeItem(mixId, idx);
    else if (act === 'play-item' && mixId && idx >= 0) playItem(mixId, idx);
    else if (act === 'combine' && mixId) combineDuplicates(mixId);
  }

  KM.mixes = { render: render, create: create, promptAdd: promptAdd, detectDuplicates: detectDuplicates };
})();
