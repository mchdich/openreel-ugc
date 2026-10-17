import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const serverAudio = await import('../lib/audio.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const browserAudio = await import('../public/audio.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const { transcribeAudio, validateAudioChunk } = serverAudio;
const { extractAudio } = browserAudio;

// Independent, valid little-endian PCM16 mono16k WAV with a real 440 Hz test tone.
function wavFixture(seconds = 0.1) {
  const samples = Math.round(16000 * seconds);
  const bytes = new Uint8Array(44 + samples * 2), view = new DataView(bytes.buffer);
  const word = (offset, value) => [...value].forEach((character, index) => { bytes[offset + index] = character.charCodeAt(0); });
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index++) view.setInt16(44 + index * 2, Math.round(Math.sin(index / 16000 * Math.PI * 880) * 12000), true);
  return bytes;
}
const chunk = (bytes = wavFixture(), duration = (bytes.length - 44) / 32000) => ({ index: 0, start: 0, duration, dataUrl: `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}` });
const withFetch = async (implementation, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try { return await fn(); } finally { globalThis.fetch = original; }
};
async function withProvider(handler, run) {
  const server = createServer(async (request, response) => {
    try { await handler(request, response); }
    catch (error) { response.writeHead(500); response.end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}/v1`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('audio modules expose extraction, validation and actual transcription operations', () => {
  assert.equal(typeof extractAudio, 'function');
  assert.equal(typeof validateAudioChunk, 'function');
  assert.equal(typeof transcribeAudio, 'function');
});

test('canonical WAV validation derives duration and copies only validated audio bytes', () => {
  const result = validateAudioChunk({ ...chunk(), endpoint: 'https://unsafe.example', transcript: 'invented' });
  assert.equal(result.duration, 0.1);
  assert.deepEqual([...result.bytes], [...wavFixture()]);
  assert.equal(result.endpoint, undefined);
  assert.equal(result.transcript, undefined);
});

test('invalid WAV headers, forged durations, noncanonical base64 and oversized chunks are rejected', () => {
  for (const mutate of [
    data => { data[0] = 0; }, data => { data[8] = 0; }, data => { data[12] = 0; },
    data => { data[20] = 3; }, data => { data[22] = 2; }, data => { data[24] = 0; },
    data => { data[28] = 1; }, data => { data[32] = 4; }, data => { data[34] = 8; },
    data => { data[36] = 0; }, data => { data[40] = 3; }, data => { data[4] = 0; }
  ]) {
    const data = wavFixture(); mutate(data);
    assert.throws(() => validateAudioChunk(chunk(data)), error => error.status === 400 && error.code === 'invalid-audio');
  }
  for (const value of [null, {}, { ...chunk(), duration: 0 }, { ...chunk(), duration: 1 },
    { ...chunk(), dataUrl: 'data:audio/mp3;base64,AAAA' },
    { ...chunk(), dataUrl: `${chunk().dataUrl}\n` },
    chunk(wavFixture(30.01)),
    { duration: 30, dataUrl: `data:audio/wav;base64,${'A'.repeat(1400000)}` }
  ]) assert.throws(() => validateAudioChunk(value), error => [400, 413].includes(error.status));
});

test('missing required transcription model/key is explicit and never sends a paid request', async () => {
  await withFetch(async () => assert.fail('Unconfigured transcription cannot fetch'), async () => {
    for (const env of [{}, { OPENAI_API_KEY: 'secret' }, { OPENAI_TRANSCRIPTION_MODEL: 'test-transcribe' }, { OPENAI_API_KEY: 'secret', OPENAI_MODEL: 'vision-is-not-transcription' }]) {
      await assert.rejects(transcribeAudio(chunk(), env), error => error.status === 503 && error.code === 'provider-unconfigured');
    }
  });
});

test('transcription sends a real WAV multipart file to a real HTTP-compatible provider', async () => {
  let captured;
  await withProvider(async (request, response) => {
    const pieces = [];
    for await (const piece of request) pieces.push(piece);
    const body = Buffer.concat(pieces);
    const form = await new Request('http://localhost/transcription', { method: 'POST', headers: request.headers, body }).formData();
    const file = form.get('file');
    captured = { path: request.url, authorization: request.headers.authorization, contentType: request.headers['content-type'], model: form.get('model'), format: form.get('response_format'), filename: file.name, fileType: file.type, bytes: new Uint8Array(await file.arrayBuffer()), keys: [...form.keys()] };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ text: ' Recognized words from the test provider.\u0000 ', duration: 999, privateTrace: 'must be discarded' }));
  }, async base => {
    const result = await transcribeAudio({ ...chunk(), endpoint: 'https://attacker.example' }, { OPENAI_API_KEY: 'test-secret', OPENAI_TRANSCRIPTION_MODEL: 'test-transcribe', OPENAI_BASE_URL: base });
    assert.deepEqual(result, { text: 'Recognized words from the test provider.', duration: 0.1, provider: 'machine-transcription' });
  });
  assert.equal(captured.path, '/v1/audio/transcriptions');
  assert.equal(captured.authorization, 'Bearer test-secret');
  assert.match(captured.contentType, /^multipart\/form-data; boundary=/);
  assert.equal(captured.model, 'test-transcribe');
  assert.equal(captured.format, 'json');
  assert.equal(captured.filename, 'audio-chunk.wav');
  assert.equal(captured.fileType, 'audio/wav');
  assert.deepEqual(captured.keys.sort(), ['file', 'model', 'response_format']);
  assert.deepEqual([...captured.bytes], [...wavFixture()]);
});

test('transcription rejects unsafe provider configuration and does not follow credential redirects', async () => {
  const env = { OPENAI_API_KEY: 'secret', OPENAI_TRANSCRIPTION_MODEL: 'test-transcribe' };
  await withFetch(async () => assert.fail('Invalid provider URLs cannot fetch'), async () => {
    for (const url of ['http://provider.example/v1', 'https://user:pass@provider.example/v1', 'https://provider.example/v1?secret=yes', 'https://provider.example/v1#hash', 'file:///tmp/audio']) {
      await assert.rejects(transcribeAudio(chunk(), { ...env, OPENAI_BASE_URL: url }), error => error.status === 503 && error.code === 'provider-configuration');
    }
  });
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://provider.example/v1/audio/transcriptions');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    return new Response('secret redirect', { status: 302, headers: { location: 'https://evil.example' } });
  }, () => assert.rejects(transcribeAudio(chunk(), { ...env, OPENAI_BASE_URL: 'https://provider.example/v1/chat/completions' }), error => error.code === 'provider-unavailable' && !/secret/.test(error.message)));
});

test('transcription failures, timeouts and malformed/big responses stay explicit and secret-free', async () => {
  const env = { OPENAI_API_KEY: 'secret-token', OPENAI_TRANSCRIPTION_MODEL: 'test-transcribe' };
  for (const makeResponse of [
    () => new Response('secret-token upstream trace', { status: 401 }),
    () => new Response('not json', { headers: { 'content-type': 'application/json' } }),
    () => new Response(JSON.stringify({ text: 'x'.repeat(12001) }), { headers: { 'content-type': 'application/json' } }),
    () => new Response(JSON.stringify({ words: 'no text' }), { headers: { 'content-type': 'application/json' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '65537' } }),
    () => new Response(JSON.stringify({ text: 'x', padding: 'x'.repeat(65537) }), { headers: { 'content-type': 'application/json' } }),
    () => { throw new Error('secret-token network stack'); }
  ]) {
    let calls = 0;
    await withFetch(async () => { calls++; return makeResponse(); }, async () => {
      await assert.rejects(transcribeAudio(chunk(), env), error => error.status >= 400 && !/secret-token|trace|stack/.test(error.message));
      assert.equal(calls, 1);
    });
  }
  await withFetch(async () => { throw new DOMException('secret-token timeout', 'TimeoutError'); }, () => assert.rejects(transcribeAudio(chunk(), env), error => error.status === 504 && error.code === 'provider-timeout'));
  await withFetch(async () => new Response(JSON.stringify({ text: '' }), { headers: { 'content-type': 'application/json' } }), async () => {
    assert.equal((await transcribeAudio(chunk(), env)).text, '');
  });
});

async function withAudioDecoder(buffer, run, error = null) {
  const original = globalThis.AudioContext;
  let closed = 0;
  globalThis.AudioContext = class {
    async decodeAudioData() { if (error) throw error; return buffer; }
    async close() { closed++; }
  };
  try { await run(() => closed); } finally { if (original === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = original; }
}
const localFile = () => new File(['local video bytes'], 'clip.webm', { type: 'video/webm' });

test('browser extraction averages stereo, downsamples actual PCM and writes correct canonical WAV samples', async () => {
  const channels = [new Float32Array([1, 1, 1, -1, -1, -1]), new Float32Array(6)];
  const buffer = { length: 6, sampleRate: 48000, numberOfChannels: 2, duration: 6 / 48000, getChannelData: channel => channels[channel] };
  await withAudioDecoder(buffer, async closed => {
    const result = await extractAudio(localFile());
    assert.equal(result.status, 'available');
    assert.equal(result.sampleRate, 16000);
    assert.equal(result.channels, 1);
    assert.equal(result.chunks.length, 1);
    assert.equal(result.chunks[0].start, 0);
    const bytes = Buffer.from(result.chunks[0].dataUrl.split(',')[1], 'base64');
    assert.equal(bytes.length, 48);
    assert.equal(bytes.readUInt32LE(24), 16000);
    assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.readInt16LE(44), 16384);
    assert.equal(bytes.readInt16LE(46), -16384);
    assert.equal(validateAudioChunk(result.chunks[0]).duration, 2 / 16000);
    assert.equal(closed(), 1);
    assert.ok(channels.every(channel => channel.every(sample => sample === 0)));
  });
});

test('browser extraction splits audio into 30 second bounded chunks and clears decoded buffers', async () => {
  const samples = new Float32Array(481600).fill(0.25);
  const buffer = { length: samples.length, sampleRate: 16000, numberOfChannels: 1, duration: 30.1, getChannelData: () => samples };
  await withAudioDecoder(buffer, async closed => {
    const result = await extractAudio(localFile());
    assert.equal(result.chunks.length, 2);
    assert.equal(result.duration, 30.1);
    assert.deepEqual(result.chunks.map(value => [value.index, value.start, value.duration]), [[0, 0, 30], [1, 30, 0.1]]);
    for (const value of result.chunks) assert.ok(validateAudioChunk(value).bytes.byteLength <= 1048576);
    assert.equal(closed(), 1);
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 0);
  });
});

test('browser extraction never treats missing/unsupported audio or invalid metadata as speech', async () => {
  await withAudioDecoder(null, async closed => {
    const result = await extractAudio(localFile());
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.chunks, []);
    assert.match(result.message, /audio|codec|decode/i);
    assert.equal(closed(), 1);
  }, new DOMException('Unable to decode', 'EncodingError'));
  await withAudioDecoder({ numberOfChannels: 0, duration: 2, sampleRate: 16000, length: 32000 }, async closed => {
    assert.equal((await extractAudio(localFile())).status, 'absent');
    assert.equal(closed(), 1);
  });
  await withAudioDecoder({ numberOfChannels: 1, duration: 601, sampleRate: 16000, length: 9616000, getChannelData: () => new Float32Array(0) }, async closed => {
    await assert.rejects(extractAudio(localFile()), /600|10 minutes/i);
    assert.equal(closed(), 1);
  });
  await assert.rejects(extractAudio(new File(['text'], 'notes.txt', { type: 'text/plain' })), /audio|video/i);
});
