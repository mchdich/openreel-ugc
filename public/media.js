/** Put four samples in the first three seconds, then cover the rest of the clip. */
export function sampleTimes(duration){
  if(!Number.isFinite(duration)||duration<=0||duration>600)throw new Error('Choose a video between 0 and 600 seconds long.');
  const end=Math.max(0,duration-.04);
  const proposed=duration>8?[.04,.65,1.5,3,6,duration*.5,duration*.75,end]:Array.from({length:8},(_,i)=>end*i/7);
  return [...new Set(proposed.map(t=>Math.round(Math.min(t,end)*1000)/1000))].sort((a,b)=>a-b);
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
    if((data.length-data.indexOf(',')-1)*.75<=160*1024)return data;
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
    const times=sampleTimes(video.duration);if(!video.videoWidth||!video.videoHeight)throw new Error('This file has no decodable video track.');
    await waitFor(video,'loadeddata',signal,()=>video.readyState>=2);
    const frames=[];
    for(const timestamp of times){
      if(signal?.aborted)throw new DOMException('Video processing cancelled.','AbortError');
      if(Math.abs(video.currentTime-timestamp)>.0005){const seek=waitFor(video,'seeked',signal);video.currentTime=timestamp;await seek;}
      frames.push({timestamp,dataUrl:jpegFrame(video)});onProgress(frames.length,times.length);
    }
    return {attachment:{name:file.name.slice(0,160),duration:video.duration,width:video.videoWidth,height:video.videoHeight,frames,transcript:''},previewUrl,dispose};
  }catch(error){dispose();throw error;}
}
