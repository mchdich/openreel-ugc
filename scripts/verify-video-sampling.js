#!/usr/bin/env node
/** Optional real-browser regression. Generates its own local test clip; no AI calls. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parseArgs} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';

const {values}=parseArgs({options:{'playwright-module':{type:'string'},'browser-path':{type:'string'},'base-url':{type:'string'},out:{type:'string'}}});
for(const name of ['playwright-module','browser-path'])if(!values[name]||!isAbsolute(values[name]))throw new Error(`Supply an installed absolute --${name}; this script installs nothing.`);
const origin=new URL(values['base-url']||'http://127.0.0.1:3000');
if(!['http:','https:'].includes(origin.protocol)||!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Use the running local app origin for --base-url.');
const {chromium}=createRequire(import.meta.url)(values['playwright-module']);
const browser=await chromium.launch({executablePath:values['browser-path'],headless:true,args:['--disable-gpu']});
try{
  const page=await browser.newPage();await page.goto(origin.href);
  const proof=await page.evaluate(async()=>{
    const {inspectVideo,sampleTimes}=await import('/media.js');
    const canvas=document.createElement('canvas');canvas.width=180;canvas.height=320;
    const context=canvas.getContext('2d'),stream=canvas.captureStream(12),mime='video/mp4;codecs=avc1.42001E';
    if(!MediaRecorder.isTypeSupported(mime))throw new Error('This check requires a Chromium build with H.264 MediaRecorder support.');
    let recorder,timer;
    try{
      recorder=new MediaRecorder(stream,{mimeType:mime});const chunks=[];
      const recorded=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/mp4'}));recorder.onerror=e=>reject(e.error||new Error('Test recording failed.'));});
      const started=performance.now();
      const paint=()=>{const time=(performance.now()-started)/1000;context.fillStyle=time>=4&&time<5?'#00d800':'#0000dc';context.fillRect(0,0,180,320);context.fillStyle='#fff';context.font='15px Arial';context.fillText(time>=4&&time<5?'PRODUCT REVEAL':'Opening scene',10,160);};
      paint();recorder.start();timer=setInterval(paint,70);await new Promise(resolve=>setTimeout(resolve,12100));clearInterval(timer);recorder.stop();
      const file=new File([await recorded],'sampling-regression.mp4',{type:'video/mp4'}),progress=[];
      const begin=performance.now(),prepared=await inspectVideo(file,{onProgress:(done,total)=>progress.push({done,total})});
      let frames;
      try{
        frames=[];
        for(const frame of prepared.attachment.frames){
          const image=new Image();image.src=frame.dataUrl;await image.decode();
          context.drawImage(image,0,0,180,320);const [r,g,b]=context.getImageData(20,20,1,1).data;
          frames.push({timestamp:frame.timestamp,reveal:g>r+30&&g>b+30});
        }
        const controller=new AbortController();let cancelled=false;
        try{const unexpected=await inspectVideo(file,{signal:controller.signal,onProgress:done=>{if(done===3)controller.abort();}});unexpected.dispose();}catch(error){if(error.name!=='AbortError')throw error;cancelled=true;}
        return {generatedTestFixture:true,aiCalls:0,duration:prepared.attachment.duration,elapsedMs:Math.round(performance.now()-begin),fixedTimes:sampleTimes(prepared.attachment.duration),frames,progress,cancelled};
      }finally{prepared.dispose();}
    }finally{clearInterval(timer);if(recorder?.state==='recording')recorder.stop();stream.getTracks().forEach(track=>track.stop());}
  });
  assert.ok(proof.frames.some(frame=>frame.reveal),'The brief visual reveal must appear in the selected JPEGs.');
  assert.ok(proof.frames.length<=8);assert.ok(proof.progress.length<=136);assert.equal(proof.cancelled,true);
  assert.equal(proof.progress.at(-1).done,proof.progress.at(-1).total);
  const directory=resolve(values.out||'data/video-sampling-proof');await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({pass:true,generatedTestFixture:true,frameCount:proof.frames.length,revealTimes:proof.frames.filter(frame=>frame.reveal).map(frame=>frame.timestamp),elapsedMs:proof.elapsedMs,cancelled:proof.cancelled}));
}finally{await browser.close();}
