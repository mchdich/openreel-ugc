import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.js';
const req=(route,body)=>new Request(`https://openreel.test${route}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
test('video analysis route reports missing provider rather than making up visual feedback',async()=>{
  const r=await handleApi(req('/api/video/analyze',{question:'Why did this flop?',attachment:{name:'clip.mp4',duration:2,width:100,height:100,frames:[{timestamp:0,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}],transcript:''}}));
  assert.equal(r.status,503);assert.equal((await r.json()).code,'provider-unconfigured');
});
test('direct import rejects arbitrary fetch targets at its public API boundary',async()=>{
  const r=await handleApi(req('/api/videos/import',{url:'http://127.0.0.1/private'}));assert.equal(r.status,400);
});
test('live discovery has an explicit configuration boundary and no fixture fallback',async()=>{
  const r=await handleApi(req('/api/videos/discover',{query:'study apps',limit:10}));assert.equal(r.status,503);assert.equal((await r.json()).code,'social-unconfigured');
});
test('status reports vision and social capabilities without exposing provider credentials',async()=>{
  const r=await handleApi(new Request('https://openreel.test/api/status'),{OPENAI_API_KEY:'private-key',OPENAI_VISION_MODEL:'vision',APIFY_API_TOKEN:'private-social'});
  const status=await r.json();assert.equal(status.visionConfigured,true);assert.equal(status.discoveryConfigured,true);assert.equal(status.directImportAvailable,true);assert.ok(!JSON.stringify(status).includes('private-'));
});
test('public paid discovery is protected even when no language model is configured',async()=>{
  const r=await handleApi(req('/api/videos/discover',{query:'study apps'}),{APIFY_API_TOKEN:'private-social',OPENREEL_API_TOKEN:'secret'});assert.equal(r.status,401);
});
