import {normalizeRecords,MAX_RECORDS} from './engine.js';

/** Validate before replacing state; a full browser library never evicts real records. */
export function mergeLibrary(records,incoming,{dropExamples=false}={}){
  if(!Array.isArray(records)||!Array.isArray(incoming))throw new Error('Invalid library records.');
  const existing=records.length?normalizeRecords(records):[];
  const additions=incoming.length?normalizeRecords(incoming):[];
  const merged=new Map(existing.filter(r=>!dropExamples||!r.demo).map(r=>[r.id,r]));
  for(const record of additions)merged.set(record.id,record);
  if(merged.size>MAX_RECORDS)throw new Error('Your browser library is full (2,000 records). Export it before replacing records, or use the server corpus. No records were removed.');
  return [...merged.values()];
}

const text=(v,max=6000)=>{if(typeof v!=='string')throw new Error('Invalid saved text.');return v.slice(0,max);};
const recordList=(v)=>{if(!Array.isArray(v))throw new Error('Invalid saved records.');return v.length?normalizeRecords(v):[];};
function videoMetadata(value){
  if(!value||typeof value.name!=='string'||!Number.isFinite(value.duration)||value.duration<=0||value.duration>600)return null;
  return {name:value.name.slice(0,160),duration:value.duration};
}
function conversation(value){
  try{
    const id=text(value.id,200),title=text(value.title,200);
    if(!id||!Array.isArray(value.messages))return null;
    const messages=value.messages.slice(-200).map(m=>{
      if(m.role==='user'){const attachment=videoMetadata(m.attachment);return {role:'user',content:text(m.content),...(attachment?{attachment}:{})};}
      if(m.role!=='assistant')throw new Error('Invalid message role.');
      if(typeof m.error==='string')return {role:'assistant',error:text(m.error)};
      const r=m.result;
      if(!Array.isArray(r.sections)||r.sections.length>10)throw new Error('Invalid sections.');
      const sources=recordList(r.sources),sourceIds=new Set(sources.map(record=>record.id));
      const result={kind:typeof r.kind==='string'?r.kind:'research',mode:r.mode==='ai'?'ai':'deterministic',title:text(r.title,300),summary:text(r.summary),
        sections:r.sections.map(s=>({heading:text(s.heading,200),text:text(s.text,5000),...(Array.isArray(s.sourceIds)?{sourceIds:[...new Set(s.sourceIds.filter(id=>sourceIds.has(id)))].slice(0,2000)}:{}),...(s.rationale?{rationale:{text:text(s.rationale.text,2000),...(s.rationale.label?{label:text(s.rationale.label,80)}:{})}}:{})})),sources,creators:recordList(r.creators)};
      if(typeof r.notice==='string')result.notice=text(r.notice);
      const video=videoMetadata(r.videoAnalysis);
      if(video&&Number.isInteger(r.videoAnalysis.frameCount)&&r.videoAnalysis.frameCount>=1&&r.videoAnalysis.frameCount<=8&&Array.isArray(r.videoAnalysis.timestamps)&&r.videoAnalysis.timestamps.length===r.videoAnalysis.frameCount&&r.videoAnalysis.timestamps.every(t=>Number.isFinite(t)&&t>=0&&t<=video.duration))result.videoAnalysis={...video,frameCount:r.videoAnalysis.frameCount,timestamps:[...r.videoAnalysis.timestamps],audioAvailable:r.videoAnalysis.audioAvailable===true,transcriptProvided:r.videoAnalysis.transcriptProvided===true};
      return {role:'assistant',result};
    });
    const lastAnswer=[...value.messages].reverse().find(message=>message?.role==='assistant'&&message.result)?.result;
    const source=['library','corpus','live'].includes(value.source)?value.source:value.source===undefined&&Number.isSafeInteger(lastAnswer?.corpus?.byKind?.real)&&lastAnswer.corpus.byKind.real>=0?'corpus':undefined;
    return {id,title,createdAt:typeof value.createdAt==='string'?value.createdAt:'',messages,...(source?{source}:{})};
  }catch{return null;}
}

/** Validate all nested data before it reaches browser rendering or alert iteration. */
export function normalizeWorkspace(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid workspace.');
  const records=normalizeRecords(input.records);
  const conversations=Array.isArray(input.conversations)?input.conversations.slice(0,100).map(conversation).filter(Boolean):[];
  const bookmarks=Array.isArray(input.bookmarks)?[...new Set(input.bookmarks.filter(id=>typeof id==='string'&&records.some(r=>r.id===id)))]:[];
  const alerts=Array.isArray(input.alerts)?input.alerts.slice(0,100).filter(a=>a&&typeof a.id==='string'&&typeof a.query==='string'&&a.query.trim()).map(a=>({id:a.id.slice(0,200),query:a.query.slice(0,300),paused:a.paused===true,seen:Array.isArray(a.seen)?a.seen.filter(id=>typeof id==='string'):[]})):[];
  return {records,conversations,bookmarks,alerts,activeId:conversations.some(c=>c.id===input.activeId)?input.activeId:null};
}
