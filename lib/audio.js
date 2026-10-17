const MAX_CHUNK_BYTES = 1024 * 1024;
const MAX_PROVIDER_BYTES = 64 * 1024;
const PREFIX = 'data:audio/wav;base64,';
const failure = (message, code, status) => Object.assign(new Error(message), { code, status });
const invalid = (message, status = 400) => failure(message, 'invalid-audio', status);

/** Only canonical PCM16, mono, 16kHz WAV chunks produced by the local extractor. */
export function validateAudioChunk(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.dataUrl !== 'string' || !input.dataUrl.startsWith(PREFIX)) throw invalid('Audio must be a PCM16 mono 16kHz WAV data URL.');
  const encoded = input.dataUrl.slice(PREFIX.length);
  if (encoded.length > Math.ceil(MAX_CHUNK_BYTES / 3) * 4) throw invalid('Each audio chunk must be at most 1 MiB.', 413);
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw invalid('Audio data must contain canonical base64.');
  let binary;
  try { binary = atob(encoded); } catch { throw invalid('Audio data must contain canonical base64.'); }
  if (btoa(binary) !== encoded || binary.length < 46 || binary.length > MAX_CHUNK_BYTES) throw invalid('Audio WAV size is invalid.');
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const label = offset => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (label(0) !== 'RIFF' || view.getUint32(4, true) !== bytes.length - 8 || label(8) !== 'WAVE' || label(12) !== 'fmt ' ||
    view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== 16000 || view.getUint32(28, true) !== 32000 || view.getUint16(32, true) !== 2 ||
    view.getUint16(34, true) !== 16 || label(36) !== 'data' || view.getUint32(40, true) !== bytes.length - 44 || (bytes.length - 44) % 2 !== 0) throw invalid('Audio must have a canonical PCM16 mono 16kHz WAV header and complete sample data.');
  const duration = (bytes.length - 44) / 32000;
  if (!Number.isFinite(input.duration) || input.duration <= 0 || duration > 30 || Math.abs(input.duration - duration) > 1 / 16000) throw invalid('Audio chunk duration must match its samples and be at most 30 seconds.');
  return { bytes, duration };
}

function configuration(env) {
  const key = typeof env.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
  const model = typeof env.OPENAI_TRANSCRIPTION_MODEL === 'string' ? env.OPENAI_TRANSCRIPTION_MODEL.trim() : '';
  if (!key || !model) throw failure('Audio transcription requires OPENAI_API_KEY and OPENAI_TRANSCRIPTION_MODEL on the server.', 'provider-unconfigured', 503);
  let url;
  try {
    url = new URL(env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    if (!url.pathname.endsWith('/audio/transcriptions')) url.pathname += '/audio/transcriptions';
  } catch { throw failure('The transcription provider URL is invalid. Use an HTTPS base URL, or HTTP on localhost for a local provider.', 'provider-configuration', 503); }
  return { key, model, url: url.href };
}

async function readTranscription(response) {
  const bad = () => failure('The transcription provider returned invalid or oversized text. Check the configured model and try again.', 'provider-invalid-response', 502);
  if (!/\bapplication\/(?:[a-z0-9.+-]*\+)?json\b/i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > MAX_PROVIDER_BYTES || !response.body) {
    await response.body?.cancel();
    throw bad();
  }
  const reader = response.body.getReader(), chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PROVIDER_BYTES) { await reader.cancel(); throw bad(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const value of chunks) { bytes.set(value, offset); offset += value.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw bad(); }
  if (!data || typeof data.text !== 'string' || data.text.length > 12000) throw bad();
  return data.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

/** Machine transcription of supplied audio; returned text remains unverified. */
export async function transcribeAudio(chunk, env = {}) {
  const audio = validateAudioChunk(chunk);
  const provider = configuration(env);
  const form = new FormData();
  form.append('file', new Blob([audio.bytes], { type: 'audio/wav' }), 'audio-chunk.wav');
  form.append('model', provider.model);
  form.append('response_format', 'json');
  let text;
  try {
    const response = await fetch(provider.url, {
      method: 'POST', headers: { authorization: `Bearer ${provider.key}` }, body: form,
      redirect: 'error', signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw failure('The transcription provider is unavailable. Check its credentials, quota and transcription model.', 'provider-unavailable', 502);
    }
    text = await readTranscription(response);
  } catch (error) {
    if (['provider-invalid-response', 'provider-unavailable'].includes(error?.code)) throw error;
    if (['AbortError', 'TimeoutError'].includes(error?.name)) throw failure('The transcription provider timed out. Check its availability before trying again.', 'provider-timeout', 504);
    throw failure('The transcription provider could not be reached. Check the server configuration and try again.', 'provider-unavailable', 502);
  }
  return { text, duration: audio.duration, provider: 'machine-transcription' };
}
