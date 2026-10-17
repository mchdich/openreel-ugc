import test from 'node:test';
import assert from 'node:assert/strict';
const { discoverCreator } = await import('../lib/social.js');

const profileUrl = 'https://www.tiktok.com/@scout2015';
const fixture = () => ({
  service: {}, theme: {}, ttep: {}, router: {}, user: {},
  source: { data: {
    '/embed/@scout2015': {
      isFetching: false, isReady: true, route: '/embed/@:uniqueId', link: '/embed/@scout2015', query: {}, page: 1,
      userInfo: { id: '6741174161235231749', uniqueId: 'scout2015', verified: true,
        followingCount: 1173, followerCount: 9000000, heartCount: 108300000,
        signature: 'Public pet creator. Contact public@creator.example', privateAccount: false,
        nickname: 'Scout, Suki & Stella', avatarThumbUrl: 'https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg', code: 200, customErrorCode: 0 },
      videoList: [
        { id: '7697620220420066590', desc: 'A video caption mentioning NYU and Boston', height: 1280, width: 720, ratio: '720p',
          coverUrl: 'https://p16-common-sign.tiktokcdn-us.com/cover.jpeg', originCoverUrl: 'https://p16-common-sign.tiktokcdn-us.com/original.jpeg',
          dynamicCoverUrl: 'https://p16-common-sign.tiktokcdn-us.com/animated.webp', playAddr: 'https://private-media.example/never-fetch.mp4',
          playCount: 3605, privateItem: false, authorUniqueId: 'scout2015' },
        { id: '7697074394463554847', desc: 'Another real public video caption', height: 1280, width: 720, ratio: '720p',
          coverUrl: 'https://p16-common-sign.tiktokcdn-us.com/cover-two.jpeg', originCoverUrl: '', dynamicCoverUrl: '', playAddr: '',
          playCount: 0, privateItem: false, authorUniqueId: 'scout2015' }
      ], isError: false, pageName: 'creator-profile', playlistType: null, playlistId: null
    }
  } }, abtest: {}, feature: {}, frontity: {}
});
const state = value => value.source.data['/embed/@scout2015'];
const html = value => `<!doctype html><html><body><script>globalThis.doNotExecute = true</script><script type="application/json" id="__FRONTITY_CONNECT_STATE__">${JSON.stringify(value)}</script></body></html>`;
const response = value => new Response(html(value), { headers: { 'content-type': 'text/html; charset=utf-8' } });
const withFetch = async (implementation, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try { return await fn(); } finally { globalThis.fetch = original; }
};

test('free creator discovery exposes the profile embed adapter', () => {
  assert.equal(typeof discoverCreator, 'function');
});

test('creator acquisition requests one fixed no-key HTML endpoint and never fetches media', async () => {
  let calls = 0;
  await withFetch(async (url, init) => {
    calls++;
    assert.equal(url, 'https://www.tiktok.com/embed/@scout2015');
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.headers.authorization, undefined);
    return response(fixture());
  }, async () => {
    const result = await discoverCreator(' @Scout2015 ', { APIFY_API_TOKEN: 'paid-token-must-not-be-used' });
    assert.equal(calls, 1);
    assert.equal(result.provider, 'tiktok-creator-embed');
    assert.equal(result.records.length, 2);
    assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
    assert.equal(globalThis.doNotExecute, undefined);
    assert.doesNotMatch(JSON.stringify(result), /playAddr|never-fetch|paid-token-must-not-be-used/);
  });
});

