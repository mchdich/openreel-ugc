/** Real social metadata adapters. No provider HTML or downloaded media enters the app. */
const MAX_JSON_BYTES = 256 * 1024;
const MAX_RESULTS = 30;
const METRICS = ['followers', 'views', 'likes', 'comments', 'shares'];
const HANDLE = /^[a-z0-9_][a-z0-9_.]{0,79}$/i;

class SocialError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'SocialError';
    this.status = status;
    this.code = code;
  }
}
const fail = (message, status, code) => new SocialError(message, status, code);
const text = (value, limit = 2000) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, limit) : '';
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Only canonical direct public TikTok video URLs; no short-link or arbitrary URL fetch. */
export function canonicalTikTokUrl(value) {
  const invalid = () => fail('Use a direct HTTPS TikTok video URL, such as https://www.tiktok.com/@creator/video/123. Short links are not supported.', 400, 'INVALID_TIKTOK_URL');
  if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u0020\u007f\\]/.test(value.trim())) throw invalid();
  let url;
  try { url = new URL(value.trim()); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || !['tiktok.com', 'www.tiktok.com'].includes(url.hostname) || url.port || url.username || url.password) throw invalid();
  const match = url.pathname.match(/^\/@([a-z0-9_][a-z0-9_.]{0,79})\/video\/(\d{1,30})\/?$/i);
  if (!match) throw invalid();
  return `https://www.tiktok.com/@${match[1]}/video/${match[2]}`;
}

function publicHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}

async function boundedJson(response) {
  if (Number(response.headers.get('content-length')) > MAX_JSON_BYTES) {
    await response.body?.cancel();
    throw fail('The data provider returned too much data. Try a smaller request.', 502, 'PROVIDER_RESPONSE_TOO_LARGE');
  }
  if (!/\bapplication\/(?:[a-z0-9.+-]*\+)?json\b/i.test(response.headers.get('content-type') || '') || !response.body) {
    await response.body?.cancel();
    throw fail('The data provider returned an unsupported response. Try again later.', 502, 'INVALID_PROVIDER_RESPONSE');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel();
      throw fail('The data provider returned too much data. Try a smaller request.', 502, 'PROVIDER_RESPONSE_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw fail('The data provider returned invalid JSON. Try again later.', 502, 'INVALID_PROVIDER_RESPONSE'); }
}

async function providerJson(url, init, provider, timeoutMs) {
  try {
    const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      await response.body?.cancel();
      if (provider === 'apify') {
        if ([401, 403].includes(response.status)) throw fail('Live discovery authentication failed. Check the server APIFY_API_TOKEN and Actor access.', 503, 'LIVE_PROVIDER_AUTH_FAILED');
        if (response.status === 402) throw fail('Live discovery could not run within the provider budget. Check Apify account credits and the configured Actor.', 503, 'LIVE_PROVIDER_BUDGET');
        if ([408, 504].includes(response.status)) throw fail('Live discovery timed out. Check the Apify run before trying again; the run may have incurred a charge.', 504, 'LIVE_PROVIDER_TIMEOUT');
        if (response.status === 429) throw fail('Live discovery is rate limited. Wait before starting another request.', 503, 'LIVE_PROVIDER_RATE_LIMITED');
      } else if (response.status === 404) throw fail('This TikTok video could not be found. Confirm it is public and the direct URL is correct.', 404, 'VIDEO_NOT_FOUND');
      throw fail(provider === 'apify' ? 'Live discovery is unavailable. Check the Apify Actor and try again later.' : 'TikTok metadata is unavailable. Confirm the video is public and try again later.', 502, 'PROVIDER_UNAVAILABLE');
    }
    return await boundedJson(response);
  } catch (error) {
    if (error instanceof SocialError) throw error;
    if (['TimeoutError', 'AbortError'].includes(error?.name)) throw fail(provider === 'apify' ? 'Live discovery timed out. Check the Apify run before trying again; the run may have incurred a charge.' : 'TikTok metadata timed out. Try again later.', 504, 'PROVIDER_TIMEOUT');
    throw fail(provider === 'apify' ? 'Live discovery could not reach Apify. Check provider availability before trying again; do not automatically repeat a paid request.' : 'TikTok metadata could not be reached. Try again later.', 502, 'PROVIDER_UNAVAILABLE');
  }
}

function emptyRecord(url, sourceType, fetchedAt) {
  const match = url.match(/\/@([^/]+)\/video\/(\d+)$/);
  return {
    id: `tiktok-${match[2]}`, handle: `@${match[1]}`, caption: '', transcript: '', hook: '', format: '', niche: '',
    location: '', school: '', bio: '', postedAt: '', url, thumbnail: '', email: '',
    followers: 0, views: 0, likes: 0, comments: 0, shares: 0,
    unavailableMetrics: [...METRICS], authorUrl: `https://www.tiktok.com/@${match[1]}`,
    sourceType, fetchedAt, fetchedAtISO: fetchedAt, demo: false
  };
}

/** Fetch official unauthenticated oEmbed metadata. Caption text is not a transcript. */
export async function ingestTikTok(value, env = {}) {
  const url = canonicalTikTokUrl(value);
  const target = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const data = await providerJson(target, { method: 'GET', headers: { accept: 'application/json' } }, 'tiktok', 10000);
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.type !== 'video' || typeof data.title !== 'string') throw fail('TikTok did not return valid video metadata. Confirm the video is public.', 502, 'INVALID_PROVIDER_RESPONSE');
  const id = url.match(/\/video\/(\d+)$/)[1];
  if (data.embed_product_id !== undefined && String(data.embed_product_id) !== id) throw fail('TikTok returned metadata for a different video. Check the supplied URL.', 502, 'INVALID_PROVIDER_RESPONSE');
  let authorHandle = '';
  try {
    const authorUrl = new URL(data.author_url);
    if (authorUrl.protocol === 'https:' && ['tiktok.com', 'www.tiktok.com'].includes(authorUrl.hostname) && !authorUrl.username && !authorUrl.password && !authorUrl.port) authorHandle = authorUrl.pathname.match(/^\/@([a-z0-9_][a-z0-9_.]{0,79})\/?$/i)?.[1] || '';
  } catch { /* Optional author metadata may be absent; the validated input remains usable. */ }
  if (!authorHandle && typeof data.author_unique_id === 'string' && HANDLE.test(data.author_unique_id)) authorHandle = data.author_unique_id;
  const record = emptyRecord(authorHandle ? `https://www.tiktok.com/@${authorHandle}/video/${id}` : url, 'tiktok-oembed', new Date().toISOString());
  record.caption = text(data.title, 10000);
  record.thumbnail = publicHttpsUrl(data.thumbnail_url);
  return record;
}

