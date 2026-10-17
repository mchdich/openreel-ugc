import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecords} from '../public/engine.js';
import {openCorpus} from '../lib/corpus.js';
let metadata;
try { metadata=await import('../lib/player-metadata.js'); } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const observedAt='2026-10-17T12:00:00.000Z';
const canonical=(id,handle='@gardenmaker')=>`https://www.tiktok.com/${handle}/video/${id}`;
function delta(id='101',handle='@gardenmaker',images=true){
 const patch={handle,url:canonical(id,handle),authorUrl:`https://www.tiktok.com/${handle}`,...(images?{thumbnail:'https://p16.tiktokcdn.com/cover.jpg?signature=sample',avatar:'https://p16.tiktokcdn.com/avatar.jpg?signature=sample'}:{})};
 const postHref=patch.url+'?refer=player_v1',authorHref=patch.authorUrl+'?refer=player_v1';
 const metadataEvidence={};
 for(const field of Object.keys(patch))metadataEvidence[field]={sourceType:'tiktok-public-player-dom',sourceUrl:`https://www.tiktok.com/player/v1/${id}?autoplay=0`,observedAt,postId:id,selector:field==='thumbnail'?'img[alt="Video Cover"]':'a[href]',attribute:['thumbnail','avatar'].includes(field)?'src':'href',observedValue:['handle','url'].includes(field)?postHref:field==='authorUrl'?authorHref:patch[field],...(['thumbnail','avatar'].includes(field)?{src:patch[field],width:100,height:100}:{}),...(field==='avatar'?{authorAnchorHref:authorHref}:{}),validation:{inputPostIdMatched:true,officialHttpsHost:true,loadedSourceVerified:false}};
 return {recordId:`tiktok-${id}`,postId:id,observedAt,patch,metadataEvidence,unknownFields:[]};
}
const archive=(id='101',overrides={})=>({id:`tiktok-${id}`,handle:'',creatorId:'901',url:`https://www.tiktok.com/player/v1/${id}`,caption:'Original caption',transcript:'Spoken marigold words',visualDescription:'An observed lavender scene',descriptionSource:'upstream-model',postedAt:'2024-07-20',sourceType:'public-archive',fetchedAt:'2026-10-16T00:00:00.000Z',archiveProvenance:{dataset:'test-fixture',license:'separate-data-license'},followers:0,views:250,likes:10,comments:0,shares:0,unavailableMetrics:['followers','comments'],...overrides});
const compact=(fields=['handle','url','authorUrl','thumbnail','avatar'])=>({sourceType:'tiktok-public-player-dom',sourceUrl:'https://www.tiktok.com/player/v1/101',observedAt,postId:'101',fields});
function normalize(value){assert.equal(typeof metadata?.normalizePlayerMetadataDelta,'function','normalizePlayerMetadataDelta must be implemented');return metadata.normalizePlayerMetadataDelta(value);}
function merge(record,value){assert.equal(typeof metadata?.mergePlayerMetadataRecord,'function','mergePlayerMetadataRecord must be implemented');return metadata.mergePlayerMetadataRecord(record,value);}
const sqlRow=(db,id='tiktok-101')=>({...db.database.prepare('SELECT * FROM corpus_videos WHERE id=?').get(id)});
const unchangedSql=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['record_json','handle','transcript'].includes(key)));

