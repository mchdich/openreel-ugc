import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePlayerPostIds,detectPlayerBarrier,parsePlayerMetadataSnapshot,collectPlayerMetadataSequential} from '../lib/player-metadata-dom.js';
import {normalizePlayerMetadataDelta} from '../lib/player-metadata.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const id='7000000000000000001',other='7000000000000000002',third='7000000000000000003';
// Fictional metadata fixtures: no creator content, actual observations, or images bundled.
function snapshot(postId=id){
 return {videoId:postId,sourceUrl:`https://www.tiktok.com/player/v1/${postId}?autoplay=0`,finalUrl:`https://www.tiktok.com/player/v1/${postId}?autoplay=0`,documentStatus:200,observedAt:'2026-10-17T23:00:00.000Z',dom:{barrierText:'',visibleChallenge:false,hasPasswordInput:false,unavailable:false,links:[{href:`https://www.tiktok.com/@fixture_creator/video/${postId}?refer=player_v1`},{href:'https://www.tiktok.com/@fixture_creator?refer=player_v1'}],images:[{alt:'Video Cover',src:'https://p16-common-sign.tiktokcdn-us.com/fixture-cover.image?x-expires=1792447200',currentSrc:'',srcset:'',width:540,height:960,ancestorHref:''},{alt:'',src:'https://p16-common-sign.tiktokcdn-us.com/fixture-avatar.jpeg',currentSrc:'',srcset:'',width:100,height:100,ancestorHref:'https://www.tiktok.com/@fixture_creator?refer=player_v1'}]}};
}
test('validates explicit unique numeric strings and operator limit before navigation',()=>{
 assert.deepEqual(validatePlayerPostIds([id,other]),[id,other]);
 for(const invalid of [[],[id,id],[Number(id)],['https://www.tiktok.com/player/v1/'+id],Array.from({length:6},(_,i)=>String(700+i))])assert.throws(()=>validatePlayerPostIds(invalid));
 assert.equal(validatePlayerPostIds(Array.from({length:40},(_,i)=>String(700+i)),{limit:40}).length,40);
 assert.throws(()=>validatePlayerPostIds([id],{limit:41}));
});
test('emits identity and image fields only with field-specific observed evidence',()=>{
 const result=parsePlayerMetadataSnapshot(snapshot());
 assert.equal(result.patch.handle,'@fixture_creator');assert.equal(result.patch.url,'https://www.tiktok.com/@fixture_creator/video/7000000000000000001');
 assert.equal(result.patch.authorUrl,'https://www.tiktok.com/@fixture_creator');assert.equal(result.patch.thumbnail,'https://p16-common-sign.tiktokcdn-us.com/fixture-cover.image?x-expires=1792447200');
 assert.equal(result.metadataEvidence.thumbnail.selector,'img[alt="Video Cover"]');assert.equal(result.metadataEvidence.thumbnail.urlExpiresAt,'2026-10-19T22:00:00.000Z');
 assert.equal(result.metadataEvidence.avatar.authorAnchorHref,'https://www.tiktok.com/@fixture_creator?refer=player_v1');
 assert.equal(result.metadataEvidence.url.observedValue,snapshot().dom.links[0].href);
 assert.deepEqual(Object.keys(result.patch).sort(),['authorUrl','avatar','handle','thumbnail','url']);
 for(const field of ['sourceType','fetchedAt','caption','transcript','postedAt','views','bio','school','archiveProvenance','corpusVerification'])assert.equal(result[field],undefined);
});
test('rejects wrong post ID, hostile URL, conflicting creators and uncorroborated handles',()=>{
 for(const change of [value=>value.dom.links[0].href='https://www.tiktok.com/@fixture_creator/video/123',value=>value.dom.links[0].href=`https://www.tiktok.com.evil.test/@fixture_creator/video/${id}`,value=>value.dom.links.push({href:`https://www.tiktok.com/@different_fixture/video/${id}`}),value=>value.dom.links.pop(),value=>value.finalUrl=`https://www.tiktok.com/player/v1/${other}`,value=>value.observedAt='invalid']){
  const value=snapshot();change(value);assert.equal(parsePlayerMetadataSnapshot(value),null);
 }
});
test('requires loaded official image elements and a matching author ancestor for avatars',()=>{
 const value=snapshot();value.dom.images[0].width=0;value.dom.images[1].ancestorHref='https://www.tiktok.com/@different_fixture';
 const result=parsePlayerMetadataSnapshot(value);assert.equal(result.patch.thumbnail,undefined);assert.equal(result.patch.avatar,undefined);assert.deepEqual(result.unknownFields,['thumbnail','avatar']);
 const hostile=snapshot();hostile.dom.images[0].src='https://evil.test/fixture-cover.image';assert.equal(parsePlayerMetadataSnapshot(hostile).patch.thumbnail,undefined);
 const ambiguous=snapshot();ambiguous.dom.images.push({...ambiguous.dom.images[0],src:'https://p16-common-sign.tiktokcdn-us.com/different-cover.image'});assert.equal(parsePlayerMetadataSnapshot(ambiguous).patch.thumbnail,undefined);
});
test('distinguishes selected currentSrc from DOM src and legacy unproved image selection',()=>{
 const value=snapshot();value.dom.images[0].currentSrc='https://p16-common-sign.tiktokcdn-us.com/selected-cover.image';value.dom.images[0].srcset='https://p16-common-sign.tiktokcdn-us.com/selected-cover.image 2x';
 const result=parsePlayerMetadataSnapshot(value);assert.equal(result.patch.thumbnail,'https://p16-common-sign.tiktokcdn-us.com/selected-cover.image');assert.equal(result.metadataEvidence.thumbnail.attribute,'currentSrc');assert.equal(result.metadataEvidence.thumbnail.currentSrc,result.patch.thumbnail);assert.equal(result.metadataEvidence.thumbnail.src,snapshot().dom.images[0].src);assert.equal(result.metadataEvidence.thumbnail.validation.loadedSourceVerified,true);
 const legacy=parsePlayerMetadataSnapshot(snapshot());assert.equal(legacy.metadataEvidence.thumbnail.validation.loadedSourceVerified,false);assert.equal(legacy.metadataEvidence.thumbnail.validation.imageElementLoaded,true);
});
test('parser deltas satisfy storage validation for responsive and official alias observations',()=>{
 const value=snapshot();
 value.dom.links=value.dom.links.map(link=>({href:link.href.replace('www.tiktok.com','tiktok.com').replace('?','/?')}));
 value.dom.images[1].ancestorHref='https://tiktok.com/@fixture_creator/';
 value.dom.images[0].currentSrc='https://p16-common-sign.tiktokcdn-us.com/selected-cover.image';
 const raw=parsePlayerMetadataSnapshot(value),stored=normalizePlayerMetadataDelta(raw);
 assert.equal(stored.patch.thumbnail,'https://p16-common-sign.tiktokcdn-us.com/selected-cover.image');
 assert.equal(stored.patch.handle,'@fixture_creator');assert.equal(stored.metadataEvidence.sourceUrl,'https://www.tiktok.com/player/v1/7000000000000000001');
});
test('detects HTTP barriers, login navigation and visible challenges',()=>{
 for(const value of [{...snapshot(),documentStatus:403},{...snapshot(),documentBarrierStatus:429},{...snapshot(),finalUrl:'https://www.tiktok.com/login'}, {...snapshot(),dom:{...snapshot().dom,visibleChallenge:true}}, {...snapshot(),dom:{...snapshot().dom,barrierText:'Verify you are human'}}])assert.ok(detectPlayerBarrier(value));
 assert.equal(detectPlayerBarrier(snapshot()),null);
 const unavailable=snapshot();unavailable.dom.unavailable=true;unavailable.dom.links=[];assert.equal(parsePlayerMetadataSnapshot(unavailable),null);
});
test('preserves partial observations then halts at first barrier without retry',async()=>{
 const visited=[];const saved=[];
 const result=await collectPlayerMetadataSequential([id,other,third],async postId=>{visited.push(postId);return postId===other?{...snapshot(postId),documentStatus:403}:snapshot(postId);},{afterEach:value=>saved.push(value.observations.length)});
 assert.deepEqual(visited,[id,other]);assert.deepEqual(saved,[1,2]);assert.equal(result.deltas.length,1);assert.equal(result.stopped.videoId,other);assert.equal(result.requested,3);
});
test('batch deadline prevents the next observation and navigation failure stops immediately',async()=>{
 let clock=0;const visited=[];
 const result=await collectPlayerMetadataSequential([id,other],async postId=>{visited.push(postId);clock=1001;return snapshot(postId);},{maxElapsedMs:1000,now:()=>clock});
 assert.deepEqual(visited,[id]);assert.equal(result.stopped.code,'BATCH_TIMEOUT');
 const failed=await collectPlayerMetadataSequential([id,other],async()=>{throw new Error('navigation timed out');});assert.equal(failed.observations.length,1);assert.equal(failed.stopped.code,'NAVIGATION_ERROR');
});
test('collector help does not load optional browser runtime; unavailable runtime fails without collection',()=>{
 const help=spawnSync(process.execPath,[join(root,'scripts/collect-player-metadata.js'),'--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/playwright-module/);assert.match(help.stdout,/--out/);
 const directory=mkdtempSync(join(tmpdir(),'openreel-player-cli-'));
 try{
  writeFileSync(join(directory,'ids.json'),JSON.stringify([id]));
  const missing=spawnSync(process.execPath,[join(root,'scripts/collect-player-metadata.js'),'--ids',join(directory,'ids.json'),'--out',join(directory,'result'),'--playwright-module',join(directory,'unavailable-module'),'--browser-path',join(directory,'missing-browser')],{encoding:'utf8'});
  assert.notEqual(missing.status,0);assert.match(missing.stderr,/optional.*Playwright|Playwright.*unavailable/i);assert.equal(existsSync(join(directory,'result')),false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('apply command requires explicit database and rejects oversized deltas before opening it',()=>{
 const directory=mkdtempSync(join(tmpdir(),'openreel-player-apply-'));
 try{
  const input=join(directory,'deltas.json');writeFileSync(input,JSON.stringify({deltas:[]}));
  const noDb=spawnSync(process.execPath,[join(root,'scripts/corpus.js'),'apply-player-metadata',input],{encoding:'utf8'});assert.notEqual(noDb.status,0);assert.match(noDb.stderr,/explicit --db/);
  writeFileSync(input,JSON.stringify({deltas:Array.from({length:41},()=>({}))}));
  const path=join(directory,'must-not-exist.sqlite');
  const oversized=spawnSync(process.execPath,[join(root,'scripts/corpus.js'),'apply-player-metadata',input,'--db',path],{encoding:'utf8'});assert.notEqual(oversized.status,0);assert.match(oversized.stderr,/1.?40|1.*40/);assert.equal(existsSync(path),false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('does not emit invalid snapshots or transfer a different observed ID into the requested batch',async()=>{
 const numeric=snapshot();numeric.videoId=Number(id);assert.equal(parsePlayerMetadataSnapshot(numeric),null);
 const malformed=snapshot();malformed.dom.links.unshift(null);malformed.dom.images.unshift(null);assert.equal(parsePlayerMetadataSnapshot(malformed).patch.handle,'@fixture_creator');
 const result=await collectPlayerMetadataSequential([id,third],async()=>snapshot(other));assert.equal(result.deltas.length,0);assert.equal(result.stopped.code,'OBSERVATION_ID_MISMATCH');assert.equal(result.observations.length,1);
});
test('times out an uncooperative observation and aborts its signal while retaining partial output',{timeout:2500},async()=>{
 let aborted=false;const saved=[];
 const started=performance.now();
 const result=await collectPlayerMetadataSequential([id,other],async(postId,{signal})=>{signal?.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});},{maxElapsedMs:1000,afterEach:value=>saved.push(value.observations.length)});
 assert.ok(performance.now()-started<2500);assert.equal(aborted,true);assert.equal(result.stopped.code,'BATCH_TIMEOUT');assert.equal(result.observations.length,1);assert.deepEqual(result.notAttempted,[other]);assert.deepEqual(saved,[1]);
});
test('CLI watchdog saves an active attempt and exits when optional browser page creation stalls',()=>{
 const directory=mkdtempSync(join(tmpdir(),'openreel-player-watchdog-'));
 try{
  const modulePath=join(directory,'browser-double.cjs');
  // Only the external browser boundary is replaced; the real CLI budgets and report writer execute.
  writeFileSync(modulePath,"module.exports={chromium:{launch:async()=>({newContext:async()=>({newPage:async()=>new Promise(()=>{}),close:async()=>{}}),close:async()=>{}})}};");
  const ids=join(directory,'ids.json'),out=join(directory,'report');writeFileSync(ids,JSON.stringify([id,other]));
  const result=spawnSync(process.execPath,[join(root,'scripts/collect-player-metadata.js'),'--ids',ids,'--out',out,'--playwright-module',modulePath,'--browser-path',process.execPath,'--batch-timeout-ms','1000'],{encoding:'utf8',timeout:4000});
  assert.equal(result.error,undefined);assert.equal(result.status,2);
  const report=JSON.parse(readFileSync(join(out,'summary.json'),'utf8'));assert.equal(report.stopped.code,'BATCH_TIMEOUT');assert.equal(report.navigationCount,0);assert.equal(report.observations,1);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
