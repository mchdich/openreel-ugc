import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../public/engine.js';
import {mergeLibrary,normalizeWorkspace} from '../public/workspace.js';
import {handleApi} from '../lib/api.js';
const url='https://www.tiktok.com/@datedcreator/video/123456';
const previous=()=>({id:'tiktok-123456',creatorId:'5000',handle:'@datedcreator',caption:'Coffee caption',url,postedAt:'2024-10-04T00:00:00.000Z',sourceType:'tiktok-public-post',fetchedAt:'2024-10-05T00:00:00.000Z',demo:false,views:1000,followers:1200});
const incoming=()=>({...previous(),postedAt:'',sourceType:'tiktok-creator-embed',fetchedAt:'2024-10-06T00:00:00.000Z',views:0,followers:900,unavailableMetrics:['views']});
const retain=(a,b)=>{assert.equal(typeof engine.retainPostingDate,'function');return engine.retainPostingDate(a,b);};
test('a known primary posting date retains explicit provenance without retaining old analytics or profile fields',()=>{
 const a=previous(),b=incoming(),before=JSON.stringify([a,b]);const kept=retain(a,b);assert.equal(kept.postedAt,a.postedAt);assert.equal(kept.views,0);assert.equal(kept.followers,900);assert.deepEqual(kept.unavailableMetrics,['views']);assert.equal(kept.postingEvidence.sourceType,'tiktok-public-post');assert.equal(kept.postingEvidence.url,url);assert.equal(kept.postingEvidence.observedAt,a.fetchedAt);assert.equal(JSON.stringify([a,b]),before);const normalized=engine.normalizeRecords([kept])[0];assert.deepEqual(normalized.postingEvidence,kept.postingEvidence);
});
test('unknown, fictional, mismatched, nonprimary and conflicting fresh date inputs never borrow unsupported timestamps',()=>{
 const a=previous(),b=incoming();for(const old of [{...a,demo:true},{...a,sourceType:'user-supplied'},{...a,id:'wrong'},{...a,creatorId:'999'},{...a,postedAt:''},{...a,postedAt:'future'},{...a,url:url.replace('123456','999')},{...a,fetchedAt:'invalid'}])assert.equal(retain(old,b).postedAt,'');
 const fresh={...b,postedAt:'2024-10-03T00:00:00.000Z'};assert.equal(retain(a,fresh),fresh);
});
test('posting evidence validates exact source ID, matching timestamp, bounds and shape',()=>{
 const kept=retain(previous(),incoming());for(const change of [{postedAt:'2024-10-03T00:00:00.000Z'},{url:url.replace('123456','999')},{url:'https://evil.example/video/123456'},{sourceType:'invented'},{observedAt:'2020-01-01T00:00:00.000Z'},{extra:'invented'}])assert.throws(()=>engine.normalizeRecords([{...kept,postingEvidence:{...kept.postingEvidence,...change}}]));
});
test('library refresh and saved workspace retain dated evidence while unknown new counts stay unknown',()=>{
 const old=engine.normalizeRecords([previous()]),fresh=engine.normalizeRecords([incoming()]);const merged=mergeLibrary(old,fresh);assert.equal(merged[0].postedAt,old[0].postedAt);assert.equal(merged[0].views,0);assert.ok(merged[0].unavailableMetrics.includes('views'));const restored=normalizeWorkspace({records:merged,conversations:[],bookmarks:[],alerts:[]});assert.deepEqual(restored.records[0].postingEvidence,merged[0].postingEvidence);
});
test('normal acquisition API keeps a prior independently observed date with its original evidence',async()=>{
 const original=globalThis.fetch;let persisted;
 globalThis.fetch=async()=>new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{'/embed/@datedcreator':{isReady:true,isError:false,userInfo:{id:'5000',uniqueId:'datedcreator',code:200,privateAccount:false,signature:'Coffee creator',followerCount:900},videoList:[{id:'123456',desc:'Coffee refreshed',privateItem:false,authorUniqueId:'datedcreator',playCount:10}]}}}})+'</script>',{headers:{'content-type':'text/html'}});
 try{
  for(const verification of ['provider-observed','user-supplied']){
   const corpus={get:async()=>({...previous(),corpusKind:'real',corpusVerification:verification}),upsert:async records=>{persisted=records;}};
   const r=await handleApi(new Request('http://localhost/api/videos/creator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handle:'datedcreator'})}),{OPENREEL_CORPUS:corpus});assert.equal(r.status,200);const body=await r.json();assert.equal(body.records[0].postedAt,verification==='provider-observed'?previous().postedAt:'');assert.equal(persisted[0].postedAt,body.records[0].postedAt);assert.equal(persisted[0].views,10);assert.equal(persisted[0].followers,900);
  }
 }finally{globalThis.fetch=original;}
});

test('posting continuity uses one bounded corpus read instead of one query per incoming record',async()=>{
 const {retainCorpusPostingDates}=await import('../lib/live-post-metadata.js');let reads=0;
 const fresh=Array.from({length:30},(_,i)=>({...incoming(),id:'tiktok-'+(123456+i),url:url.replace('123456',String(123456+i))}));
 const result=await retainCorpusPostingDates(fresh,{get(){assert.fail('Avoid per-record cloud queries');},getMany:async ids=>{reads++;assert.equal(ids.length,30);return [{...previous(),corpusKind:'real',corpusVerification:'provider-observed'}];}});
 assert.equal(reads,1);assert.equal(result[0].postedAt,previous().postedAt);assert.equal(result[29].postedAt,'');
});
