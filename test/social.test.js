import test from 'node:test';
import assert from 'node:assert/strict';

// A missing adapter should fail as a missing feature, before any network call.
const social = await import('../lib/social.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const { canonicalTikTokUrl, ingestTikTok, mapApifyRecords, discoverVideos } = social;
const videoUrl = 'https://www.tiktok.com/@scout2015/video/6718335390845095173';
const metrics = ['followers', 'views', 'likes', 'comments', 'shares'];
const oembed = {
  version: '1.0', type: 'video', title: 'A real video caption #pets',
  author_url: 'https://www.tiktok.com/@scout2015', author_name: 'Scout, Suki & Stella',
  width: '100%', height: '100%', html: '<script>doNotExecute()</script>',
  thumbnail_width: 576, thumbnail_height: 1024,
  thumbnail_url: 'https://p16-common-sign.tiktokcdn-us.com/public-cover.jpg?x-expires=1792440000',
  provider_url: 'https://www.tiktok.com', provider_name: 'TikTok',
  author_unique_id: 'scout2015', embed_product_id: '6718335390845095173', embed_type: 'video'
};
const apifyRow = {
  id: '7543693751290481942', text: 'Beauty morning routine at NYU. fake@caption.example',
  textLanguage: 'en', createTime: 1756403075, createTimeISO: '2025-08-28T17:44:35.000Z',
  isAd: false,
  authorMeta: {
    id: '6733984297591636998', name: 'gretalynnhihi', profileUrl: 'https://www.tiktok.com/@gretalynnhihi',
    nickName: 'Greta Lynn', verified: false, signature: 'Beauty creator. Contact collabs@public.example',
    bioLink: null, avatar: 'https://p16-sign-va.tiktokcdn.com/avatar.jpeg',
    privateAccount: false, following: 269, friends: 0, fans: 51200, heart: 3000000, video: 259, digg: 194800
  },
  musicMeta: { musicName: 'original sound', musicAuthor: 'Artist', musicOriginal: true, musicId: '7529403355681147665' },
  webVideoUrl: 'https://www.tiktok.com/@gretalynnhihi/video/7543693751290481942', mediaUrls: [],
  videoMeta: { height: 1024, width: 576, duration: 15, coverUrl: 'https://p16-sign.tiktokcdn.com/cover.jpg', definition: '540p', format: 'mp4', subtitleLinks: [] },
  diggCount: 23400, shareCount: 145, playCount: 145900, collectCount: 1637, commentCount: 46,
  mentions: [], detailedMentions: [], hashtags: [{ id: '4982299', name: 'beauty', title: '', cover: '' }],
  isSlideshow: false, isPinned: false, searchQuery: 'beauty'
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const withFetch = async (implementation, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try { return await fn(); } finally { globalThis.fetch = original; }
};

test('social ingestion exposes the required real adapter functions', () => {
  for (const name of ['canonicalTikTokUrl', 'ingestTikTok', 'mapApifyRecords', 'discoverVideos']) assert.equal(typeof social[name], 'function', `${name} is implemented`);
});

test('canonical URLs accept only direct HTTPS TikTok video hosts and discard tracking', () => {
  assert.equal(canonicalTikTokUrl('https://tiktok.com/@scout2015/video/6718335390845095173?lang=en#details'), videoUrl);
  for (const value of [
    'http://www.tiktok.com/@scout2015/video/6718335390845095173',
    'https://www.tiktok.com.evil.example/@scout2015/video/6718335390845095173',
    'https://evil@www.tiktok.com/@scout2015/video/6718335390845095173',
    'https://www.tiktok.com:8443/@scout2015/video/6718335390845095173',
    'https://vm.tiktok.com/abcd/', 'https://127.0.0.1/@x/video/12',
    'https://www.tiktok.com/@x/video/not-numeric', 'https://www.tiktok.com/@x/video/12/extra',
    'https://www.tiktok.com/@x', 'javascript:alert(1)', null, { url: videoUrl }
  ]) assert.throws(() => canonicalTikTokUrl(value), error => error.status === 400 && error.code === 'INVALID_TIKTOK_URL');
});

test('real oEmbed transport is fixed, bounded and never requests the supplied video or executes HTML', async () => {
  await withFetch(async (url, init) => {
    const target = new URL(url);
    assert.equal(target.origin + target.pathname, 'https://www.tiktok.com/oembed');
    assert.equal(target.searchParams.get('url'), videoUrl);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    return json(oembed);
  }, async () => {
    const record = await ingestTikTok(videoUrl);
    assert.equal(record.id, 'tiktok-6718335390845095173');
    assert.equal(record.handle, '@scout2015');
    assert.equal(record.caption, 'A real video caption #pets');
    assert.equal(record.hook, '');
    assert.equal(record.url, videoUrl);
    assert.equal(record.thumbnail, oembed.thumbnail_url);
    assert.equal(record.authorUrl, 'https://www.tiktok.com/@scout2015');
    assert.equal(record.sourceType, 'tiktok-oembed');
    assert.equal(record.postedAt, '');
    assert.ok(Number.isFinite(Date.parse(record.fetchedAt)));
    assert.deepEqual(record.unavailableMetrics, metrics);
    assert.equal(record.demo, false);
    assert.doesNotMatch(JSON.stringify(record), /doNotExecute|<script>|"html"/);
  });
});

test('oEmbed preserves unknowns and discards unsafe optional links or unavailable extra fields', async () => {
  await withFetch(async () => json({ type: 'video', title: 'Caption\u0000', thumbnail_url: 'javascript:bad()', author_url: 'https://attacker.example/@x', html: 'unsafe' }), async () => {
    const record = await ingestTikTok(videoUrl);
    assert.equal(record.handle, '@scout2015');
    assert.equal(record.authorUrl, 'https://www.tiktok.com/@scout2015');
    assert.equal(record.thumbnail, '');
    assert.equal(record.caption, 'Caption');
    assert.deepEqual(record.unavailableMetrics, metrics);
  });
});

test('oEmbed uses verified author identity when a pasted URL contains an outdated creator handle', async () => {
  await withFetch(async () => json(oembed), async () => {
    const record = await ingestTikTok('https://www.tiktok.com/@oldhandle/video/6718335390845095173');
    assert.equal(record.handle, '@scout2015');
    assert.equal(record.authorUrl, 'https://www.tiktok.com/@scout2015');
    assert.equal(record.url, videoUrl);
  });
  await withFetch(async () => json({ ...oembed, embed_product_id: '999' }), () => assert.rejects(ingestTikTok(videoUrl), error => error.code === 'INVALID_PROVIDER_RESPONSE'));
});

test('oEmbed rejects oversized declared or streamed JSON and invalid video responses', async () => {
  for (const response of [
    new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '262145' } }),
    json({ ...oembed, title: 'x'.repeat(262145) }),
    json({ type: 'link', title: 'Not a video' }),
    new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } })
  ]) await withFetch(async () => response, () => assert.rejects(ingestTikTok(videoUrl), error => error.status === 502 && ['PROVIDER_RESPONSE_TOO_LARGE', 'INVALID_PROVIDER_RESPONSE'].includes(error.code)));
});

