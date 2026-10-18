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

test('validated critique preserves structured sample timestamps for source citation and reload',async()=>{
 await withProvider(respond(narrative()),async env=>{const result=await analyzeVideo(attachment(),'Review visible samples',env);assert.deepEqual(result.sections[0].timestamps,[0]);assert.deepEqual(result.sections[1].timestamps,[0,5.5]);});
});

test('natural singular and plural camera framing phrases are not mistaken for social view metrics',async()=>{
 for(const summary of ['The opening shows a wide POV view of the coffee station.','The sampled sequence jumps from earlier machine views to tighter detail frames.','Trim repeated setup views.','A similar frontal view and a wider countertop view show the coffee station.','Try the tighter 0s or 5.5s view where the machine fills the frame.','The ending keeps more of the machine in view.','Try a tighter view to improve clarity.'])await withProvider(respond(narrative({summary})),async env=>assert.equal((await analyzeVideo(attachment(),'Give visual edits',env)).mode,'ai'));
 for(const summary of ['Product views reached 999999.','Product views hit 999999.','You reported product views reached 999999.','You reported product views hit 999999.','Product views are 999999.','The product views total 999999.','You reported product views are 999999.','This edit guarantees 999999 product views.','The machine views doubled.','This will improve product views.','You reported 999999 product views.','This edit guarantees more product views.','This increases views.','This increases machine views.','The machine views increased.','POV views increased.','The machine view count is 999999.','This earns 999999 views.','A wider view at 999999s shows the product.'])await withProvider(respond(narrative({summary})),env=>rejectsCode(()=>analyzeVideo(attachment(),'Give visual edits',env),'provider-invalid-response',502));
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
    assert.equal(received.body.response_format.type,'json_schema');
    const schema=received.body.response_format.json_schema.schema;
    assert.equal(schema.additionalProperties,false);
    assert.deepEqual(schema.required,['title','summary','sections']);
    assert.deepEqual(schema.properties.sections.items.properties.timestamps.items.enum,[0,5.5]);
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
    assert.ok(result.sections.some(section => /supplied.*unverified|unverified.*supplied/i.test(section.text)));
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
test('metadata durations and proposed edit lengths are not mistaken for observed timestamps',async()=>{
  for(const summary of ['The supplied video is 12 seconds long.','Experiment with a 2 second opening before the next visual.','Try cutting to the product at 2s as an alternate edit.']){
    await withProvider(respond(narrative({summary})),async env=>assert.equal((await analyzeVideo(attachment(),'How should I improve this?',env)).summary,summary));
  }
});

test('conditional editing experiments do not assert a measured outcome or authorize nearby promises',async()=>{
 for(const text of ['Test if the abrupt transition improves viewer retention.','Test whether the alternate crop changes engagement.','Test if viewer retention improves.','Test whether engagement changes.']){
  await withProvider(respond(narrative({sections:[{heading:'Editing experiment',text,timestamps:[0,5.5]}]})),async env=>{
   const result=await analyzeVideo(attachment(),'Suggest one visual editing experiment to test.',env);
   assert.ok(result.sections[0].text.endsWith(text));
  });
 }
 for(const text of [
  'Test retention with this cut.',
  'Test if this cut will definitely improve retention.',
  'Test if the cut improves retention; this guarantees more views.',
  'Test if the cut improves retention. This improves engagement.',
  'Test if the cut improves retention: this improves engagement.',
  'Test if the cut improves retention and this guarantees engagement.',
  'Test if the cut improves retention, a change that increases views.',
  'Test if the cut changes retention – this increases engagement.',
  'Test if the cut changes retention (this increases engagement).',
  'Test if retention improves!This improves engagement.',
  'Test if the crop works - this improves retention.',
  'Test if the crop works--this improves retention.',
  'Test if this cut could improve retention and this guarantees views.',
  'Experiment with a cut that might improve retention but will boost likes.'
 ])await withProvider(respond(narrative({sections:[{heading:'Editing experiment',text,timestamps:[0,5.5]}]})),env=>rejectsCode(()=>analyzeVideo(attachment(),'Suggest an editing test.',env),'provider-invalid-response',502));
});

test('editing proposals may state a bounded conditional test as their purpose',async()=>{
 for(const text of [
  'Try cutting to 5.5s immediately after 0s to test if the scene change enhances viewer retention. Compare with original sequence.',
  'Consider a tighter crop to test whether the alternate crop changes engagement.',
  'Experiment with a shorter opening to test if viewer retention improves.',
  'Try removing the pause to test whether the transition affects watch time.'
 ]){
  await withProvider(respond(narrative({sections:[{heading:'Editing experiment',text,timestamps:[0,5.5]}]})),async env=>{
   const result=await analyzeVideo(attachment(),'Suggest one visual editing experiment to test.',env);
   assert.ok(result.sections[0].text.endsWith(text));
   assert.deepEqual(result.videoAnalysis.timestamps,[0,5.5]);
  });
 }
});

test('an experiment purpose cannot authorize performance claims or another assertion',async()=>{
 for(const text of [
  'Try a crop that improves retention to test if the change enhances engagement.',
  'Try a crop that may improve retention to test if the change enhances engagement.',
  'Try a crop that will work to test if the scene change enhances retention.',
  'Consider guaranteed results to test if the crop enhances retention.',
  'Review this crop to test if the scene change enhances retention.',
  'Try the crop to test if the scene change will enhance retention.',
  'Try the crop to test if the scene change enhances retention and this increases engagement.',
  'Try the crop to test if the scene change enhances retention: this improves engagement.',
  'Try the crop to test if the scene change enhances retention – this improves engagement.',
  'Try the crop to test if the scene change enhances retention--this improves engagement.',
  'Try the crop to test if the scene change enhances retention (this improves engagement).',
  'Try the crop to test if the scene change may enhance retention – this improves engagement.',
  'Try the crop to test if the scene change could enhance retention (this increases engagement).',
  'Try the crop to test if the scene change - this improves engagement enhances retention.',
  'Try the crop to test whether the scene change enhances retention, this guarantees more views.',
  'Try the crop to test if retention improves!This increases views.',
  'Try the crop; to test if the scene change enhances retention.'
 ])await withProvider(respond(narrative({sections:[{heading:'Editing experiment',text,timestamps:[0,5.5]}]})),env=>rejectsCode(()=>analyzeVideo(attachment(),'Suggest an editing test.',env),'provider-invalid-response',502));
});

test('conditional experiment purposes retain numeric audio and timestamp safeguards',async()=>{
 for(const text of [
  'Try a tighter crop to test if the scene change enhances 90% retention.',
  'Try using the upbeat music to test if the scene change enhances retention.',
  'Try a tighter crop to test if the scene change enhances retention. At 2s the product appears.'
 ])await withProvider(respond(narrative({sections:[{heading:'Editing experiment',text,timestamps:[0,5.5]}]})),env=>rejectsCode(()=>analyzeVideo(attachment(),'Suggest an editing test.',env),'provider-invalid-response',502));
});

test('repeated citations to the same supplied frame are normalized without adding evidence',async()=>{
  await withProvider(respond(narrative({sections:[{heading:'Opening',text:'The sampled opening shows the product.',timestamps:[0,0]}]})),async env=>{
    const value=await analyzeVideo(attachment(),'Review this opening',env);
    assert.match(value.sections[0].text,/^0s — /);assert.doesNotMatch(value.sections[0].text,/0s, 0s/);
  });
});

test('operator vision deadline is bounded and passed to the actual provider request',async()=>{
 const original=AbortSignal.timeout;const seen=[];AbortSignal.timeout=milliseconds=>{seen.push(milliseconds);return original(milliseconds);};
 try{await withProvider(respond(narrative()),async env=>{await analyzeVideo(attachment(),'Critique this',{...env,OPENREEL_VISION_TIMEOUT_MS:'90000'});});assert.ok(seen.includes(90000));}finally{AbortSignal.timeout=original;}
 for(const value of ['0','9999','180001','NaN','45000.5'])await rejectsCode(()=>analyzeVideo(attachment(),'Critique this',{OPENAI_API_KEY:'provider-test-secret',OPENAI_MODEL:'vision',OPENREEL_VISION_TIMEOUT_MS:value}),'provider-configuration',503);
});

test('camera views are visual evidence rather than invented view-count claims',async()=>{
 for(const text of ['Try opening with the closest product view first.','The view becomes a closer crop at 5.5s.','The bottle is visible in the camera view.']){
  await withProvider(respond(narrative({sections:[{heading:'Visual edit',text,timestamps:[0,5.5]}]})),async env=>{
   const result=await analyzeVideo(attachment(),'Give a concrete edit',env);
   assert.ok(result.sections.some(s=>s.text.includes(text)));
  });
 }
 // Actual metric promises retain their separate validation.
 await withProvider(respond(narrative({summary:'This edit increases views.'})),env=>rejectsCode(()=>analyzeVideo(attachment(),'Give a concrete edit',env),'provider-invalid-response',502));
});

test('a GPT-5 vision request uses reasoning-compatible output controls',async()=>{
 await withProvider(async(request,response)=>{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks));
  if(body.max_tokens!==undefined||body.temperature!==undefined||!(body.max_completion_tokens>0)){response.statusCode=400;response.end('{}');return;}
  respond(narrative())(request,response);
 },async env=>{
  const result=await analyzeVideo(attachment(),'Give a concrete edit',{...env,OPENAI_VISION_MODEL:'gpt-5.4-mini'});
  assert.equal(result.mode,'ai');
 });
});
test('sampled camera framing at a timestamp is not parsed as a social view count',async()=>{
 const summary='The package view at 0s is a still state. The room view at 5.5s shows a wider composition.';
 await withProvider(respond(narrative({summary})),async env=>{
  const result=await analyzeVideo(attachment(),'Give visual feedback',env);assert.equal(result.summary,summary);
 });
 await withProvider(respond(narrative({summary:'The view count is 999999.'})),env=>rejectsCode(()=>analyzeVideo(attachment(),'Give visual feedback',env),'provider-invalid-response',502));
});
test('a bare view figure and an unseen visual time cannot use the camera-view exemption',async()=>{
 for(const summary of ['View at 999999.','The view at 999999 is unverified.','The view at 999999s shows a product.']){
  await withProvider(respond(narrative({summary})),env=>rejectsCode(()=>analyzeVideo(attachment(),'Give visual feedback',env),'provider-invalid-response',502));
 }
});
test('one invalid vision narrative is corrected within the same deadline',async t=>{
 let calls=0;const signals=[];const actualTimeout=AbortSignal.timeout;t.mock.method(AbortSignal,'timeout',ms=>{signals.push(ms);return actualTimeout(ms);});
 await withProvider(async(request,response)=>{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks));calls++;
  if(calls===1){respond(narrative({summary:'The clip has 999999 views.'}))(request,response);return;}
  assert.match(body.messages[0].content,/correct|previous|invalid/i);respond(narrative())(request,response);
 },async env=>{
  const result=await analyzeVideo(attachment(),'Give an observation and a proposed edit',env);
  assert.equal(result.mode,'ai');assert.equal(calls,2);assert.deepEqual(signals,[45000]);
 });
});
