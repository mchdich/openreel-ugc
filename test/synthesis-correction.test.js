import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.js';
const record={id:'source-a',handle:'@known',caption:'Cooking recipe',followers:1000,views:100};
const request=()=>new Request('http://localhost/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Analyze cooking hooks',records:[record]})});
const env={OPENAI_API_KEY:'controlled-placeholder'};
const valid={summary:'One supplied cooking example; try a result-first opening.',sections:[{heading:'Proposed opening',text:'Try showing the dish first.',sourceIds:['source-a']}]};
const reply=value=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));
test('one completed invalid synthesis reply is corrected using the same deadline and unchanged sources',async()=>{
 const old=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push(options);return reply(calls.length===1?{...valid,sections:[{heading:'Wrong citation',text:'Unverified',sourceIds:['absent']}] }:valid);};
 try{const r=await(await handleApi(request(),env)).json();assert.equal(r.mode,'ai');assert.equal(r.summary,valid.summary);assert.equal(calls.length,2);assert.equal(calls[0].signal,calls[1].signal);assert.match(JSON.parse(calls[1].body).messages[0].content,/correction/i);assert.deepEqual(r.sources.map(s=>s.id),['source-a']);assert.doesNotMatch(JSON.stringify(r),/Wrong citation|absent/);}finally{globalThis.fetch=old;}
});
test('two completed invalid replies fall back without leaking either hallucinated contact',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return reply({...valid,summary:'Contact invented@elsewhere.example'});};
 try{const r=await(await handleApi(request(),env)).json();assert.equal(calls,2);assert.equal(r.mode,'deterministic');assert.match(r.notice,/could not be verified/);assert.doesNotMatch(JSON.stringify(r),/invented@/);}finally{globalThis.fetch=old;}
});
test('provider and body transport outages make one call; delivered malformed JSON can be corrected',async()=>{
 const old=globalThis.fetch;
 try{for(const broken of [()=>new Response('private error',{status:502}),()=>new Response(new ReadableStream({start(c){c.error(new TypeError('private transport'));}}))]){let calls=0;globalThis.fetch=async()=>{calls++;return broken();};const r=await(await handleApi(request(),env)).json();assert.equal(calls,1);assert.equal(r.mode,'deterministic');assert.match(r.notice,/provider is unavailable/);assert.doesNotMatch(JSON.stringify(r),/private transport|private error/);}
 let calls=0;globalThis.fetch=async()=>++calls===1?new Response('{"choices":'):reply(valid);const recovered=await(await handleApi(request(),env)).json();assert.equal(calls,2);assert.equal(recovered.mode,'ai');
 }finally{globalThis.fetch=old;}
});
test('an exhausted original deadline cannot start a correction request',async()=>{
 const oldFetch=globalThis.fetch,oldTimeout=AbortSignal.timeout,controller=new AbortController();let calls=0;AbortSignal.timeout=()=>controller.signal;globalThis.fetch=async()=>{calls++;controller.abort();return reply({...valid,summary:'invented@elsewhere.example'});};
 try{const r=await(await handleApi(request(),env)).json();assert.equal(calls,1);assert.equal(r.mode,'deterministic');}finally{globalThis.fetch=oldFetch;AbortSignal.timeout=oldTimeout;}
});

test('a numeric creator ID cannot become an invented handle, including during correction',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return reply(calls===1?{...valid,summary:'The creator is @123456789012.'}:valid);};
 try{const body={question:'Analyze cooking hooks',records:[{...record,handle:'',creatorId:'123456789012'}]},req=new Request('http://localhost/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await(await handleApi(req,env)).json();assert.equal(calls,2);assert.equal(result.mode,'ai');assert.equal(result.sources[0].handle,'');assert.equal(result.sources[0].creatorId,'123456789012');assert.doesNotMatch(JSON.stringify(result),/@123456789012/);}finally{globalThis.fetch=old;}
});
