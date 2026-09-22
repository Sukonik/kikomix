/* KikoMix UI shell helpers — window.KM.ui
 * Provided: showTab(name), toast(msg), esc(s), badge(sourceId).
 * No dependencies: safe to call even when data.js / adapters.js /
 * feature modules have not loaded yet. */
(function () {
  'use strict';
  window.KM = window.KM || {};

  var TABS = ['home', 'search', 'library', 'mixes', 'nowplaying', 'sources'];
  // Optional per-tab onShow hooks on feature modules (all optional-chained).
  var ONSHOW = {
    home: 'lion',
    search: 'search',
    library: 'library',
    mixes: 'mixes',
    nowplaying: 'player',
    sources: 'sources'
  };

  /** HTML-escape any user-ish string before injecting into markup. */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Switch the visible tab, sync the tab bar, update location.hash,
   *  then call the optional onShow hook of the tab's feature module. */
  function showTab(name) {
    if (TABS.indexOf(name) === -1) name = 'home';

    // Leaving the full-screen Now Playing sheet: drop sheet mode first so
    // the normal tab chrome (nav, player bar) comes back.
    var sheetWasOpen = false;
    try {
      sheetWasOpen = document.body.classList.contains('np-sheet-open');
      if (sheetWasOpen && name !== 'nowplaying') {
        document.body.classList.remove('np-sheet-open');
        _returnTab = null;
      }
    } catch (e) { /* sheet never opened; carry on */ }

    var sections = document.querySelectorAll('main .tab');
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.toggle('active', sections[i].id === 'tab-' + name);
    }

    var buttons = document.querySelectorAll('#tabbar [data-tab]');
    for (var j = 0; j < buttons.length; j++) {
      var on = buttons[j].getAttribute('data-tab') === name;
      buttons[j].classList.toggle('active', on);
      buttons[j].setAttribute('aria-selected', on ? 'true' : 'false');
    }

    if ((location.hash || '').slice(1) !== name) location.hash = name;

    // Tapping the Playing tab on a small screen with an active track
    // presents Now Playing as a full-screen sheet instead of a plain tab.
    if (name === 'nowplaying' && !_expanding && !sheetWasOpen) {
      var hasTrack = false;
      try { hasTrack = !!(window.KM.player && window.KM.player.state.trackId != null); } catch (e) {}
      var small = false;
      try { small = window.matchMedia && window.matchMedia('(max-width: 599px)').matches; } catch (e) {}
      if (hasTrack && small) { expandNowPlaying(); return; }
    }

    var modKey = ONSHOW[name];
    try {
      var mod = window.KM[modKey];
      if (mod && typeof mod.onShow === 'function') mod.onShow();
    } catch (e) {
      /* A feature module failed; the shell stays up. */
    }

    // Let contextual modules (e.g. LionDavid tips) react to tab switches.
    try {
      document.dispatchEvent(new CustomEvent('km:tab', { detail: { tab: name } }));
      document.dispatchEvent(new CustomEvent('km:tabchange', { detail: { tab: name } }));
    } catch (e) { /* older engines; tabs still work */ }
  }

  /** Small "which service is this from" label, e.g. <span class="badge" data-source="spotify">Spotify</span> */
  function badge(sourceId) {
    var name = sourceId;
    try {
      var adapters = window.KM_ADAPTERS;
      var a = null;
      if (adapters) {
        if (typeof adapters.byId === 'function') a = adapters.byId(sourceId);
        else if (adapters.byId && typeof adapters.byId === 'object') a = adapters.byId[sourceId] || null;
        if (!a && Array.isArray(adapters.list)) {
          for (var i = 0; i < adapters.list.length; i++) {
            if (adapters.list[i] && adapters.list[i].id === sourceId) { a = adapters.list[i]; break; }
          }
        }
      }
      if (a) name = a.name || a.label || a.title || sourceId;
    } catch (e) { /* fall back to raw id */ }
    return '<span class="badge" data-source="' + esc(sourceId) + '">' + esc(name) + '</span>';
  }

  /** Full-screen Now Playing sheet (mobile).
   *  expandNowPlaying() remembers the current tab, switches to the Playing
   *  tab, and adds body.np-sheet-open (CSS turns #tab-nowplaying into a
   *  full-screen sheet below 600px; elsewhere it is a plain tab).
   *  collapseNowPlaying() reverses it, returning to the previous tab.
   *  Dispatches km:playerexpand / km:playercollapse on document. */
  var _returnTab = null;
  var _expanding = false;

  function expandNowPlaying() {
    if (_expanding) return;
    _expanding = true;
    try {
      var before = (location.hash || '').slice(1);
      if (before && before !== 'nowplaying' && TABS.indexOf(before) !== -1) _returnTab = before;
      else if (!before) _returnTab = 'home';
      document.body.classList.add('np-sheet-open');
      if ((location.hash || '').slice(1) !== 'nowplaying') showTab('nowplaying');
      document.dispatchEvent(new CustomEvent('km:playerexpand', { detail: { tab: 'nowplaying' } }));
    } catch (e) { /* sheet state best-effort */ }
    _expanding = false;
  }

  function collapseNowPlaying() {
    try {
      document.body.classList.remove('np-sheet-open');
      document.dispatchEvent(new CustomEvent('km:playercollapse', {}));
    } catch (e) {}
    var target = _returnTab && TABS.indexOf(_returnTab) !== -1 ? _returnTab : 'home';
    _returnTab = null;
    if ((location.hash || '').slice(1) !== target) showTab(target);
  }

  function isSheetOpen() {
    try { return document.body.classList.contains('np-sheet-open'); } catch (e) { return false; }
  }

  var toastTimer = null;
  /** Show a transient message in #toast. Safe if the element is missing. */
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = String(msg == null ? '' : msg);
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  window.KM.ui = {
    showTab: showTab,
    toast: toast,
    esc: esc,
    badge: badge,
    expandNowPlaying: expandNowPlaying,
    collapseNowPlaying: collapseNowPlaying,
    isSheetOpen: isSheetOpen
  };

  /* Delegated tab switching: the #tabbar buttons carry data-tab but have
   * no inline handlers — one listener covers present and future buttons.
   * showTab() also sets location.hash; the hashchange re-fire is
   * idempotent, so tapping the active tab is a harmless no-op. */
  (function wireTabbar() {
    var tabbar = document.getElementById('tabbar');
    if (!tabbar) return;
    tabbar.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('[data-tab]') : null;
      if (!btn || !tabbar.contains(btn)) return;
      e.preventDefault();
      showTab(btn.getAttribute('data-tab'));
    });
  })();
})();