// Losing raw ID/value checks would permit forged booleans to bind another post or author.
test('delta normalization binds observed URLs and emits only compact field evidence',()=>{
 const input=delta(),before=structuredClone(input),result=normalize(input);
 assert.deepEqual(result,{recordId:'tiktok-101',postId:'101',observedAt,patch:input.patch,metadataEvidence:compact()});
 assert.deepEqual(input,before);assert.doesNotMatch(JSON.stringify(result.metadataEvidence),/selector|validation|signature|loadedSourceVerified/);
 const selected=delta();selected.patch.thumbnail='https://p16.tiktokcdn.com/selected.jpg';Object.assign(selected.metadataEvidence.thumbnail,{attribute:'currentSrc',observedValue:selected.patch.thumbnail,currentSrc:selected.patch.thumbnail});
 assert.equal(normalize(selected).patch.thumbnail,selected.patch.thumbnail);
 const noImages=normalize(delta('101','@gardenmaker',false));assert.deepEqual(noImages.metadataEvidence.fields,['handle','url','authorUrl']);
 const officialAliases=delta();for(const field of ['handle','url','authorUrl'])officialAliases.metadataEvidence[field].observedValue=officialAliases.metadataEvidence[field].observedValue.replace('www.tiktok.com','tiktok.com').replace('?','/?');
 officialAliases.metadataEvidence.avatar.authorAnchorHref='https://tiktok.com/@gardenmaker/';
 assert.deepEqual(normalize(officialAliases).patch,officialAliases.patch);
});

test('delta normalization rejects identity conflicts, unsafe links and unobserved patch fields',()=>{
 assert.equal(typeof metadata?.normalizePlayerMetadataDelta,'function','normalizePlayerMetadataDelta must be implemented');
 const mutations=[
  d=>{d.recordId='tiktok-102';},d=>{d.postId=101;},d=>{d.observedAt='2026-02-30T12:00:00.000Z';},
  d=>{d.patch.handle='@someoneelse';},d=>{d.patch.url=canonical('102');},d=>{d.patch.url+='?tracking=1';},
  d=>{d.patch.authorUrl='https://www.tiktok.com/@other';},d=>{delete d.patch.authorUrl;},d=>{d.patch.bio='Invented profile';},
  d=>{d.patch.views=1000;},d=>{d.patch.thumbnail='http://p16.tiktokcdn.com/cover.jpg';},d=>{d.patch.avatar='https://user:password@p16.tiktokcdn.com/a.jpg';},
  d=>{d.patch.thumbnail='https://127.0.0.1/image.jpg';},d=>{d.patch.avatar='https://tiktokcdn.com.evil.example/image.jpg';},
  d=>{d.metadataEvidence.handle.observedValue=canonical('102');},d=>{d.metadataEvidence.url.sourceUrl='https://www.tiktok.com/player/v1/102';},
  d=>{d.metadataEvidence.url.sourceUrl='https://www.tiktok.com.evil.example/player/v1/101';},d=>{d.metadataEvidence.handle.sourceUrl='http://www.tiktok.com/player/v1/101';},
  d=>{d.metadataEvidence.url.postId='102';},d=>{d.metadataEvidence.url.observedAt='2026-10-17T13:00:00.000Z';},
  d=>{delete d.metadataEvidence.thumbnail;},d=>{d.metadataEvidence.thumbnail.observedValue='https://p16.tiktokcdn.com/other.jpg';},
  d=>{d.metadataEvidence.thumbnail.src='https://p16.tiktokcdn.com/other.jpg';},d=>{d.metadataEvidence.avatar.authorAnchorHref='https://www.tiktok.com/@other';},
  d=>{delete d.metadataEvidence.avatar.authorAnchorHref;},d=>{d.metadataEvidence.handle={validation:{inputPostIdMatched:true,officialHttpsHost:true,authorAnchorMatches:true}};}
 ];
 for(const mutate of mutations){const input=delta();mutate(input);assert.throws(()=>normalize(input),/metadata|evidence|post|handle|author|patch|url|https|observ/i);}
});

