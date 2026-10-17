import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {handleApi} from '../lib/api.js';
import * as engine from '../public/engine.js';
import * as workspace from '../public/workspace.js';

const record={id:'budget-source',handle:'@budget',caption:'Beauty morning routine',followers:10000,views:1000};
let client=0;
const request=(body,headers={})=>new Request('http://localhost/api/chat',{method:'POST',headers:{'content-type':'application/json','x-openreel-client-ip':`chat-budget-${client++}`,...headers},body:JSON.stringify(body)});
const chat={question:'Find beauty creators',records:[record]};
const providerReply=()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'One supplied beauty creator.',sections:[]})}}]}),{headers:{'content-type':'application/json'}});

test('chat status publishes only the bounded public deadline needed by the browser',async()=>{
  for(const [configured,want] of [[undefined,25000],['10000',10000],['90000',90000],['180000',180000]]){
    const env={OPENAI_API_KEY:'private-key',OPENAI_BASE_URL:'http://localhost:9000/private-base',OPENAI_MODEL:'private-model',...(configured===undefined?{}:{OPENREEL_CHAT_TIMEOUT_MS:configured})};
    const response=await handleApi(new Request('http://localhost/api/status'),env);
    assert.equal(response.status,200);
    const status=await response.json();
    assert.equal(status.providerConfigured,true);
    assert.equal(status.chatRequestTimeoutMs,want);
    assert.doesNotMatch(JSON.stringify(status),/private-key|private-base|private-model/);
  }
});

test('configured chat supplies its validated deadline to the actual provider request',async t=>{
  const budgets=[],signals=[];
  t.mock.method(AbortSignal,'timeout',milliseconds=>{budgets.push(milliseconds);const signal=new AbortController().signal;signals.push(signal);return signal;});
  let calls=0;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{assert.equal(init.signal,signals.at(-1));calls++;return providerReply();});
  for(const [configured,want] of [[undefined,25000],['10000',10000],['90000',90000],['180000',180000]]){
    const response=await handleApi(request(chat),{OPENAI_API_KEY:'private-key',...(configured===undefined?{}:{OPENREEL_CHAT_TIMEOUT_MS:configured})});
    assert.equal(response.status,200);
    const value=await response.json();
    assert.equal(value.mode,'ai');
    assert.equal(value.sources[0].id,'budget-source');
    assert.equal(value.sources[0].views,1000);
    assert.equal(budgets.at(-1),want);
  }
  assert.equal(calls,4);
});

test('invalid configured deadlines fail before a model request and never echo their value',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return providerReply();});
  for(const value of ['',null,'0','9999','180001','25000.5','NaN','Infinity','private-timeout-secret']){
    const env={OPENAI_API_KEY:'private-key',OPENREEL_CHAT_TIMEOUT_MS:value};
    for(const req of [new Request('http://localhost/api/status'),request(chat)]){
      const response=await handleApi(req,env);
      assert.equal(response.status,503,`invalid deadline ${String(value)}`);
      const output=JSON.stringify(await response.json());
      assert.match(output,/whole number.*10000.*180000/);
      assert.doesNotMatch(output,/private-timeout-secret|private-key/);
    }
  }
  assert.equal(calls,0);
});

test('unused invalid chat deadlines leave deterministic, empty and dated research available',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('No provider request expected');});
  const env={OPENAI_API_KEY:'private-key',OPENREEL_CHAT_TIMEOUT_MS:'invalid'};
  for(const body of [{...chat,mode:'deterministic'},{question:'Find beauty creators',records:[]},{question:'What skincare formats are gaining share as of 2024-07-21 over 7 days?',records:[]}]){
    const response=await handleApi(request(body),env);
    assert.equal(response.status,200);assert.equal((await response.json()).mode,'deterministic');
  }
  const response=await handleApi(request(chat),{OPENREEL_CHAT_TIMEOUT_MS:'invalid'});
  assert.equal(response.status,200);assert.equal((await response.json()).mode,'deterministic');
  const status=await(await handleApi(new Request('http://localhost/api/status'),{OPENREEL_CHAT_TIMEOUT_MS:'invalid'})).json();
  assert.equal(status.providerConfigured,false);assert.equal(status.chatRequestTimeoutMs,25000);
  assert.equal(calls,0);
});