test('oEmbed provider failures are safe and invalid input performs no fetch', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return new Response('secret upstream stack', { status: 403 }); }, async () => {
    await assert.rejects(ingestTikTok('https://private.example/video/1'), error => error.status === 400);
    assert.equal(calls, 0);
    await assert.rejects(ingestTikTok(videoUrl), error => error.status === 502 && !/secret|stack/.test(error.message));
    assert.equal(calls, 1);
  });
});

test('Apify records map actual provider metrics, profile evidence and public bio contacts', () => {
  const [record] = mapApifyRecords([apifyRow]);
  assert.equal(record.id, 'tiktok-7543693751290481942');
  assert.equal(record.handle, '@gretalynnhihi');
  assert.equal(record.caption, apifyRow.text);
  assert.equal(record.followers, 51200);
  assert.equal(record.views, 145900);
  assert.equal(record.likes, 23400);
  assert.equal(record.comments, 46);
  assert.equal(record.shares, 145);
  assert.equal(record.email, 'collabs@public.example');
  assert.equal(record.bio, apifyRow.authorMeta.signature);
  assert.equal(record.school, '');
  assert.equal(record.location, '');
  assert.equal(record.transcript, '');
  assert.equal(record.hook, '');
  assert.equal(record.authorUrl, apifyRow.authorMeta.profileUrl);
  assert.deepEqual(record.unavailableMetrics, []);
  assert.equal(record.sourceType, 'apify');
  assert.equal(record.demo, false);
});

test('Apify mapping preserves unknown metrics, genuine zeroes and explicit provider profile fields', () => {
  const row = structuredClone(apifyRow);
  delete row.authorMeta.fans;
  row.authorMeta.school = 'New York University';
  row.authorMeta.location = 'New York';
  row.authorMeta.signature = 'Public bio without email';
  row.playCount = 0;
  row.diggCount = null;
  row.commentCount = -1;
  row.shareCount = '999999999999999999999';
  const [record] = mapApifyRecords([row]);
  assert.equal(record.views, 0);
  assert.deepEqual(record.unavailableMetrics, ['followers', 'likes', 'comments', 'shares']);
  assert.equal(record.email, '');
  assert.equal(record.school, 'New York University');
  assert.equal(record.location, 'New York');
});

