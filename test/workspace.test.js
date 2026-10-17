import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWorkspace,mergeLibrary} from '../public/workspace.js';

const record={id:'one',handle:'safe.creator',hook:'A hook',followers:1500};
const result={title:'Result',summary:'Summary',sections:[],sources:[record],creators:[]};
const chat=(r=result)=>({id:'chat',title:'My research',messages:[{role:'assistant',result:r}]});
test('corrupt nested conversations cannot reach the renderer',()=>{
  const workspace=normalizeWorkspace({records:[record],conversations:[chat({...result,creators:[null]}),{id:'bad',title:'Bad',messages:[null]}],alerts:[]});
  assert.deepEqual(workspace.conversations,[]);
});
test('valid records are normalized in research results and alerts have iterable seen IDs',()=>{
  const workspace=normalizeWorkspace({records:[record],conversations:[chat({...result,sources:[{...record,hook:123}]})],alerts:[{id:'alert',query:'study',seen:{not:'iterable'},paused:false}],activeId:'chat'});
  assert.equal(workspace.conversations[0].messages[0].result.sources[0].hook,'123');
  assert.deepEqual(workspace.alerts[0].seen,[]);
  assert.equal(workspace.activeId,'chat');
});
test('unsafe links invalidate a stored result and empty active IDs recover to the home screen',()=>{
  const workspace=normalizeWorkspace({records:[record],conversations:[chat({...result,sources:[{...record,url:'javascript:alert(1)'}]})],activeId:'missing'});
  assert.deepEqual(workspace.conversations,[]);assert.equal(workspace.activeId,null);
});
test('invalid replacement libraries throw without modifying supplied data',()=>{
  const input={records:[{handle:'bad',url:'javascript:alert(1)'}]};const copy=structuredClone(input);
  assert.throws(()=>normalizeWorkspace(input),/url/);assert.deepEqual(input,copy);
});
test('attachment evidence survives reload without retaining frame or video payloads',()=>{
  const workspace=normalizeWorkspace({records:[record],conversations:[{id:'video',title:'Video',messages:[{role:'user',content:'Review this',attachment:{name:'clip.webm',duration:3,frames:['secret-image']}},{role:'assistant',result:{...result,videoAnalysis:{name:'clip.webm',duration:3,frameCount:2,timestamps:[0,2],audioAvailable:false,frames:['secret-image']}}}]}]});
  const messages=workspace.conversations[0].messages;
  assert.deepEqual(messages[0].attachment,{name:'clip.webm',duration:3});
  assert.equal(messages[1].result.videoAnalysis.frameCount,2);
  assert.ok(!JSON.stringify(workspace).includes('secret-image'));
});
test('URL and manual additions are atomic at library capacity while existing IDs can update',()=>{
  const library=Array.from({length:2000},(_,i)=>({id:'r'+i,handle:'creator'+i,caption:'Original'}));
  const copy=structuredClone(library);
  assert.throws(()=>mergeLibrary(library,[{id:'extra',handle:'extra'}]),/2000|2,000|full/i);
  assert.deepEqual(library,copy);
  const updated=mergeLibrary(library,[{id:'r5',handle:'creator5',caption:'Updated'}]);
  assert.equal(updated.length,2000);assert.equal(updated.find(r=>r.id==='r5').caption,'Updated');
});
test('real library merges can replace examples without silently evicting real records',()=>{
  const merged=mergeLibrary([{id:'demo',handle:'demo',demo:true},{id:'real',handle:'real'}],[{id:'new',handle:'new'}],{dropExamples:true});
  assert.deepEqual(merged.map(r=>r.id),['real','new']);
});

test('saved insights retain bounded source links and supplied rationale with valid source IDs',()=>{
  const workspace=normalizeWorkspace({records:[record],conversations:[chat({...result,sections:[{heading:'Insight',text:'Evidence',sourceIds:['one','one','unknown'],rationale:{label:'Hypothesis',text:'Try a different opening.'}}]})]});
  const section=workspace.conversations[0].messages[0].result.sections[0];assert.deepEqual(section.sourceIds,['one']);assert.deepEqual(section.rationale,{label:'Hypothesis',text:'Try a different opening.'});
});

test('each saved chat retains only its explicit supported research source',()=>{
 for(const source of ['library','corpus','live']){
  const workspace=normalizeWorkspace({records:[record],conversations:[{...chat(),source}],activeId:'chat'});
  assert.equal(workspace.conversations[0].source,source);assert.equal(workspace.activeId,'chat');
 }
 for(const source of ['video','unknown',{},null]){
  const workspace=normalizeWorkspace({records:[record],conversations:[{...chat(),source}]});
  assert.equal(workspace.conversations.length,1);assert.equal(workspace.conversations[0].source,undefined);
 }
});
test('legacy corpus answers restore their explicit corpus provenance without guessing from prose',()=>{
 const legacy=normalizeWorkspace({records:[record],conversations:[chat({...result,corpus:{total:154424,byKind:{real:154424}}})]});
 assert.equal(legacy.conversations[0].source,'corpus');
 const ordinary=normalizeWorkspace({records:[record],conversations:[chat({...result,notice:'corpus'})]});assert.equal(ordinary.conversations[0].source,undefined);
 const explicit=normalizeWorkspace({records:[record],conversations:[{...chat({...result,corpus:{total:1,byKind:{real:1}}}),source:'library'}]});assert.equal(explicit.conversations[0].source,'library');
});
