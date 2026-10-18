import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('collector preserves failed-close diagnostics then exits despite a live browser transport',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'openreel-collector-'));
 try{
  const module=join(directory,'browser.cjs'),preload=join(directory,'preload.cjs'),urls=join(directory,'urls.json'),output=join(directory,'result');
  const url='https://www.tiktok.com/@visual_0/video/1000';
  const item={id:'1000',privateItem:false,author:{id:'5000',uniqueId:'visual_0',privateAccount:false},video:{width:720,height:1280,duration:10}};
  const html='<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.video-detail':{statusCode:0,itemInfo:{itemStruct:item}}}})+'</script>';
  await writeFile(preload,`globalThis.fetch=async input=>{if(!String(input).startsWith('https://www.tiktok.com/'))throw Error('No model/network call after failed cleanup');return new Response(${JSON.stringify(html)},{headers:{'content-type':'text/html'}});};`);
  await writeFile(module,`const url=${JSON.stringify(url)};const page={setDefaultTimeout(){},on(){},url:()=> 'https://www.tiktok.com/player/v1/1000?autoplay=1&muted=1',goto:async()=>({status:()=>200}),waitForFunction:async()=>{},evaluate:async()=>({links:[{href:url},{href:'https://www.tiktok.com/@visual_0'}],images:[]}),locator:()=>({evaluate:async(fn,time)=>time===undefined?{duration:10,width:720,height:1280}:{timestamp:time,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}})};module.exports.chromium={launch:async()=>{setInterval(()=>{},1000);return {newContext:async()=>({newPage:async()=>page,newCDPSession:async()=>({send:async()=>{},on(){}})}),close:async()=>{throw Error('Controlled close failure');}};}};`);
  await writeFile(urls,JSON.stringify([url]));
  let outcome;try{await promisify(execFile)(process.execPath,['--require',preload,resolve('scripts/collect-player-visuals.js'),'--urls',urls,'--out',output,'--playwright-module',module,'--browser-path',process.execPath],{env:{...process.env,OPENAI_API_KEY:'controlled-no-provider',OPENAI_VISION_MODEL:'controlled-vision'},timeout:2500});}catch(error){outcome=error;}
  assert.equal(outcome?.code,2,'Collector must exit with its failure code, not hang on a failed-close transport');assert.equal(outcome.killed,false);
  const summary=JSON.parse(await readFile(join(output,'summary.json'),'utf8')),observations=JSON.parse(await readFile(join(output,'observations.json'),'utf8'));
  assert.equal(summary.stopped.code,'CAPTURE_CLEANUP_FAILED');assert.equal(summary.modelCalls,0);assert.equal(summary.noDatabaseWrites,true);assert.equal(observations.observations[0].captureDiagnostic.cleanupFailed,true);
 }finally{await rm(directory,{recursive:true,force:true});}
});
