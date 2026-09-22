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

  window.KM.ui = { showTab: showTab, toast: toast, esc: esc, badge: badge };
})();