// Replacing the whole archival row or deriving a profile attribute would destroy source provenance.
test('record merge preserves archive fields and never mutates inputs',()=>{
 const record=normalizeRecords([archive()])[0],input=delta(),before=structuredClone(record),beforeDelta=structuredClone(input);
 const result=merge(record,input);
 assert.deepEqual(record,before);assert.deepEqual(input,beforeDelta);
 for(const [field,value]of Object.entries(before))if(!['handle','url','authorUrl','thumbnail','avatar'].includes(field))assert.deepEqual(result[field],value,field);
 assert.equal(result.handle,'@gardenmaker');assert.equal(result.url,canonical('101'));assert.deepEqual(result.metadataEvidence,compact());
 assert.equal(result.bio,'');assert.equal(result.school,'');assert.equal(result.location,'');
 assert.throws(()=>merge({...record,id:'tiktok-102'},input),/post|identity|record|id/i);
 assert.throws(()=>merge({...record,url:'https://www.tiktok.com/player/v1/102'},input),/post|identity|record|id/i);
 assert.throws(()=>merge({...record,handle:'@old',url:'https://www.tiktok.com/@old/video/102'},input),/post|identity|record|id/i);
 const oldImage=normalizeRecords([archive('101',{thumbnail:'https://cdn.example.com/existing.jpg'})])[0];
 assert.equal(merge(oldImage,delta('101','@gardenmaker',false)).thumbnail,oldImage.thumbnail);
});

// Shared browser/Worker normalization must retain field evidence without broadening its claims.
test('shared record normalization preserves bounded compact evidence and rejects inconsistent claims',()=>{
 const row={...archive(),...delta().patch,metadataEvidence:compact()};
 assert.deepEqual(normalizeRecords([row])[0].metadataEvidence,compact());
 assert.deepEqual(normalizeRecords([{...row,metadataEvidence:compact(['thumbnail'])}])[0].metadataEvidence,compact(['thumbnail']));
 const invalid=[
  {fields:[]},{fields:['views']},{fields:['handle','handle']},{fields:Array(6).fill('handle')},
  {sourceType:'provider-observed'},{sourceUrl:'https://www.tiktok.com/player/v1/102'},
  {sourceUrl:'http://www.tiktok.com/player/v1/101'},{sourceUrl:'https://www.tiktok.com/player/v1/101?autoplay=0'},
  {postId:'102'},{observedAt:'not-a-date'},{validation:{trusted:true}}
 ];
 for(const change of invalid)assert.throws(()=>normalizeRecords([{...row,metadataEvidence:{...compact(),...change}}]),/metadata|evidence/i);
 for(const change of [{id:'tiktok-102'},{handle:'@other'},{authorUrl:'https://www.tiktok.com/@other'},{thumbnail:''},{avatar:'http://p16.tiktokcdn.com/avatar.jpg'}])assert.throws(()=>normalizeRecords([{...row,...change}]),/metadata|evidence/i);
});

// A metadata update must not promote archival verification or rewrite SQL metrics/import time.
test('corpus metadata merge preserves storage classifications and metrics while updating FTS',()=>{
 const db=openCorpus(':memory:');try{
  db.upsert([archive()],{kind:'real',source:'permitted-archive',verification:'user-supplied'});
  const before=sqlRow(db),source=JSON.parse(before.record_json);
  assert.equal(typeof db.applyPlayerMetadata,'function','applyPlayerMetadata must be implemented');
  assert.deepEqual(db.applyPlayerMetadata([delta()]),{processed:1,changed:1,total:1});
  const after=sqlRow(db),saved=db.get('tiktok-101');
  assert.deepEqual(unchangedSql(after),unchangedSql(before));assert.equal(after.handle,'creator:901');
  for(const field of ['creatorId','caption','transcript','visualDescription','descriptionSource','postedAt','sourceType','fetchedAt','archiveProvenance','followers','views','likes','comments','shares','unavailableMetrics'])assert.deepEqual(saved[field],source[field],field);
  assert.equal(saved.corpusVerification,'user-supplied');assert.equal(saved.corpusSource,'permitted-archive');assert.equal(saved.corpusImportedAt,before.imported_at);
  assert.equal(db.stats().providerObservedReal,0);assert.equal(db.search('gardenmaker')[0].id,'tiktok-101');
  assert.equal(db.search('marigold')[0].id,'tiktok-101');assert.equal(db.search('lavender')[0].id,'tiktok-101');
  assert.equal(db.search('',{knownHandlesOnly:true})[0].handle,'@gardenmaker');assert.deepEqual(db.search('',{maxFollowers:0}),[]);
  assert.deepEqual(db.applyPlayerMetadata([delta()]),{processed:1,changed:0,total:1});
 }finally{db.close();}
});

