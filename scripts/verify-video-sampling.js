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
  const blockedRequests=[];
  const guard=async page=>page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(['/api/chat','/api/video/analyze','/api/videos/analyze','/api/audio/transcribe','/api/videos/discover','/api/corpus/visual-patterns'].includes(path)){
      blockedRequests.push(path);return route.abort();
    }
    return route.continue();
  });
  const page=await browser.newPage({viewport:{width:1512,height:982}});await guard(page);await page.goto(origin.href);
  await page.waitForFunction(()=>document.querySelector('#engine-status')?.textContent!=='Connecting…');
  await page.waitForTimeout(300);
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
      globalThis.samplingPreviewFixture=file;
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
  for(const timestamp of proof.fixedTimes)assert.ok(proof.frames.some(frame=>frame.timestamp===timestamp),`Baseline sample ${timestamp} must survive.`);
  assert.ok(proof.frames.length<=12);assert.ok(proof.progress.length<=140);assert.equal(proof.cancelled,true);
  assert.equal(proof.progress.at(-1).done,proof.progress.at(-1).total);
  const directory=resolve(values.out||'data/video-sampling-proof');await mkdir(directory,{recursive:true});
  const failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await globalThis.samplingPreviewFixture.arrayBuffer())));
  const fixture={name:'sampling-regression.mp4',mimeType:'video/mp4',buffer:Buffer.from(bytes)};
  const attach=async()=>{
    const chooser=page.waitForEvent('filechooser');await page.locator('[data-action="attach"]').click();
    await (await chooser).setFiles(fixture);
  };
  const draft='why did my video only get 200 views???';
  await page.locator('#question').fill(draft);await attach();
  await page.locator('.attachment-preview video').waitFor({timeout:30000});
  await page.locator('#question').focus();await page.mouse.move(5,5);
  const idle=await page.locator('.composer').evaluate(form=>{
    const video=form.querySelector('video'),style=getComputedStyle(form),rect=form.getBoundingClientRect();
    return {controls:video.controls,tabIndex:video.tabIndex,borderColor:style.borderColor,width:rect.width,height:rect.height};
  });
  check(!idle.controls,'Desktop idle preview should leave the video image unobstructed.');
  check(idle.tabIndex>=0,'The preview should be keyboard focusable.');
  const channels=idle.borderColor.match(/\d+/g)?.map(Number);
  check(channels?.length>=3&&channels[0]===channels[1]&&channels[1]===channels[2],'Composer focus should use a neutral gray border.');
  await page.locator('.composer').screenshot({path:resolve(directory,'desktop-preview.png')});
  await page.locator('.attachment-preview video').hover();
  const hoverControls=await page.locator('.attachment-preview video').evaluate(video=>video.controls);
  check(hoverControls,'Hover should expose native playback controls.');
  await page.mouse.move(5,5);await page.locator('.attachment-preview video').focus();
  const focusControls=await page.locator('.attachment-preview video').evaluate(video=>video.controls);
  check(focusControls,'Keyboard focus should expose native playback controls.');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>{const video=document.querySelector('.attachment-preview video');return !video.paused&&video.currentTime>0.1;});
  await page.keyboard.press('Space');
  const keyboardPlayPause=await page.locator('.attachment-preview video').evaluate(video=>video.paused);
  check(keyboardPlayPause,'Space should play and pause the actual preview.');
  await page.locator('#question').focus();await page.mouse.move(5,5);
  const controlsAfterBlur=await page.locator('.attachment-preview video').evaluate(video=>video.controls);
  check(!controlsAfterBlur,'Controls should hide after pointer and keyboard focus leave the preview.');
  await page.locator('[data-action="remove-video"]').click();
  check(await page.locator('.attachment-preview').count()===0,'Removing a video should clear the preview.');
  await attach();await page.locator('.attachment-preview video').waitFor({timeout:30000});
  const draftPreserved=await page.locator('#question').inputValue()===draft;
  check(draftPreserved,'Replacing the same local video should preserve the draft.');
  const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await guard(touch);await touch.goto(origin.href);
  await touch.waitForTimeout(300);
  await touch.locator('#video-import').setInputFiles(fixture);
  await touch.locator('.attachment-preview video').waitFor({timeout:30000});
  const mobile=await touch.locator('.attachment-preview video').evaluate(video=>({controls:video.controls,noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,hoverAvailable:matchMedia('(hover: hover)').matches}));
  check(mobile.controls&&!mobile.hoverAvailable,'Touch devices should retain native playback controls.');
  check(mobile.noHorizontalOverflow,'The attached mobile composer should fit the viewport.');
  await touch.screenshot({path:resolve(directory,'touch-preview.png')});
  proof.preview={idle,hoverControls,focusControls,keyboardPlayPause,controlsAfterBlur,draftPreserved,mobile,failures,blockedRequests};
  await writeFile(resolve(directory,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');
  assert.deepEqual(blockedRequests,[],'Preview preparation must not send paid analysis or discovery requests.');
  assert.deepEqual(failures,[]);
  console.log(JSON.stringify({pass:true,generatedTestFixture:true,frameCount:proof.frames.length,revealTimes:proof.frames.filter(frame=>frame.reveal).map(frame=>frame.timestamp),elapsedMs:proof.elapsedMs,cancelled:proof.cancelled}));
}finally{await browser.close();}
