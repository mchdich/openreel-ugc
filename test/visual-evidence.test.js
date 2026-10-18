import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../public/engine.js';
import {mergeLibrary} from '../public/workspace.js';
import {openCorpus} from '../lib/corpus.js';
import {retainCorpusPostingDates} from '../lib/live-post-metadata.js';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=i=>({id:'tiktok-'+(1000+i),creatorId:String(5000+i),handle:'@visual_'+i,url:`https://www.tiktok.com/@visual_${i}/video/${1000+i}`,caption:'Original coffee caption',transcript:'Original supplied transcript',bio:'Original public bio',postedAt:'2024-10-04T00:00:00.000Z',fetchedAt:'2024-10-05T00:00:00.000Z',sourceType:'tiktok-public-post',views:100,followers:1500,demo:false,archiveProvenance:{dataset:'controlled fixture',license:'separate-source-license'}});
const proof=i=>({sourceType:'tiktok-public-player-frames',sourceUrl:source(i).url,creatorId:String(5000+i),observedAt:'2024-10-05T01:00:00.000Z',duration:10,frames:[{timestamp:.04,sha256:'a'.repeat(64)},{timestamp:6,sha256:'b'.repeat(64)}]});
const description='The sampled video shows close-up shots of a cobalt kettle. Visible hands arrange objects on a dark table. The samples show a step-by-step tutorial with successive preparation stages.';
const annotated=i=>({...source(i),visualDescription:description,descriptionSource:'openreel-vision',visualEvidence:proof(i)});

test('sampled-frame descriptions require exact bounded source/creator/date/frame evidence and no raw image bytes',()=>{
 assert.doesNotThrow(()=>engine.normalizeRecords([annotated(0)]));const row=engine.normalizeRecords([annotated(0)])[0];assert.deepEqual(row.visualEvidence,proof(0));assert.equal(row.transcript,'Original supplied transcript');
 for(const change of [{sourceUrl:source(1).url},{creatorId:'9999'},{observedAt:'invalid'},{observedAt:'2024-01-01T00:00:00.000Z'},{duration:601},{frames:[{timestamp:11,sha256:'a'.repeat(64)}]},{frames:[{timestamp:1,sha256:'no'}]},{frames:[{timestamp:1,sha256:'a'.repeat(64),dataUrl:'hidden bytes'}]},{extra:true}])assert.throws(()=>engine.normalizeRecords([{...annotated(0),visualEvidence:{...proof(0),...change}}]));
 assert.throws(()=>engine.normalizeRecords([{...annotated(0),visualEvidence:undefined}]));assert.throws(()=>engine.normalizeRecords([{...annotated(0),demo:true}]));
});

test('actual sampled descriptions feed broad and specific pattern gates with distinct provenance',async()=>{
 const records=engine.normalizeRecords([annotated(0),annotated(1)]),groups=engine.getTrends(records);assert.equal(groups.length,1);assert.equal(groups[0].format,'Step-by-step tutorial');assert.equal(groups[0].sourceGroups[0].descriptionSource,'openreel-vision');
 const {availableVisualFacts}=await import('../public/visual-facts.js');assert.deepEqual(availableVisualFacts(records[0]).map(f=>f.featureId).sort(),['close-up','dark-surface','hands','tabletop']);
 assert.deepEqual(engine.getTrends(records.map(r=>({...r,visualEvidence:undefined}))),[]);
});

