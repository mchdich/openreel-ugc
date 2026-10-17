import {normalizeRecords} from './engine.js';

const text=(v,max=6000)=>{if(typeof v!=='string')throw new Error('Invalid saved text.');return v.slice(0,max);};
const recordList=(v)=>{if(!Array.isArray(v))throw new Error('Invalid saved records.');return v.length?normalizeRecords(v):[];};
function conversation(value){
  try{
    const id=text(value.id,200),title=text(value.title,200);
    if(!id||!Array.isArray(value.messages))return null;
    const messages=value.messages.slice(-200).map(m=>{
      if(m.role==='user')return {role:'user',content:text(m.content)};
      if(m.role!=='assistant')throw new Error('Invalid message role.');
      if(typeof m.error==='string')return {role:'assistant',error:text(m.error)};
      const r=m.result;
      if(!Array.isArray(r.sections)||r.sections.length>10)throw new Error('Invalid sections.');
      const result={kind:typeof r.kind==='string'?r.kind:'research',mode:r.mode==='ai'?'ai':'deterministic',title:text(r.title,300),summary:text(r.summary),
        sections:r.sections.map(s=>({heading:text(s.heading,200),text:text(s.text,5000)})),sources:recordList(r.sources),creators:recordList(r.creators)};
      if(typeof r.notice==='string')result.notice=text(r.notice);
      return {role:'assistant',result};
    });
    return {id,title,createdAt:typeof value.createdAt==='string'?value.createdAt:'',messages};
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
