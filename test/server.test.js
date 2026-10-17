import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../server.js';

async function withServer(run, env = {}) {
  const server = createAppServer(env);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('Node bridge serves assets with security headers and handles JSON research', async () => {
  await withServer(async base => {
    const module = await fetch(`${base}/engine.js`);
    assert.equal(module.status, 200);
    assert.match(module.headers.get('content-type'), /javascript/);
    assert.match(module.headers.get('content-security-policy'), /object-src 'none'/);
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'Find creators', records: [{ handle: 'node', followers: 10000 }] }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).creators[0].handle, '@node');
    assert.equal((await fetch(`${base}/does-not-exist`)).status, 404);
    assert.equal((await fetch(`${base}/engine.js`, { method: 'POST' })).status, 405);
  });
});

test('Node bridge rejects escaped filesystem paths and keeps loopback provider configuration private', async () => {
  await withServer(async base => {
    assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 403);
    const response = await fetch(`${base}/api/status`);
    const value = await response.json();
    assert.equal(value.providerConfigured, true);
    assert.equal(value.requiresToken, false);
    assert.doesNotMatch(JSON.stringify(value), /sk-private/);
  }, { OPENAI_API_KEY: 'sk-private' });
});
