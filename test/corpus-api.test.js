import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.js';
const post=(path,body)=>new Request('http://corpus-local.example'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const source={id:'real-one',handle:'maker',caption:'Beauty routine',bio:'UCLA | maker@example.com',email:'maker@example.com',school:'UCLA',followers:2000,url:'https://www.tiktok.com/@maker/video/123',sourceType:'tiktok-creator-embed',fetchedAt:'2026-10-17T00:00:00Z'};
test('free creator collection returns public profile evidence without a paid provider',async()=>{
  const originalFetch=globalThis.fetch;let target;
  globalThis.fetch=async address=>{target=String(address);return new Response('<script id="__FRONTITY_CONNECT_STATE__" type="application/json">'+JSON.stringify({source:{data:{'/embed/@maker':{isReady:true,isError:false,userInfo:{code:200,privateAccount:false,uniqueId:'maker',followerCount:2000,signature:'UCLA | maker@example.com'},videoList:[{id:'123',desc:'Beauty routine',playCount:42,privateItem:false,authorUniqueId:'maker'}]}}}})+'</script>',{headers:{'content-type':'text/html'}});};
  try{
    const response=await handleApi(post('/api/videos/creator',{handle:'maker'}));
    assert.equal(response.status,200);const result=await response.json();
    assert.equal(result.records.length,1);assert.match(target,/^https:\/\/www.tiktok.com\/embed\/@maker$/);
    assert.equal(result.records[0].school,'University of California, Los Angeles');assert.equal(result.records[0].email,'maker@example.com');
    assert.equal(result.records[0].profileEvidence.school.source,'public-bio-self-description');
  }finally{globalThis.fetch=originalFetch;}
});
test('corpus routes report unavailable storage and reject invalid bounds without searching',async()=>{
  assert.equal((await handleApi(post('/api/corpus/search',{query:'beauty'}))).status,503);
  const corpus={search:()=>{throw new Error('must not search');},stats:()=>({real:150001,total:150001})};
  for(const options of [{limit:10001},{offset:-1},{minFollowers:-1},{emailInBio:'yes'}])assert.equal((await handleApi(post('/api/corpus/search',{query:'beauty',...options}),{OPENREEL_CORPUS:corpus})).status,400);
});
test('corpus search uses indexed retrieval and exposes real corpus counts separately',async()=>{
  let searched;const corpus={search:(query,options)=>{searched={query,options};return [source];},stats:()=>({real:150001,total:150001,example:0,synthetic:0,unverified:0})};
  const response=await handleApi(post('/api/corpus/search',{query:'beauty',limit:20,school:'UCLA',emailInBio:true}),{OPENREEL_CORPUS:corpus});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.records[0].id,'real-one');assert.equal(result.corpus.real,150001);assert.equal(searched.options.limit,20);assert.equal(searched.options.kind,'real');assert.equal(searched.options.emailInBio,true);
  const answer=await handleApi(post('/api/chat',{question:'Find beauty creators at UCLA with email in bio',records:[],corpus:true}),{OPENREEL_CORPUS:corpus});
  assert.equal(answer.status,200);const value=await answer.json();assert.equal(value.creators[0].id,'real-one');assert.equal(value.corpus.real,150001);assert.equal(value.stats.totalRecords,1);assert.match(value.notice,/retrieved|subset/i);
});

test('corpus retrieval preserves earlier creator constraints before applying its result limit',async()=>{
  let query;const corpus={search:value=>{query=value;return [source];},stats:()=>({byKind:{real:251},total:251})};
  const response=await handleApi(post('/api/chat',{question:'Only those with public emails',records:[],history:[{role:'user',content:'Find beauty creators at UCLA'}],corpus:true}),{OPENREEL_CORPUS:corpus});
  assert.equal(response.status,200);assert.match(query,/Find beauty creators at UCLA/);assert.match(query,/public emails/);assert.equal((await response.json()).creators[0].id,'real-one');
});

test('corpus bulk ingestion requires the operator token and labels imports as user supplied',async()=>{
  let imported;const corpus={upsert:(records,options)=>{imported={records,options};return {processed:records.length,changed:records.length};},stats:()=>({total:1,byKind:{real:1}})};
  assert.equal((await handleApi(post('/api/corpus/import',{records:[source],source:'archive'}),{OPENREEL_CORPUS:corpus})).status,503);
  const env={OPENREEL_CORPUS:corpus,OPENREEL_API_TOKEN:'operator-token'};
  assert.equal((await handleApi(post('/api/corpus/import',{records:[source],source:'archive'}),env)).status,401);
  const request=post('/api/corpus/import',{records:[source],source:'archive'});request.headers.set('authorization','Bearer operator-token');
  const response=await handleApi(request,env);assert.equal(response.status,200);assert.equal(imported.options.verification,'user-supplied');assert.equal(imported.options.kind,'real');
});
