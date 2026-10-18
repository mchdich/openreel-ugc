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
  if(env.OPENREEL_POST_METADATA==='true')return ingestPublicPost(url);
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

/** Parse public page hydration as data; never execute scripts or fetch media. */
export function parsePublicPostHtml(html,value,fetchedAt=new Date().toISOString()){
  const url=canonicalTikTokUrl(value);
  const invalid=()=>fail('TikTok did not return matching public post metadata. No dates or counts were inferred.',502,'INVALID_PUBLIC_POST');
  if(typeof html!=='string'||new TextEncoder().encode(html).byteLength>1024*1024||!Number.isFinite(Date.parse(fetchedAt)))throw invalid();
  const scripts=[...html.matchAll(/<script\b(?=[^>]*\bid\s*=\s*["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'])[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  if(scripts.length!==1)throw invalid();
  let hydration;try{hydration=JSON.parse(scripts[0][1]);}catch{throw invalid();}
  const detail=object(object(object(hydration).__DEFAULT_SCOPE__)['webapp.video-detail']);
  const item=object(object(detail.itemInfo).itemStruct),author=object(item.author);
  const id=url.match(/\/video\/(\d+)$/)[1];
  if(detail.statusCode!==0||item.id!==id||item.privateItem!==false||author.privateAccount!==false||
    ['secret','forFriend','isProhibited'].some(field=>item[field]!==undefined&&item[field]!==false)||
    item.takeDown!==undefined&&item.takeDown!==0||typeof author.uniqueId!=='string'||!HANDLE.test(author.uniqueId)||typeof author.id!=='string'||!/^\d{1,30}$/.test(author.id))throw invalid();
  const record=emptyRecord(`https://www.tiktok.com/@${author.uniqueId}/video/${id}`,'tiktok-public-post',fetchedAt);
  record.creatorId=author.id;record.caption=text(item.desc,10000);
  record.bio=text(author.signature,4000);record.thumbnail=publicHttpsUrl(object(item.video).cover);record.avatar=publicHttpsUrl(author.avatarThumb);
  record.email=record.bio.match(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+\b/i)?.[0]?.slice(0,254)||'';
  const identity=bioIdentity(record.bio);record.profileEvidence={url:record.authorUrl,fetchedAt};
  for(const field of ['school','location'])if(identity[field]){record[field]=identity[field].value;record.profileEvidence[field]=identity[field];}
  const rawTime=item.createTime;
  const seconds=typeof rawTime==='number'?rawTime:typeof rawTime==='string'&&/^\d{1,12}$/.test(rawTime)?Number(rawTime):NaN;
  if(Number.isSafeInteger(seconds)&&seconds>=946684800&&seconds*1000<=Date.parse(fetchedAt)+300000)record.postedAt=new Date(seconds*1000).toISOString();
  if(record.postedAt)record.postingEvidence={sourceType:'tiktok-public-post',url:record.url,observedAt:fetchedAt,postedAt:record.postedAt};
  const stats=object(item.stats),authorStats=object(item.authorStats);
  const sourceMetrics={followers:authorStats.followerCount,views:stats.playCount,likes:stats.diggCount,comments:stats.commentCount,shares:stats.shareCount};
  for(const field of METRICS){const number=sourceMetrics[field];if(typeof number==='number'&&Number.isSafeInteger(number)&&number>=0){record[field]=number;record.unavailableMetrics=record.unavailableMetrics.filter(name=>name!==field);}}
  return record;
}

/** One fixed-host canonical page GET, bounded by the existing HTML reader. */
export async function ingestPublicPost(value,{signal}={}){
  const url=canonicalTikTokUrl(value);
  let html;
  try{html=await creatorHtml(url,signal);}catch(error){throw fail('Public TikTok post metadata is unavailable. No automatic retry or oEmbed fallback was made.',error.status===504?504:error.status===404?404:502,'PUBLIC_POST_UNAVAILABLE');}
  return parsePublicPostHtml(html,url);
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

async function creatorHtml(url,signal) {
  try {
    const response = await fetch(url, { method: 'GET', headers: { accept: 'text/html' }, redirect: 'error', signal: signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw fail('The public TikTok creator embed is unavailable. Confirm the handle is public and try again later.', response.status === 404 ? 404 : 502, 'CREATOR_UNAVAILABLE');
    }
    const maxBytes = 1024 * 1024;
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw fail('The public creator embed exceeds the supported response size.', 502, 'PROVIDER_RESPONSE_TOO_LARGE');
    }
    if (!/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || !response.body) {
      await response.body?.cancel();
      throw fail('TikTok did not return a supported public creator embed.', 502, 'INVALID_PROVIDER_RESPONSE');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw fail('The public creator embed exceeds the supported response size.', 502, 'PROVIDER_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof SocialError) throw error;
    if (['TimeoutError', 'AbortError'].includes(error?.name)) throw fail('The public TikTok creator embed timed out. Try again later.', 504, 'PROVIDER_TIMEOUT');
    throw fail('The public TikTok creator embed could not be reached. Try again later.', 502, 'CREATOR_UNAVAILABLE');
  }
}

function bioIdentity(bio) {
  const schools = new Map();
  const locations = new Map();
  const cityNames = { nyc: 'New York City', 'new york city': 'New York City', 'los angeles': 'Los Angeles', boston: 'Boston', chicago: 'Chicago', miami: 'Miami', 'san francisco': 'San Francisco', austin: 'Austin', seattle: 'Seattle' };
  for (const raw of bio.split(/[\n|•;]+/)) {
    const evidence = raw.trim();
    const segment = evidence.replace(/[^\p{L}\p{N}\s'’,.-]/gu, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
    const school = segment.match(/^(?:(?:student|studying) at )?(nyu|new york university|ucla|university of california,? los angeles)(?:\s+(?:student|alumna|alumnus|alumni|graduate)|\s*(?:class of )?['’]?(?:20)?\d{2})?$/);
    if (school) {
      const value = ['nyu', 'new york university'].includes(school[1]) ? 'New York University' : 'University of California, Los Angeles';
      schools.set(value, { value, source: 'public-bio-self-description', text: evidence });
    }
    const city = segment.match(/^(?:(?:based|living) in )?(nyc|new york city|los angeles|boston|chicago|miami|san francisco|austin|seattle)$/);
    if (city) {
      const value = cityNames[city[1]];
      locations.set(value, { value, source: 'public-bio-self-description', text: evidence });
    }
  }
  return { school: schools.size === 1 ? [...schools.values()][0] : null, location: locations.size === 1 ? [...locations.values()][0] : null };
}

/** Acquire the public videos selected by a known creator's official no-key embed. */
export async function discoverCreator(value, env = {}) {
  if (typeof value !== 'string' || value.length > 100) throw fail('Use a TikTok creator handle, such as @creator. Profile URLs and short links are not supported here.', 400, 'INVALID_CREATOR_HANDLE');
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  if (!HANDLE.test(handle)) throw fail('Use a TikTok creator handle, such as @creator. Profile URLs and short links are not supported here.', 400, 'INVALID_CREATOR_HANDLE');
  const embedUrl = `https://www.tiktok.com/embed/@${handle}`;
  const body = await creatorHtml(embedUrl);
  const match = body.match(/<script\b(?=[^>]*\bid\s*=\s*["']__FRONTITY_CONNECT_STATE__["'])[^>]*>([\s\S]*?)<\/script\s*>/i);
  if (!match) throw fail('TikTok did not return public creator data. The profile may be unavailable or its embed format may have changed.', 502, 'INVALID_PROVIDER_RESPONSE');
  let hydration;
  try { hydration = JSON.parse(match[1]); }
  catch { throw fail('TikTok returned invalid creator embed data. Try again later.', 502, 'INVALID_PROVIDER_RESPONSE'); }
  const fetchedAt = new Date().toISOString();
  const result = { records: [], creator: null, provider: 'tiktok-creator-embed', fetchedAt };
  const node = object(object(object(hydration).source).data)[`/embed/@${handle}`];
  const info = object(object(node).userInfo);
  // HTTP 200 also covers unavailable/private profiles and shells. Never turn them into records.
  if (!node || node.isReady !== true || node.isError === true || info.code !== 200 ||
    (info.customErrorCode !== undefined && info.customErrorCode !== 0) || info.privateAccount !== false ||
    typeof info.uniqueId !== 'string' || info.uniqueId.toLowerCase() !== handle || !Array.isArray(node.videoList)) {
    return { ...result, notice: 'This public creator profile is unavailable or not ready. No videos were added.' };
  }
  const authorUrl = `https://www.tiktok.com/@${handle}`;
  const knownCount = number => typeof number === 'number' && Number.isSafeInteger(number) && number >= 0 ? number : null;
  const bio = text(info.signature, 4000);
  const identity = bioIdentity(bio);
  const email = bio.match(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+\b/i)?.[0]?.slice(0, 254) || '';
  const followers = knownCount(info.followerCount);
  result.creator = {
    id: text(info.id, 80), handle: `@${handle}`, nickname: text(info.nickname, 200),
    verified: typeof info.verified === 'boolean' ? info.verified : null,
    bio, email, school: identity.school?.value || '', location: identity.location?.value || '', avatarUrl: publicHttpsUrl(info.avatarThumbUrl), followers,
    following: knownCount(info.followingCount), totalLikes: knownCount(info.heartCount),
    authorUrl, sourceType: 'tiktok-creator-embed', fetchedAt
  };
  const seen = new Set();
  for (const input of node.videoList.slice(0, 1000)) {
    const item = object(input);
    if (typeof item.id !== 'string' || !/^\d{1,30}$/.test(item.id) || seen.has(item.id) || item.privateItem !== false ||
      typeof item.authorUniqueId !== 'string' || item.authorUniqueId.toLowerCase() !== handle) continue;
    const record = emptyRecord(`https://www.tiktok.com/@${handle}/video/${item.id}`, 'tiktok-creator-embed', fetchedAt);
    record.caption = text(item.desc, 10000);
    record.thumbnail = publicHttpsUrl(item.coverUrl) || publicHttpsUrl(item.originCoverUrl);
    record.avatar = result.creator.avatarUrl;
    record.bio = bio;
    if(/^\d{1,30}$/.test(String(info.id)))record.creatorId=String(info.id);
    record.email = email;
    record.profileEvidence = { url: authorUrl, fetchedAt };
    for (const field of ['school', 'location']) if (identity[field]) {
      record[field] = identity[field].value;
      record.profileEvidence[field] = identity[field];
    }
    const views = knownCount(item.playCount);
    if (followers !== null) { record.followers = followers; record.unavailableMetrics = record.unavailableMetrics.filter(field => field !== 'followers'); }
    if (views !== null) { record.views = views; record.unavailableMetrics = record.unavailableMetrics.filter(field => field !== 'views'); }
    result.records.push(record);
    seen.add(item.id);
    if (result.records.length >= 20) break;
  }
  return result;
}
