import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecords} from '../public/engine.js';
import {handleApi} from '../lib/api.js';
const module=await import('../lib/visual-patterns.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const detect=(...args)=>{assert.equal(typeof module.detectVisualPatterns,'function');return module.detectVisualPatterns(...args);};
const sentence='The video shows a split-screen layout with two people beside one another. A date sticker appears at the bottom of both scenes.';
const rows=()=>normalizeRecords([1,2].map(i=>({id:'source-'+i,creatorId:String(100+i),caption:'Source clip',visualDescription:sentence,descriptionSource:'upstream-model',demo:false})));
const proposal={title:'Split-screen clips with on-screen date labels',description:'Paired scenes share a split-screen layout and visible date stickers.',components:[{featureId:'split-screen',label:'Split-screen paired layout',evidence:[1,2].map(i=>({recordId:'source-'+i,quote:'The video shows a split-screen layout with two people beside one another.'}))},{featureId:'date-overlay',label:'A visible date sticker',evidence:[1,2].map(i=>({recordId:'source-'+i,quote:'A date sticker appears at the bottom of both scenes.'}))}]};
const env={OPENAI_API_KEY:'provider-test-secret',OPENAI_MODEL:'gpt-5.4-mini'};
const response=(body)=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
const completion=(patterns=[proposal],review=false)=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({patterns:review?patterns.map((p,i)=>({patternIndex:i,...p})):patterns}),refusal:null}}]});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}
const request=(body,headers={},host='http://localhost')=>new Request(host+'/api/corpus/visual-patterns',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});

test('bounded generation and conservative review uses attributed descriptions and returns only grounded proposals',async()=>{
 let calls=0;await withFetch(async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(init.redirect,'error');const body=JSON.parse(init.body);assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);assert.ok(body.max_completion_tokens<=6000);const context=JSON.parse(body.messages.at(-1).content);assert.equal(context.sources.length,2);assert.equal(context.sources[0].descriptionSource,'upstream-model');assert.ok(!('transcript' in context.sources[0]));return response(completion([proposal],body.response_format.json_schema.name==='visual_pattern_review'));},async()=>{
  const result=await detect(rows(),'split screen',env);assert.equal(result.patterns.length,1);assert.equal(result.analyzedRecords,2);assert.equal(calls,2);assert.doesNotMatch(JSON.stringify(result),/provider-test-secret/);
 });
});

test('description context is capped at sixty distinct creator identities and 1800 characters each',async()=>{
 const many=normalizeRecords(Array.from({length:100},(_,i)=>({id:'source-'+i,creatorId:String(100+i),visualDescription:sentence.repeat(20),descriptionSource:'upstream-model',demo:false})));
 await withFetch(async(url,init)=>{const sources=JSON.parse(JSON.parse(init.body).messages.at(-1).content).sources;assert.equal(sources.length,60);assert.ok(sources.every(r=>r.visualDescription.length<=1800));return response(completion([]));},async()=>{const result=await detect(many,'',env);assert.equal(result.analyzedRecords,60);assert.deepEqual(result.patterns,[]);});
});

test('missing providers and insufficient attributed independent descriptions make no model call',async()=>{
 await withFetch(async()=>assert.fail('Unexpected paid call'),async()=>{
  await assert.rejects(detect(rows(),'split screen',{}),e=>e.status===503);
  for(const records of [[],rows().slice(0,1),rows().map(r=>({...r,descriptionSource:''})),rows().map(r=>({...r,creatorId:'100'}))]){
   const result=await detect(records,'',env);assert.deepEqual(result.patterns,[]);assert.equal(result.analyzedRecords<2,true);
  }
 });
});

test('refusals, truncation, invalid output, upstream errors, timeouts and oversized streams never substitute patterns',async()=>{
 const bad=completion();bad.choices[0].finish_reason='length';const refusal=completion();refusal.choices[0].message.refusal='Refused';
 for(const fn of [()=>response(bad),()=>response(refusal),()=>response({choices:[]}),()=>new Response('provider-test-secret',{status:429}),()=>{throw new DOMException('provider-test-secret','TimeoutError');},()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(70000));c.close();}}),{headers:{'content-type':'application/json'}})]){
  let calls=0;await withFetch(async()=>{calls++;return fn();},async()=>{await assert.rejects(detect(rows(),'split screen',env),e=>e.status>=500&&!e.message.includes('provider-test-secret'));assert.equal(calls,1);});
 }
});

test('public detection validates bearer and origin before corpus reads or paid requests',async()=>{
 const settings={...env,OPENREEL_API_TOKEN:'owner-token',OPENREEL_CORPUS:{search(){assert.fail('Unexpected corpus read');}}};
 await withFetch(async()=>assert.fail('Unexpected paid request'),async()=>{
  assert.equal((await handleApi(request({query:''},{},'https://public.example'),settings)).status,401);
  assert.equal((await handleApi(request({query:''},{authorization:'Bearer owner-token',origin:'https://foreign.example'},'https://public.example'),settings)).status,403);
 });
});

test('the API returns grounded pattern records and selection provenance without corpus writes',async()=>{
 const corpus={search:async()=>rows(),stats:async()=>({total:2,byKind:{real:2}}),upsert(){assert.fail('Pattern detection must not write derived labels to records');}};
 await withFetch(async(url,init)=>response(completion([proposal],JSON.parse(init.body).response_format.json_schema.name==='visual_pattern_review')),async()=>{
  const result=await handleApi(request({query:'split screen'}),{...env,OPENREEL_CORPUS:corpus});assert.equal(result.status,200);const body=await result.json();assert.equal(body.patterns.length,1);assert.equal(body.records.length,2);assert.equal(body.selection.method,'query');assert.equal(body.corpus.total,2);assert.equal(body.analyzedRecords,2);assert.ok(body.records.every(r=>r.format===''));
 });
});


test('unsupported initial wording is replaced only by a grounded independent adjudication with the same deadline',async()=>{
 const initial={...proposal,title:'Split-screen duets with people facing the camera'};let calls=0,firstSignal;
 await withFetch(async(url,init)=>{calls++;if(calls===1){firstSignal=init.signal;return response(completion([initial]));}assert.equal(init.signal,firstSignal);const body=JSON.parse(init.body);assert.equal(body.response_format.json_schema.name,'visual_pattern_review');return response(completion([proposal],true));},async()=>{const result=await detect(rows(),'split screen',env);assert.equal(result.patterns[0].format,proposal.title);assert.equal(result.modelCalls,2);assert.equal(calls,2);});
});

test('adjudication cannot introduce new source IDs or silently fall back to first-pass patterns',async()=>{
 const outsider={...proposal,components:proposal.components.map(c=>({...c,evidence:[...c.evidence.slice(0,1),{recordId:'outside',quote:c.evidence[0].quote}]}))};
 for(const reply of [completion([outsider],true),completion(),{choices:[{finish_reason:'length',message:{content:'{}'}}]}]){let calls=0;await withFetch(async()=>response(++calls===1?completion():reply),async()=>{await assert.rejects(detect(rows(),'',env),e=>e.status>=500);assert.equal(calls,2);});}
});
