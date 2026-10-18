import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../lib/api.js';

const record = { id: 'a', handle: '@a', caption: 'Beauty morning routine', format: 'List', followers: 10000, views: 1000 };
const request = (body, host = 'localhost', headers = {}) => new Request(`http://${host}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('status exposes provider availability without configuration secrets', async () => {
  const response = await handleApi(new Request('https://app.example/api/status'), { OPENAI_API_KEY: 'sk-secret', OPENAI_BASE_URL: 'https://private.example/v1', OPENAI_MODEL: 'private-model' });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.aiConfigured, true);
  assert.equal(value.tokenRequired, true);
  assert.doesNotMatch(JSON.stringify(value), /sk-secret|private.example|private-model/);
});

test('valid chat returns actual deterministic research', async () => {
  const response = await handleApi(request({ question: 'Find beauty creators', records: [record] }));
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.mode, 'deterministic');
  assert.equal(value.creators[0].handle, '@a');
  assert.equal(value.stats.totalRecords, 1);
});

test('endpoint validates methods, JSON, question, count, history and media type', async () => {
  const cases = [
    [new Request('http://localhost/api/chat'), 405],
    [new Request('http://localhost/api/nope'), 404],
    [new Request('http://localhost/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), 400],
    [request({ question: '', records: [] }), 400],
    [request({ question: 'x'.repeat(6001), records: [] }), 400],
    [request({ question: 'Find creators', records: 'bad' }), 400],
    [request({ question: 'Find creators', records: Array.from({ length: 2001 }, () => record) }), 400],
    [request({ question: 'Find creators', records: [], history: Array(21).fill({ role: 'user', content: 'hello' }) }), 400],
    [new Request('http://localhost/api/chat', { method: 'POST', body: '{}' }), 415],
    [request({ question: 'x', records: [] }, 'localhost', { 'content-length': '2097153' }), 413]
  ];
  for (const [req, status] of cases) assert.equal((await handleApi(req)).status, status);
});

test('public paid provider calls require bearer token and host spoofing does not bypass auth', async () => {
  const env = { OPENAI_API_KEY: 'sk-secret', OPENREEL_API_TOKEN: 'app-secret' };
  for (const host of ['app.example', 'localhost.evil.example', '127.0.0.1.evil.example']) {
    assert.equal((await handleApi(request({ question: 'x', records: [] }, host), env)).status, 401);
  }
  assert.equal((await handleApi(request({ question: 'x', records: [] }, 'app.example', { authorization: 'Bearer wrong' }), env)).status, 401);
  const noTokenConfig = await handleApi(request({ question: 'x', records: [] }, 'app.example'), { OPENAI_API_KEY: 'sk-secret' });
  assert.equal(noTokenConfig.status, 503);
});

test('provider failure falls back with grounded results and never leaks provider errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('sk-secret private provider stack', { status: 500 });
  try {
    const response = await handleApi(request({ question: 'Find beauty creators', records: [record] }), { OPENAI_API_KEY: 'sk-secret' });
    assert.equal(response.status, 200);
    const value = await response.json();
    assert.equal(value.mode, 'deterministic');
    assert.equal(value.sources[0].id, 'a');
    assert.match(value.notice, /unavailable/i);
    assert.doesNotMatch(JSON.stringify(value), /sk-secret|stack/);
  } finally { globalThis.fetch = originalFetch; }
});

test('provider can enrich prose but cannot replace corpus sources or metrics', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'Grounded narrative.', sections: [{ heading: 'Observation', text: 'One supplied creator.' }], sources: [{ handle: '@fake' }], stats: { totalRecords: 999 } }) } }] }), { headers: { 'content-type': 'application/json' } });
  try {
    const response = await handleApi(request({ question: 'Find beauty creators', records: [record] }, 'public.example', { authorization: 'Bearer app-secret' }), { OPENAI_API_KEY: 'sk-secret', OPENREEL_API_TOKEN: 'app-secret' });
    const value = await response.json();
    assert.equal(value.mode, 'ai');
    assert.equal(value.summary, 'Grounded narrative.');
    assert.equal(value.sources[0].handle, '@a');
    assert.equal(value.stats.totalRecords, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('rate limits an individual client with a bounded response', async () => {
  const req = () => request({ question: 'Find creators', records: [] }, 'rate.example');
  const statuses = [];
  for (let i = 0; i < 35; i++) statuses.push((await handleApi(req())).status);
  assert.ok(statuses.includes(429));
});

test('status and UI research modes follow the browser contract', async () => {
  const response = await handleApi(new Request('http://localhost/api/status'));
  const value = await response.json();
  assert.equal(value.providerConfigured, false);
  assert.equal(value.requiresToken, false);
  for (const mode of ['normal', 'deep']) {
    const answer = await handleApi(request({ question: 'Find beauty creators', records: [record], mode }, `mode-${mode}.example`));
    assert.equal(answer.status, 200);
    assert.equal((await answer.json()).sources[0].id, 'a');
  }
});

test('cross-origin and undeclared oversized streaming bodies are rejected', async () => {
  const crossing = await handleApi(request({ question: 'Find beauty creators', records: [record] }, 'csrf.example', { origin: 'https://attacker.example' }));
  assert.equal(crossing.status, 403);
  const big = new Request('http://body-size.example/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'x', records: [], padding: 'x'.repeat(2097152) }) });
  assert.equal((await handleApi(big)).status, 413);
});

test('provider cannot introduce nonexistent contacts or fetch a question URL', async () => {
  const originalFetch = globalThis.fetch;
  let fetched;
  globalThis.fetch = async url => {
    fetched = String(url);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'Contact fake@invented.com for details.', sections: [] }) } }] }));
  };
  try {
    const answer = await handleApi(request({ question: 'Review this script: I open the video by saying hello. https://attacker.example/private', records: [record] }, 'localhost'), { OPENAI_API_KEY: 'sk-secret', OPENAI_BASE_URL: 'https://configured.example/v1' });
    const value = await answer.json();
    assert.equal(fetched, 'https://configured.example/v1/chat/completions');
    assert.equal(value.mode, 'deterministic');
    assert.doesNotMatch(JSON.stringify(value), /fake@invented/);
  } finally { globalThis.fetch = originalFetch; }
});

test('client rate limits cannot be bypassed by changing requested host', async () => {
  const statuses = [];
  for (let i = 0; i < 35; i++) statuses.push((await handleApi(request({ question: 'x', records: [] }, `host-${i}.example`, { 'cf-connecting-ip': '192.0.2.140' }))).status);
  assert.ok(statuses.includes(429));
});

test('empty creator search stays honest even with a configured model', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'I found many matching creators.', sections: [] }) } }] }));
  try {
    const response = await handleApi(request({ question: 'Find Harvard creators over 1M followers', records: [record] }, 'empty.example', { authorization: 'Bearer token' }), { OPENAI_API_KEY: 'sk-secret', OPENREEL_API_TOKEN: 'token' });
    const value = await response.json();
    assert.equal(value.mode, 'deterministic');
    assert.deepEqual(value.creators, []);
    assert.match(value.summary, /no creators/i);
  } finally { globalThis.fetch = originalFetch; }
});

test('audio transcription advertises explicit configuration and guards public provider calls',async()=>{
  const env={OPENAI_API_KEY:'test-provider-secret',OPENAI_TRANSCRIPTION_MODEL:'tiny.en',OPENREEL_API_TOKEN:'app-secret'};
  const status=await(await handleApi(new Request('https://audio-status.example/api/status'),env)).json();
  assert.equal(status.transcriptionConfigured,true);
  const req=body=>new Request('https://audio-public.example/api/audio/transcribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await handleApi(req({audio:{}}),env)).status,401);
  const missing=await handleApi(req({audio:{}}),{});assert.equal(missing.status,400);
  assert.match((await missing.json()).error,/audio|WAV/i);
});

test('ordinary sentence punctuation after supplied handles and URLs preserves AI synthesis',async()=>{
 const old=globalThis.fetch;
 try{for(const [source,summary] of [[{...record,handle:'@a.b'},'The matched creator is @a.b.'],[{...record,url:'https://creator.example/known'},'See https://creator.example/known.']]){
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary,sections:[]})}}]}));
  const result=await(await handleApi(request({question:'Find beauty creators',records:[source]}),{OPENAI_API_KEY:'private-test-key'})).json();assert.equal(result.mode,'ai');assert.equal(result.summary,summary);
 }}finally{globalThis.fetch=old;}
});

test('a prefix of a supplied contact is still ungrounded and rejected replies are distinct from provider outages',async()=>{
 const old=globalThis.fetch;
 try{for(const [source,summary] of [[{...record,handle:'@averylongname'},'The creator is @avery'],[{...record,url:'https://creator.example/known-long'},'See https://creator.example/known']]){
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary,sections:[]})}}]}));
  const result=await(await handleApi(request({question:'Find beauty creators',records:[source]}),{OPENAI_API_KEY:'private-test-key'})).json();assert.equal(result.mode,'deterministic');assert.match(result.notice,/AI reply could not be verified/);assert.doesNotMatch(result.notice,/provider is unavailable/);assert.notEqual(result.summary,summary);
 }}finally{globalThis.fetch=old;}
});

test('provider body transport failures remain outages while malformed delivered JSON is an unverifiable reply',async()=>{
 const old=globalThis.fetch;
 try{for(const [response,pattern] of [[()=>new Response(new ReadableStream({start(c){c.error(new TypeError('private-body-secret'));}})),/provider is unavailable/],[()=>new Response('{"choices":'),/AI reply could not be verified/],[()=>new Response(new ReadableStream({start(c){c.error(new TypeError('private-body-secret'));}}),{status:502}),/provider is unavailable/]]){
  globalThis.fetch=async()=>response();const result=await(await handleApi(request({question:'Find beauty creators',records:[record]}),{OPENAI_API_KEY:'private-test-key'})).json();assert.equal(result.mode,'deterministic');assert.match(result.notice,pattern);assert.doesNotMatch(JSON.stringify(result),/private-body-secret|private-test-key/);
 }}finally{globalThis.fetch=old;}
});
