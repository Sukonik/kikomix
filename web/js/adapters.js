/* KikoMix — Project TriBeam: provider adapter layer.
 * Sets window.KM_ADAPTERS = { list: [...], byId: {...} }.
 *
 * =====================================================================
 * REAL INTEGRATION SEAM — to plug in real OAuth:
 *   1) Replace the mock search() with fetch() calls to the provider API
 *      using a stored access token.
 *   2) resolve() should return the provider's playback URI / SDK handle
 *      (e.g. Spotify URI, Apple Music token-authenticated playback URL).
 *      FREE-TIER REALITY: Spotify's Web API no longer provides 30-second
 *      preview_urls for apps created after 2024-11-27 (returns null), so a
 *      real integration cannot count on in-app previews. Free playback
 *      means deep-linking "Open in Spotify" (open.spotify.com/track/{id}),
 *      where free listeners get limited daily on-demand picks with ads
 *      before playback falls back to shuffle — or embedding via the
 *      official players: the YouTube IFrame Player API (full-length where
 *      the uploader allows embedding) and the SoundCloud HTML5 widget
 *      (full streams of public tracks, no account).
 *   3) playbackCapabilities() flips canPlayRealAudio to true only when a
 *      valid token exists; otherwise keep it false.
 *   4) NEVER store raw tokens in localStorage — use the provider SDK or a
 *      secure backend session. Playback must stay on the authorized
 *      provider; KikoMix never re-hosts audio.
 * =====================================================================
 *
 * MVP note: all five adapters are MOCK. search() filters the static
 * KM_DATA catalog with simulated latency. resolve() returns no real
 * stream. playbackCapabilities() always reports simulated-only.
 *
 * FREE-TIER FIRST: adapters carry badge ('Free' | 'Subscription' |
 * 'Your files'), tier ('free' | 'more', for the Sources tab grouping) and
 * an honest blurb about what free playback can do. Nothing here implies
 * full on-demand Spotify playback without Premium.
 */
(function () {
  'use strict';

  var KM_DATA_MISSING = typeof window.KM_DATA === 'undefined' ||
    !window.KM_DATA ||
    !Array.isArray(window.KM_DATA.tracks);

  if (KM_DATA_MISSING) {
    console.warn('[KikoMix] adapters.js: window.KM_DATA is missing or has no tracks. ' +
      'Load js/data.js before js/adapters.js. search() will return empty results.');
  }

  /**
   * ProviderAdapter — contract the UI builds on.
   * fields: id, name, tagline, color, badge, tier, blurb, dimmed, connected
   * methods: search(query), resolve(trackId), playbackCapabilities()
   */
  function ProviderAdapter(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.tagline = opts.tagline;
    this.color = opts.color;
    // Free-tier framing (additive fields — the contract above is unchanged):
    // badge: 'Free' | 'Subscription' | 'Your files'
    // tier: 'free' (Sources tab "Free" section) | 'more' ("More" section)
    // blurb: honest one-liner about what free playback can do here
    // dimmed: true for subscription sources (Sources tab renders them de-emphasized)
    this.badge = opts.badge || null;
    this.tier = opts.tier || 'free';
    this.blurb = opts.blurb || '';
    this.dimmed = !!opts.dimmed;
    // All adapters are "connected" in the MVP mock: the streaming services
    // simulate a logged-in session, and local files need no OAuth at all.
    this.connected = typeof opts.connected === 'boolean' ? opts.connected : true;
  }

  /**
   * search(query) → Promise<[{ trackId, sourceId, title, artist, album, durationSec }]>
   * Mock implementation: filters KM_DATA.tracks. Every whitespace-separated
   * term must match (case-insensitive) somewhere in title/artist/album/genre.
   * Only tracks listed on THIS adapter's source id are returned.
   * Latency is simulated: 120–450 ms via setTimeout.
   */
  ProviderAdapter.prototype.search = function (query) {
    var self = this;
    return new Promise(function (resolve) {
      var latency = 120 + Math.floor(Math.random() * 331); // 120–450 ms
      setTimeout(function () {
        if (KM_DATA_MISSING) { resolve([]); return; }
        var terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
        var results = window.KM_DATA.tracks.filter(function (t) {
          if (t.sources.indexOf(self.id) === -1) return false;
          if (terms.length === 0) return true;
          var haystack = (t.title + ' ' + t.artist + ' ' + t.album + ' ' + t.genre).toLowerCase();
          return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
        }).map(function (t) {
          return {
            trackId: t.id,
            sourceId: self.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            durationSec: t.durationSec
          };
        });
        resolve(results);
      }, latency);
    });
  };

  /**
   * resolve(trackId) → { streamUrl: null, requiresAuth: true, simulated: true, note }
   * MVP: no real audio. In production this returns the provider's playback
   * URI / SDK handle (see REAL INTEGRATION SEAM above).
   */
  ProviderAdapter.prototype.resolve = function (trackId) {
    return {
      streamUrl: null,
      requiresAuth: this.id !== 'local',
      simulated: true,
      note: 'MVP mock — no real audio. Connect the real ' + this.name +
        ' service to get a playable stream for track "' + trackId + '".'
    };
  };

  /**
   * playbackCapabilities() → { canPlayRealAudio:false, simulatedOnly:true, details }
   * Flips canPlayRealAudio only when a real provider token exists.
   */
  ProviderAdapter.prototype.playbackCapabilities = function () {
    return {
      canPlayRealAudio: false,
      simulatedOnly: true,
      details: 'Mock adapter — ' + (this.blurb ||
        'connect a real service for actual playback.')
    };
  };

  var list = [
    new ProviderAdapter({
      id: 'spotify', name: 'Spotify', color: '#1DB954',
      tagline: 'Search the Spotify catalog, then open tracks in Spotify.',
      badge: 'Free', tier: 'free',
      blurb: 'In-app 30-second previews are deprecated by Spotify for new apps — ' +
        'tap "Open in Spotify" instead. Free listeners get limited on-demand ' +
        'picks with ads each day, then shuffle. Full on-demand needs Premium.'
    }),
    new ProviderAdapter({
      id: 'youtube', name: 'YouTube', color: '#ff0000',
      tagline: 'Music videos and audio from YouTube\'s deep catalog.',
      badge: 'Free', tier: 'free',
      blurb: 'Full-length playback via the official YouTube IFrame Player API — ' +
        'wherever the uploader allows embedding. No account needed.'
    }),
    new ProviderAdapter({
      id: 'soundcloud', name: 'SoundCloud', color: '#ff5500',
      tagline: 'Independent artists, demos and uploads from SoundCloud.',
      badge: 'Free', tier: 'free',
      blurb: 'Full streams of public tracks via the official SoundCloud ' +
        'widget. No account needed.'
    }),
    new ProviderAdapter({
      id: 'apple', name: 'Apple Music', color: '#fa2d48',
      tagline: 'Apple Music catalog with spatial-audio ready playback.',
      badge: 'Subscription', tier: 'more', dimmed: true,
      blurb: 'Requires an Apple Music subscription for full playback — ' +
        'KikoMix shows the catalog only.'
    }),
    new ProviderAdapter({
      id: 'local', name: 'Local Files', color: '#a78bfa',
      tagline: 'Reads files you own on this device — no account needed.',
      badge: 'Your files', tier: 'more',
      blurb: 'Plays files you already own on this device — no account, no subscription.'
    })
  ];

  var byId = {};
  list.forEach(function (a) { byId[a.id] = a; });

  window.KM_ADAPTERS = { list: list, byId: byId };
})();
