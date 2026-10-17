import test from 'node:test';
import assert from 'node:assert/strict';

import {discoverIndexedVideos as discover} from '../lib/live.js';
const query='Find NYU creators with at least 1,000 followers and email in bio';
const seed=handle=>Object.freeze({id:'stale-'+handle,handle:'@'+handle,caption:'Old NYU skincare caption',school:'New York University',followers:9000,email:'old@creator.example',bio:'NYU\nold@creator.example',demo:false});
const corpus=rows=>({search:async()=>rows,upsert:()=>{throw new Error('Live acquisition must not overwrite the corpus.');}});
function profile(handle,{bio='NYU\ncurrent@creator.example',followers=1200,count=2,base=1000,privateAccount=false}={}){
 const node={isFetching:false,isReady:true,route:'/embed/@:uniqueId',link:'/embed/@'+handle,query:{},page:1,
  userInfo:{id:String(base),uniqueId:handle,verified:false,followingCount:20,followerCount:followers,heartCount:5000,signature:bio,privateAccount,nickname:handle,avatarThumbUrl:'https://p16-common-sign.tiktokcdn-us.com/avatar.jpeg',code:200,customErrorCode:0},
  videoList:Array.from({length:count},(_,i)=>({id:String(base+i),desc:'Current skincare caption mentioning NYU',height:1280,width:720,ratio:'720p',coverUrl:'https://p16-common-sign.tiktokcdn-us.com/cover.jpeg',originCoverUrl:'',dynamicCoverUrl:'',playAddr:'https://media.example/never-download.mp4',playCount:100+i,privateItem:false,authorUniqueId:handle})),
  isError:false,pageName:'creator-profile',playlistType:null,playlistId:null};
 return new Response('<!doctype html><script id="__FRONTITY_CONNECT_STATE__" type="application/json">'+JSON.stringify({source:{data:{['/embed/@'+handle]:node}}})+'</script>',{headers:{'content-type':'text/html'}});
}
async function withFetch(fn,run){const original=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=original;}}

test('live query refreshes indexed handles through official GET and returns only current compound matches',async()=>{
 const old=seed('campuscreator');
 const index={...corpus([old]),search:async(text,options)=>{assert.equal(text,'');assert.deepEqual(options,{kind:'real',uniqueCreators:true,knownHandlesOnly:true,limit:3,school:'NYU'});return [old];}};
 await withFetch(async(url,options)=>{
  assert.equal(url,'https://www.tiktok.com/embed/@campuscreator');
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,undefined);
  return profile('campuscreator');
 },async()=>{
  const result=await discover(query,{},index);
  assert.equal(result.provider,'indexed-public-profile-refresh');assert.equal(result.creatorsRefreshed,1);
  assert.equal(result.records.length,1);assert.equal(result.records[0].followers,1200);
  assert.equal(result.records[0].email,'current@creator.example');assert.equal(result.records[0].sourceType,'tiktok-creator-embed');
  assert.equal(result.records[0].caption,'Current skincare caption mentioning NYU');
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));assert.match(result.notice,/seed index|indexed creators/i);
  assert.doesNotMatch(JSON.stringify(result),/never-download|old@creator/);
  assert.equal(old.followers,9000);
 });
});

test('stale indexed university claims cannot survive an official current bio refresh',async()=>{
 await withFetch(async()=>profile('formerstudent',{bio:'Skincare creator\ncurrent@creator.example'}),async()=>{
  const result=await discover(query,{},corpus([seed('formerstudent')]));
  assert.equal(result.records.length,0);assert.equal(result.creatorsRefreshed,1);
 });
});

test('current missing followers or missing public bio email fail their compound constraints',async()=>{
 for(const options of [{followers:null},{followers:999},{bio:'NYU\nno public email'}]){
  await withFetch(async()=>profile('campuscreator',options),async()=>{
   const result=await discover(query,{},corpus([seed('campuscreator')]));assert.deepEqual(result.records,[]);
  });
 }
});

test('refreshes at most three distinct handles sequentially and caps actual video output at thirty',async()=>{
 let active=0,maximum=0;const calls=[];
 await withFetch(async(url)=>{
  active++;maximum=Math.max(maximum,active);calls.push(url);
  await new Promise(resolve=>setTimeout(resolve,2));active--;
  const handle=url.split('@')[1];return profile(handle,{count:20,base:1000*calls.length});
 },async()=>{
  const result=await discover('skincare',{limit:999,maxCreators:999},corpus(['first','first','second','third','fourth'].map(seed)));
  assert.equal(result.creatorsRefreshed,3);assert.equal(result.records.length,30);assert.equal(maximum,1);
  assert.deepEqual(calls,['https://www.tiktok.com/embed/@first','https://www.tiktok.com/embed/@second','https://www.tiktok.com/embed/@third']);
  assert.equal(new Set(result.records.map(row=>row.id)).size,30);
 });
});

