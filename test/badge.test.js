import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import * as engine from '../public/engine.js';
import * as workspace from '../public/workspace.js';
import * as patterns from '../public/patterns.js';
import * as badge from '../public/badge.js';
import {demoRecords} from '../public/demo.js';

const appSource=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
const cover=(id,creator=id)=>({id,creatorId:creator,handle:'@'+creator,thumbnail:`https://covers.example/${id}.jpg`,caption:'Supplied skincare video',demo:false});
const answer=(sources)=>({kind:'research',mode:'deterministic',title:'Real corpus answer',summary:'Returned evidence.',sections:[],sources,creators:[]});
async function composerContext(){
  const elements=new Map(),events=new Map(),requests=[];
  const context=createContext({...engine,...workspace,...patterns,...badge,demoRecords,AbortController,URL,Intl,crypto:{randomUUID:()=> 'badge-chat'},
    localStorage:{getItem(){return null;},setItem(){}},window:{scrollTo(){}},document:{body:{scrollHeight:0},addEventListener(type,handler){events.set(type,handler);},querySelector(selector){if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},focus(){},scrollIntoView(){},close(){this.open=false;}});return elements.get(selector);}},
    setInterval(){},setTimeout(){return 1;},clearTimeout(){},fetch:async(path,init)=>{requests.push({path,body:init?.body?JSON.parse(init.body):null});return new Response(JSON.stringify(path==='/api/status'?{}:answer([])));}
  });
  runInContext(appSource,context);await new Promise(setImmediate);context.click=events.get('click');context.requests=requests;return context;
}
function badgeImages(html){return [...html.match(/<span class="mini-covers"[^>]*>([\s\S]*?)<\/span>/)[1].matchAll(/<img src="([^"]+)"/g)].map(match=>match[1]);}

test('the actual Corpus composer shows returned covers with the original example library untouched',async()=>{
  const context=await composerContext();
  const sources=[cover('first'),cover('second'),cover('third')];
  runInContext(`state.activeId='corpus-chat';state.conversations=[{id:'corpus-chat',source:'corpus',messages:[{role:'user',content:'skincare'},{role:'assistant',researchSource:'corpus',result:${JSON.stringify(answer(sources))}}]}];sourceMode='corpus';`,context);
  assert.deepEqual(badgeImages(runInContext('composer()',context)),['https://covers.example/first.jpg','https://covers.example/second.jpg','https://covers.example/third.jpg']);
  assert.equal(runInContext('state.records.length',context),28);
  assert.equal(runInContext('state.records.every(r=>r.demo)',context),true);
  assert.equal(runInContext('watchedToday',context),0);
});

test('source selection cannot relabel older Corpus evidence as Library or Live',()=>{
  const chat={messages:[{role:'assistant',researchSource:'corpus',result:answer([cover('corpus')])}]};
  assert.deepEqual(badge.badgeRecords({source:'live',chat}),[]);
  assert.deepEqual(badge.badgeRecords({source:'library',chat,library:[cover('library')]}).map(r=>r.id),['library']);
  assert.deepEqual(badge.badgeRecords({source:'corpus',chat:{messages:[...chat.messages,{role:'assistant',researchSource:'live',result:answer([cover('live')])}]}}),[]);
});

test('a pending query, failed turn, empty answer or new chat cannot resurrect older covers',()=>{
  const old={role:'assistant',researchSource:'corpus',result:answer([cover('old')])};
  for(const messages of [[old,{role:'user',content:'New query'}],[old,{role:'assistant',researchSource:'corpus',error:'No results'}],[old,{role:'assistant',researchSource:'corpus',result:answer([])}],[]]){
    assert.deepEqual(badge.badgeRecords({source:'corpus',chat:{messages}}),[]);
  }
  assert.deepEqual(badge.badgeRecords({source:'corpus',chat:{messages:[old]},progress:{source:'corpus'}}),[]);
  assert.deepEqual(badge.badgeRecords({source:'corpus'}),[]);
  assert.deepEqual(badge.badgeRecords({source:'live',progress:{source:'live',records:[cover('fresh')]}}).map(r=>r.id),['fresh']);
});

test('known provenance supports legacy corpus answers while an unlabeled answer never establishes Live',()=>{
  const result={...answer([cover('legacy')]),corpus:{byKind:{real:154424}}};
  assert.deepEqual(badge.badgeRecords({source:'corpus',chat:{messages:[{role:'assistant',result}]}}).map(r=>r.id),['legacy']);
  assert.deepEqual(badge.badgeRecords({source:'live',chat:{source:'live',messages:[{role:'assistant',result:answer([cover('unknown-origin')])}]}}),[]);
});

test('badge uses at most three unique safe covers and prefers distinct creators',()=>{
  const records=[cover('one','a'),cover('two','a'),cover('three','b'),cover('four','c'),cover('five','d'),{...cover('unsafe'),thumbnail:'javascript:alert(1)'},{...cover('example'),demo:true}];
  assert.deepEqual(badge.badgeRecords({source:'library',library:records}).map(r=>r.id),['one','three','four']);
  assert.deepEqual(badge.badgeRecords({source:'library',library:[records[0],{...cover('duplicate','b'),thumbnail:records[0].thumbnail},records[1]]}).map(r=>r.id),['one','two']);
  assert.deepEqual(badge.badgeRecords({source:'library',library:[records.at(-1),{...cover('unknown'),thumbnail:''}]}),[]);
});

test('Video shows only an actual in-memory sampled frame and never a research source cover',()=>{
  const video={attachment:{frames:[{timestamp:0,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}]}};
  assert.deepEqual(badge.badgeRecords({source:'video',video,library:[cover('library')]}).map(r=>r.thumbnail),['data:image/jpeg;base64,/9j/2Q==']);
  assert.deepEqual(badge.badgeRecords({source:'video',library:[cover('library')]}),[]);
  assert.deepEqual(badge.badgeRecords({source:'library',video,library:[cover('library')]}).map(r=>r.id),['library']);
});

test('Research this format binds its pattern source and clears an unrelated pending attachment',async()=>{
  for(const [selected,pattern] of [['library','corpus'],['corpus','library'],['video','corpus']]){
    const context=await composerContext();
    runInContext(`sourceMode=${JSON.stringify(selected)};let badgeDisposed=false,badgeAborted=false;attachmentController={abort(){badgeAborted=true}};pendingVideo={attachment:{name:'old.mp4',duration:5,frames:[]},dispose(){badgeDisposed=true;}};conversationVideos.set(null,pendingVideo);`,context);
    await context.click({target:{closest:()=>({dataset:{prompt:'Analyze the tutorial format',researchSource:pattern}})},preventDefault(){}});
    await new Promise(setImmediate);
    const request=context.requests.find(request=>request.path==='/api/chat');
    assert.ok(request,'Pattern research must post text research instead of an attached-video analysis.');
    assert.equal(request.body.corpus,pattern==='corpus');
    assert.equal(request.body.records.length,pattern==='corpus'?0:28);
    assert.equal(context.requests.some(request=>request.path==='/api/video/analyze'),false);
    assert.equal(runInContext('badgeDisposed&&badgeAborted&&pendingVideo===null',context),true);
    assert.equal(runInContext('active().messages.at(-1).researchSource',context),pattern);
  }
});

test('deterministic answer labels retain each saved source when the current composer source changes',async()=>{
 const context=await composerContext();
 const messages=['library','corpus','live','video'].map(researchSource=>({role:'assistant',researchSource,result:answer([])}));
 runInContext(`state.activeId='labels';state.conversations=[{id:'labels',source:'library',messages:${JSON.stringify(messages)}}];sourceMode='library';`,context);
 const labels=runInContext('renderChat()',context).matchAll(/class="pill-label">([^<]+)</g);assert.deepEqual([...labels].map(m=>m[1]),['Library research','Corpus research','Live research','Video analysis']);
});
