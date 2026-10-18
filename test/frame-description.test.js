import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../lib/frame-description.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const describe=(...args)=>{assert.equal(typeof mod.describeVideoFrames,'function');return mod.describeVideoFrames(...args);};
const attachment={name:'Actual-source sample',duration:10,width:720,height:1280,frames:[{timestamp:.04,dataUrl:'data:image/jpeg;base64,/9j/2Q=='},{timestamp:6,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}]};
const env={OPENAI_API_KEY:'private-provider-key',OPENAI_VISION_MODEL:'gpt-5.4-mini'};
const description='The samples show close-up views of a coffee glass on a dark table. Visible hands place a kettle beside the glass.';
const reply=value=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}),{headers:{'content-type':'application/json'}});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}

test('one strict source-description call receives actual sampled images and exact timestamp choices',async()=>{
 let calls=0;await withFetch(async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(init.redirect,'error');const b=JSON.parse(init.body);assert.equal(b.response_format.type,'json_schema');assert.equal(b.response_format.json_schema.strict,true);assert.equal(b.messages.at(-1).content.filter(v=>v.type==='image_url').length,2);assert.deepEqual(b.response_format.json_schema.schema.properties.timestamps.items.enum,[.04,6]);return reply({description,timestamps:[.04,6]});},async()=>{
  const result=await describe(attachment,env);assert.deepEqual(result,{description,timestamps:[.04,6]});assert.equal(calls,1);
 });
});
test('missing provider, invalid samples and an already aborted operation cannot make a paid request',async()=>{
 await withFetch(async()=>assert.fail('Unexpected provider call'),async()=>{
  await assert.rejects(describe(attachment,{}));await assert.rejects(describe({...attachment,duration:601},env));const c=new AbortController();c.abort();await assert.rejects(describe(attachment,env,{signal:c.signal}));
 });
});
test('unseen timestamps, proposals, metrics, acoustics, extra keys and incomplete replies fail without retry',async()=>{
 for(const value of [{description,timestamps:[3]},{description:'Try adding close-up shots to improve the opening.',timestamps:[.04]},{description:'The clip has 1000 views and is trending today.',timestamps:[.04]},{description:'The voiceover is calm and music is playing softly.',timestamps:[.04]},{description,timestamps:[.04],extra:true},{description,timestamps:[6,.04]}]){
  let calls=0;await withFetch(async()=>{calls++;return reply(value);},async()=>{await assert.rejects(describe(attachment,env),e=>e.code==='FRAME_DESCRIPTION_INVALID');assert.equal(calls,1);});
 }
});
test('provider outage and oversized JSON remain explicit and secret-free with one request',async()=>{
 for(const response of [()=>new Response('private-provider-stack',{status:403}),()=>new Response('x'.repeat(70000),{headers:{'content-type':'application/json'}})]){
  let calls=0;await withFetch(async()=>{calls++;return response();},async()=>{await assert.rejects(describe(attachment,env),e=>!e.message.includes('private-')&&e.status>=500);assert.equal(calls,1);});
 }
});