test('Apify mapping rejects error rows, mismatched IDs, unsafe sources and caps/deduplicates records', () => {
  const unknown = { ...apifyRow, error: 'Profile not found', errorCode: 'NOT_FOUND' };
  const unsafe = { ...apifyRow, webVideoUrl: 'https://private.example/video/1' };
  const mismatch = { ...apifyRow, id: '111' };
  assert.deepEqual(mapApifyRecords([null, {}, unknown, unsafe, mismatch]), []);
  assert.equal(mapApifyRecords([apifyRow, apifyRow]).length, 1);
  const many = Array.from({ length: 40 }, (_, index) => ({ ...apifyRow, id: String(1000 + index), webVideoUrl: `https://www.tiktok.com/@gretalynnhihi/video/${1000 + index}` }));
  assert.equal(mapApifyRecords(many).length, 30);
});

test('unconfigured discovery is actionable and never calls a paid API', async () => {
  await withFetch(async () => { assert.fail('No token must never create a paid run'); }, async () => {
    await assert.rejects(discoverVideos('beauty', {}, {}), error => error.status === 503 && error.code === 'LIVE_PROVIDER_NOT_CONFIGURED' && /APIFY_API_TOKEN/.test(error.message));
  });
});

test('Apify discovery bounds query/results/cost and authenticates only the fixed provider', async () => {
  await withFetch(async (url, init) => {
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.apify.com');
    assert.equal(target.pathname, '/v2/actors/clockworks~tiktok-scraper/run-sync-get-dataset-items');
    assert.equal(target.searchParams.get('timeout'), '40');
    assert.equal(target.searchParams.get('maxItems'), '30');
    assert.equal(target.searchParams.get('maxTotalChargeUsd'), '0.25');
    assert.equal(init.headers.authorization, 'Bearer secret-provider-token');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    const input = JSON.parse(init.body);
    assert.deepEqual(input.searchQueries, ['beauty creators']);
    assert.equal(input.resultsPerPage, 30);
    assert.equal(input.searchSection, '/video');
    assert.equal(input.shouldDownloadVideos, false);
    assert.equal(input.downloadSubtitlesOptions, 'NEVER_DOWNLOAD_SUBTITLES');
    assert.equal(input.aiVideoSummary, false);
    return json([apifyRow]);
  }, async () => {
    const result = await discoverVideos('  beauty creators  ', { limit: 500 }, { APIFY_API_TOKEN: 'secret-provider-token' });
    assert.equal(result.records[0].views, 145900);
    assert.equal(result.provider, 'apify');
    assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
    assert.doesNotMatch(JSON.stringify(result), /secret-provider-token/);
  });
});

test('discovery validates actor/query/options before requesting and supports a configured actor identifier', async () => {
  await withFetch(async (url, init) => {
    assert.equal(new URL(url).pathname, '/v2/actors/owner~custom-actor/run-sync-get-dataset-items');
    assert.equal(JSON.parse(init.body).resultsPerPage, 2);
    return json([]);
  }, async () => {
    const result = await discoverVideos('pets', { limit: 2 }, { APIFY_API_TOKEN: 'secret', APIFY_ACTOR_ID: 'owner/custom-actor' });
    assert.deepEqual(result.records, []);
  });
  await withFetch(async () => assert.fail('Invalid requests must not create runs'), async () => {
    for (const query of ['', ' ', 'x'.repeat(1001), {}, null]) await assert.rejects(discoverVideos(query, {}, { APIFY_API_TOKEN: 'secret' }), error => error.status === 400);
    for (const limit of [0, -1, 1.5, '5', NaN]) await assert.rejects(discoverVideos('pets', { limit }, { APIFY_API_TOKEN: 'secret' }), error => error.status === 400);
    await assert.rejects(discoverVideos('pets', {}, { APIFY_API_TOKEN: 'secret', APIFY_ACTOR_ID: 'https://attacker.example/secret' }), error => error.status === 503);
  });
});

test('discovery bounds streamed response and never retries failing billable POSTs or echoes secrets', async () => {
  for (const fixture of [
    () => new Response('secret-provider-token upstream stack', { status: 401 }),
    () => new Response('secret-provider-token upstream stack', { status: 408 }),
    () => json({ data: { status: 'RUNNING' } }),
    () => json([{ ...apifyRow, text: 'x'.repeat(262145) }]),
    () => { throw new Error('secret-provider-token upstream stack'); }
  ]) {
    let calls = 0;
    await withFetch(async () => { calls++; return fixture(); }, async () => {
      await assert.rejects(discoverVideos('beauty', {}, { APIFY_API_TOKEN: 'secret-provider-token' }), error => error.status >= 400 && !/secret-provider-token|stack/.test(error.message));
      assert.equal(calls, 1);
    });
  }
});
