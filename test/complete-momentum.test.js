import test from 'node:test';
import assert from 'node:assert/strict';
import {openCorpus} from '../lib/corpus.js';
import {handleApi} from '../lib/api.js';
import {analyzeMomentum} from '../public/temporal.js';
const question='Which formats are gaining share as of 2024-07-21 over 7 days?';
const request=body=>new Request('http://local.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,records:[],corpus:true,mode:'deep',...body})});
function cohort(){
 const rows=[];
 for(const [day,total,unboxing]of [['2024-07-20',1200,30],['2024-07-10',1100,10]])for(let i=0;i<total;i++){
  const id=String((day==='2024-07-20'?100000:200000)+i),handle='person'+i%11;
  // Put the current examples beyond both the old 500 cap and the first SQL page.
  const format=day==='2024-07-20'?i>=total-unboxing:i<unboxing;
  rows.push({id,handle,caption:'Coffee '+(i%2?'recipe':'equipment'),postedAt:day,format:format?'Unboxing':'',school:i%2?'UCLA':'NYU',location:'New York',followers:2000,email:'hi@example.com',bio:'hi@example.com',url:`https://www.tiktok.com/@${handle}/video/${id}`,sourceType:'controlled-test-fixture',fetchedAt:'2026-10-18T12:00:00Z'});
 }
 return rows;
}
test('iterable comparison matches array evidence and closes its iterator when classification throws',()=>{
 const rows=cohort(),options={asOf:'2024-07-21',windowDays:7};
 function* source(){yield* rows;}
 assert.deepEqual(analyzeMomentum(source(),options),analyzeMomentum(rows,options));
 let closed=false;function* broken(){try{yield rows[0];throw Error('read failed');}finally{closed=true;}}
 assert.throws(()=>analyzeMomentum(broken(),options),/read failed/);assert.equal(closed,true);
});
test('Deep corpus comparison counts the complete real SQLite cohort and fixes a capped sign reversal',async()=>{
 const db=openCorpus(':memory:');try{
  db.upsert(cohort(),{kind:'real',source:'controlled cohort regression'});const before=db.stats();
  const normal=await handleApi(request({mode:'normal'}),{OPENREEL_CORPUS:db}),sample=await normal.json();assert.equal(normal.status,200);assert.equal(sample.temporal.groups[0].risingWithinSample,false);
  const original=globalThis.fetch;let paid=0;globalThis.fetch=async()=>{paid++;throw Error('Dated counts must not call a model');};
  let response;try{response=await handleApi(request({}),{OPENREEL_CORPUS:db,OPENAI_API_KEY:'configured-placeholder',OPENREEL_LOCAL_REQUEST:true});}finally{globalThis.fetch=original;}
  assert.equal(response.status,200);const result=await response.json();assert.equal(paid,0);
  assert.equal(result.temporal.windows.current.recordCount,1200);assert.equal(result.temporal.windows.prior.recordCount,1100);
  const group=result.temporal.groups.find(g=>g.format==='Unboxing');assert.equal(group.current.videoCount,30);assert.equal(group.prior.videoCount,10);assert.equal(group.risingWithinSample,true);
  assert.equal(result.temporal.retrieval.scope,'complete-filtered-corpus');assert.equal(result.stats.comparedRecords,2300);assert.ok(result.sources.length<=36);assert.match(result.notice,/complete.*filtered/i);assert.doesNotMatch(result.notice,/at most 500|bounded sample/i);assert.deepEqual(db.stats(),before);
 }finally{db.close();}
});
test('complete cohort scanning preserves combined topic, school, contact and follower predicates',()=>{
 const db=openCorpus(':memory:');try{
  db.upsert(cohort(),{kind:'real',source:'controlled cohort regression'});
  const result=db.momentum('Coffee creators at UCLA with at least 1,000 followers and email in bio',{asOf:'2024-07-21',windowDays:7});
  assert.equal(result.temporal.windows.current.recordCount,600);assert.equal(result.temporal.windows.prior.recordCount,550);assert.ok(result.sources.every(r=>r.school==='UCLA'&&r.bio.includes(r.email)&&r.followers>=1000));
  assert.equal(result.stats.comparedRecords,1150);
 }finally{db.close();}
});
test('a failed complete scan cannot return a partial or sampled answer',async()=>{
 let searches=0;const corpus={momentum(){throw Object.assign(Error('The complete comparison is too large. Narrow its dates or topic.'),{code:'CORPUS_COMPARISON_LIMIT'});},search(){searches++;return [];},stats(){return {total:1};}};
 const response=await handleApi(request({}),{OPENREEL_CORPUS:corpus});assert.equal(response.status,413);assert.match((await response.json()).error,/narrow/i);assert.equal(searches,0);
});

test('complete comparisons stream rows without sorting their payloads before resource checks',()=>{
 const db=openCorpus(':memory:');try{
  db.upsert(cohort().slice(0,60),{kind:'real',source:'controlled streaming regression'});
  const prepare=db.database.prepare.bind(db.database);let details;
  db.database.prepare=sql=>{
   const statement=prepare(sql);
   if(!sql.endsWith(' LIMIT ?'))return statement;
   return {iterate(...parameters){details=prepare('EXPLAIN QUERY PLAN '+sql).all(...parameters);return statement.iterate(...parameters);}};
  };
  const result=db.momentum('',{asOf:'2024-07-21',windowDays:7});
  assert.equal(result.stats.comparedRecords,60);assert.ok(details?.length);assert.ok(details.every(row=>!/TEMP B-TREE FOR ORDER BY/i.test(row.detail)),'a payload sort can allocate before the scan byte budget runs');
 }finally{db.close();}
});
