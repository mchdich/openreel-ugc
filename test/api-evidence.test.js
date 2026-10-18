import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.js';
const record={id:'real-source',handle:'@campuscreator',caption:'Beauty morning routine',school:'New York University',bio:'NYU\ncontact@creator.example',email:'contact@creator.example',followers:2000,views:1000,demo:false};
const req=(path,body,host='evidence.example')=>new Request(`https://${host}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
async function withFetch(fn,run){const previous=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=previous;}}
const completion=value=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}));
test('AI insights preserve supplied source links and explicit hypothesis rationale',async()=>{
 const section={heading:'Opening pattern',text:'The supplied caption introduces the routine.',sourceIds:['real-source','real-source'],rationale:{label:'Hypothesis',text:'A concrete opening may make the topic easier to follow.'}};
 await withFetch(async()=>completion({summary:'One supplied example.',sections:[section]}),async()=>{
  const response=await handleApi(req('/api/chat',{question:'Analyze beauty hooks',records:[record]},'localhost'),{OPENAI_API_KEY:'test-only'});
  const value=await response.json();assert.equal(value.mode,'ai');assert.deepEqual(value.sections[0].sourceIds,['real-source']);assert.deepEqual(value.sections[0].rationale,section.rationale);
 });
});
test('invented source IDs and malformed rationale fall back to grounded deterministic sections',async()=>{
 for(const extra of [{sourceIds:['imaginary']},{sourceIds:'real-source'},{rationale:{text:'x'.repeat(2001)}},{rationale:'causal claim'}]){
  await withFetch(async()=>completion({summary:'Grounded prose.',sections:[{heading:'Pattern',text:'Supplied evidence.',...extra}]}),async()=>{
   const response=await handleApi(req('/api/chat',{question:'Analyze beauty hooks',records:[record]},'localhost'),{OPENAI_API_KEY:'test-only'});
   const value=await response.json();assert.equal(value.mode,'deterministic');assert.match(value.notice,/AI reply could not be verified/);assert.doesNotMatch(JSON.stringify(value),/imaginary/);
  });
 }
});
function profile(){return new Response('<script id="__FRONTITY_CONNECT_STATE__">'+JSON.stringify({source:{data:{'/embed/@campuscreator':{isReady:true,isError:false,userInfo:{id:'123',uniqueId:'campuscreator',code:200,privateAccount:false,signature:'NYU\ncontact@creator.example',followerCount:2345},videoList:[{id:'12345678',authorUniqueId:'campuscreator',privateItem:false,desc:'Beauty routine',playCount:123}]}}}})+'</script>',{headers:{'content-type':'text/html'}});}
test('no-key Live route refreshes indexed creators and persists only current provider observations',async()=>{
 let writes,calls=0;
 const corpus={search:async()=>[record],upsert:async(rows,options)=>{writes={rows,options};},stats:async()=>({total:1})};
 await withFetch(async url=>{calls++;assert.equal(url,'https://www.tiktok.com/embed/@campuscreator');return profile();},async()=>{
  const status=await(await handleApi(new Request('https://live-index.example/api/status'),{OPENREEL_CORPUS:corpus})).json();assert.equal(status.indexedDiscoveryAvailable,true);
  const response=await handleApi(req('/api/videos/discover',{query:'Find NYU creators with over 1000 followers and email in bio'},'live-index.example'),{OPENREEL_CORPUS:corpus});
  assert.equal(response.status,200);const value=await response.json();assert.equal(calls,1);assert.equal(value.provider,'indexed-public-profile-refresh');assert.equal(value.records[0].followers,2345);assert.equal(writes.options.verification,'provider-observed');assert.equal(writes.options.source,'tiktok-creator-embed');assert.equal(writes.rows[0].id,'tiktok-12345678');
 });
});
test('Live without provider or corpus gives a configuration error without outbound fetch',async()=>{
 await withFetch(async()=>assert.fail('No configured source must not fetch'),async()=>{
  const response=await handleApi(req('/api/videos/discover',{query:'beauty'},'missing-index.example'));assert.equal(response.status,503);assert.match((await response.json()).error,/corpus|index|APIFY/i);
 });
});

test('research preserves per-source data attribution and labels upstream model evidence',async()=>{
 const archived={...record,id:'tiktok-123456789',handle:'',creatorId:'123',url:'https://www.tiktok.com/player/v1/123456789',visualDescription:'A beauty product demonstration.',descriptionSource:'upstream-model',archiveProvenance:{dataset:'lingbow/tiktok-video-engagement-200k',license:'CC-BY-NC-4.0',sourceUrl:'https://huggingface.co/datasets/lingbow/tiktok-video-engagement-200k',engagementObservedOn:'2024-08-01'}};
 const response=await handleApi(req('/api/chat',{question:'Analyze beauty hooks',records:[archived]},'attribution.example'));const value=await response.json();assert.equal(response.status,200);assert.match(value.notice,/CC-BY-NC-4.0/);assert.match(value.notice,/upstream AI|upstream model/i);assert.equal(value.sources[0].archiveProvenance.engagementObservedOn,'2024-08-01');assert.equal(value.sources[0].handle,'');
});

test('mixed library research identifies fictional evidence rather than presenting it as actual source data',async()=>{
 const rows=[{...record,id:'fictional',demo:true},{...record,id:'actual',demo:false}];const response=await handleApi(req('/api/chat',{question:'Analyze beauty hooks',records:rows},'mixed-evidence.example'));const result=await response.json();assert.match(result.notice,/1.*fictional|fictional.*1/i);assert.match(result.notice,/not.*real|example/i);
});