// A bad late delta must fail validation before any earlier row reaches SQLite update triggers.
test('corpus validates bounded batches against existing real IDs before writing',()=>{
 const db=openCorpus(':memory:');try{
  db.upsert([archive()],{kind:'real'});db.upsert([archive('102')],{kind:'unverified'});
  let writes=0;db.database.function('metadata_write_probe',()=>{writes++;return 1;});
  db.database.exec('CREATE TEMP TRIGGER count_metadata_writes BEFORE UPDATE ON corpus_videos BEGIN SELECT metadata_write_probe(); END;');
  const before=sqlRow(db);assert.equal(typeof db.applyPlayerMetadata,'function','applyPlayerMetadata must be implemented');
  for(const batch of [[],Array(41).fill(delta()),[delta(),delta()],[delta(),delta('103')],[delta(),delta('102')]]){
   assert.throws(()=>db.applyPlayerMetadata(batch),/batch|40|duplicate|missing|exist|real/i);assert.equal(writes,0);assert.deepEqual(sqlRow(db),before);
  }
  assert.throws(()=>db.applyPlayerMetadata('invalid'),/batch|array/i);
  db.database.prepare("UPDATE corpus_videos SET record_json=json_set(record_json,'$.url','https://www.tiktok.com/player/v1/109') WHERE id='tiktok-101'").run();writes=0;
  assert.throws(()=>db.applyPlayerMetadata([delta()]),/post|identity|record|id/i);assert.equal(writes,0);
 }finally{db.close();}
});

// A later SQLite error must roll back earlier record JSON and all FTS trigger side effects.
test('corpus rolls back metadata and searchable handles when a later SQL update fails',()=>{
 const db=openCorpus(':memory:');try{
  db.upsert([archive(),archive('102',{creatorId:'902'})],{kind:'real'});
  const before=[sqlRow(db),sqlRow(db,'tiktok-102')];assert.equal(typeof db.applyPlayerMetadata,'function','applyPlayerMetadata must be implemented');
  db.database.exec("CREATE TEMP TRIGGER reject_second_metadata BEFORE UPDATE ON corpus_videos WHEN old.id='tiktok-102' BEGIN SELECT RAISE(ABORT,'metadata regression failure'); END;");
  assert.throws(()=>db.applyPlayerMetadata([delta(),delta('102','@secondmaker')]),/metadata regression failure/);
  assert.deepEqual([sqlRow(db),sqlRow(db,'tiktok-102')],before);assert.deepEqual(db.search('gardenmaker'),[]);assert.deepEqual(db.search('secondmaker'),[]);
  assert.equal(db.search('marigold').length,2);assert.equal(db.stats().providerObservedReal,0);
 }finally{db.close();}
});

// Another writer may change the source after preflight; stale merges must never overwrite it.
test('corpus rejects source changes between preflight and transaction without overwriting newer evidence',()=>{
 const db=openCorpus(':memory:');try{
  db.upsert([archive()],{kind:'real'});
  const exec=db.database.exec.bind(db.database);let newer;
  db.database.exec=sql=>{
   if(sql==='BEGIN IMMEDIATE'){
    db.database.prepare("UPDATE corpus_videos SET record_json=json_set(record_json,'$.caption','New sage source evidence','$.views',999),caption='New sage source evidence',views=999,source='new-acquisition' WHERE id='tiktok-101'").run();
    newer=sqlRow(db);
   }
   return exec(sql);
  };
  assert.throws(()=>db.applyPlayerMetadata([delta()]),/changed|conflict|concurrent/i);
  assert.deepEqual(sqlRow(db),newer);assert.equal(db.get('tiktok-101').caption,'New sage source evidence');
  assert.equal(db.get('tiktok-101').views,999);assert.equal(db.get('tiktok-101').handle,'');
  assert.equal(db.search('sage')[0].id,'tiktok-101');assert.deepEqual(db.search('gardenmaker'),[]);
 }finally{db.close();}
});
