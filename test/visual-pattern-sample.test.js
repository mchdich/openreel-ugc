import test from 'node:test';
import assert from 'node:assert/strict';
import {openCorpus} from '../lib/corpus.js';
import {handleApi} from '../lib/api.js';
const module=await import('../lib/corpus-patterns.js');
const sample=(...args)=>{assert.equal(typeof module.sampleVisualPatterns,'function');return module.sampleVisualPatterns(...args);};
const description='The camera points straight down onto a marble counter. Two hands arrange five pastel jars into a neat circle, then slide the jars toward the middle. The sequence remains a single overhead shot.';
const row=i=>({id:'tiktok-'+String(9000+i),creatorId:String(100+i),handle:'',caption:'An overhead arrangement',url:'https://www.tiktok.com/player/v1/'+String(9000+i),sourceType:'test-fixture',fetchedAt:'2024-01-01T00:00:00Z',visualDescription:description,descriptionSource:'upstream-model',demo:false});
test('default visual sampling includes shared arrangements without any broad format keyword',async()=>{
 const db=openCorpus(':memory:');try{db.upsert([row(1),row(2)],{kind:'real',source:'controlled visual fixture'});const before=db.stats(),result=await sample(db);assert.equal(result.records.length,2);assert.equal(result.selection.method,'visual-coverage');assert.deepEqual(db.stats(),before);}finally{db.close();}
});
test('visual sampling retains strict topic/profile constraints and does not widen nonempty queries',async()=>{
 const db=openCorpus(':memory:');try{db.upsert([{...row(1),caption:'Coffee',school:'NYU',followers:2000,email:'public@example.com',bio:'NYU | public@example.com'},{...row(2),caption:'Coffee',school:'UCLA',followers:2000,email:'public@example.com'}],{kind:'real',source:'controlled fixture'});const result=await sample(db,'coffee NYU with at least 1500 followers and email in bio');assert.deepEqual(result.records.map(r=>r.id),['tiktok-9001']);assert.equal(result.selection.method,'query');}finally{db.close();}
});
test('default visual sampling is bounded and excludes unattributed/fictional descriptions',async()=>{
 const corpus={search:async(q,{limit})=>Array.from({length:limit},(_,i)=>({...row(i),id:q+'-'+i,...(i%5===0?{descriptionSource:'',visualDescription:''}:{})}))};const result=await sample(corpus);assert.ok(result.records.length<=100);assert.ok(result.selection.candidateRecords<=220);assert.ok(result.selection.queryCount<=7);assert.ok(result.records.every(r=>r.descriptionSource==='upstream-model'));assert.equal(new Set(result.records.map(r=>r.id)).size,result.records.length);
});
