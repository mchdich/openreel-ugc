const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 30 * SAMPLE_RATE;
const unavailable = message => ({ status: 'unavailable', duration: 0, sampleRate: SAMPLE_RATE, channels: 1, chunks: [], message });
const aborted = () => new DOMException('Audio extraction cancelled.', 'AbortError');

function clearDecoded(buffer) {
  if (!buffer || typeof buffer.getChannelData !== 'function') return;
  for (let channel = 0; channel < Math.min(buffer.numberOfChannels, 32); channel++) {
    try { buffer.getChannelData(channel).fill(0); } catch { /* Release any remaining references even if a decoder has detached its buffer. */ }
  }
}

function decode(context, bytes, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) { clearDecoded(value); return; }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(value);
    };
    const cancel = () => finish(aborted());
    const timer = setTimeout(() => finish(new Error('Audio decoding timed out.')), 20000);
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    try { Promise.resolve(context.decodeAudioData(bytes)).then(value => finish(null, value), error => finish(error)); }
    catch (error) { finish(error); }
  });
}

function wavData(channels, sourceRate, first, count) {
  const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
  const label = (offset, value) => { for (let index = 0; index < value.length; index++) bytes[offset + index] = value.charCodeAt(index); };
  label(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); label(8, 'WAVE'); label(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  label(36, 'data'); view.setUint32(40, count * 2, true);
  const ratio = sourceRate / SAMPLE_RATE;
  const mono = index => {
    let value = 0;
    for (const channel of channels) value += channel[Math.min(index, channel.length - 1)];
    value /= channels.length;
    if (!Number.isFinite(value)) throw new Error('Decoded audio contains invalid samples.');
    return value;
  };
  for (let index = 0; index < count; index++) {
    const start = (first + index) * ratio;
    let sample;
    if (ratio <= 1) {
      const lower = Math.floor(start), fraction = start - lower;
      sample = mono(lower) * (1 - fraction) + mono(lower + 1) * fraction;
    } else {
      const end = start + ratio;
      let value = 0;
      for (let source = Math.floor(start); source < Math.ceil(end); source++) value += mono(source) * (Math.min(end, source + 1) - Math.max(start, source));
      sample = value / ratio;
    }
    sample = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  const dataUrl = `data:audio/wav;base64,${btoa(binary)}`;
  bytes.fill(0);
  return dataUrl;
}

/** Decode only a user-selected local file; never record a microphone or fetch media. */
export async function extractAudio(file, { signal, onProgress = () => {} } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size <= 0 || file.size > 50 * 1024 * 1024) throw new Error('Choose a local audio or video file no larger than 50 MiB.');
  if (!/^(?:video|audio)\//i.test(file.type || '') && !/\.(?:mp4|webm|mov|m4v|ogv|wav|mp3|m4a|ogg|flac)$/i.test(file.name || '')) throw new Error('Choose a supported local audio or video file.');
  if (signal?.aborted) throw aborted();
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return unavailable('This browser does not support local audio decoding. Audio was not extracted.');
  let context, compressed, buffer;
  try {
    // decodeAudioData uses the context rate, letting the native decoder resample first.
    try { context = new AudioContextClass({ sampleRate: SAMPLE_RATE }); }
    catch { context = new AudioContextClass(); }
    compressed = await file.arrayBuffer();
    try { buffer = await decode(context, compressed, signal); }
    catch (error) {
      if (error?.name === 'AbortError') throw error;
      return unavailable('No decodable audio was found. The file may have no audio track, or this browser may not support its audio codec.');
    }
    if (signal?.aborted) throw aborted();
    if (!buffer || !Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1) return { ...unavailable('The decoded file has no audio track.'), status: 'absent' };
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 600) throw new Error('Audio must be no longer than 600 seconds (10 minutes).');
    if (buffer.numberOfChannels > 8 || !Number.isInteger(buffer.sampleRate) || buffer.sampleRate < 8000 || buffer.sampleRate > 192000 || !Number.isInteger(buffer.length) || buffer.length < 1 || Math.abs(buffer.length / buffer.sampleRate - buffer.duration) > 1 / buffer.sampleRate) throw new Error('The decoded audio metadata is unsupported.');
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    if (channels.some(channel => !(channel instanceof Float32Array) || channel.length !== buffer.length)) throw new Error('The decoded audio sample data is incomplete.');
    const count = Math.round(buffer.length * SAMPLE_RATE / buffer.sampleRate);
    if (count < 1) return unavailable('The audio track is too short to extract.');
    const chunks = [];
    for (let first = 0; first < count; first += CHUNK_SAMPLES) {
      if (signal?.aborted) throw aborted();
      const samples = Math.min(CHUNK_SAMPLES, count - first);
      chunks.push({ index: chunks.length, start: first / SAMPLE_RATE, duration: samples / SAMPLE_RATE, dataUrl: wavData(channels, buffer.sampleRate, first, samples) });
      onProgress(chunks.length, Math.ceil(count / CHUNK_SAMPLES));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { status: 'available', duration: count / SAMPLE_RATE, sampleRate: SAMPLE_RATE, channels: 1, chunks };
  } finally {
    clearDecoded(buffer);
    // Browsers may detach the compressed ArrayBuffer during decodeAudioData.
    try { if (compressed?.byteLength) new Uint8Array(compressed).fill(0); } catch { /* Detached data already has no accessible bytes. */ }
    buffer = null;
    compressed = null;
    if (context && typeof context.close === 'function') { try { await context.close(); } catch { /* Closing an already-closed decoder does not affect extracted bytes. */ } }
  }
}