test('requested smaller output and creator limits bound actual acquisition',async()=>{
 let calls=0;
 await withFetch(async()=>{calls++;return profile('first',{count:10});},async()=>{
  const result=await discover('skincare',{limit:2,maxCreators:1},corpus(['first','second'].map(seed)));
  assert.equal(result.records.length,2);assert.equal(result.creatorsRefreshed,1);assert.equal(calls,1);
 });
});

test('an empty seed index makes no external request and states its coverage limit',async()=>{
 await withFetch(async()=>{throw new Error('Unexpected external request');},async()=>{
  const result=await discover('a topic outside the index',{},corpus([]));
  assert.deepEqual(result.records,[]);assert.equal(result.creatorsRefreshed,0);assert.match(result.notice,/seed index|indexed creators/i);
 });
});

test('private profiles return no stale cached records',async()=>{
 await withFetch(async()=>profile('campuscreator',{privateAccount:true}),async()=>{
  const result=await discover(query,{},corpus([seed('campuscreator')]));
  assert.deepEqual(result.records,[]);assert.equal(result.creatorsRefreshed,0);assert.match(result.notice,/unavailable/i);
 });
});

test('provider barriers fail without retry, stale fallback, or provider error leakage',async()=>{
 let calls=0;
 await withFetch(async()=>{calls++;return new Response('secret provider debug token',{status:403});},async()=>{
  await assert.rejects(()=>discover(query,{},corpus(['first','second'].map(seed))),error=>error.status===502&&error.code==='CREATOR_UNAVAILABLE'&&!/secret|debug|token/.test(error.message));
  assert.equal(calls,1);
 });
});

test('invalid requests and a missing index fail before any external request',async()=>{
 await withFetch(async()=>{throw new Error('Unexpected external request');},async()=>{
  for(const value of ['',null,'x'.repeat(1001)])await assert.rejects(()=>discover(value,{},corpus([])),error=>error.status===400);
  for(const options of [null,[],{limit:0},{limit:1.5},{maxCreators:0},{maxCreators:1.5}])await assert.rejects(()=>discover('skincare',options,corpus([])),error=>error.status===400);
  await assert.rejects(()=>discover('skincare'),error=>error.status===503&&error.code==='LIVE_INDEX_UNAVAILABLE');
 });
});

test('volatile cached follower and contact values never prevent a bounded current refresh',async()=>{
 const {openCorpus}=await import('../lib/corpus.js');
 const db=openCorpus(':memory:');let calls=0;
 try{
  db.upsert([{...seed('campuscreator'),id:'tiktok-1000',url:'https://www.tiktok.com/@campuscreator/video/1000',followers:999,email:'',bio:'NYU',sourceType:'tiktok-creator-embed',fetchedAt:'2026-10-01T00:00:00Z'}],{kind:'real',source:'earlier-public-snapshot'});
  await withFetch(async()=>{calls++;return profile('campuscreator',{followers:1200});},async()=>{
   const result=await discover(query,{},db);assert.equal(calls,1);assert.equal(result.records.length,1);assert.equal(result.records[0].followers,1200);
  });
 }finally{db.close();}
});

test('numeric-only seed matches cannot hide a later known username from bounded live refresh',async()=>{
 const {openCorpus}=await import('../lib/corpus.js');const db=openCorpus(':memory:');const calls=[];
 try{
  db.upsert([
   ...[1001,1002,1003].map((id,i)=>({id:`tiktok-${id}`,handle:'',creatorId:String(900+i),url:`https://www.tiktok.com/player/v1/${id}`,caption:'skincare',sourceType:'public-archive',fetchedAt:'2026-10-01T00:00:00Z'})),
   {...seed('campuscreator'),id:'z-named',creatorId:'999',url:'https://www.tiktok.com/@campuscreator/video/1004',caption:'skincare',sourceType:'tiktok-creator-embed',fetchedAt:'2026-10-01T00:00:00Z'}
  ],{kind:'real'});
  assert.equal(db.search('skincare',{uniqueCreators:true,limit:1})[0].handle,'');
  await withFetch(async url=>{calls.push(url);return profile('campuscreator');},async()=>{
   const found=await discover('skincare',{maxCreators:1},db);
   assert.deepEqual(calls,['https://www.tiktok.com/embed/@campuscreator']);assert.equal(found.creatorsRefreshed,1);assert.equal(found.records.length,2);assert.ok(found.records.every(r=>r.handle==='@campuscreator'));
  });
 }finally{db.close();}
});
