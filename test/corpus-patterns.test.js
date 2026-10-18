import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.js';
import {openCorpus} from '../lib/corpus.js';
import {getTrends} from '../public/engine.js';

// Controlled index fixtures prove retrieval behavior, never real corpus coverage.
const row=(id,format='',extra={})=>({id:`tiktok-${id}`,handle:`@qa_${id}`,creatorId:String(id),caption:'Cooking fixture',format,followers:1500,bio:'NYU | qa@example.com',school:'NYU',email:'qa@example.com',url:`https://www.tiktok.com/@qa_${id}/video/${id}`,sourceType:'test-fixture',fetchedAt:'2024-01-01T00:00:00Z',demo:false,...extra});
const request=(body,headers={})=>new Request('http://localhost/api/corpus/patterns',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
async function sample(corpus,query=''){
 const response=await handleApi(request({query}),{OPENREEL_CORPUS:corpus});
 assert.equal(response.status,200);return response.json();
}

test('default pattern browse reaches qualifying formats beyond the first index page',async()=>{
 const db=openCorpus(':memory:');
 try{
  db.upsert([...Array.from({length:110},(_,i)=>row(1000+i)),row(9001,'Unboxing'),row(9002,'Unboxing'),row(9003,'Product review'),row(9004,'Product review')],{kind:'real',source:'controlled pattern test'});
  assert.equal(getTrends(db.search('',{kind:'real',limit:100})).length,0);
  const before=db.stats(),result=await sample(db);
  assert.deepEqual(result.records.map(r=>r.id).sort(),['tiktok-9001','tiktok-9002','tiktok-9003','tiktok-9004']);
  assert.deepEqual(getTrends(result.records).map(g=>g.format).sort(),['Product review','Unboxing']);
  assert.equal(result.selection.method,'format-stratified');assert.equal(result.selection.queryCount,8);
  assert.equal(result.corpus.total,114);assert.equal(db.stats().total,before.total);
 }finally{db.close();}
});

test('format browse caps unique real output and gives eligible formats room in the sample',async()=>{
 const db=openCorpus(':memory:');
 try{
  const formats=['Unboxing','Product review','Product demonstration','Step-by-step tutorial'];
  db.upsert(formats.flatMap((format,g)=>Array.from({length:45},(_,i)=>row(2000+g*100+i,format))),{kind:'real',source:'controlled pattern test'});
  db.upsert([row(9991,'Fictional format'),row(9992,'Fictional format')],{kind:'example',source:'controlled examples'});
  const result=await sample(db);
  assert.equal(result.records.length,100);assert.equal(new Set(result.records.map(r=>r.id)).size,100);
  assert.ok(result.records.every(r=>r.demo===false&&!['tiktok-9991','tiktok-9992'].includes(r.id)));
  assert.equal(getTrends(result.records).length,4);
  assert.ok(getTrends(result.records).every(g=>g.creators.length>=2));
  assert.ok(result.selection.candidateRecords<=310);assert.equal(result.corpus.byKind.example,2);
 }finally{db.close();}
});

test('day-in-the-life format probing does not become a creator location filter',async()=>{
 const db=openCorpus(':memory:');
 try{
  db.upsert([...Array.from({length:110},(_,i)=>row(1000+i)),row(9101,'Day in the life'),row(9102,'Day in the life')],{kind:'real',source:'controlled pattern test'});
  const result=await sample(db);
  assert.deepEqual(result.records.map(r=>r.id).sort(),['tiktok-9101','tiktok-9102']);
  assert.equal(getTrends(result.records)[0].format,'Day in the life');
 }finally{db.close();}
});

test('topic searches preserve combined profile filters and do not widen into format queries',async()=>{
 const db=openCorpus(':memory:');
 try{
  db.upsert([row(8001,'Unboxing'),row(8002,'Unboxing',{school:'UCLA'}),row(8003,'Unboxing',{followers:900}),row(8004,'Unboxing',{bio:'NYU',email:''}),row(8005,'Unboxing',{caption:'Pottery fixture'})],{kind:'real',source:'controlled pattern test'});
  const result=await sample(db,'cooking NYU at least 1000 followers with email in bio');
  assert.deepEqual(result.records.map(r=>r.id),['tiktok-8001']);
  assert.deepEqual(result.selection,{method:'query',queryCount:1,candidateRecords:1});
 }finally{db.close();}
});

test('missing format evidence, negated descriptions and one-creator repeats cannot create browse groups',async()=>{
 const db=openCorpus(':memory:');
 try{
  db.upsert([row(7001,'',{caption:'Unboxing',visualDescription:'A static card without unboxing.',descriptionSource:'upstream-model'}),row(7002,'',{visualDescription:'Text promises an upcoming unboxing tomorrow.',descriptionSource:'upstream-model'}),row(7003,'Product review'),row(7004,'Product review',{creatorId:'7003',handle:'@qa_7003',url:'https://www.tiktok.com/@qa_7003/video/7004'})],{kind:'real',source:'controlled pattern test'});
  const result=await sample(db);assert.deepEqual(result.records,[]);assert.equal(result.corpus.byKind.real,4);
 }finally{db.close();}
});

test('pattern route rejects invalid queries and cross-origin requests before corpus access',async()=>{
 const db={search(){throw new Error('must not search');},stats(){throw new Error('must not read');}};
 for(const query of [null,42,'x'.repeat(1001)])assert.equal((await handleApi(request({query}),{OPENREEL_CORPUS:db})).status,400);
 assert.equal((await handleApi(request({query:''},{origin:'https://other.example'}),{OPENREEL_CORPUS:db})).status,403);
 assert.equal((await handleApi(request({query:''}))).status,503);
});
