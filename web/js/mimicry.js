/* KikoMix — Mimicry: Vibe Generator (prototype)
 *
 * window.KM.mimicry = { generate(seedId, n=12), renderPanel(container, seedId) }
 *
 * Finds similar songs from mock metadata. It never copies or recreates
 * the original recording — similarity is scored from genre, mood, tempo,
 * era, energy, and instrumentation only.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  var lastContainer = null;
  var curSeed = null;
  var curResults = [];

  /* ---------- helpers ---------- */
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
  function badgeHTML(sourceId) {
    try {
      if (KM.ui && typeof KM.ui.badge === 'function') return KM.ui.badge(sourceId);
    } catch (e) {}
    var a = (window.KM_ADAPTERS && window.KM_ADAPTERS.byId && window.KM_ADAPTERS.byId[sourceId]) || {};
    return '<span class="badge" data-source="' + esc(sourceId) + '">' + esc(a.name || sourceId) + '</span>';
  }

  /* ---------- scoring (max 10) ---------- */
  function score(seed, cand) {
    var s = 0;
    if (cand.genre && seed.genre && cand.genre === seed.genre) s += 3;
    if (cand.mood && seed.mood && cand.mood === seed.mood) s += 2;
    if (typeof cand.tempoBpm === 'number' && typeof seed.tempoBpm === 'number' &&
        Math.abs(cand.tempoBpm - seed.tempoBpm) < 15) s += 2;
    if (cand.era && seed.era && cand.era === seed.era) s += 1;
    if (typeof cand.energy === 'number' && typeof seed.energy === 'number' &&
        Math.abs(cand.energy - seed.energy) <= 2) s += 1;
    var si = seed.instruments || [], ci = cand.instruments || [];
    if (si.some(function (x) { return ci.indexOf(x) !== -1; })) s += 1;
    return s;
  }

  /**
   * Score every track against the seed and return the top n matches
   * (seed excluded), each as { track, score, pct }.
   */
  function generate(seedId, n) {
    n = n || 12;
    var seed = byId(seedId);
    if (!seed) return [];
    return tracks()
      .filter(function (t) { return t && t.id !== seedId; })
      .map(function (t) {
        var sc = score(seed, t);
        return { track: t, score: sc, pct: Math.round((sc / 10) * 100) };
      })
      .filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, n);
  }

  /* ---------- panel ---------- */
  function resultsHTML() {
    if (!curResults.length) return '';
    return curResults.map(function (r) {
      var t = r.track;
      return '<div class="track-row" data-id="' + esc(t.id) + '">' +
        '<div class="cover" style="--hue:' + ((typeof t.hue === 'number') ? t.hue : 210) + '"></div>' +
        '<div class="track-meta"><div class="track-title">' + esc(t.title) + '</div>' +
        '<div class="track-sub">' + esc(t.artist || 'Unknown artist') + '</div></div>' +
        '<span class="chip">' + r.pct + '% match</span>' +
        badgeHTML(((t.sources || [])[0]) || 'local') +
        '<button class="btn btn-ghost" data-act="play">Play</button>' +
        '<button class="btn btn-ghost" data-act="mix">+Mix</button>' +
        '</div>';
    }).join('');
  }

  function paint() {
    if (!lastContainer) return;
    var seed = byId(curSeed);
    var opts = tracks().map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (t.id === curSeed ? ' selected' : '') + '>' +
        esc(t.title) + ' — ' + esc(t.artist || 'Unknown artist') + '</option>';
    }).join('');
    var h = '<section class="card mimicry-panel">' +
      '<h3 class="section-title">Mimicry — Vibe Generator <span class="chip">Prototype mock</span></h3>';
    if (seed) {
      h += '<div class="track-row seed-row">' +
        '<div class="cover" style="--hue:' + ((typeof seed.hue === 'number') ? seed.hue : 210) + '"></div>' +
        '<div class="track-meta"><div class="track-title">' + esc(seed.title) + '</div>' +
        '<div class="track-sub">' + esc(seed.artist || 'Unknown artist') + ' · seed track</div></div></div>' +
        '<div class="mimicry-controls">' +
        '<label class="seed-pick">Seed <select id="km-mimicry-seed">' + opts + '</select></label>' +
        '<button class="btn btn-primary" data-act="gen">Generate vibe</button>' +
        '</div>';
    } else {
      h += '<div class="empty-state">No tracks to seed from yet.</div>';
    }
    h += '<div class="mimicry-results">' + resultsHTML() + '</div>';
    h += '<p class="tech-note">Prototype: finds similar songs from mock metadata. ' +
      'It never copies or recreates the original recording.</p>';
    h += '</section>';
    lastContainer.innerHTML = h;
  }

  function renderPanel(container, seedId) {
    if (!container) return;
    lastContainer = container;
    if (!container._kmMimWired) {
      container.addEventListener('click', onClick);
      container.addEventListener('change', onChange);
      container._kmMimWired = true;
    }
    if (seedId) curSeed = seedId;
    if (!byId(curSeed)) curSeed = (tracks()[0] && tracks()[0].id) || null;
    curResults = [];
    paint();
  }

  function onClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'gen') {
      curResults = generate(curSeed, 12);
      paint();
      return;
    }
    var row = btn.closest('.track-row');
    var id = row && row.getAttribute('data-id');
    if (!id) return;
    if (act === 'play') {
      try { if (KM.player && typeof KM.player.play === 'function') KM.player.play(id); } catch (err) {}
    } else if (act === 'mix') {
      var t = byId(id);
      var src = (t && (t.sources || [])[0]) || 'local';
      try { if (KM.mixes && typeof KM.mixes.promptAdd === 'function') KM.mixes.promptAdd(id, src); } catch (err) {}
    }
  }

  function onChange(e) {
    if (e.target && e.target.id === 'km-mimicry-seed') {
      curSeed = e.target.value;
      curResults = [];
      paint();
    }
  }

  KM.mimicry = { generate: generate, renderPanel: renderPanel };

  /* If mixes.js rendered an empty #mimicry-root before this file loaded,
   * fill it once the DOM is ready. */
  function selfFill() {
    var el = document.getElementById('mimicry-root');
    if (el && !el.innerHTML.trim() && !(KM.mixes && document.querySelector('#mixes-root .mimicry-panel'))) {
      renderPanel(el);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selfFill);
  else selfFill();
})();
