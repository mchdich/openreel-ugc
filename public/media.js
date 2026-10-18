import {MAX_VIDEO_FRAMES} from './engine.js';
/** Put four samples in the first three seconds, then cover the rest of the clip. */
export function sampleTimes(duration){
  if(!Number.isFinite(duration)||duration<=0||duration>600)throw new Error('Choose a video between 0 and 600 seconds long.');
  const end=Math.max(0,duration-.04);
  const proposed=duration>8?[.04,.65,1.5,3,6,duration*.5,duration*.75,end]:Array.from({length:8},(_,i)=>end*i/7);
  return [...new Set(proposed.map(t=>Math.round(Math.min(t,end)*1000)/1000))].sort((a,b)=>a-b);
}
/** Preserve the opening and ending, then cover distinct measured visual states. */
export function selectFrameTimes(duration,samples=[]){
  const baseline=sampleTimes(duration);
  if(!Array.isArray(samples)||samples.length>128)throw new Error('Visual analysis must contain at most 128 samples.');
  let previous=-1,size;
  for(const sample of samples){
    const descriptor=sample?.descriptor;
    if(!Number.isFinite(sample?.timestamp)||sample.timestamp<0||sample.timestamp>=duration||sample.timestamp<=previous||!Array.isArray(descriptor)||descriptor.length<3||descriptor.length>768||size!==undefined&&descriptor.length!==size||descriptor.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('Invalid visual analysis sample.');
    previous=sample.timestamp;size=descriptor.length;
  }
  if(!samples.length)return baseline;
  const nearest=time=>samples.reduce((best,sample)=>Math.abs(sample.timestamp-time)<Math.abs(best.timestamp-time)?sample:best);
  const distance=(a,b)=>a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]),0)/a.length;
  const selected=[...baseline],gap=Math.min(2,Math.max(.2,duration/40));
  while(selected.length<Math.min(MAX_VIDEO_FRAMES,baseline.length+4)){
    let best,score=.025;
    for(const sample of samples){
      if(selected.some(time=>Math.abs(time-sample.timestamp)<gap))continue;
      const novelty=Math.min(...selected.map(time=>distance(sample.descriptor,nearest(time).descriptor)));
      if(novelty>score){best=sample.timestamp;score=novelty;}
    }
    if(best===undefined)break;
    selected.push(best);
  }
  return selected.sort((a,b)=>a-b);
}
export function inspectionTimes(duration){
  const end=Math.max(0,duration-.04),count=Math.min(120,Math.max(2,Math.ceil(duration*2)+1));
  return [...new Set([...sampleTimes(duration),...Array.from({length:count},(_,i)=>Math.round(end*i/(count-1)*1000)/1000)])].sort((a,b)=>a-b);
}

function waitFor(video,event,signal,ready){
  if(signal?.aborted)return Promise.reject(new DOMException('Video processing cancelled.','AbortError'));
  if(ready?.())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',fail);signal?.removeEventListener('abort',abort);};
    const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(new Error('This browser could not decode that video. Try MP4 (H.264) or WebM.'));},abort=()=>{cleanup();reject(new DOMException('Video processing cancelled.','AbortError'));};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Video decoding took too long. Try a shorter clip.'));},15000);
    video.addEventListener(event,done,{once:true});video.addEventListener('error',fail,{once:true});signal?.addEventListener('abort',abort,{once:true});
  });
}
function jpegFrame(video){
  const canvas=document.createElement('canvas');let scale=Math.min(1,960/video.videoWidth,960/video.videoHeight);
  for(let pass=0;pass<5;pass++){
    canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',Math.max(.3,.78-pass*.1));
    if((data.length-data.indexOf(',')-1)*.75<=1280*1024/MAX_VIDEO_FRAMES)return data;
    scale*=.78;
  }
  throw new Error('The video frames could not be compressed to a safe size.');
}
/** Decode a user-selected File locally. Only sampled JPEGs leave the browser on submit. */
export async function inspectVideo(file,{signal,onProgress=()=>{}}={}){
  if(!file||file.size<=0||file.size>50*1024*1024)throw new Error('Choose a video smaller than 50 MiB.');
  if(!/^video\//.test(file.type)&&! /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name))throw new Error('Choose an MP4, WebM, or other supported video file.');
  const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
  const previewUrl=URL.createObjectURL(file);let released=false;
  const dispose=()=>{if(released)return;released=true;video.removeAttribute('src');video.load();URL.revokeObjectURL(previewUrl);};
  try{
    video.src=previewUrl;await waitFor(video,'loadedmetadata',signal,()=>video.readyState>=1);
    const scanTimes=inspectionTimes(video.duration);if(!video.videoWidth||!video.videoHeight)throw new Error('This file has no decodable video track.');
    await waitFor(video,'loadeddata',signal,()=>video.readyState>=2);
    const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
    const context=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
    const samples=[],total=scanTimes.length+MAX_VIDEO_FRAMES;
    for(const timestamp of scanTimes){
      if(signal?.aborted)throw new DOMException('Video processing cancelled.','AbortError');
      if(Math.abs(video.currentTime-timestamp)>.0005){const seek=waitFor(video,'seeked',signal);video.currentTime=timestamp;await seek;}
      context.drawImage(video,0,0,16,16);
      const pixels=context.getImageData(0,0,16,16).data,descriptor=[];
      for(let i=0;i<pixels.length;i+=4)descriptor.push(pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255);
      samples.push({timestamp,descriptor});onProgress(samples.length,total);
    }
    const times=selectFrameTimes(video.duration,samples),frames=[],selectedTotal=scanTimes.length+times.length;
    for(const timestamp of times){
      if(signal?.aborted)throw new DOMException('Video processing cancelled.','AbortError');
      if(Math.abs(video.currentTime-timestamp)>.0005){const seek=waitFor(video,'seeked',signal);video.currentTime=timestamp;await seek;}
      frames.push({timestamp,dataUrl:jpegFrame(video)});onProgress(scanTimes.length+frames.length,selectedTotal);
    }
    return {attachment:{name:file.name.slice(0,160),duration:video.duration,width:video.videoWidth,height:video.videoHeight,frames,transcript:''},previewUrl,dispose};
  }catch(error){dispose();throw error;}
}