test('creator records retain explicit public identity and counts without inferred school or location', async () => {
  await withFetch(async () => response(fixture()), async () => {
    const result = await discoverCreator('scout2015');
    const first = result.records[0];
    assert.equal(first.id, 'tiktok-7697620220420066590');
    assert.equal(first.url, 'https://www.tiktok.com/@scout2015/video/7697620220420066590');
    assert.equal(first.handle, '@scout2015');
    assert.equal(first.caption, 'A video caption mentioning NYU and Boston');
    assert.equal(first.bio, 'Public pet creator. Contact public@creator.example');
    assert.equal(first.email, 'public@creator.example');
    assert.equal(first.followers, 9000000);
    assert.equal(first.views, 3605);
    assert.equal(result.records[1].views, 0);
    assert.deepEqual(first.unavailableMetrics, ['likes', 'comments', 'shares']);
    assert.equal(first.sourceType, 'tiktok-creator-embed');
    assert.equal(first.authorUrl, profileUrl);
    assert.deepEqual(first.profileEvidence, { url: profileUrl, fetchedAt: result.fetchedAt });
    assert.equal(first.school, '');
    assert.equal(first.location, '');
    assert.equal(first.hook, '');
    assert.equal(first.transcript, '');
    assert.equal(first.postedAt, '');
    assert.equal(first.demo, false);
    assert.equal(result.creator.followers, 9000000);
    assert.equal(result.creator.following, 1173);
    assert.equal(result.creator.totalLikes, 108300000);
    assert.equal(result.creator.nickname, 'Scout, Suki & Stella');
    assert.equal(result.creator.verified, true);
  });
});

test('unknown creator metrics remain unavailable while actual zeroes remain known', async () => {
  const value = fixture();
  state(value).userInfo.followerCount = null;
  state(value).userInfo.followingCount = 0;
  state(value).userInfo.heartCount = -1;
  state(value).userInfo.signature = 'Public bio with no email';
  state(value).videoList[0].playCount = '3605';
  state(value).videoList[0].desc = 'Caption email fake@caption.example';
  await withFetch(async () => response(value), async () => {
    const result = await discoverCreator('scout2015');
    assert.deepEqual(result.records[0].unavailableMetrics, ['followers', 'views', 'likes', 'comments', 'shares']);
    assert.deepEqual(result.records[1].unavailableMetrics, ['followers', 'likes', 'comments', 'shares']);
    assert.equal(result.records[0].email, '');
    assert.equal(result.creator.followers, null);
    assert.equal(result.creator.following, 0);
    assert.equal(result.creator.totalLikes, null);
  });
});

test('standalone public bio school and city descriptions retain their exact evidence', async () => {
  const value = fixture();
  state(value).userInfo.signature = "NYU '27 | based in NYC | Beauty creator";
  await withFetch(async () => response(value), async () => {
    const { records, creator } = await discoverCreator('scout2015');
    assert.equal(records[0].school, 'New York University');
    assert.equal(records[0].location, 'New York City');
    assert.equal(creator.school, 'New York University');
    assert.deepEqual(records[0].profileEvidence.school, { value: 'New York University', source: 'public-bio-self-description', text: "NYU '27" });
    assert.deepEqual(records[0].profileEvidence.location, { value: 'New York City', source: 'public-bio-self-description', text: 'based in NYC' });
  });
});

test('ambiguous prose, negation and conflicting public bio schools do not become identity filters', async () => {
  for (const [bio, expectedSchool, expectedLocation] of [
    ['I reviewed NYU beauty trends while visiting Boston', '', ''],
    ['Not a NYU student | Not based in NYC', '', ''],
    ['NYU | UCLA | Boston', '', 'Boston'],
    ['UCLA student | Los Angeles', 'University of California, Los Angeles', 'Los Angeles'],
    ['New York University | Chicago | Miami', 'New York University', '']
  ]) {
    const value = fixture();
    state(value).userInfo.signature = bio;
    await withFetch(async () => response(value), async () => {
      const record = (await discoverCreator('scout2015')).records[0];
      assert.equal(record.school, expectedSchool, bio);
      assert.equal(record.location, expectedLocation, bio);
      if (!expectedSchool) assert.equal(record.profileEvidence.school, undefined);
      if (!expectedLocation) assert.equal(record.profileEvidence.location, undefined);
    });
  }
});

test('HTTP 200 private, deleted or wrong-identity profile states stay empty', async () => {
  const values = [];
  for (const mutate of [
    node => { node.userInfo.privateAccount = true; },
    node => { node.userInfo.code = 10202; node.isError = true; },
    node => { node.userInfo.customErrorCode = 404; },
    node => { node.userInfo.uniqueId = 'someone_else'; },
    node => { delete node.userInfo; },
    node => { delete node.videoList; },
    node => { node.isReady = false; }
  ]) { const value = fixture(); mutate(state(value)); values.push(value); }
  for (const value of values) await withFetch(async () => response(value), async () => {
    const result = await discoverCreator('scout2015');
    assert.deepEqual(result.records, []);
    assert.equal(result.creator, null);
    assert.match(result.notice, /unavailable|public|ready/i);
  });
});

