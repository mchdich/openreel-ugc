import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
let module;
try { module=await import('../lib/corpus.js'); } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const root=resolve(import.meta.dirname,'..');
const source={url:'https://www.tiktok.com/@scout2015/video/6718335390845095173',sourceType:'user-import',fetchedAt:'2026-10-17T20:39:05.973Z'};
const real=(overrides={})=>({id:'known-source',handle:'@scout2015',caption:'Campus cooking with a beauty routine',followers:1200,views:900,likes:90,comments:5,shares:5,...source,...overrides});
function open(path=':memory:'){assert.equal(typeof module?.openCorpus,'function','openCorpus must be implemented');return module.openCorpus(path);}
function temporary(t){const dir=mkdtempSync(join(tmpdir(),'openreel-corpus-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
function run(...args){return spawnSync(process.execPath,['scripts/corpus.js',...args],{cwd:root,encoding:'utf8'});}

// Missing persistence or category filtering loses a user's real research library on reopen.
test('file corpus persists records and keeps example and unverified counts distinct',t=>{
 const path=join(temporary(t),'nested','corpus.sqlite');let db=open(path);
 db.upsert([{handle:'fictional',caption:'Fictional campus beauty',demo:true}]);
 db.upsert([{handle:'unsourced',caption:'Unverified record'}]);
 assert.equal(db.stats().total,2);assert.equal(db.stats().byKind.example,1);assert.equal(db.stats().byKind.unverified,1);assert.equal(db.stats().byKind.real,0);
 assert.deepEqual(db.search('campus'),[]);db.close();
 db=open(path);try{assert.equal(db.search('campus',{kind:'example'})[0].demo,true);assert.equal(db.stats().total,2);}finally{db.close();}
});

// A broken conflict clause duplicates records or leaves stale FTS terms after updates.
test('idempotent upserts update FTS terms and preserve stable IDs for source URLs',()=>{
 const db=open();try{
  const record=real({id:undefined,caption:'Rare chrysanthemum opening'});
  assert.equal(db.upsert([record],{kind:'real',source:'permitted-json'}).changed,1);
  const first=db.search('chrysanthemum')[0];assert.ok(first.id);assert.equal(first.corpusVerification,'user-supplied');
  assert.equal(db.upsert([record],{kind:'real',source:'permitted-json'}).changed,0);
  db.upsert([{...record,caption:'Remarkable saffron opening'}],{kind:'real',source:'permitted-json'});
  assert.deepEqual(db.search('chrysanthemum'),[]);assert.equal(db.search('saffron')[0].id,first.id);assert.equal(db.stats().total,1);
 }finally{db.close();}
});

// Validation must roll back earlier changes and their FTS triggers, not just the bad row.
test('invalid streamed import rolls back inserted records and updates atomically',()=>{
 const db=open();try{
  db.upsert([real({caption:'Original marigold'})],{kind:'real'});
  function* bad(){yield real({caption:'Changed lavender'});yield real({id:'new',handle:'@another',url:'https://www.tiktok.com/@another/video/123'});yield {caption:'missing handle'};}
  assert.throws(()=>db.upsert(bad(),{kind:'real'}),/handle/i);
  assert.equal(db.stats().total,1);assert.equal(db.get('known-source').caption,'Original marigold');assert.deepEqual(db.search('lavender'),[]);assert.equal(db.search('marigold').length,1);
 }finally{db.close();}
});

// A benchmark/example must never silently become a real source count.
test('real classification requires provenance and rejects fictional or synthetic promotion',()=>{
 const db=open();try{
  assert.throws(()=>db.upsert([{handle:'fake',caption:'x'}],{kind:'real'}),/source|provenance|real/i);
  assert.throws(()=>db.upsert([real({demo:true})],{kind:'real'}),/example|fictional|demo/i);
  db.upsert([real()],{kind:'real'});
  db.upsert([{id:'example',handle:'example',caption:'Beauty',demo:true}],{kind:'example'});
  db.upsert([{id:'synthetic',handle:'synthetic',caption:'Beauty synthetic'}],{kind:'synthetic'});
  db.upsert([{id:'unverified',handle:'unverified',caption:'Beauty'}]);
  assert.deepEqual(db.stats().byKind,{real:1,example:1,synthetic:1,unverified:1});
  assert.equal(db.search('beauty').length,1);assert.equal(db.search('beauty',{kind:'all'}).length,4);
  assert.throws(()=>db.upsert([real({id:'synthetic',demo:false})],{kind:'real'}),/synthetic|promot/i);
  assert.equal(db.stats().byKind.real,1);
 }finally{db.close();}
});

// Treating unknown followers/views as measured zero makes strict creator searches false.
test('unknown metrics survive persistence and cannot satisfy follower filters',()=>{
 const db=open();try{
  db.upsert([real({id:'unknown',followers:undefined,views:undefined}),real({id:'zero',handle:'zero',url:'https://www.tiktok.com/@zero/video/2',followers:0,views:0}),real({id:'flagged',handle:'flagged',url:'https://www.tiktok.com/@flagged/video/3',followers:0,unavailableMetrics:['followers']})],{kind:'real'});
  const unknown=db.get('unknown');assert.ok(unknown.unavailableMetrics.includes('followers'));assert.ok(unknown.unavailableMetrics.includes('views'));
  assert.deepEqual(db.search('',{maxFollowers:0}).map(r=>r.id),['zero']);assert.equal(db.stats().knownViewRecords,2);
 }finally{db.close();}
});

// Interpreting user text as SQL or raw FTS syntax can broaden queries or crash them.
test('FTS search applies profile bounds and treats query syntax as literal text',()=>{
 const db=open();try{
  db.upsert([real({id:'nyu',school:'NYU',location:'NYC',bio:'Public skincare partner',email:'public@example.com'}),real({id:'other',handle:'other',url:'https://www.tiktok.com/@other/video/2',school:'UCLA',location:'LA',followers:5000})],{kind:'real'});
  assert.deepEqual(db.search('skincare',{school:'NYU',location:'NYC',minFollowers:1000,maxFollowers:2000,emailOnly:true}).map(r=>r.id),['nyu']);
  assert.deepEqual(db.search('beauty',{school:'Harvard'}),[]);
  assert.doesNotThrow(()=>db.search('"beauty" OR 1=1 --'));assert.equal(db.stats().total,2);
  assert.throws(()=>db.search('beauty',{limit:0}),/limit/i);assert.throws(()=>db.search('beauty',{kind:'fake'}),/kind/i);
 }finally{db.close();}
});

// Reusing browser batch normalization would reject a legitimate corpus past 2,000 rows.
test('iterable imports exceed the browser limit and support bounded result pages',()=>{
 const db=open();try{
  function* records(){for(let i=0;i<2501;i++)yield {id:`s-${String(i).padStart(4,'0')}`,handle:`synthetic_${i}`,caption:'Synthetic pagination sentinel',demo:true};}
  db.upsert(records(),{kind:'synthetic',source:'unit-test-generated'});
  assert.equal(db.stats().total,2501);assert.equal(db.stats().byKind.real,0);
  const page=db.search('sentinel',{kind:'synthetic',limit:2,offset:2});assert.deepEqual(page.map(r=>r.id),['s-0002','s-0003']);
 }finally{db.close();}
});

// The actual CLI must preserve classifications and leave existing data after bad imports.
test('CLI initializes, imports JSON, searches and reports persisted counts',t=>{
 const dir=temporary(t),path=join(dir,'cli.sqlite'),file=join(dir,'records.json');
 writeFileSync(file,JSON.stringify([{id:'fixture',handle:'fictional',caption:'Orchid sample',demo:true}]));
 let result=run('init','--db',path);assert.equal(result.status,0,result.stderr);
 result=run('import',file,'--db',path,'--kind','example','--source','unit-test');assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).changed,1);
 result=run('search','orchid','--db',path,'--kind','example');assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).records[0].id,'fixture');
 result=run('stats','--db',path);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).byKind.example,1);
 writeFileSync(file,JSON.stringify([{handle:'ok'},{caption:'invalid'}]));result=run('import',file,'--db',path);assert.equal(result.status,1);assert.match(result.stderr,/handle/i);
 result=run('stats','--db',path);assert.equal(JSON.parse(result.stdout).total,1);
 const untouched=join(dir,'not-created.sqlite');result=run('unknown','--db',untouched);assert.equal(result.status,1);assert.equal(existsSync(untouched),false);
});

