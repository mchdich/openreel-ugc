import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { validateVideoAttachment, analyzeVideo } from '../lib/media.js';

const jpeg = size => {
  const bytes = Buffer.alloc(size || 8, 0);
  bytes[0] = 0xff; bytes[1] = 0xd8;
  bytes[bytes.length - 2] = 0xff; bytes[bytes.length - 1] = 0xd9;
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
};
const attachment = (overrides = {}) => ({ name: 'Opening.mp4', duration: 12, width: 1080, height: 1920, frames: [{ timestamp: 0, dataUrl: jpeg() }, { timestamp: 5.5, dataUrl: jpeg() }], ...overrides });
const narrative = (overrides = {}) => ({ title: 'Opening critique', summary: 'The sampled opening shows a product before the second sampled scene.', sections: [{ heading: 'Visual opening', text: 'The first sampled frame introduces the product; try a tighter crop as a hypothesis.', timestamps: [0] }, { heading: 'Pacing', text: 'A scene change is visible between the sampled frames; intervening edits cannot be assessed.', timestamps: [0, 5.5] }], ...overrides });
const completion = value => ({ id: 'chatcmpl-test', object: 'chat.completion', created: 1, model: 'local-vision', choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(value), refusal: null }, finish_reason: 'stop' }], usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 } });
async function withProvider(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { OPENAI_API_KEY: 'provider-test-secret', OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1/`, OPENAI_VISION_MODEL: 'local-vision' };
  try { return await run(env); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const respond = value => (_request, response) => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(completion(value))); };
const rejectsCode = (work, code, status) => assert.rejects(work, error => error.code === code && error.status === status && !/provider-test-secret|private-stack/.test(error.message));

test('video validation sanitizes only allowed metadata and copies timestamped frames', () => {
  const input = attachment({ name: '  Opening\u0000.mp4  ', transcript: '  A supplied transcript.  ', token: 'never retain', audioAvailable: true });
  input.frames[0].extra = 'drop';
  const value = validateVideoAttachment(input);
  assert.deepEqual(value, { name: 'Opening.mp4', duration: 12, width: 1080, height: 1920, frames: [{ timestamp: 0, dataUrl: jpeg() }, { timestamp: 5.5, dataUrl: jpeg() }], transcript: 'A supplied transcript.' });
  assert.notEqual(value.frames, input.frames);
  assert.notEqual(value.frames[0], input.frames[0]);
  assert.equal(validateVideoAttachment(attachment()).transcript, '');
});

test('validation rejects invalid duration, dimensions, frame count and metadata bounds', () => {
  const invalid = [null, [], {}, attachment({ duration: 0 }), attachment({ duration: -1 }), attachment({ duration: 600.1 }), attachment({ duration: Infinity }), attachment({ duration: NaN }), attachment({ duration: '12' }), attachment({ width: 0 }), attachment({ width: 7681 }), attachment({ height: 1.2 }), attachment({ height: '1920' }), attachment({ frames: [] }), attachment({ frames: Array(9).fill({ timestamp: 0, dataUrl: jpeg() }) }), attachment({ name: 'x'.repeat(161) }), attachment({ name: {} }), attachment({ transcript: 'x'.repeat(12001) }), attachment({ transcript: [] })];
  for (const value of invalid) assert.throws(() => validateVideoAttachment(value), error => error.code === 'invalid-video' && error.status === 400);
  const edge = validateVideoAttachment(attachment({ duration: 600, width: 7680, height: 1, name: 'x'.repeat(160), transcript: 'x'.repeat(12000) }));
  assert.equal(edge.duration, 600);
});

test('validation requires finite unique chronological timestamps within video duration', () => {
  for (const timestamps of [[-1], [12.01], [NaN], [Infinity], ['0'], [0, 0], [5.5, 0]]) {
    assert.throws(() => validateVideoAttachment(attachment({ frames: timestamps.map(timestamp => ({ timestamp, dataUrl: jpeg() })) })), error => error.code === 'invalid-video');
  }
  assert.equal(validateVideoAttachment(attachment({ frames: [{ timestamp: 12, dataUrl: jpeg() }] })).frames[0].timestamp, 12);
});

test('validation accepts bounded JPEG data only and rejects corrupt or noncanonical base64', () => {
  const invalid = ['https://example.test/photo.jpg', 'data:image/png;base64,/9j/2Q==', 'data:image/jpeg;base64,not base64', 'data:image/jpeg;base64,/9j/2Q', 'data:image/jpeg;base64,/9j/2R==', 'data:image/jpeg;base64,AAAAAA==', 'data:image/jpeg;base64,/9gAAA==', 'data:image/jpeg;base64,/9j/2Q==\n', null];
  for (const dataUrl of invalid) assert.throws(() => validateVideoAttachment(attachment({ frames: [{ timestamp: 0, dataUrl }] })), error => error.code === 'invalid-video');
  assert.equal(validateVideoAttachment(attachment({ frames: [{ timestamp: 0, dataUrl: jpeg(160 * 1024) }] })).frames.length, 1);
  assert.throws(() => validateVideoAttachment(attachment({ frames: [{ timestamp: 0, dataUrl: jpeg(160 * 1024 + 1) }] })), error => error.code === 'invalid-video' && error.status === 413);
  const maximum = validateVideoAttachment(attachment({ frames: Array.from({ length: 8 }, (_, timestamp) => ({ timestamp, dataUrl: jpeg(160 * 1024) })) }));
  assert.equal(maximum.frames.length, 8);
});

test('unconfigured analysis fails explicitly before any provider request', async () => {
  for (const env of [{}, { OPENAI_API_KEY: ' ' }, { OPENAI_VISION_MODEL: 'local-vision' }, { OPENAI_API_KEY: 'provider-test-secret' }]) {
    await rejectsCode(() => analyzeVideo(attachment(), 'Critique the hook', env), 'provider-unconfigured', 503);
  }
});

test('real HTTP provider receives every frame with timestamps and result retains only verified metadata', async () => {
  let received;
  await withProvider(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = { path: request.url, authorization: request.headers.authorization, body: JSON.parse(Buffer.concat(chunks)) };
    respond(narrative())(request, response);
  }, async env => {
    const result = await analyzeVideo(attachment(), 'How could I improve the opening?', env);
    assert.equal(received.path, '/v1/chat/completions');
    assert.equal(received.authorization, 'Bearer provider-test-secret');
    assert.equal(received.body.model, 'local-vision');
    const user = received.body.messages.find(message => message.role === 'user');
    assert.deepEqual(user.content.filter(part => part.type === 'image_url').map(part => part.image_url.url), [jpeg(), jpeg()]);
    const text = user.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
    assert.match(text, /0(?:\.0+)?\s*(?:s|seconds)/i);
    assert.match(text, /5\.5\s*(?:s|seconds)/i);
    assert.match(text, /How could I improve/);
    const system = received.body.messages.find(message => message.role === 'system').content;
    assert.match(system, /sampled/i);
    assert.match(system, /full (?:video|footage)/i);
    assert.match(system, /untrusted/i);
    assert.match(system, /never invent/i);
    assert.deepEqual(result.videoAnalysis, { name: 'Opening.mp4', duration: 12, frameCount: 2, timestamps: [0, 5.5], audioAvailable: false, transcriptProvided: false });
    assert.equal(result.kind, 'critique');
    assert.equal(result.mode, 'ai');
    assert.deepEqual(result.sources, []);
    assert.deepEqual(result.creators, []);
    assert.equal(result.stats.totalRecords, 0);
    assert.equal(result.stats.matchedRecords, 0);
    assert.equal(result.title, 'Opening critique');
    assert.ok(result.sections.some(section => /0s/.test(section.text)));
    assert.ok(result.sections.some(section => /no audio|audio.*(?:unavailable|not supplied)/i.test(section.text)));
    assert.doesNotMatch(JSON.stringify(result), /data:image|provider-test-secret|prompt_tokens/);
  });
});

test('transcript is explicitly unverified user supplied evidence and model fallback works', async () => {
  let payload;
  await withProvider(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    payload = JSON.parse(Buffer.concat(chunks));
    respond(narrative())(request, response);
  }, async env => {
    delete env.OPENAI_VISION_MODEL;
    env.OPENAI_MODEL = 'fallback-vision';
    const result = await analyzeVideo(attachment({ transcript: 'I made this for you.' }), 'Check the hook', env);
    assert.equal(payload.model, 'fallback-vision');
    assert.match(JSON.stringify(payload.messages), /unverified/i);
    assert.match(JSON.stringify(payload.messages), /I made this for you/);
    assert.equal(result.videoAnalysis.audioAvailable, false);
    assert.equal(result.videoAnalysis.transcriptProvided, true);
    assert.ok(result.sections.some(section => /user.supplied.*unverified|unverified.*user.supplied/i.test(section.text)));
  });
});

test('provider may not insert metrics, sources, unobserved timestamps or missing-audio claims', async () => {
  const invalid = [
    narrative({ stats: { totalRecords: 999 } }), narrative({ sources: [{ url: 'https://invented.example' }] }),
    narrative({ sections: [{ heading: 'Pacing', text: 'A cut is visible.', timestamps: [3] }] }),
    narrative({ summary: 'The video has 900K views and a 90% retention rate.' }),
    narrative({ summary: 'The music is upbeat and the voiceover is clear.' }),
    narrative({ summary: 'The clip earned many likes.' }),
    narrative({ sections: [{ heading: 'Visual', text: 'Contact maker@invented.example.', timestamps: [0] }] })
  ];
  for (const value of invalid) await withProvider(respond(value), env => rejectsCode(() => analyzeVideo(attachment(), 'Critique this', env), 'provider-invalid-response', 502));
});

test('malformed and truncated provider responses produce controlled secret-free errors', async () => {
  const invalid = [
    {}, { choices: [] }, { choices: [{ message: { content: 'private-stack provider-test-secret' } }] },
    completion(narrative({ sections: [] })), completion(narrative({ summary: '' })), completion(narrative({ title: 'x'.repeat(161) })),
    { ...completion(narrative()), choices: [{ message: { content: JSON.stringify(narrative()) }, finish_reason: 'length' }] },
    completion(narrative({ sections: [{ heading: 'Visual', text: 'x'.repeat(4001), timestamps: [0] }] }))
  ];
  for (const data of invalid) await withProvider((_request, response) => response.end(JSON.stringify(data)), env => rejectsCode(() => analyzeVideo(attachment(), 'Critique this', env), 'provider-invalid-response', 502));
  await withProvider((_request, response) => response.end('x'.repeat(70000)), env => rejectsCode(() => analyzeVideo(attachment(), 'Critique this', env), 'provider-invalid-response', 502));
});

test('provider HTTP and network failures never become offline visual analysis', async () => {
  for (const status of [401, 429, 500]) await withProvider((_request, response) => { response.writeHead(status); response.end('provider-test-secret private-stack'); }, env => rejectsCode(() => analyzeVideo(attachment(), 'Critique this', env), 'provider-unavailable', 502));
  await withProvider((request) => request.socket.destroy(), env => rejectsCode(() => analyzeVideo(attachment(), 'Critique this', env), 'provider-unavailable', 502));
});

test('provider configuration refuses unsafe URLs and question/attachment never selects an endpoint', async () => {
  for (const base of ['http://public.example/v1', 'https://user:password@provider.example/v1', 'https://provider.example/v1?key=secret', 'ftp://provider.example/v1', 'not a url']) {
    await rejectsCode(() => analyzeVideo(attachment(), 'Critique this', { OPENAI_API_KEY: 'provider-test-secret', OPENAI_MODEL: 'vision', OPENAI_BASE_URL: base }), 'provider-configuration', 503);
  }
  for (const question of ['', ' '.repeat(5), 'x'.repeat(6001), null]) await rejectsCode(() => analyzeVideo(attachment(), question, { OPENAI_API_KEY: 'provider-test-secret', OPENAI_MODEL: 'vision' }), 'invalid-question', 400);
});

test('a cited frame cannot disguise invented prose timestamps or speech claims', async () => {
  const invalid = [
    narrative({ summary: 'At 3s the product appears.' }),
    narrative({ summary: 'The product first appears at 00:03.' }),
    narrative({ summary: 'She says buy this now.' }),
    narrative({ summary: 'The creator whispers the opening line.' })
  ];
  for (const value of invalid) await withProvider(respond(value), env => rejectsCode(() => analyzeVideo(attachment(), 'Critique this', env), 'provider-invalid-response', 502));
});

test('redirected provider requests fail without sending credentials to a new endpoint', async () => {
  let redirectedCalls = 0;
  await withProvider((_request, response) => { redirectedCalls++; respond(narrative())(_request, response); }, async destination => {
    await withProvider((_request, response) => { response.writeHead(302, { location: `${destination.OPENAI_BASE_URL}chat/completions` }); response.end(); }, env => rejectsCode(() => analyzeVideo(attachment(), 'Critique this', env), 'provider-unavailable', 502));
  });
  assert.equal(redirectedCalls, 0);
});

test('provider timeouts have a controlled retryable response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new DOMException('provider-test-secret private-stack', 'TimeoutError'); };
  try { await rejectsCode(() => analyzeVideo(attachment(), 'Critique this', { OPENAI_API_KEY: 'provider-test-secret', OPENAI_MODEL: 'vision' }), 'provider-timeout', 504); }
  finally { globalThis.fetch = originalFetch; }
});

test('analytics disclaimers and labeled visual hypotheses remain usable', async () => {
  const cases = [
    ['Why200views?', 'The frames cannot establish why the reported200views occurred'],
    ['Why only 200 views?', 'The frames cannot establish why the reported 200 views occurred.'],
    ['Why are views low?', 'The cause of low views cannot be established from frames.'],
    ['How could I improve the opening?', 'A faster opening may help retention; test it.'],
    ['How could I improve the opening?', 'Audio was not analyzed.'],
    ['What does the opening show?', 'On-screen text says Try this.']
  ];
  for (const [question, summary] of cases) {
    await withProvider(respond(narrative({ summary })), async env => {
      const result = await analyzeVideo(attachment(), question, env);
      assert.equal(result.summary, summary);
      assert.equal(result.videoAnalysis.audioAvailable, false);
      assert.match(result.sections[0].text, /^0s/);
    });
  }
});

test('reported analytics never authorize invented counts or positive audio observations', async () => {
  const cases = [
    ['Critique this', 'The frames cannot establish why the reported200views occurred'],
    ['Why200views?', 'The frames cannot establish why the reported2Mviews occurred'],
    ['Why200views?', 'The clip has 2M views.'],
    ['Why200views?', 'The clip has 200 likes.'],
    ['Why200views?', 'The narrator says Try this.'],
    ['Why200views?', 'Audio was not analyzed, but the music is upbeat.'],
    ['Why200views?', 'On-screen text says Try this, while the narrator says buy it.'],
    ['Why200views?', 'A faster opening will improve retention.'],
    ['Why200views?', 'At 2s the product is revealed.']
  ];
  for (const [question, summary] of cases) await withProvider(respond(narrative({ summary })), env => rejectsCode(() => analyzeVideo(attachment(), question, env), 'provider-invalid-response', 502));
});
