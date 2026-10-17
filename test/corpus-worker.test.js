import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {openCorpus} from '../lib/corpus.js';
let workerModule;
try{workerModule=await import('../lib/corpus-worker.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}

/** Real SQLite behind only the asynchronous D1 transport contract. */
class SQLiteD1{
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(readFileSync(new URL('../drizzle/0000_corpus.sql',import.meta.url),'utf8'));this.calls=[];this.batches=0;}
 prepare(sql){
  this.calls.push(sql);const db=this.db;
  return {sql,parameters:[],bind(...parameters){return {sql,parameters,async all(){return {success:true,results:db.prepare(sql).all(...parameters)};},async first(){return db.prepare(sql).get(...parameters)??null;}};},async all(){return {success:true,results:db.prepare(sql).all()};},async first(){return db.prepare(sql).get()??null;}};
 }
 async batch(statements){this.batches++;this.db.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>({success:true,results:this.db.prepare(s.sql).all(...s.parameters)}));this.db.exec('COMMIT');return results;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 close(){this.db.close();}
}
const row=(overrides={})=>({id:'video-a',handle:'@maker',caption:'Beauty routine',bio:'NYU | public@example.com',email:'public@example.com',school:'NYU',location:'NYC',followers:1200,views:100,likes:10,comments:0,shares:0,url:'https://www.tiktok.com/@maker/video/123',sourceType:'user-import',fetchedAt:'2026-10-17T00:00:00Z',...overrides});
function open(){assert.equal(typeof workerModule?.openWorkerCorpus,'function','openWorkerCorpus must be implemented');const binding=new SQLiteD1();return {binding,corpus:workerModule.openWorkerCorpus(binding)};}

// Running request-side schema creation could corrupt migrations or exceed platform limits.
test('D1 corpus uses a migrated binding without executing schema changes in requests',async()=>{
 const {binding,corpus}=open();try{assert.equal((await corpus.stats()).total,0);assert.deepEqual(await corpus.search('beauty'),[]);assert.ok(binding.calls.every(sql=>!/^\s*(?:CREATE|ALTER|DROP|PRAGMA)/i.test(sql)));assert.throws(()=>workerModule.openWorkerCorpus(null),/binding|database/i);}finally{binding.close();}
});

// Upsert counts must not include FTS shadow writes, and stale terms must disappear.
test('D1 upsert remains idempotent and returns source provenance with current FTS terms',async()=>{
 const {binding,corpus}=open();try{
  assert.equal((await corpus.upsert([row({id:undefined,caption:'Rare saffron'})],{kind:'real',source:'permitted-import'})).changed,1);
  assert.equal((await corpus.upsert([row({id:undefined,caption:'Rare saffron'})],{kind:'real',source:'permitted-import'})).changed,0);
  const first=(await corpus.search('saffron'))[0];assert.equal(first.id,'tiktok-123');assert.equal(first.corpusVerification,'user-supplied');assert.equal(first.corpusSource,'permitted-import');
  await corpus.upsert([row({id:undefined,caption:'Rare marigold'})],{kind:'real',source:'permitted-import'});
  assert.deepEqual(await corpus.search('saffron'),[]);assert.equal((await corpus.search('marigold')).length,1);assert.equal((await corpus.stats()).total,1);
 }finally{binding.close();}
});

// Invalid final rows must not send any earlier writes to the provider.
test('D1 validates the whole acquisition batch before submitting any statement',async()=>{
 const {binding,corpus}=open();try{await assert.rejects(corpus.upsert([row(),{caption:'missing handle'}],{kind:'real'}),/handle/i);assert.equal(binding.batches,0);assert.equal((await corpus.stats()).total,0);}finally{binding.close();}
});

// A concurrent/existing fixture collision must abort the entire D1 batch at SQL level.
test('D1 batch rolls back preceding inserts when a fixture ID would become real',async()=>{
 const {binding,corpus}=open();try{
  await corpus.upsert([row({id:'fixture',demo:true})],{kind:'example'});
  await assert.rejects(corpus.upsert([row({id:'new'}),row({id:'fixture'})],{kind:'real'}),/promot|synthetic|example/i);
  assert.equal((await corpus.stats()).total,1);assert.equal(await corpus.get('new'),null);assert.equal((await corpus.stats()).byKind.real,0);
 }finally{binding.close();}
});

// D1 must preserve the same field, alias, unknown and creator-count semantics as local storage.
test('D1 filtered search agrees with real SQLite corpus results',async()=>{
 const {binding,corpus}=open(),local=openCorpus(':memory:');try{
  const rows=[row(),row({id:'video-b',url:'https://www.tiktok.com/@maker/video/124'}),row({id:'other',handle:'@other',school:'New York University',location:'New York City',followers:1400,url:'https://www.tiktok.com/@other/video/125'}),row({id:'unknown',handle:'@unknown',followers:undefined,url:'https://www.tiktok.com/@unknown/video/126'}),row({id:'separate-email',handle:'@separate',bio:'NYU',url:'https://www.tiktok.com/@separate/video/127'})];
  await corpus.upsert(rows,{kind:'real'});local.upsert(rows,{kind:'real'});
  for(const [query,options]of [['Find 2 beauty creators at NYU around 1201 followers',{emailInBio:true}],['beauty',{school:'NYU',location:'NYC',minFollowers:1000,maxFollowers:1500}],['beauty',{maxFollowers:0}],['"beauty" OR 1=1 --',{}]])assert.deepEqual((await corpus.search(query,options)).map(r=>r.id),local.search(query,options).map(r=>r.id));
  assert.ok((await corpus.get('unknown')).unavailableMetrics.includes('followers'));
 }finally{binding.close();local.close();}
});

// Hosted write limits must reject before partial chunks are committed.
test('D1 acquisition batches are bounded and classifications remain separate',async()=>{
 const {binding,corpus}=open();try{
  const rows=Array.from({length:41},(_,i)=>row({id:`real-${i}`}));await assert.rejects(corpus.upsert(rows,{kind:'real'}),/40|batch/i);assert.equal(binding.batches,0);
  await corpus.upsert([row()],{kind:'real',verification:'provider-observed'});
  await corpus.upsert([row({id:'example',demo:true})],{kind:'example'});await corpus.upsert([row({id:'synthetic'})],{kind:'synthetic'});await corpus.upsert([row({id:'unverified'})]);
  const stats=await corpus.stats();assert.deepEqual(stats.byKind,{real:1,example:1,synthetic:1,unverified:1});assert.equal(stats.providerObservedReal,1);assert.equal((await corpus.search('beauty')).length,1);
 }finally{binding.close();}
});

// A requested limit is applied after deduplication, including pages with no FTS terms.
test('D1 creator pagination and invalid query bounds remain safe',async()=>{
 const {binding,corpus}=open();try{
  await corpus.upsert([row(),row({id:'video-b',url:'https://www.tiktok.com/@maker/video/124'}),row({id:'other',handle:'@other',url:'https://www.tiktok.com/@other/video/125'})],{kind:'real'});
  assert.equal((await corpus.search('Find 2 creators')).length,2);assert.equal((await corpus.search('beauty',{uniqueCreators:true,offset:1,limit:1})).length,1);
  await assert.rejects(corpus.search('beauty',{limit:0}),/limit/i);await assert.rejects(corpus.search('beauty',{kind:'fake'}),/kind/i);
 }finally{binding.close();}
});

// Per-batch corpus scans multiply acquisition costs as the real index grows.
test('D1 upsert reports write counts without scanning corpus statistics',async()=>{
 const {binding,corpus}=open();try{
  const imported=await corpus.upsert([row()],{kind:'real'});assert.equal(imported.processed,1);assert.equal(imported.changed,1);
  assert.ok(binding.calls.every(sql=>!/^\s*SELECT|\bCOUNT\s*\(/i.test(sql)),'A bounded write must not scan global counts.');
  binding.calls=[];await corpus.upsert([]);assert.equal(binding.calls.length,0);
 }finally{binding.close();}
});
