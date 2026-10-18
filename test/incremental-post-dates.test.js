import test from 'node:test';
import assert from 'node:assert/strict';
import {openCorpus} from '../lib/corpus.js';
import {enrichPublicPosts,retainCorpusPostingDates} from '../lib/live-post-metadata.js';
import {handleApi} from '../lib/api.js';
const env={OPENREEL_POST_METADATA:'true'};
const rows=(creators=1,count=8)=>Array.from({length:creators},(_,c)=>Array.from({length:count},(_,i)=>({id:`tiktok-${10000+c*100+i}`,handle:`@increment_${c}`,creatorId:String(5000+c),url:`https://www.tiktok.com/@increment_${c}/video/${10000+c*100+i}`,caption:'Coffee preparation',bio:'Coffee creator',followers:1500,views:100,postedAt:'',sourceType:'tiktok-creator-embed',fetchedAt:'2024-10-01T00:00:00.000Z',demo:false}))).flat();
const html=body=>new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:body}}}})+'</script>',{headers:{'content-type':'text/html'}});
const post=(row,caption='Coffee preparation')=>html({id:row.id.slice(7),privateItem:false,createTime:'1728000000',desc:caption,author:{id:row.creatorId,uniqueId:row.handle.slice(1),privateAccount:false,signature:'Lifestyle creator'},authorStats:{followerCount:1500},stats:{playCount:120}});
const profile=rs=>new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{['/embed/'+rs[0].handle]:{isReady:true,isError:false,userInfo:{id:rs[0].creatorId,uniqueId:rs[0].handle.slice(1),code:200,privateAccount:false,signature:'Lifestyle creator',followerCount:1500},videoList:rs.map(r=>({id:r.id.slice(7),desc:r.caption,privateItem:false,authorUniqueId:r.handle.slice(1),playCount:100}))}}}})+'</script>',{headers:{'content-type':'text/html'}});
const request=(query,limit=20)=>new Request('http://localhost/api/videos/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,limit})});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}

test('repeat acquisition dates previously uninspected posts before spending remaining slots on dated posts',async()=>{
 const rs=rows(),db=openCorpus(':memory:'),calls=[];
 try{await withFetch(async url=>{calls.push(url);return post(rs.find(r=>r.url===url));},async()=>{
  const first=await enrichPublicPosts(rs,{...env,OPENREEL_CORPUS:db});await db.upsert(first.records,{kind:'real',source:'controlled acquisition',verification:'provider-observed'});calls.length=0;
  const next=await enrichPublicPosts(rs,{...env,OPENREEL_CORPUS:db});
  assert.deepEqual(calls.slice(0,2),['https://www.tiktok.com/@increment_0/video/10001','https://www.tiktok.com/@increment_0/video/10000']);assert.equal(calls.length,6);
  assert.equal(next.postMetadata.knownDatedCandidates,6);assert.equal(next.postMetadata.selectedUndated,2);assert.equal(next.postMetadata.selectedKnownDated,4);assert.equal(next.observedRecords.length,6);
  await db.upsert(await retainCorpusPostingDates(next.records,db),{kind:'real',source:'controlled acquisition',verification:'provider-observed'});
  assert.equal(db.search('',{kind:'real',uniqueCreators:false,limit:20}).filter(r=>r.postedAt).length,8);
 });}finally{db.close();}
});

test('creator-deduplicated API results retain every already inspected date in the real corpus',async()=>{
 const rs=rows(),db=openCorpus(':memory:');db.upsert([rs[0]],{kind:'real',source:'controlled seed',verification:'provider-observed'});
 const calls=[];
 try{await withFetch(async url=>{calls.push(url);return url.includes('/embed/')?profile(rs):post(rs.find(r=>r.url===url));},async()=>{
  for(const expected of [6,8]){const r=await handleApi(request('Find coffee creators'),{...env,OPENREEL_CORPUS:db});assert.equal(r.status,200);const body=await r.json();assert.equal(body.records.length,1);assert.equal(body.observedRecords,undefined);assert.equal(body.indexing.inspected,6);assert.equal(body.indexing.additionalInspected,5);assert.equal(db.search('',{kind:'real',uniqueCreators:false,limit:20}).filter(r=>r.postedAt).length,expected);}
  assert.equal(calls.filter(u=>u.includes('/video/')).length,12);assert.deepEqual(calls.slice(8,10).map(u=>u.split('/').at(-1)),['10001','10000']);
 });}finally{db.close();}
});

test('filtered result rows stay eligible while additional inspected observations persist within the36-row bound',async()=>{
 const rs=rows(3,20),db=openCorpus(':memory:');db.upsert(rs.filter((_,i)=>i%20===0),{kind:'real',source:'controlled seed',verification:'provider-observed'});
 try{await withFetch(async url=>url.includes('/embed/')?profile(rs.filter(r=>r.handle===new URL(url).pathname.split('/').at(-1))):post(rs.find(r=>r.url===url),'Tea preparation'),async()=>{
  const r=await handleApi(request('Find coffee videos across creators',30),{...env,OPENREEL_CORPUS:db});assert.equal(r.status,200);const body=await r.json();assert.equal(body.records.length,30);assert.ok(body.records.every(r=>r.caption==='Coffee preparation'));assert.equal(body.observedRecords,undefined);assert.equal(body.indexing.processed,36);assert.equal(body.indexing.additionalInspected,6);assert.equal(db.search('tea',{kind:'real',uniqueCreators:false,limit:100}).length,6);
 });}finally{db.close();}
});

test('coverage lookups chunk120 confirmed candidates into three native-compatible bulk reads',async()=>{
 const rs=rows(6,20),db=openCorpus(':memory:');let reads=0;
 try{await withFetch(async url=>post(rs.find(r=>r.url===url)),async()=>{
  const corpus={getMany(ids){reads++;assert.ok(ids.length<=40);return db.getMany(ids);}};
  const found=await enrichPublicPosts(rs,{...env,OPENREEL_CORPUS:corpus});assert.equal(reads,3);assert.equal(found.postMetadata.checked,6);assert.equal(found.postMetadata.selectedUndated,6);
 });}finally{db.close();}
});

test('disabled and skipped phases never read coverage or fetch pages, and failed reads do not trigger acquisition',async()=>{
 const rs=rows();await withFetch(async()=>assert.fail('Unexpected page request'),async()=>{
  const corpus={getMany(){assert.fail('Unexpected coverage read');}};await enrichPublicPosts(rs,{OPENREEL_CORPUS:corpus});await enrichPublicPosts(rs,{...env,OPENREEL_CORPUS:corpus},{skip:true});
  await assert.rejects(enrichPublicPosts(rs,{...env,OPENREEL_CORPUS:{getMany(){throw Error('database-secret');}}}),e=>e.status===503&&e.code==='POST_COVERAGE_UNAVAILABLE'&&!e.message.includes('secret'));
 });
});

test('only independently observed exact-source dates confer known-date sampling priority',async()=>{
 const rs=rows(),calls=[];const dated=r=>({...r,postedAt:'2024-10-04T00:00:00.000Z',sourceType:'tiktok-public-post',fetchedAt:'2024-10-05T00:00:00.000Z',corpusKind:'real',corpusVerification:'provider-observed'});
 await withFetch(async url=>{calls.push(url);return post(rs.find(r=>r.url===url));},async()=>{
  const known=[dated(rs[7]),{...dated(rs[6]),corpusVerification:'user-supplied'},{...dated(rs[5]),creatorId:'different'},{...dated(rs[4]),sourceType:'archive'}];
  const result=await enrichPublicPosts(rs,{...env,OPENREEL_CORPUS:{getMany:async()=>known}});assert.equal(result.postMetadata.knownDatedCandidates,1);assert.ok(!calls.some(u=>u.endsWith('10007')));assert.deepEqual(calls.map(u=>u.split('/').at(-1)),['10006','10005','10004','10003','10002','10001']);
 });
});

test('get-only custom adapters keep compatible sampling without a per-candidate coverage fanout',async()=>{
 const rs=rows(),calls=[];await withFetch(async url=>{calls.push(url);return post(rs.find(r=>r.url===url));},async()=>{
  const result=await enrichPublicPosts(rs,{...env,OPENREEL_CORPUS:{get(){assert.fail('Selection requires bounded bulk lookup support');}}});assert.equal(result.postMetadata.knownDatedCandidates,0);assert.equal(result.postMetadata.checked,6);assert.equal(calls[0],'https://www.tiktok.com/@increment_0/video/10007');
 });
});
