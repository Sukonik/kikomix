/* KikoMix — Kiko Radio
 *
 * window.KM.radio = { render() }
 *
 * REAL playback, not simulated: streams NoCopyrightSounds' free,
 * creator-cleared music mix (https://ncs.io) through the official YouTube
 * IFrame Player API. No KikoMix account, no provider login, no API key —
 * this is exactly the "free source, no account needed" playback the
 * Sources tab already promises for YouTube, now actually wired up for one
 * real, always-available catalog instead of the simulated timer the rest
 * of the (invented) demo catalog uses.
 *
 * The IFrame API and its network requests are loaded lazily, only once the
 * user opens Now Playing — never on initial page load.
 */
(function () {
  'use strict';
  window.KM = window.KM || {};
  var KM = window.KM;

  // "NCS : Copyright Free Music" — NCS's own official YouTube playlist.
  // Free to stream/embed; no API key needed for the Player (only the
  // YouTube Data API needs a key, and this doesn't use it).
  var PLAYLIST_ID = 'PLRBp0Fe2GpgnIh0AiYKh7o7HnYAej-5ph';
  var HOST_ID = 'km-radio-yt';

  var player = null;
  var apiCallbacks = [];
  var apiLoading = false;

  function toast(msg) {
    try { if (KM.ui && typeof KM.ui.toast === 'function') KM.ui.toast(msg); } catch (e) {}
  }

  function loadApi(cb) {
    if (window.YT && window.YT.Player) { cb(); return; }
    apiCallbacks.push(cb);
    if (apiLoading) return;
    apiLoading = true;
    var prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof prevReady === 'function') { try { prevReady(); } catch (e) {} }
      var cbs = apiCallbacks;
      apiCallbacks = [];
      cbs.forEach(function (fn) { try { fn(); } catch (e) {} });
    };
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = function () {
      apiLoading = false;
      setStatus('Couldn’t reach YouTube — check your connection and reopen this tab.');
    };
    document.head.appendChild(tag);
  }

  function setStatus(text) {
    var el = document.getElementById('radio-status');
    if (el) el.textContent = text;
  }

  function setToggleIcon(playing) {
    var btn = document.querySelector('[data-radio="toggle"]');
    if (btn) { btn.textContent = playing ? '⏸' : '▶'; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  }

  function onPlayerStateChange(e) {
    if (!window.YT) return;
    setToggleIcon(e.data === YT.PlayerState.PLAYING);
    if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.CUED) {
      try {
        var data = player.getVideoData();
        setStatus(data && data.title ? data.title : 'NCS radio');
      } catch (err) {}
    }
  }

  function ensurePlayer() {
    if (player || !document.getElementById(HOST_ID)) return;
    setStatus('Connecting to YouTube…');
    loadApi(function () {
      if (player || !document.getElementById(HOST_ID)) return;
      player = new YT.Player(HOST_ID, {
        height: '180',
        width: '100%',
        playerVars: { listType: 'playlist', list: PLAYLIST_ID, rel: 0 },
        events: {
          onReady: function () { setStatus('Ready — tap play.'); },
          onStateChange: onPlayerStateChange,
          onError: function () { setStatus('This track hit a snag — try Next.'); }
        }
      });
    });
  }

  function onClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-radio]') : null;
    if (!btn) return;
    if (!player) { toast('Still connecting to YouTube…'); return; }
    var act = btn.getAttribute('data-radio');
    try {
      if (act === 'toggle') {
        var state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) player.pauseVideo();
        else player.playVideo();
      } else if (act === 'next') player.nextVideo();
      else if (act === 'prev') player.previousVideo();
    } catch (err) { toast('Playback control failed — reload Now Playing.'); }
  }

  function render() {
    var root = document.getElementById('np-radio');
    if (!root || root._kmRadioBuilt) return;
    root._kmRadioBuilt = true;
    root.innerHTML =
      '<section class="card" aria-label="Kiko Radio">' +
        '<div class="tech-panel__header">' +
          '<h3 class="section-title" style="margin:0;">🎧 Kiko Radio</h3>' +
          '<span class="chip">Free · No account needed</span>' +
        '</div>' +
        '<p class="track-sub">Real playback — NoCopyrightSounds’ free, ' +
        'creator-cleared music mix, streamed via the official YouTube player. ' +
        'Not a KikoMix upload or a simulation; audio comes straight from YouTube ' +
        '(normal YouTube ads may apply).</p>' +
        '<div id="' + HOST_ID + '"></div>' +
        '<p id="radio-status" class="track-sub" role="status" aria-live="polite">Loading…</p>' +
        '<div class="np-transport">' +
          '<button type="button" class="tbtn" data-radio="prev" aria-label="Previous">⏮</button>' +
          '<button type="button" class="tbtn tbtn-main" data-radio="toggle" aria-label="Play">▶</button>' +
          '<button type="button" class="tbtn" data-radio="next" aria-label="Next">⏭</button>' +
        '</div>' +
      '</section>';
    root.addEventListener('click', onClick);
    ensurePlayer();
  }

  document.addEventListener('km:tab', function (e) {
    try { if (e && e.detail && e.detail.tab === 'nowplaying') render(); } catch (err) {}
  });
  document.addEventListener('DOMContentLoaded', function () {
    if ((location.hash || '').slice(1) === 'nowplaying') render();
  });

  KM.radio = { render: render };
})();