// Profile acquisition must issue one request per normalized unique handle and never retry errors.
test('creator collection is sequential, deduplicated and preserves provider-observed provenance',async()=>{
 assert.equal(typeof module?.collectCreatorHandles,'function','collectCreatorHandles must be implemented');
 const db=open();const calls=[];
 try{
  const summary=await module.collectCreatorHandles(db,[' @Scout2015 ','scout2015','@missing'],{discoverCreator:async handle=>{
   calls.push(handle);if(handle==='@missing')throw new Error('private provider secret');
   return {records:[real({sourceType:'tiktok-creator-embed'})],creator:{handle:'@scout2015'},provider:'tiktok-creator-embed',fetchedAt:source.fetchedAt};
  }});
  assert.deepEqual(calls,['@scout2015','@missing']);assert.equal(summary.profilesRequested,2);assert.equal(summary.recordsChanged,1);assert.equal(summary.failures.length,1);
  assert.doesNotMatch(JSON.stringify(summary),/private provider secret/);assert.equal(db.stats().providerObservedReal,1);assert.equal(db.get('known-source').corpusVerification,'provider-observed');
 }finally{db.close();}
});

// Capacity demonstrations must be isolated, explicitly synthetic and never inflate real counts.
test('benchmark CLI requires an explicit database and reports only synthetic rows',t=>{
 const path=join(temporary(t),'benchmark.sqlite');
 let result=run('benchmark','--count','31');assert.equal(result.status,1);assert.match(result.stderr,/explicit.*db|--db/i);
 result=run('benchmark','--db',path,'--count','31');assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);assert.equal(report.synthetic,true);assert.equal(report.stats.total,31);assert.equal(report.stats.byKind.synthetic,31);assert.equal(report.stats.byKind.real,0);assert.ok(report.importMilliseconds>=0);
});

