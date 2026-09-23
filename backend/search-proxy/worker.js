/* KikoMix search-proxy — a Cloudflare Worker.
 *
 * Why this exists: Deezer, the iTunes Search API, and Jamendo are all real,
 * genuinely keyless (or free-signup) public catalogs, but NONE of them send
 * CORS headers, so a static site like KikoMix cannot call them directly
 * from the browser (confirmed by testing each in September 2026 — every
 * one returns no Access-Control-Allow-Origin header). This Worker is the
 * smallest possible fix: it calls each provider server-side (where CORS
 * doesn't apply), normalizes the response into the shape
 * web/js/adapters.js expects, and adds CORS headers of its own so
 * KikoMix's frontend can call it.
 *
 * Contract: GET /search?provider=<deezer|jamendo|itunes>&q=<query>
 *   -> { query, provider, results: [{ providerId, title, artist, album,
 *        artwork, durationSec, previewUrl, externalUrl }] }
 *
 * One provider per request by design: KikoMix's existing search.js already
 * fans out to every connected adapter in parallel and merges/dedupes by
 * title+artist client-side (see web/js/search.js) — this Worker doesn't
 * duplicate that logic, it just makes each real source reachable.
 *
 * Deploy: see README.md in this directory.
 */

var GENRE_WORDS = new Set([
  'ska', 'house', 'deep house', 'afro house', 'tech house', 'techno', 'trance',
  'jungle', 'drum and bass', 'dnb', 'reggae', 'dancehall', 'afrobeat', 'afrobeats',
  'lofi', 'lo-fi', 'jazz', 'ambient', 'punk', 'hip hop', 'hip-hop', 'soul', 'funk',
  'disco', 'drill', 'grime', 'dubstep', 'rock', 'pop', 'metal', 'folk', 'blues',
  'classical', 'country', 'r&b', 'rnb', 'gospel', 'k-pop', 'kpop', 'indie'
]);

var SEARCHERS = {
  deezer: searchDeezer,
  itunes: searchItunes,
  jamendo: searchJamendo
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));

    var url = new URL(request.url);
    if (url.pathname !== '/search') return withCors(json({ error: 'not found' }, 404));

    var q = (url.searchParams.get('q') || '').trim();
    var provider = (url.searchParams.get('provider') || '').trim();
    if (!q || !provider) return withCors(json({ error: 'q and provider are both required' }, 400));

    var searcher = SEARCHERS[provider];
    if (!searcher) return withCors(json({ error: 'unknown provider: ' + provider }, 400));

    try {
      var results = await searcher(q, env);
      return withCors(json({ query: q, provider: provider, results: results }));
    } catch (err) {
      // One provider having a bad day should read as "no results", not a
      // 500 that could take down a whole KikoMix search — matches the
      // "one bad adapter never kills search" rule already in search.js.
      return withCors(json({ query: q, provider: provider, results: [], error: String(err && err.message || err) }));
    }
  }
};

async function searchDeezer(q) {
  var res = await fetch('https://api.deezer.com/search?q=' + encodeURIComponent(q));
  if (!res.ok) return [];
  var data = await res.json();
  return (data.data || []).slice(0, 25).map(function (t) {
    return {
      providerId: String(t.id),
      title: t.title,
      artist: t.artist && t.artist.name,
      album: t.album && t.album.title,
      artwork: t.album && t.album.cover_medium,
      durationSec: t.duration,
      previewUrl: t.preview || null, // real 30s mp3, playable directly
      externalUrl: t.link
    };
  });
}

async function searchItunes(q) {
  var res = await fetch('https://itunes.apple.com/search?media=music&limit=25&term=' + encodeURIComponent(q));
  if (!res.ok) return [];
  var data = await res.json();
  return (data.results || []).map(function (t) {
    return {
      providerId: String(t.trackId),
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      artwork: t.artworkUrl100,
      durationSec: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : null,
      previewUrl: t.previewUrl || null, // real 30s m4a, playable directly
      externalUrl: t.trackViewUrl
    };
  });
}

async function searchJamendo(q, env) {
  var clientId = env && env.JAMENDO_CLIENT_ID;
  if (!clientId) return []; // not registered yet -- skip, don't error the whole request
  var isGenre = GENRE_WORDS.has(q.toLowerCase().trim());
  var param = isGenre ? 'tags=' + encodeURIComponent(q) : 'namesearch=' + encodeURIComponent(q);
  var res = await fetch('https://api.jamendo.com/v3.0/tracks/?client_id=' + encodeURIComponent(clientId) +
    '&format=json&limit=25&' + param);
  if (!res.ok) return [];
  var data = await res.json();
  return (data.results || []).map(function (t) {
    return {
      providerId: String(t.id),
      title: t.name,
      artist: t.artist_name,
      album: t.album_name,
      artwork: t.image,
      durationSec: t.duration,
      previewUrl: t.audio || null, // real full-length stream, CC-licensed
      externalUrl: t.shareurl
    };
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
function withCors(res) {
  var headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers: headers });
}
