import test from 'node:test';
import assert from 'node:assert/strict';
import {createPatternController} from '../public/patterns.js';
import {normalizeRecords} from '../public/engine.js';
const description='The video shows a split-screen layout with two people beside one another. A date sticker appears at the bottom of both scenes.';
const records=normalizeRecords([1,2].map(i=>({id:'source-'+i,creatorId:String(100+i),visualDescription:description,descriptionSource:'upstream-model',demo:false})));
const proposals=[{title:'Split-screen clips with on-screen date labels',description:'Paired scenes share a split-screen layout and visible date stickers.',components:[{featureId:'split-screen',label:'Split-screen paired layout',evidence:[1,2].map(i=>({recordId:'source-'+i,quote:'The video shows a split-screen layout with two people beside one another.'}))},{featureId:'date-overlay',label:'A visible date sticker',evidence:[1,2].map(i=>({recordId:'source-'+i,quote:'A date sticker appears at the bottom of both scenes.'}))}]}];
const sample={records,corpus:{total:2,byKind:{real:2}},selection:{method:'query',queryCount:1,candidateRecords:2}};
const answer={...sample,proposals,analyzedRecords:2,notice:'Source-description interpretations.'};
const tick=()=>new Promise(r=>setTimeout(r,5));

test('ordinary entry and typing stay read-only; visual detection is explicit and cached for that query',async()=>{
 const calls=[];const c=createPatternController({debounceMs:1,request:async(path)=>{calls.push(path);return path.endsWith('/visual-patterns')?answer:sample;}});c.configure(true);c.enter();await tick();c.search('split screen');await tick();assert.equal(calls.filter(p=>p.endsWith('/visual-patterns')).length,0);
 assert.equal(typeof c.detectVisualPatterns,'function');c.detectVisualPatterns();await tick();assert.equal(c.snapshot().visualStatus,'ready');assert.equal(c.snapshot().visualPatterns.length,1);assert.equal(c.snapshot().analysis,'visual');c.showFormats();assert.equal(c.snapshot().analysis,'formats');c.detectVisualPatterns();assert.equal(c.snapshot().analysis,'visual');assert.equal(calls.filter(p=>p.endsWith('/visual-patterns')).length,1);c.leave();
});

test('late paid results cannot replace a new query or explicit Library selection',async()=>{
 let resolve,signal;const c=createPatternController({debounceMs:1,request:async(path,body,s)=>path.endsWith('/visual-patterns')?new Promise(r=>{resolve=r;signal=s;}):sample});c.configure(true);c.enter();await tick();assert.equal(typeof c.detectVisualPatterns,'function');c.detectVisualPatterns();c.search('different');assert.equal(signal.aborted,true);resolve(answer);await tick();assert.equal(c.snapshot().analysis,'formats');assert.deepEqual(c.snapshot().visualPatterns,[]);c.detectVisualPatterns();await tick();c.chooseSource('library');resolve(answer);await tick();assert.equal(c.snapshot().source,'library');assert.deepEqual(c.snapshot().visualPatterns,[]);c.leave();
});

test('leaving, errors and cancellation never manufacture visual patterns or automatically retry paid calls',async()=>{
 let calls=0;const c=createPatternController({request:async(path)=>{if(path.endsWith('/visual-patterns')){calls++;throw new Error('Provider unavailable');}return sample;}});c.configure(true);c.enter();await tick();assert.equal(typeof c.detectVisualPatterns,'function');c.detectVisualPatterns();await tick();assert.equal(c.snapshot().visualStatus,'error');assert.match(c.snapshot().visualError,/Provider unavailable/);c.leave();c.enter();await tick();assert.equal(calls,1);assert.deepEqual(c.snapshot().visualPatterns,[]);c.showFormats();assert.equal(c.snapshot().analysis,'formats');c.leave();
});
