/* KikoMix — deployment config. Loaded first, before every other script.
 *
 * Set KM_SEARCH_PROXY_URL to your deployed backend/search-proxy Worker URL
 * (see backend/search-proxy/README.md) to turn on real Deezer + Jamendo
 * search results alongside the existing mock catalog. Leave it null and
 * KikoMix behaves exactly as the all-mock MVP does today — the new
 * adapters make zero network calls when this is unset.
 */
if (typeof window.KM_SEARCH_PROXY_URL === 'undefined') window.KM_SEARCH_PROXY_URL = null;
