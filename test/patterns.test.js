import test from 'node:test';
import assert from 'node:assert/strict';

// Controlled transport fixtures exercise browser retrieval semantics, not corpus quality.
const row=(id='one',extra={})=>({id,creatorId:id==='one'?'101':'102',handle:'',demo:false,format:'Unboxing',postedAt:'2022-01-15',...extra});
const result=(records=[row()],extra={})=>({records,corpus:{total:154424,byKind:{real:154424,example:0,synthetic:0,unverified:0}},...extra});
const pending=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const module=()=>import('../public/patterns.js');

test('pattern retrieval is bounded and preserves supplied evidence and unavailable metrics',async()=>{
 const {fetchPatternSample}=await module();let sent;
 const sample=await fetchPatternSample(async(path,body,signal)=>{sent={path,body,signal};return result([row('one',{visualDescription:'The creator is unboxing a parcel.',descriptionSource:'upstream-model'})]);},'  pottery  ',new AbortController().signal);
 assert.equal(sent.path,'/api/corpus/search');assert.deepEqual(sent.body,{query:'pottery',limit:100});assert.equal(sent.signal.aborted,false);
 assert.equal(sample.records[0].id,'one');assert.equal(sample.records[0].visualDescription,'The creator is unboxing a parcel.');assert.equal(sample.records[0].descriptionSource,'upstream-model');
 assert.deepEqual(sample.records[0].unavailableMetrics,['followers','views','likes','comments','shares']);assert.equal(sample.corpus.byKind.real,154424);
});

test('pattern retrieval rejects examples, synthetic rows and malformed or unbounded server responses',async()=>{
 const {fetchPatternSample}=await module();
 for(const value of [result([row('one',{demo:true})]),result([row('one',{demo:'true'})]),result([row('one',{synthetic:true})]),result([row('one',{corpusKind:'synthetic'})]),result([row('one',{corpusKind:'unverified'})]),result([row('one',{demo:undefined})]),result([row('one',{id:''})]),result([row('one',{creatorId:'invalid'})]),result(Array.from({length:101},(_,i)=>row('id'+i))),result(undefined,{corpus:{total:1,byKind:{real:2}}}),result(undefined,{corpus:{total:1,byKind:{real:-1}}}),result(undefined,{corpus:null}),{records:'invalid'}]){
  await assert.rejects(fetchPatternSample(async()=>value,''),/corpus|record|pattern|real|sample/i);
 }
 let requested=false;await assert.rejects(fetchPatternSample(async()=>{requested=true;return result();},'x'.repeat(1001)),/1,000/);assert.equal(requested,false);
});

test('empty real results remain empty and do not substitute fictional library data',async()=>{
 const {fetchPatternSample}=await module();const sample=await fetchPatternSample(async()=>result([]),'not found');assert.deepEqual(sample.records,[]);assert.equal(sample.corpus.total,154424);
});

test('configured corpus becomes the default on entry while explicit Library survives delayed status',async()=>{
 const {createPatternController}=await module();const requests=[];
 const controller=createPatternController({request:async(path,body)=>{requests.push(body);return result();}});
 controller.configure(true);assert.equal(controller.snapshot().source,'corpus');assert.equal(requests.length,0);
 controller.enter();await tick();assert.equal(controller.snapshot().status,'ready');assert.deepEqual(requests,[{query:'',limit:100}]);
 controller.leave();
 const delayed=createPatternController({request:async()=>{throw new Error('must not retrieve');}});delayed.enter();delayed.chooseSource('library');delayed.configure(true);await tick();assert.equal(delayed.snapshot().source,'library');assert.equal(delayed.snapshot().status,'idle');
 const saved=createPatternController({request:async()=>result(),source:'library'});saved.configure(true);saved.enter();assert.equal(saved.snapshot().source,'library');
});

test('query changes abort old work and stale successes or failures cannot replace the current sample',async()=>{
 const {createPatternController}=await module();const requests=[];
 const controller=createPatternController({debounceMs:0,request:(path,body,signal)=>{const next=pending();requests.push({...next,body,signal});return next.promise;}});
 controller.configure(true);controller.enter();assert.equal(requests.length,1);controller.search('new');await tick();assert.equal(requests[0].signal.aborted,true);assert.equal(requests.length,2);
 requests[1].resolve(result([row('new')]));await tick();requests[0].resolve(result([row('old')]));await tick();assert.deepEqual(controller.snapshot().records.map(r=>r.id),['new']);
 controller.search('third');await tick();controller.search('fourth');await tick();requests[3].resolve(result([row('fourth')]));await tick();requests[2].reject(new Error('old failure'));await tick();assert.equal(controller.snapshot().status,'ready');assert.deepEqual(controller.snapshot().records.map(r=>r.id),['fourth']);controller.leave();
});

test('saved Corpus choice entered before status starts retrieval once availability arrives',async()=>{
 const {createPatternController}=await module();let calls=0;
 const controller=createPatternController({source:'corpus',request:async()=>{calls++;return result();}});controller.enter();assert.equal(calls,0);controller.configure(true);await tick();assert.equal(calls,1);assert.equal(controller.snapshot().status,'ready');controller.leave();
});