test('a slow configured provider falls back to the actual deterministic answer without leaking errors',async t=>{
  const baseline=await(await handleApi(request({...chat,mode:'deterministic'}))).json();
  t.mock.method(globalThis,'fetch',async()=>{throw new DOMException('private-key timeout stack','TimeoutError');});
  const response=await handleApi(request(chat),{OPENAI_API_KEY:'private-key',OPENREEL_CHAT_TIMEOUT_MS:'180000'});
  assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.mode,'deterministic');assert.equal(result.summary,baseline.summary);assert.deepEqual(result.sources,baseline.sources);
  assert.match(result.notice,/provider is unavailable.*deterministic research/i);
  assert.doesNotMatch(JSON.stringify(result),/private-key|timeout stack|One supplied beauty creator/);
});

test('configured long deadlines preserve public bearer and origin checks before provider work',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return providerReply();});
  const env={OPENAI_API_KEY:'private-key',OPENREEL_API_TOKEN:'app-token',OPENREEL_LOCAL_REQUEST:false,OPENREEL_CHAT_TIMEOUT_MS:'180000'};
  assert.equal((await handleApi(request(chat),env)).status,401);
  assert.equal((await handleApi(request(chat,{authorization:'Bearer wrong'}),env)).status,401);
  assert.equal((await handleApi(request(chat,{authorization:'Bearer app-token',origin:'https://attacker.example'}),env)).status,403);
  assert.equal(calls,0);
  assert.equal((await handleApi(request(chat,{authorization:'Bearer app-token'}),env)).status,200);
  assert.equal(calls,1);
});

// Run the client itself with a minimal DOM and fake network/timers. The deadline
// is observed at setTimeout, without waiting or copying its calculation here.
const appSource=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
async function browserSubmission(status,{source='library',video=false}={}){
  const timers=[],requests=[],elements=new Map();
  const node=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},focus(){},scrollIntoView(){}});
  const context=createContext({...engine,...workspace,demoRecords:engine.normalizeRecords([record]),AbortController,URL,Intl,crypto:{randomUUID},
    localStorage:{getItem(){return null;},setItem(){}},window:{scrollTo(){}},document:{body:{scrollHeight:0},addEventListener(){},querySelector(selector){if(!elements.has(selector))elements.set(selector,node());return elements.get(selector);}},
    setInterval(){},setTimeout(callback,delay){timers.push({callback,delay});return timers.length;},clearTimeout(){},
    fetch:async(path,init)=>{requests.push({path,init});if(path==='/api/status')return new Response(JSON.stringify(status));if(path==='/api/videos/discover')return new Response(JSON.stringify({records:[record]}));return new Response(JSON.stringify({title:'Research',summary:'Supplied evidence.',sections:[],sources:[],mode:'deterministic'}));}
  });
  runInContext(appSource,context);
  await new Promise(setImmediate);
  runInContext(`sourceMode=${JSON.stringify(source)};${video?"pendingVideo={attachment:{name:'clip.mp4',duration:20,frames:[]},audio:{chunks:[{},{}]},dispose(){}};":''}`,context);
  await runInContext('submit("Find beauty creators")',context);
  return {timers,requests};
}

test('browser retains its default deadline and allows a configured local chat to finish',async()=>{
  for(const [status,source,want] of [
    [{},'library',65000],
    [{providerConfigured:true,chatRequestTimeoutMs:25000},'live',65000],
    [{providerConfigured:true,chatRequestTimeoutMs:90000},'library',95000],
    [{providerConfigured:true,chatRequestTimeoutMs:180000},'corpus',185000],
    [{providerConfigured:true,chatRequestTimeoutMs:180000},'live',220000]
  ]){
    const {timers,requests}=await browserSubmission(status,{source});
    assert.equal(timers[0].delay,want);
    assert.ok(requests.some(request=>request.path==='/api/chat'));
    if(source==='live')assert.equal(requests.find(request=>request.path==='/api/videos/discover').init.signal,requests.find(request=>request.path==='/api/chat').init.signal);
  }
});

test('browser rejects untrusted or absent status deadlines and preserves the video audio allowance',async()=>{
  for(const budget of [undefined,null,'180000',9999,180001,25000.5,Infinity]){
    const {timers}=await browserSubmission({providerConfigured:true,chatRequestTimeoutMs:budget});
    assert.equal(timers[0].delay,65000);
  }
  const disabled=await browserSubmission({providerConfigured:false,chatRequestTimeoutMs:180000});assert.equal(disabled.timers[0].delay,65000);
  const video=await browserSubmission({providerConfigured:true,chatRequestTimeoutMs:180000},{source:'video',video:true});
  assert.equal(video.timers[0].delay,275000);assert.ok(video.requests.some(request=>request.path==='/api/video/analyze'));
});