test('reviewed visual deltas update only description evidence and FTS while preserving all other fields and corpus roles',()=>{
 const db=openCorpus(':memory:');try{db.upsert([source(0),source(1)],{kind:'real',source:'controlled acquisition',verification:'provider-observed'});const before=db.database.prepare('SELECT * FROM corpus_videos ORDER BY id').all();assert.equal(db.search('cobalt').length,0);const counts=db.stats();
  assert.equal(typeof db.applyVisualEvidence,'function');const result=db.applyVisualEvidence([0,1].map(i=>({recordId:source(i).id,visualDescription:description,visualEvidence:proof(i)})));assert.equal(result.changed,2);assert.equal(db.search('cobalt',{uniqueCreators:false}).length,2);const after=db.database.prepare('SELECT * FROM corpus_videos ORDER BY id').all();
  for(let i=0;i<2;i++){const original=JSON.parse(before[i].record_json),updated=JSON.parse(after[i].record_json);for(const key of Object.keys(original))if(!['visualDescription','descriptionSource','visualEvidence'].includes(key))assert.deepEqual(updated[key],original[key],key);for(const key of Object.keys(before[i]))if(!['record_json','transcript'].includes(key))assert.deepEqual(after[i][key],before[i][key],key);assert.equal(updated.descriptionSource,'openreel-vision');assert.deepEqual(updated.visualEvidence,proof(i));}assert.deepEqual(db.stats(),counts);
  const snap=JSON.stringify(after);assert.throws(()=>db.applyVisualEvidence([{recordId:source(0).id,visualDescription:'Changed description',visualEvidence:proof(0)},{recordId:'tiktok-999',visualDescription:description,visualEvidence:proof(0)}]));assert.equal(JSON.stringify(db.database.prepare('SELECT * FROM corpus_videos ORDER BY id').all()),snap);
 }finally{db.close();}
});

test('normal refresh keeps earlier independently observed visual evidence but fresh analytics and explicit new descriptions win',async()=>{
 const old=engine.normalizeRecords([annotated(0)])[0],fresh=engine.normalizeRecords([{...source(0),views:0,followers:900,fetchedAt:'2024-10-06T00:00:00.000Z'}])[0];assert.equal(typeof engine.retainVisualEvidence,'function');const retained=engine.retainVisualEvidence(old,fresh);assert.equal(retained.visualDescription,description);assert.equal(retained.views,0);assert.equal(retained.followers,900);assert.deepEqual(retained.visualEvidence,proof(0));assert.equal(mergeLibrary([old],[fresh])[0].visualDescription,description);
 for(const verification of ['provider-observed','user-supplied']){let reads=0;const result=await retainCorpusPostingDates([fresh],{getMany:async()=>{reads++;return [{...old,corpusKind:'real',corpusVerification:verification}];}});assert.equal(reads,1);assert.equal(result[0].visualDescription,verification==='provider-observed'?description:'');}
 const replacement={...fresh,visualDescription:'New supplied description',descriptionSource:'user-supplied'};assert.equal(engine.retainVisualEvidence(old,replacement),replacement);assert.equal(engine.retainVisualEvidence({...old,creatorId:'other'},fresh),fresh);
});

test('explicit CLI apply validates before opening a database and atomically annotates existing rows',()=>{
 const directory=mkdtempSync(join(tmpdir(),'openreel-visual-')),path=join(directory,'corpus.sqlite'),input=join(directory,'deltas.json');
 const run=(...args)=>spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/corpus.js',import.meta.url)),...args],{encoding:'utf8'});
 try{
  writeFileSync(input,JSON.stringify([{recordId:'tiktok-1000',visualDescription:description,visualEvidence:proof(0)}]));
  assert.notEqual(run('apply-video-evidence',input).status,0);assert.notEqual(run('apply-video-evidence',input,'--db',path).status,0);assert.equal(existsSync(path),false);
  const seed=openCorpus(path);seed.upsert([source(0)],{kind:'real',source:'original',verification:'user-supplied'});seed.close();
  const applied=run('apply-video-evidence',input,'--db',path);assert.equal(applied.status,0,applied.stderr);assert.equal(JSON.parse(applied.stdout).changed,1);
  const check=openCorpus(path,{readOnly:true});try{const row=check.get('tiktok-1000');assert.equal(row.descriptionSource,'openreel-vision');assert.equal(row.corpusVerification,'user-supplied');assert.equal(row.corpusSource,'original');assert.equal(check.search('cobalt').length,1);}finally{check.close();}
 }finally{rmSync(directory,{recursive:true,force:true});}
});
