/** Serializable browser-only helper. Never reads a microphone, system audio or media URL. */
export async function captureOpeningAudio(video,{maxSeconds=30}={}){
 if(!Number.isInteger(maxSeconds)||maxSeconds<1||maxSeconds>30||!Number.isFinite(video?.duration)||video.duration<=0||video.duration>600)throw new Error('Opening audio requires a video and a whole-second limit from 1 to 30.');
 const unavailable=reason=>({status:'unavailable',reason});
 if(typeof video.captureStream!=='function'||typeof globalThis.AudioContext!=='function'||typeof globalThis.MediaStream!=='function')return unavailable('unsupported');
 let stream,context,source,processor,gain,timer,resumeTimer,endedTimer,finish,samples,playing=false,reason;
 const ended=()=>{endedTimer=setTimeout(()=>finish?.(),300);};
 try{
  video.pause();video.muted=true;
  if(Math.abs(video.currentTime)>.001)await new Promise((resolve,reject)=>{let seekTimer;const clear=()=>{clearTimeout(seekTimer);video.removeEventListener('seeked',done);video.removeEventListener('error',failed);},done=()=>{clear();resolve();},failed=()=>{clear();reject(new Error('Audio start seek failed'));};seekTimer=setTimeout(failed,4000);video.addEventListener('seeked',done,{once:true});video.addEventListener('error',failed,{once:true});video.currentTime=0;});
  if(video.seeking||video.readyState<2||!Number.isFinite(video.currentTime)||video.currentTime>.1||video.playbackRate!==1)return unavailable('source-not-ready');
  stream=video.captureStream();const tracks=stream.getAudioTracks();if(!tracks.length)return unavailable('no-audio-track');
  context=new AudioContext({sampleRate:16000});await Promise.race([context.resume(),new Promise(resolve=>{resumeTimer=setTimeout(resolve,1000);})]);clearTimeout(resumeTimer);
  if(context.state!=='running')return unavailable('suspended');if(context.sampleRate!==16000)return unavailable('unsupported-sample-rate');
  const wanted=Math.max(1,Math.floor(Math.min(maxSeconds,video.duration)*16000));samples=new Float32Array(wanted);let count=0,sum=0,peak=0;
  source=context.createMediaStreamSource(new MediaStream(tracks));processor=context.createScriptProcessor(4096,1,1);gain=context.createGain();gain.gain.value=0;
  const recording=new Promise(resolve=>{finish=resolve;});
  processor.onaudioprocess=event=>{
   event.outputBuffer.getChannelData(0).fill(0);if(!playing||count>=wanted)return;
   const data=event.inputBuffer.getChannelData(0),length=Math.min(data.length,wanted-count);
   for(let i=0;i<length;i++){if(!Number.isFinite(data[i])){reason='invalid-samples';finish();return;}const value=Math.max(-1,Math.min(1,data[i]));samples[count++]=value;sum+=value*value;peak=Math.max(peak,Math.abs(value));}
   if(count===wanted)finish();
  };
  source.connect(processor);processor.connect(gain);gain.connect(context.destination);video.addEventListener('ended',ended,{once:true});
  const sourceStart=video.currentTime,started=performance.now();timer=setTimeout(()=>{reason='capture-timeout';finish();},Math.min(33000,(wanted/16000+3)*1000));playing=true;
  await Promise.race([video.play(),recording]);await recording;playing=false;video.pause();
  const sourceEnd=video.currentTime,duration=count/16000,rms=count?Math.sqrt(sum/count):0;
  if(reason)return unavailable(reason);
  if(!count||!Number.isFinite(sourceEnd)||sourceEnd<=sourceStart||sourceEnd>video.duration+.1||Math.abs(sourceEnd-sourceStart-duration)>1)return unavailable('playback-stalled');
  if(rms<=.0001||peak<=.0003)return unavailable('silent-or-unavailable');
  const bytes=new Uint8Array(44+count*2),view=new DataView(bytes.buffer),label=(offset,text)=>{for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);};
  label(0,'RIFF');view.setUint32(4,bytes.length-8,true);label(8,'WAVE');label(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++)view.setInt16(44+i*2,Math.round(samples[i]*(samples[i]<0?32768:32767)),true);
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));const dataUrl='data:audio/wav;base64,'+btoa(binary);bytes.fill(0);binary='';
  return {status:'available',chunk:{duration,dataUrl},sourceStart,sourceEnd,recordedWallMs:performance.now()-started,rms,peak,sampleRate:16000};
 }catch(error){return unavailable(error?.name==='SecurityError'?'protected-or-unavailable':error?.name==='NotAllowedError'?'playback-unavailable':'capture-error');}
 finally{playing=false;clearTimeout(timer);clearTimeout(resumeTimer);clearTimeout(endedTimer);video.removeEventListener('ended',ended);video.pause();if(processor)processor.onaudioprocess=null;source?.disconnect();processor?.disconnect();gain?.disconnect();stream?.getTracks().forEach(track=>track.stop());samples?.fill(0);if(context)try{await context.close();}catch{}}
}