// Validate a whole handle list before contacting any profile, avoiding accidental partial collection.
test('invalid handle collection performs no provider requests',async()=>{
 assert.equal(typeof module?.collectCreatorHandles,'function','collectCreatorHandles must be implemented');const db=open();let calls=0;
 try{await assert.rejects(module.collectCreatorHandles(db,['@valid','https://example.com'],{discoverCreator:async()=>{calls++;return {records:[]};}}),/handle/i);assert.equal(calls,0);assert.equal(db.stats().total,0);}finally{db.close();}
});

// Approximate follower bounds are fractional; rejecting them breaks valid natural queries.
test('approximate follower plans accept fractional boundaries',()=>{
 const db=open();try{db.upsert([real()],{kind:'real'});assert.equal(db.search('Find creators around 1201 followers').length,1);}finally{db.close();}
});

// Source-only imports and adapter IDs must address the same video on subsequent acquisition.
test('canonical video IDs remain idempotent across source import and adapter acquisition',()=>{
 const db=open();try{
  db.upsert([real({id:undefined})],{kind:'real'});
  db.upsert([real({id:'tiktok-6718335390845095173'})],{kind:'real'});
  assert.equal(db.stats().total,1);
 }finally{db.close();}
});

// Limiting clips before deduplication must not hide other matching creators.
test('creator result count is applied after matching handles are deduplicated',()=>{
 const db=open();try{
  db.upsert([real({id:'a1'}),real({id:'a2',url:'https://www.tiktok.com/@scout2015/video/2'}),real({id:'a3',url:'https://www.tiktok.com/@scout2015/video/3'}),real({id:'b',handle:'@other',url:'https://www.tiktok.com/@other/video/4'})],{kind:'real'});
  assert.deepEqual(db.search('Find 2 beauty creators').map(record=>record.handle),['@scout2015','@other']);
 }finally{db.close();}
});

// Numeric platform identity must survive reopen without inventing public usernames.
test('real player sources persist numeric creators and keep distinct creator counts',t=>{
 const path=join(temporary(t),'numeric.sqlite');let db=open(path);
 const numeric=(post,creator)=>({id:`tiktok-${post}`,handle:'',creatorId:creator,url:`https://www.tiktok.com/player/v1/${post}`,caption:'Numeric creator skincare example',sourceType:'public-archive',fetchedAt:source.fetchedAt});
 db.upsert([numeric('101','901'),numeric('102','901'),numeric('103','902'),{...numeric('105','901'),handle:'@campuscreator',url:'https://www.tiktok.com/@campuscreator/video/105'}],{kind:'real',source:'permitted-archive'});db.close();
 db=open(path);try{
  assert.equal(db.stats().total,4);assert.equal(db.stats().uniqueCreators,2);
  assert.equal(db.search('skincare',{uniqueCreators:true}).length,2);
  const saved=db.get('tiktok-101');assert.equal(saved.handle,'');assert.equal(saved.creatorId,'901');assert.equal(saved.url,'https://www.tiktok.com/player/v1/101');assert.equal(saved.corpusSource,'permitted-archive');assert.equal(saved.sourceType,'public-archive');
  assert.deepEqual(db.search('',{handle:'creator:901'}),[]);assert.deepEqual(db.search('',{handle:'901'}),[]);
  assert.deepEqual(db.search('',{handle:'campuscreator'}).map(r=>r.id),['tiktok-105']);assert.deepEqual(db.search('campuscreator').map(r=>r.id),['tiktok-105']);
  assert.equal(db.upsert([{...numeric('104','903'),id:undefined}],{kind:'real'}).changed,1);assert.ok(db.get('tiktok-104'));
 }finally{db.close();}
});