test('debounced search retrieves only the last query and a source change cancels pending work',async()=>{
 const {createPatternController}=await module();const requests=[];
 const controller=createPatternController({debounceMs:20,request:async(path,body,signal)=>{requests.push({body,signal});return result();}});controller.configure(true);controller.enter();await tick();
 controller.search('p');controller.search('po');controller.search('pottery');assert.equal(controller.snapshot().status,'loading');assert.deepEqual(controller.snapshot().records,[]);
 await new Promise(resolve=>setTimeout(resolve,35));assert.deepEqual(requests.map(r=>r.body.query),['','pottery']);
 controller.search('cancel me');controller.chooseSource('library');await new Promise(resolve=>setTimeout(resolve,35));assert.equal(requests.length,2);assert.equal(controller.snapshot().source,'library');assert.equal(controller.snapshot().status,'idle');
 controller.chooseSource('corpus');await tick();assert.deepEqual(requests.map(r=>r.body.query),['','pottery','cancel me']);controller.leave();
});

test('leaving or selecting Library prevents an outstanding corpus response from resurfacing',async()=>{
 const {createPatternController}=await module();const next=pending();let signal;
 const controller=createPatternController({request:(path,body,value)=>{signal=value;return next.promise;}});controller.configure(true);controller.enter();controller.chooseSource('library');assert.equal(signal.aborted,true);next.resolve(result());await tick();assert.equal(controller.snapshot().source,'library');assert.deepEqual(controller.snapshot().records,[]);
 const other=pending();const leaving=createPatternController({request:()=>other.promise});leaving.configure(true);leaving.enter();leaving.leave();other.resolve(result());await tick();assert.equal(leaving.snapshot().status,'idle');assert.deepEqual(leaving.snapshot().records,[]);
});

test('retrieval failures remain explicit until a manual retry succeeds',async()=>{
 const {createPatternController}=await module();let failing=true,calls=0;
 const controller=createPatternController({request:async()=>{calls++;if(failing)throw new Error('Corpus service unavailable.');return result([row('retried')]);}});controller.configure(true);controller.enter();await tick();assert.equal(controller.snapshot().status,'error');assert.equal(controller.snapshot().error,'Corpus service unavailable.');assert.deepEqual(controller.snapshot().records,[]);
 await tick();assert.equal(calls,1);failing=false;controller.retry();await tick();assert.equal(controller.snapshot().status,'ready');assert.equal(controller.snapshot().records[0].id,'retried');assert.equal(calls,2);controller.leave();
});

test('an unresponsive corpus request times out, aborts transport and offers a retryable error',async()=>{
 const {createPatternController}=await module();let signal;
 const controller=createPatternController({requestTimeoutMs:10,request:(path,body,value)=>{signal=value;return new Promise(()=>{});}});controller.configure(true);controller.enter();await new Promise(resolve=>setTimeout(resolve,25));assert.equal(signal.aborted,true);assert.equal(controller.snapshot().status,'error');assert.match(controller.snapshot().error,/timed out/i);assert.deepEqual(controller.snapshot().records,[]);controller.leave();
});

test('corpus preview fans select the first record for three distinct creators',async()=>{
 const {patternPreviewRecords}=await module();const rows=[row('one'),row('two'),row('repeat',{creatorId:'102'}),row('three',{creatorId:'103'}),row('four',{creatorId:'104'})];
 assert.deepEqual(patternPreviewRecords(rows).map(r=>r.id),['one','two','three']);assert.deepEqual(patternPreviewRecords(rows.slice(0,3)).map(r=>r.id),['one','two']);
});

test('verified HTTPS covers later in a view-sorted sample reach the fan without changing record order or evidence',async()=>{
 const {patternPreviewRecords}=await module();
 const rows=[
  row('most-viewed',{creatorId:'201',views:9000000,thumbnail:''}),
  row('unknown-other',{creatorId:'202',views:8000000}),
  row('covered-one',{creatorId:'201',views:7000,thumbnail:'https://p16.example.com/cover-a.jpeg',avatar:'https://p16.example.com/avatar-a.jpeg'}),
  row('same-covered-creator',{creatorId:'201',views:6000,thumbnail:'https://p16.example.com/cover-a2.jpeg'}),
  row('covered-two',{creatorId:'203',views:5000,thumbnail:'https://p16.example.com/cover-b.jpeg'}),
  row('covered-three',{creatorId:'204',views:4000,thumbnail:'https://p16.example.com/cover-c.jpeg'}),
  row('covered-four',{creatorId:'205',views:3000,thumbnail:'https://p16.example.com/cover-d.jpeg'})
 ];
 const before=JSON.stringify(rows),selected=patternPreviewRecords(rows);
 assert.deepEqual(selected.map(r=>r.id),['covered-one','covered-two','covered-three']);assert.equal(selected[0],rows[2]);assert.equal(selected[0].avatar,'https://p16.example.com/avatar-a.jpeg');assert.equal(JSON.stringify(rows),before);
});

test('preview fan fills remaining distinct creators in order while unsafe or absent covers receive no image priority',async()=>{
 const {patternPreviewRecords}=await module();
 const rows=[
  row('missing',{creatorId:'201',thumbnail:''}),
  row('plain-http',{creatorId:'202',thumbnail:'http://images.example.com/b.jpg'}),
  row('credentials',{creatorId:'203',thumbnail:'https://user:password@images.example.com/c.jpg'}),
  row('data-url',{creatorId:'204',thumbnail:'data:image/png;base64,AAA'}),
  row('broken-url',{creatorId:'205',thumbnail:'not a URL'}),
  row('valid',{creatorId:'202',thumbnail:'https://images.example.com/real.jpg'})
 ];
 assert.deepEqual(patternPreviewRecords(rows).map(r=>r.id),['valid','missing','credentials']);
 assert.deepEqual(patternPreviewRecords(rows.slice(0,5)).map(r=>r.id),['missing','plain-http','credentials']);
});
