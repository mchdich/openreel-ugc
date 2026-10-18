import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverIndexedVideos} from '../lib/live.js';
import {discoverWebCreators} from '../lib/web-discovery.js';
import {handleApi} from '../lib/api.js';
const env={OPENREEL_POST_METADATA:'true'};
const json=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
const profile=(handle,base)=>new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{['/embed/@'+handle]:{isReady:true,isError:false,userInfo:{code:200,id:String(base),uniqueId:handle,privateAccount:false,signature:'NYU\nCoffee creator\ncontact@creator.example',followerCount:1500},videoList:[0,1].map(i=>({id:String(base+i),desc:'Coffee preparation',privateItem:false,authorUniqueId:handle,playCount:100}))}}}})+'</script>',{headers:{'content-type':'text/html'}});
const page=(url,bio='NYU\nCoffee creator\nupdated@creator.example',followers=1400)=>{const [handle,id]=new URL(url).pathname.match(/^\/@([^/]+)\/video\/(\d+)$/).slice(1);return new Response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:{id,privateItem:false,createTime:'1728000000',desc:'Fresh coffee preparation',author:{id:handle==='seed'?'1000':'2000',uniqueId:handle,privateAccount:false,signature:bio},authorStats:{followerCount:followers},stats:{playCount:120}}}}}})+'</script>',{headers:{'content-type':'text/html'}});};
const index={search:async()=>[{handle:'@seed',demo:false}]};
const web={...env,OPENREEL_WEB_DISCOVERY:'true',OPENAI_API_KEY:'provider-test-secret',OPENAI_MODEL:'gpt-5.4-mini'};
const proposal=()=>json({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://creator.example/other'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:[{handle:'other',sourceUrl:'https://creator.example/other'}]})}]}]});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}

test('current trend wording does not become acquisition topic terms, while supplied dates remain actual',async()=>{
 let seedQuery,calls=0;await withFetch(async url=>{calls++;return url.includes('/embed/')?profile('seed',1000):page(url);},async()=>{
  const result=await discoverIndexedVideos('What coffee formats are trending this week?',{}, {search:async(query)=>{seedQuery=query;return [{handle:'@seed',demo:false}];}},env);
  assert.equal(seedQuery,'coffee');assert.equal(result.records.length,2);assert.equal(result.postMetadata.dated,2);assert.ok(result.records.every(r=>r.sourceType==='tiktok-public-post'&&r.postedAt==='2024-10-04T00:00:00.000Z'));assert.equal(calls,3);
 });
});
test('fresh post profile fields must still satisfy every compound constraint after enrichment',async()=>{
 for(const [bio,followers] of [['UCLA\nCoffee creator\nupdated@creator.example',1400],['NYU\nCoffee creator',1400],['NYU\nCoffee creator\nupdated@creator.example',999]])await withFetch(async url=>url.includes('/embed/')?profile('seed',1000):page(url,bio,followers),async()=>{
  const result=await discoverIndexedVideos('Find coffee creators at NYU with at least 1000 followers and email in bio',{},index,env);assert.equal(result.postMetadata.enriched,2);assert.deepEqual(result.records,[]);
 });
});
test('web profile verification precedes bounded post reads, and returned creator rows carry inspected metadata',async()=>{
 const calls=[];await withFetch(async url=>{calls.push(url);if(url.endsWith('/responses'))return proposal();if(url.includes('/embed/'))return profile(url.endsWith('@seed')?'seed':'other',url.endsWith('@seed')?1000:2000);return page(url);},async()=>{
  const result=await discoverWebCreators('Find coffee creators',{},web,index);assert.equal(result.postMetadata.checked,4);assert.equal(result.records.length,2);assert.ok(result.records.every(r=>r.sourceType==='tiktok-public-post'&&r.email==='updated@creator.example'));assert.ok(calls.findIndex(u=>u.includes('/video/'))>calls.findIndex(u=>u.endsWith('@other')));assert.doesNotMatch(result.notice,/posting dates are unavailable\./);
 });
});
test('no public post calls follow a failed official-profile batch',async()=>{
 const calls=[];await withFetch(async url=>{calls.push(url);if(url.endsWith('/responses'))return proposal();if(url.endsWith('@failed'))return new Response('upstream-secret',{status:403});if(url.includes('/embed/'))return profile('seed',1000);assert.fail('No post calls after a failed profile batch');},async()=>{
  const result=await discoverWebCreators('Find coffee creators',{},web,{search:async()=>[{handle:'@seed'},{handle:'@failed'}]});assert.equal(result.postMetadata.checked,0);assert.equal(result.incomplete,true);assert.equal(result.records.length,1);assert.match(result.notice,/not requested after a profile/);assert.ok(!calls.some(u=>u.endsWith('@other')));
 });
});
test('normal creator API and status expose metadata acquisition with actual persisted provenance',async()=>{
 let saved;await withFetch(async url=>url.includes('/embed/')?profile('seed',1000):page(url),async()=>{
  const status=await handleApi(new Request('http://localhost/api/status'),env);assert.equal((await status.json()).postMetadataConfigured,true);
  const r=await handleApi(new Request('http://localhost/api/videos/creator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handle:'seed'})}),{...env,OPENREEL_CORPUS:{upsert:async(records,meta)=>{saved={records,meta};}}});assert.equal(r.status,200);const body=await r.json();assert.equal(body.postMetadata.enriched,2);assert.equal(saved.meta.source,'tiktok-public-profile-and-post');assert.ok(saved.records.every(r=>r.sourceType==='tiktok-public-post'&&r.postedAt));
 });
});

test('video and dated-format research across creators retains multiple inspected clips per creator',async()=>{
 await withFetch(async url=>url.includes('/embed/')?profile('seed',1000):page(url),async()=>{
  const result=await discoverIndexedVideos('What coffee formats are emerging across creators as of 2024-10-10 over 7 days?',{},index,env);assert.equal(result.records.length,2);assert.equal(result.postMetadata.dated,2);
 });
});