test('creator discovery skips malformed/private/mismatched videos and deduplicates with a bounded result count', async () => {
  const value = fixture();
  const node = state(value), valid = node.videoList[0];
  node.videoList = [null, {}, { ...valid, id: 'bad' }, { ...valid, privateItem: true }, { ...valid, authorUniqueId: 'other_creator' }, valid, valid,
    ...Array.from({ length: 35 }, (_, index) => ({ ...valid, id: String(1000 + index) }))];
  await withFetch(async () => response(value), async () => {
    const result = await discoverCreator('scout2015');
    assert.equal(result.records.length, 20);
    assert.equal(new Set(result.records.map(record => record.id)).size, 20);
  });
});

test('invalid creator handles never become URL paths or outbound requests', async () => {
  await withFetch(async () => assert.fail('Invalid handles cannot fetch'), async () => {
    for (const handle of ['', '@', 'bad handle', 'a/b', 'a?x=y', 'https://www.tiktok.com/@x', '../admin', '@@x', 'x'.repeat(81), {}, null]) {
      await assert.rejects(discoverCreator(handle), error => error.status === 400 && error.code === 'INVALID_CREATOR_HANDLE');
    }
  });
});

test('creator HTML accepts real response sizes but enforces a one MiB declared and streamed cap', async () => {
  await withFetch(async () => new Response(`${' '.repeat(300000)}${html(fixture())}`, { headers: { 'content-type': 'text/html' } }), async () => {
    assert.equal((await discoverCreator('scout2015')).records.length, 2);
  });
  for (const makeResponse of [
    () => new Response(html(fixture()), { headers: { 'content-type': 'text/html', 'content-length': '1048577' } }),
    () => new Response(`${' '.repeat(1048577)}${html(fixture())}`, { headers: { 'content-type': 'text/html' } })
  ]) await withFetch(async () => makeResponse(), () => assert.rejects(discoverCreator('scout2015'), error => error.status === 502 && error.code === 'PROVIDER_RESPONSE_TOO_LARGE'));
});

test('missing or malformed creator hydration and non-HTML content produce controlled errors', async () => {
  for (const makeResponse of [
    () => new Response('<html>Log in</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('<script id="__FRONTITY_CONNECT_STATE__">not json</script>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } })
  ]) await withFetch(async () => makeResponse(), () => assert.rejects(discoverCreator('scout2015'), error => error.status === 502 && error.code === 'INVALID_PROVIDER_RESPONSE'));
});

test('creator request failures never bypass a barrier, retry, or leak provider response text', async () => {
  for (const status of [403, 429, 500]) {
    let calls = 0;
    await withFetch(async () => { calls++; return new Response('secret upstream stack and captcha', { status }); }, async () => {
      await assert.rejects(discoverCreator('scout2015'), error => error.status >= 400 && !/secret|stack/.test(error.message));
      assert.equal(calls, 1);
    });
  }
  await withFetch(async () => { throw new DOMException('secret timeout', 'TimeoutError'); }, () => assert.rejects(discoverCreator('scout2015'), error => error.status === 504 && error.code === 'PROVIDER_TIMEOUT' && !/secret/.test(error.message)));
});

test('explicit alumni and compact graduation-year bios retain their qualifier without implying current enrollment',async()=>{
 for(const bio of ['UCLA alumna','UCLA alumnus','UCLA alumni','UCLA graduate',"NYU'27"]){
  const value=fixture();state(value).userInfo.signature=bio;
  await withFetch(async()=>response(value),async()=>{
   const record=(await discoverCreator('scout2015')).records[0];
   assert.equal(record.school,bio.startsWith('UCLA')?'University of California, Los Angeles':'New York University');assert.equal(record.profileEvidence.school.text,bio);assert.equal(record.profileEvidence.school.source,'public-bio-self-description');
  });
 }
});
