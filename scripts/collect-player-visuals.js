#!/usr/bin/env node
/** Optional local public-player sampling. Never installs a browser or changes the corpus. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,statSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {inspectPublicPost} from '../lib/social.js';
import {frameDescriptionConfiguration,describeVideoFrames} from '../lib/frame-description.js';
import {validateVisualSourceUrls,capturePublicPlayer,collectPlayerVisuals} from '../lib/player-visuals.js';

const usage=`Optional source-frame collector (Node 24+)
  node --env-file=.env scripts/collect-player-visuals.js --urls source-urls.json --out output-directory
    --playwright-module ABSOLUTE_MODULE_PATH --browser-path ABSOLUTE_BROWSER_PATH
    [--limit 3] [--batch-timeout-ms 240000] [--save-samples]

Input: 1–8 unique canonical TikTok video URLs, within --limit (default 3).
Requires your configured vision API key/model and an already installed browser/runtime.
One ordinary public metadata read and player navigation per source; at most eight JPEG samples
and one vision call. Each capture is limited to 45 seconds and 50 MiB observed network data.
Stops on failure or access verification. No direct media fetch, retry, login or challenge handling.
Writes observations.json, deltas.json and summary.json; no database writes or saved video.
--save-samples additionally saves JPEGs for review. Keep the output outside public source.
Review the descriptions, then apply explicitly with corpus apply-video-evidence.`;
function writeJson(path,value){const temporary=path+'.tmp';writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');renameSync(temporary,path);}
async function main(){
 const {values}=parseArgs({options:{urls:{type:'string'},out:{type:'string'},'playwright-module':{type:'string'},'browser-path':{type:'string'},limit:{type:'string'},'batch-timeout-ms':{type:'string'},'save-samples':{type:'boolean'},help:{type:'boolean',short:'h'}}});
 if(values.help){console.log(usage);return;}
 for(const key of ['urls','out','playwright-module','browser-path'])if(!values[key]?.trim())throw new Error(`Missing --${key}. Use --help for setup.`);
 const limit=Number(values.limit??3),batchTimeout=Number(values['batch-timeout-ms']??240000);
 if(!Number.isSafeInteger(batchTimeout)||batchTimeout<1000||batchTimeout>600000)throw new Error('Batch timeout must be 1000–600000 milliseconds.');
 if(statSync(values.urls).size>65536)throw new Error('Source URL input exceeds 64 KiB.');
 const urls=validateVisualSourceUrls(JSON.parse(readFileSync(values.urls,'utf8').replace(/^\uFEFF/,'')),{limit});
 frameDescriptionConfiguration(process.env); // Preflight before all browser/network work. Never print the key.
 if(!isAbsolute(values['playwright-module'])||!isAbsolute(values['browser-path']))throw new Error('Installed module and browser paths must be absolute.');
 let chromium;try{({chromium}=createRequire(import.meta.url)(values['playwright-module']));if(typeof chromium?.launch!=='function')throw Error();}catch{throw new Error('Optional Playwright module unavailable. No installation was attempted.');}
 if(!statSync(values['browser-path']).isFile())throw new Error('The installed browser path must be an executable file.');
 const output=resolve(values.out),files=['observations.json','deltas.json','summary.json'];
 if(files.some(name=>existsSync(resolve(output,name)))||existsSync(resolve(output,'samples')))throw new Error('Choose an output directory without a previous collection report or samples.');
 mkdirSync(output,{recursive:true});
 const startedAt=new Date().toISOString(),controller=new AbortController();let active=null,navigations=0,modelCalls=0;
 let latest={requested:urls.length,observations:[],deltas:[],stopped:null,notAttempted:[...urls]};
 const save=(result,finishedAt)=>{
  latest=result;
  writeJson(resolve(output,'observations.json'),{schema:'openreel-player-visual-evidence-v1',startedAt,finishedAt,...result,deltas:undefined,navigations,modelCalls,audioAnalyzed:false});
  writeJson(resolve(output,'deltas.json'),{deltas:result.deltas,stopped:result.stopped,notice:'Visual field deltas only. Review samples and descriptions before explicit apply; never import as whole records.'});
  writeJson(resolve(output,'summary.json'),{requested:urls.length,attempted:result.observations.length,described:result.deltas.length,navigations,modelCalls,stopped:result.stopped,notAttempted:result.notAttempted,startedAt,finishedAt,noDatabaseWrites:true,noVideoFilesSaved:true,samplesSaved:Boolean(values['save-samples']),audioAnalyzed:false,captureLimitMs:45000,observedNetworkLimitBytes:50*1024*1024});
 };
 save(latest);
 // Independent deadline covers browser startup, evaluate and cleanup as well as provider I/O.
 const watchdog=setTimeout(()=>{
  controller.abort();const pending=active&&!latest.observations.some(o=>o.sourceUrl===active.sourceUrl)?[{...active,errorCode:'BATCH_TIMEOUT',finishedAt:new Date().toISOString()}]:[];
  const observations=[...latest.observations,...pending],timed={...latest,observations,notAttempted:urls.slice(observations.length),stopped:{code:'BATCH_TIMEOUT',...(active?{sourceUrl:active.sourceUrl}:{})}};
  try{save(timed,new Date().toISOString());}catch{}console.error('Batch deadline exceeded; review the partial report.');setTimeout(()=>process.exit(2),1000);
 },batchTimeout);
 try{
  const report=await collectPlayerVisuals(urls,{limit,signal:controller.signal,
   inspect:async(url,options)=>{active={sourceUrl:url,startedAt:new Date().toISOString(),phase:'metadata'};return inspectPublicPost(url,options);},
   capture:async(source,options)=>{
    active.phase='capture';navigations++;const sampled=await capturePublicPlayer(chromium,source,{...options,executablePath:values['browser-path']});
    if(values['save-samples']){const directory=resolve(output,'samples',source.record.id);mkdirSync(directory,{recursive:true});for(const [i,frame]of sampled.attachment.frames.entries())writeFileSync(resolve(directory,`${i}-${frame.timestamp}.jpg`),Buffer.from(frame.dataUrl.split(',')[1],'base64'));writeJson(resolve(directory,'capture.json'),{visualEvidence:sampled.visualEvidence,snapshot:sampled.snapshot});}
    return sampled;
   },
   describe:async(attachment,options)=>{active.phase='description';modelCalls++;return describeVideoFrames(attachment,process.env,options);},
   afterEach:result=>{save(result);active=null;}
  });
  save(report,new Date().toISOString());console.log(JSON.stringify({attempted:report.observations.length,described:report.deltas.length,modelCalls,stopped:report.stopped,output}));if(report.stopped)process.exitCode=2;if(report.observations.some(o=>o.captureDiagnostic?.cleanupTimedOut||o.captureDiagnostic?.cleanupFailed)){console.error('Owned browser cleanup did not finish; collector process is exiting after preserving the report.');process.exit(2);}
 }finally{clearTimeout(watchdog);}
}
main().catch(error=>{console.error(error?.code?`${error.code}: ${error.message}`:'Collection setup failed. Check input files, output directory and installed runtime paths.');process.exitCode=1;});
