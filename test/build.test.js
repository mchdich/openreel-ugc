import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('portable Worker serves the exact client and handles research without Node dependencies',async()=>{
  const root=new URL('../',import.meta.url);
  execFileSync(process.execPath,['scripts/build.js'],{cwd:fileURLToPath(root),stdio:'pipe'});
  const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url));
  const response=await worker.fetch(new Request('https://example.test/'));
  assert.equal(response.status,200);
  assert.equal(await response.text(),await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
  assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  const status=await worker.fetch(new Request('https://example.test/api/status'));
  assert.equal((await status.json()).providerConfigured,false);
  const answer=await worker.fetch(new Request('https://example.test/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Find NYU creators',records:[]})}));
  assert.equal(answer.status,200);
  const result=await answer.json();assert.deepEqual(result.creators,[]);assert.match(result.summary,/no creators/i);
  assert.equal((await worker.fetch(new Request('https://example.test/missing'))).status,404);
  assert.equal((await worker.fetch(new Request('https://example.test/',{method:'POST'}))).status,405);
});

test('portable Worker binds its hosted corpus through D1 without runtime schema changes',async()=>{
  const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');
  db.exec(await readFile(new URL('../drizzle/0000_corpus.sql',import.meta.url),'utf8'));
  let writes=0;
  const binding={prepare(sql){assert.doesNotMatch(sql,/CREATE|ALTER|DROP/i);if(/^\s*(?:INSERT|UPDATE|DELETE)/i.test(sql))writes++;return {bind(...parameters){return {all:async()=>({success:true,results:db.prepare(sql).all(...parameters)})};},all:async()=>({success:true,results:db.prepare(sql).all()})};},batch:async statements=>Promise.all(statements.map(s=>s.all()))};
  try{
    const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url));
    const response=await worker.fetch(new Request('https://d1-build.example/api/status'),{DB:binding});assert.equal((await response.json()).corpusAvailable,true);
    const stats=await worker.fetch(new Request('https://d1-build.example/api/corpus/stats'),{DB:binding});assert.equal(stats.status,200);assert.equal((await stats.json()).corpus.total,0);assert.equal(writes,0);
  }finally{db.close();}
});