/** Convert actual Clockworks output; unknown metrics stay marked unavailable. */
export function mapApifyRecords(rows) {
  if (!Array.isArray(rows)) throw fail('Live discovery returned an invalid dataset. Check the configured Actor output.', 502, 'INVALID_PROVIDER_RESPONSE');
  const fetchedAt = new Date().toISOString();
  const records = [];
  const seen = new Set();
  // Bound work as well as output, even when called without the bounded transport.
  for (const input of rows.slice(0, 1000)) {
    const row = object(input);
    if (row.error || row.errorCode || typeof row.id !== 'string' || !/^\d{1,30}$/.test(row.id)) continue;
    let url;
    try { url = canonicalTikTokUrl(row.webVideoUrl); } catch { continue; }
    if (!url.endsWith(`/video/${row.id}`) || seen.has(row.id)) continue;
    const author = object(row.authorMeta);
    const creatorHandle = url.match(/\/@([^/]+)\/video\//)[1];
    if (typeof author.name !== 'string' || !HANDLE.test(author.name) || creatorHandle.toLowerCase() !== author.name.toLowerCase() || author.privateAccount === true) continue;
    const record = emptyRecord(url, 'apify', fetchedAt);
    record.caption = text(row.text, 10000);
    record.bio = text(author.signature, 4000);
    record.school = text(author.school);
    record.location = text(author.location);
    record.thumbnail = publicHttpsUrl(object(row.videoMeta).coverUrl);
    const date = text(row.createTimeISO, 50);
    record.postedAt = date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : '';
    record.email = record.bio.match(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+\b/i)?.[0]?.slice(0, 254) || '';
    const sourceMetrics = { followers: author.fans, views: row.playCount, likes: row.diggCount, comments: row.commentCount, shares: row.shareCount };
    record.unavailableMetrics = [];
    for (const field of METRICS) {
      const value = sourceMetrics[field];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) record[field] = value;
      else record.unavailableMetrics.push(field);
    }
    seen.add(row.id);
    records.push(record);
    if (records.length >= MAX_RESULTS) break;
  }
  return records;
}

/** One bounded billable Actor request; never retry automatically or expose its token. */
export async function discoverVideos(query, options = {}, env = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 1000) throw fail('Live discovery needs a search query of 1–1000 characters.', 400, 'INVALID_DISCOVERY_QUERY');
  if (!options || typeof options !== 'object' || Array.isArray(options) || (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1))) throw fail('Live discovery limit must be a positive whole number, up to 30.', 400, 'INVALID_DISCOVERY_OPTIONS');
  const limit = Math.min(options.limit ?? 20, MAX_RESULTS);
  const token = typeof env.APIFY_API_TOKEN === 'string' ? env.APIFY_API_TOKEN.trim() : '';
  if (!token) throw fail('Live discovery is not configured. Add APIFY_API_TOKEN to the server environment, or use your library.', 503, 'LIVE_PROVIDER_NOT_CONFIGURED');
  const actorInput = env.APIFY_ACTOR_ID || 'clockworks~tiktok-scraper';
  if (typeof actorInput !== 'string' || !/^[a-z0-9_-]{1,80}(?:[~/][a-z0-9_-]{1,80})?$/i.test(actorInput)) throw fail('The live provider Actor configuration is invalid. Set APIFY_ACTOR_ID to an Actor ID or owner~name.', 503, 'INVALID_PROVIDER_CONFIGURATION');
  const actor = actorInput.replace('/', '~');
  const target = `https://api.apify.com/v2/actors/${encodeURIComponent(actor)}/run-sync-get-dataset-items?maxItems=30&timeout=40&maxTotalChargeUsd=0.25&format=json&clean=true&limit=${limit}`;
  const rows = await providerJson(target, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      searchQueries: [query.trim()], searchSection: '/video', resultsPerPage: limit,
      scrapeAdditionalAuthorMeta: true, scrapeRelatedVideos: false,
      shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadAvatars: false,
      shouldDownloadMusicCovers: false, shouldDownloadSlideshowImages: false,
      downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES', aiVideoDescription: false, aiVideoSummary: false
    })
  }, 'apify', 45000);
  const records = mapApifyRecords(rows).slice(0, limit);
  return { records, provider: 'apify', fetchedAt: new Date().toISOString() };
}
