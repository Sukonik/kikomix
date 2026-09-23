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
 * Contract: GET /search?provider=<deezer|jamendo|itunes>&q=<query>&field=<optional>
 *   -> { query, provider, results: [{ providerId, title, artist, album,
 *        artwork, durationSec, previewUrl, externalUrl }] }
 *
 * `field` is optional and defaults to auto-detect (genre-word list ->
 * genre, else a broad fuzzy match across artist/album/track). Pass
 * field=artist|album|track|genre explicitly to use each provider's precise
 * field syntax instead -- verified against each provider's own docs:
 *   Deezer:  advanced query operators `artist:"x"` / `album:"x"` /
 *            `track:"x"` on the plain /search endpoint (no separate genre
 *            field -- Deezer's genre browsing lives on a different,
 *            unrelated endpoint, so genre queries fall back to plain text).
 *   iTunes:  `attribute=artistTerm|albumTerm|songTerm|genreTerm` alongside
 *            `entity=musicTrack`.
 *   Jamendo: `artist_name=` / `album_name=` / `namesearch=` (track name) /
 *            `tags=` (genre, AND-matched) as dedicated filter params, or
 *            the broad fuzzy `search=` param (matches track+artist+album+
 *            tags at once) for auto/general queries.
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
    var fieldParam = (url.searchParams.get('field') || '').trim().toLowerCase();
    if (!q || !provider) return withCors(json({ error: 'q and provider are both required' }, 400));

    var searcher = SEARCHERS[provider];
    if (!searcher) return withCors(json({ error: 'unknown provider: ' + provider }, 400));

    var VALID_FIELDS = { artist: 1, album: 1, track: 1, genre: 1 };
    // 'auto' when no explicit field was given (or an unrecognized one) --
    // the per-provider searcher decides genre-by-wordlist vs. broad search.
    var field = VALID_FIELDS[fieldParam] ? fieldParam : 'auto';

    try {
      var results = await searcher(q, field, env);
      return withCors(json({ query: q, provider: provider, field: field, results: results }));
    } catch (err) {
      // One provider having a bad day should read as "no results", not a
      // 500 that could take down a whole KikoMix search — matches the
      // "one bad adapter never kills search" rule already in search.js.
      return withCors(json({ query: q, provider: provider, results: [], error: String(err && err.message || err) }));
    }
  }
};

// NOTE: Deezer's commonly-documented advanced query operators
// (q=artist:"x" / album:"x" / track:"x") were tested directly against the
// live API and returned ZERO results even for exact, well-known names
// (e.g. artist:"Daft Punk") -- that syntax is unreliable in practice.
// What actually works, verified live: the dedicated REST search endpoints
// (/search/artist, /search/album, /search/track), which return the
// matching entity, then a follow-up call for that entity's actual tracks.
async function searchDeezer(q, field) {
  if (field === 'track') {
    return deezerTrackList('https://api.deezer.com/search/track?q=' + encodeURIComponent(q));
  }
  if (field === 'artist') {
    var artist = await deezerFirstMatch('https://api.deezer.com/search/artist?q=' + encodeURIComponent(q) + '&limit=1');
    return artist ? deezerTrackList('https://api.deezer.com/artist/' + artist.id + '/top?limit=25') : [];
  }
  if (field === 'album') {
    var album = await deezerFirstMatch('https://api.deezer.com/search/album?q=' + encodeURIComponent(q) + '&limit=1');
    if (!album) return [];
    var tracks = await deezerTrackList('https://api.deezer.com/album/' + album.id + '/tracks?limit=25');
    // /album/{id}/tracks omits per-track album info (it's already scoped to
    // one album) -- fill it in from the album we just looked up.
    return tracks.map(function (t) { return Object.assign({}, t, { album: album.title, artwork: album.cover_medium }); });
  }
  // field === 'genre' and 'auto': Deezer's plain /search endpoint has no
  // genre operator (genre browsing lives on a separate, unrelated
  // endpoint) and is already a broad fuzzy match across artist/track/album.
  return deezerTrackList('https://api.deezer.com/search?q=' + encodeURIComponent(q));
}

async function deezerFirstMatch(url) {
  var res = await fetch(url);
  if (!res.ok) return null;
  var data = await res.json();
  return (data.data && data.data[0]) || null;
}

async function deezerTrackList(url) {
  var res = await fetch(url);
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

async function searchItunes(q, field) {
  var ITUNES_ATTR = { artist: 'artistTerm', album: 'albumTerm', track: 'songTerm', genre: 'genreTerm' };
  var attr = ITUNES_ATTR[field] ? '&attribute=' + ITUNES_ATTR[field] : ''; // omitted for 'auto' -> broad match
  var res = await fetch('https://itunes.apple.com/search?media=music&entity=musicTrack&limit=25' +
    attr + '&term=' + encodeURIComponent(q));
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

async function searchJamendo(q, field, env) {
  var clientId = env && env.JAMENDO_CLIENT_ID;
  if (!clientId) return []; // not registered yet -- skip, don't error the whole request
  var effectiveField = field === 'auto' && GENRE_WORDS.has(q.toLowerCase().trim()) ? 'genre' : field;
  var param;
  if (effectiveField === 'artist') param = 'artist_name=' + encodeURIComponent(q);
  else if (effectiveField === 'album') param = 'album_name=' + encodeURIComponent(q);
  else if (effectiveField === 'track') param = 'namesearch=' + encodeURIComponent(q);
  else if (effectiveField === 'genre') param = 'tags=' + encodeURIComponent(q);
  else param = 'search=' + encodeURIComponent(q); // 'auto', non-genre: broad match across track+artist+album+tags
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