// Player URLs are evidence only for the exact post and declared numeric creator identity.
test('real numeric sources reject impostor player routes and mismatched post IDs atomically',()=>{
 const db=open();const valid={id:'tiktok-101',handle:'',creatorId:'901',url:'https://www.tiktok.com/player/v1/101',sourceType:'public-archive',fetchedAt:source.fetchedAt};
 const invalid=[{url:'https://tiktok.com/player/v1/101'},{url:'http://www.tiktok.com/player/v1/101'},{url:'https://www.tiktok.com/player/v1/101?download=1'},{url:'https://www.tiktok.com/player/v1/101?'},{url:'https://www.tiktok.com/player/v1/101#video'},{url:'https://www.tiktok.com/player/v1/101#'},{url:'https://www.tiktok.com:8443/player/v1/101'},{url:'https://www.tiktok.com.evil.example/player/v1/101'},{url:'https://user:password@www.tiktok.com/player/v1/101'},{url:'https://www.tiktok.com/player/v1/101/'},{id:'tiktok-102'},{creatorId:''},{creatorId:'not-a-platform-id'},{sourceType:''},{fetchedAt:''}];
 try{for(const patch of invalid){assert.throws(()=>db.upsert([{...valid,id:'tiktok-100',url:'https://www.tiktok.com/player/v1/100'},{...valid,...patch}],{kind:'real'}),/source|creator|player|post|timestamp|id|url/i);assert.equal(db.stats().total,0);}}finally{db.close();}
});

// Model visual summaries are searchable while original caption and transcript remain evidence.
test('visual descriptions enter only the search projection and update stale index terms',()=>{
 const db=open();try{
  const record=real({caption:'Original caption',transcript:'Verified spoken words',visualDescription:'A lavender product reveal',descriptionSource:'upstream-model'});
  db.upsert([record],{kind:'real'});assert.equal(db.search('lavender').length,1);
  assert.equal(db.get(record.id).transcript,'Verified spoken words');assert.equal(db.get(record.id).caption,'Original caption');assert.equal(db.get(record.id).visualDescription,'A lavender product reveal');assert.equal(db.get(record.id).descriptionSource,'upstream-model');
  assert.equal(db.upsert([record],{kind:'real'}).changed,0);
  db.upsert([{...record,visualDescription:'A saffron product reveal'}],{kind:'real'});assert.deepEqual(db.search('lavender'),[]);assert.equal(db.search('saffron').length,1);assert.equal(db.search('spoken').length,1);
 }finally{db.close();}
});

// Numeric-only identities must not consume a profile refresh's bounded username slots.
test('known-handle filtering precedes creator deduplication, limits and offsets',()=>{
 const db=open();try{
  db.upsert([
   real({id:'tiktok-1001',handle:'',creatorId:'901',url:'https://www.tiktok.com/player/v1/1001'}),
   real({id:'tiktok-1002',handle:'',creatorId:'902',url:'https://www.tiktok.com/player/v1/1002'}),
   real({id:'z-named-a',handle:'@named',creatorId:'903',url:'https://www.tiktok.com/@named/video/1003'}),
   real({id:'z-named-b',handle:'@named',creatorId:'903',url:'https://www.tiktok.com/@named/video/1004'}),
   real({id:'zz-second',handle:'@second',creatorId:'904',url:'https://www.tiktok.com/@second/video/1005'})
  ],{kind:'real'});
  assert.equal(db.search('',{uniqueCreators:true,limit:1})[0].handle,'');
  assert.deepEqual(db.search('',{knownHandlesOnly:true,uniqueCreators:true,limit:2}).map(r=>r.handle),['@named','@second']);
  assert.deepEqual(db.search('',{knownHandlesOnly:true,uniqueCreators:true,limit:1,offset:1}).map(r=>r.handle),['@second']);
  assert.equal(db.search('',{knownHandlesOnly:false,limit:1})[0].handle,'');
  for(const value of ['true',1,null,[]])assert.throws(()=>db.search('',{knownHandlesOnly:value}),/knownHandlesOnly.*boolean/i);
 }finally{db.close();}
});
