/** Shared, dependency-free corpus research. All text is plain data for safe rendering. */
export const MAX_RECORDS = 2000;
export const MAX_VIDEO_FRAMES = 12;
const TEXT_FIELDS = ['id', 'handle', 'creatorId', 'caption', 'transcript', 'visualDescription', 'descriptionSource', 'hook', 'format', 'niche', 'location', 'school', 'postedAt', 'url', 'thumbnail', 'email', 'bio', 'authorUrl', 'avatar', 'sourceType', 'fetchedAt'];
const METRIC_FIELDS = ['followers', 'views', 'likes', 'comments', 'shares'];
const NUM = '(\\d[\\d,]*(?:\\.\\d+)?\\s*[kmb]?)';
const stopwords = new Set('a an and are as at be by can could content do does did find for from get give has have how i in is it me my of on only or our please show some tell than that the their them there these they this those to us use using video videos want what when where which who why with you your creator creators influencers influencer follower followers email emails public contact contacts least under over above below between around about approximately minimum maximum more less million thousand number top best also university campus college student students competitor competitors hook hooks analyze analyse analysis working work perform performing performance trends trend format formats patterns viral look looking discover list based niche niches right now most successful include across multiple compare comparing comparison repeat repeats repeated recurring trending emerging'.split(' '));
const aliases = [
  { values: ['nyu', 'new york university'], field: 'school', canonical: 'nyu' },
  { values: ['ucla', 'university of california los angeles', 'university of california, los angeles'], field: 'school', canonical: 'ucla' },
  { values: ['nyc', 'new york city', 'new york'], field: 'location', canonical: 'nyc' },
  { values: ['los angeles', 'la'], field: 'location', canonical: 'la' }
];
const lower = value => String(value || '').toLowerCase().trim();
const clean = value => lower(value).replace(/[^a-z0-9@.\s]/g, ' ').replace(/\s+/g, ' ').trim();
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contains = (text, phrase) => new RegExp(`(?:^|\\b)${escapeRegExp(phrase)}(?:\\b|$)`, 'i').test(text);
/** Numeric platform IDs identify creators without fabricating public usernames. */
export const creatorKey=record=>record.creatorId?`creator:${record.creatorId}`:lower(record.handle);
const count = value => {
  if (value === undefined || value === null || value === '') return 0;
  const match = String(value).trim().replaceAll(',', '').match(/^(\d+(?:\.\d+)?)\s*([kmb]?)$/i);
  if (!match) throw new Error('Metrics must be non-negative numbers; K, M and B are supported.');
  const number = Number(match[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[lower(match[2])] || 1);
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER) throw new Error('Metric exceeds the supported range.');
  return Math.round(number);
};
const safeLink = (value, field) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new Error(`${field} must be an absolute http or https URL without credentials.`); }
};

const PLAYER_METADATA_FIELDS = ['handle', 'url', 'authorUrl', 'thumbnail', 'avatar'];
function playerMetadataEvidence(evidence, record, index) {
  const invalid = () => new Error(`Record ${index + 1} has invalid player metadata evidence.`);
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || Object.keys(evidence).some(key => !['sourceType', 'sourceUrl', 'observedAt', 'postId', 'fields'].includes(key))
    || evidence.sourceType !== 'tiktok-public-player-dom' || typeof evidence.postId !== 'string' || !/^\d{1,30}$/.test(evidence.postId)
    || evidence.sourceUrl !== `https://www.tiktok.com/player/v1/${evidence.postId}` || record.id !== `tiktok-${evidence.postId}`
    || typeof evidence.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(evidence.observedAt)
    || !Number.isFinite(Date.parse(evidence.observedAt)) || new Date(evidence.observedAt).toISOString() !== evidence.observedAt
    || !Array.isArray(evidence.fields) || !evidence.fields.length || evidence.fields.length > PLAYER_METADATA_FIELDS.length
    || new Set(evidence.fields).size !== evidence.fields.length
    || evidence.fields.some(field => !PLAYER_METADATA_FIELDS.includes(field) || !record[field])) throw invalid();
  if (!/^@[a-z0-9_][a-z0-9_.]{0,79}$/i.test(record.handle)
    || record.url !== `https://www.tiktok.com/${record.handle}/video/${evidence.postId}`
    || record.authorUrl !== `https://www.tiktok.com/${record.handle}`) throw invalid();
  for (const field of ['thumbnail', 'avatar']) if (evidence.fields.includes(field)) {
    const url = new URL(record[field]);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw invalid();
  }
  return {sourceType: evidence.sourceType, sourceUrl: evidence.sourceUrl, observedAt: evidence.observedAt, postId: evidence.postId, fields: [...evidence.fields]};
}

function postingDateEvidence(value,record){
  const invalid=()=>new Error('Invalid posting-date evidence.');
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==4||value.sourceType!=='tiktok-public-post'||record.demo!==false)throw invalid();
  for(const field of ['url','observedAt','postedAt'])if(typeof value[field]!=='string'||value[field].length>2000)throw invalid();
  let source;try{source=new URL(value.url);}catch{throw invalid();}
  const id=source.pathname.match(/^\/@[a-z0-9_][a-z0-9_.]{0,79}\/video\/(\d{1,30})$/i)?.[1];
  if(source.protocol!=='https:'||source.hostname!=='www.tiktok.com'||source.username||source.password||source.port||source.search||source.hash||source.href!==value.url||!id||record.id!==`tiktok-${id}`||value.postedAt!==record.postedAt)throw invalid();
  for(const field of ['observedAt','postedAt'])if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value[field])||!Number.isFinite(Date.parse(value[field]))||new Date(value[field]).toISOString()!==value[field])throw invalid();
  if(Date.parse(value.postedAt)<946684800000||Date.parse(value.postedAt)>Date.parse(value.observedAt)+300000)throw invalid();
  return {sourceType:value.sourceType,url:value.url,observedAt:value.observedAt,postedAt:value.postedAt};
}

/** Creation time is immutable; retain its original evidence, never old analytics. */
export function retainPostingDate(previous,current){
  if(!previous||!current||previous.demo!==false||current.demo!==false||previous.synthetic||current.synthetic||previous.id!==current.id||current.postedAt||previous.creatorId&&current.creatorId&&previous.creatorId!==current.creatorId)return current;
  let evidence;try{evidence=postingDateEvidence(previous.postingEvidence||(previous.sourceType==='tiktok-public-post'?{sourceType:previous.sourceType,url:previous.url,observedAt:previous.fetchedAt,postedAt:previous.postedAt}:null),previous);}catch{return current;}
  return {...current,postedAt:evidence.postedAt,postingEvidence:evidence};
}

/** A citation for sampled visual interpretation, never raw footage or an audio claim. */
export function normalizeVisualEvidence(value,record){
  if(record.descriptionSource!=='openreel-vision'||!record.visualDescription)throw new Error('Invalid sampled-frame visual evidence.');
  return normalizeCapturedFrames(value,record);
}
function validateCaptureIdentity(value,record,bad){
  let url;try{url=new URL(value.sourceUrl);}catch{throw bad();}
  const id=url.pathname.match(/^\/@[a-z0-9_][a-z0-9_.]{0,79}\/video\/(\d{1,30})$/i)?.[1];
  if(url.protocol!=='https:'||url.hostname!=='www.tiktok.com'||url.username||url.password||url.port||url.search||url.hash||url.href!==value.sourceUrl||record.id!==`tiktok-${id}`||!id||typeof value.creatorId!=='string'||!/^\d{1,30}$/.test(value.creatorId)||record.creatorId&&record.creatorId!==value.creatorId)throw bad();
  if(typeof value.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.observedAt)||!Number.isFinite(Date.parse(value.observedAt))||new Date(value.observedAt).toISOString()!==value.observedAt||Date.parse(value.observedAt)<946684800000||record.postedAt&&Date.parse(record.postedAt)>Date.parse(value.observedAt)+300000)throw bad();
}
/** Shared source receipt; a critique receipt does not annotate the corpus. */
export function normalizeCapturedFrames(value,record){
  const bad=()=>new Error('Invalid sampled-frame visual evidence.');
  const shape=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  if(!shape(value,['sourceType','sourceUrl','creatorId','observedAt','duration','frames'])||value.sourceType!=='tiktok-public-player-frames'||record.demo!==false)throw bad();
  validateCaptureIdentity(value,record,bad);
  if(!Number.isFinite(value.duration)||value.duration<=0||value.duration>600||!Array.isArray(value.frames)||value.frames.length<1||value.frames.length>MAX_VIDEO_FRAMES)throw bad();
  let prior=-1;const frames=value.frames.map(frame=>{if(!shape(frame,['timestamp','sha256'])||!Number.isFinite(frame.timestamp)||frame.timestamp<0||frame.timestamp>value.duration||frame.timestamp<=prior||typeof frame.sha256!=='string'||!/^[a-f0-9]{64}$/.test(frame.sha256))throw bad();prior=frame.timestamp;return {timestamp:frame.timestamp,sha256:frame.sha256};});
  return {sourceType:value.sourceType,sourceUrl:value.sourceUrl,creatorId:value.creatorId,observedAt:value.observedAt,duration:value.duration,frames};
}
/** Bounded opening PCM provenance. Word timing and raw acoustics are not inferred. */
export function normalizeCapturedAudio(value,record,videoDuration){
  const bad=()=>new Error('Invalid captured source-audio evidence.'),keys=['sourceType','sourceUrl','creatorId','observedAt','duration','sourceStart','sourceEnd','sha256'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k))||value.sourceType!=='tiktok-public-player-audio'||record.demo!==false)throw bad();
  validateCaptureIdentity(value,record,bad);
  if(!Number.isFinite(videoDuration)||videoDuration<=0||videoDuration>600||!Number.isFinite(value.duration)||value.duration<=0||value.duration>30||Math.abs(value.duration*16000-Math.round(value.duration*16000))>.00001||!Number.isFinite(value.sourceStart)||value.sourceStart<0||value.sourceStart>.1||!Number.isFinite(value.sourceEnd)||value.sourceEnd<=value.sourceStart||value.sourceEnd>videoDuration+.1||Math.abs(value.sourceEnd-value.sourceStart-value.duration)>1||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))throw bad();
  return {sourceType:value.sourceType,sourceUrl:value.sourceUrl,creatorId:value.creatorId,observedAt:value.observedAt,duration:value.duration,sourceStart:value.sourceStart,sourceEnd:value.sourceEnd,sha256:value.sha256};
}
export function normalizeSourceAudio(value,record,videoDuration){
  const bad=()=>new Error('Invalid source-speech metadata.');
  if(!value||typeof value!=='object'||Array.isArray(value))throw bad();
  if(value.status==='unavailable'){
    if(Object.keys(value).length!==2||!['unsupported','source-not-ready','no-audio-track','suspended','unsupported-sample-rate','invalid-samples','capture-timeout','playback-stalled','silent-or-unavailable','protected-or-unavailable','playback-unavailable','capture-error'].includes(value.reason))throw bad();
    return {status:'unavailable',reason:value.reason};
  }
  if(value.status!=='available'||Object.keys(value).length!==4||value.transcriptionSource!=='machine-transcription'||typeof value.transcript!=='string'||value.transcript.length>12000||value.transcript!==value.transcript.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.transcript))throw bad();
  return {status:'available',capture:normalizeCapturedAudio(value.capture,record,videoDuration),transcript:value.transcript,transcriptionSource:'machine-transcription'};
}
export function hasVisualDescriptionEvidence(record){
  if(!record||typeof record.visualDescription!=='string'||!record.visualDescription.trim())return false;
  if(['upstream-model','user-supplied','provider-observed'].includes(record.descriptionSource))return true;
  if(record.descriptionSource!=='openreel-vision')return false;
  try{normalizeVisualEvidence(record.visualEvidence,record);return true;}catch{return false;}
}
/** Preserve a historical interpretation with its original capture, never stale metrics. */
export function retainVisualEvidence(previous,current){
  if(!previous||!current||previous.demo!==false||current.demo!==false||previous.synthetic||current.synthetic||previous.id!==current.id||current.visualDescription||previous.creatorId&&current.creatorId&&previous.creatorId!==current.creatorId||previous.descriptionSource!=='openreel-vision')return current;
  let visualEvidence;try{visualEvidence=normalizeVisualEvidence(previous.visualEvidence,{...current,descriptionSource:previous.descriptionSource,visualDescription:previous.visualDescription});}catch{return current;}
  return {...current,visualDescription:previous.visualDescription,descriptionSource:previous.descriptionSource,visualEvidence};
}

/** Rejects a whole import on any malformed row; never mutates the original input. */
export function normalizeRecords(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_RECORDS) throw new Error(`Import must contain 1–${MAX_RECORDS} records.`);
  const ids = new Set();
  return input.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Record ${index + 1} must be an object.`);
    const result = {};
    for (const field of TEXT_FIELDS) {
      const raw = row[field];
      if (raw !== undefined && raw !== null && typeof raw !== 'string' && typeof raw !== 'number') throw new Error(`Record ${index + 1}: ${field} must be text.`);
      const value = String(raw ?? '').trim();
      const limit = ['transcript','visualDescription'].includes(field) ? 50000 : ['caption', 'hook'].includes(field) ? 10000 : 2000;
      if (value.length > limit) throw new Error(`Record ${index + 1}: ${field} is too long.`);
      result[field] = value;
    }
    if(result.creatorId&&!/^\d{1,30}$/.test(result.creatorId))throw new Error(`Record ${index+1} needs a valid numeric creator ID.`);
    if (result.handle&&!/^@?[a-z0-9_.-]{1,80}$/i.test(result.handle)||!result.handle&&!result.creatorId) throw new Error(`Record ${index + 1} needs a valid creator handle or numeric creator ID.`);
    if(result.handle)result.handle = result.handle.startsWith('@') ? result.handle : `@${result.handle}`;
    result.id ||= `${result.handle?result.handle.slice(1):'creator-'+result.creatorId}-${index + 1}`;
    if(result.visualDescription&&!['upstream-model','user-supplied','provider-observed','openreel-vision'].includes(result.descriptionSource))throw new Error(`Record ${index+1} needs a description source.`);
    if (ids.has(result.id)) throw new Error(`Duplicate record id: ${result.id}`);
    ids.add(result.id);
    for (const field of METRIC_FIELDS) result[field] = count(row[field]);
    result.url = safeLink(result.url, 'url');
    result.thumbnail = safeLink(result.thumbnail, 'thumbnail');
    result.authorUrl = safeLink(result.authorUrl, 'authorUrl');
    result.avatar = safeLink(result.avatar, 'avatar');
    if(row.unavailableMetrics!==undefined&&(!Array.isArray(row.unavailableMetrics)||row.unavailableMetrics.some(m=>!METRIC_FIELDS.includes(m))))throw new Error(`Record ${index+1} has invalid unavailableMetrics.`);
    result.unavailableMetrics=[...new Set([...(row.unavailableMetrics||[]),...METRIC_FIELDS.filter(field=>row[field]===undefined||row[field]===null||row[field]==='')])];
    if (result.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result.email)) throw new Error(`Record ${index + 1} has an invalid email.`);
    if (result.postedAt && !Number.isFinite(Date.parse(result.postedAt))) throw new Error(`Record ${index + 1} has an invalid postedAt date.`);
    result.demo = row.demo === true || row.demo === 'true';
    if(row.visualEvidence!==undefined||result.descriptionSource==='openreel-vision')result.visualEvidence=normalizeVisualEvidence(row.visualEvidence,result);
    if(row.postingEvidence!==undefined)result.postingEvidence=postingDateEvidence(row.postingEvidence,result);
    if(row.profileEvidence!==undefined){
      const evidence=row.profileEvidence;
      if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||typeof evidence.url!=='string'||typeof evidence.fetchedAt!=='string'||!Number.isFinite(Date.parse(evidence.fetchedAt)))throw new Error(`Record ${index+1} has invalid profile evidence.`);
      result.profileEvidence={url:safeLink(evidence.url,'profile evidence URL'),fetchedAt:evidence.fetchedAt};
      for(const field of ['school','location'])if(evidence[field]){
        const claim=evidence[field];
        if(typeof claim.value!=='string'||claim.value.length>200||claim.source!=='public-bio-self-description'||typeof claim.text!=='string'||claim.text.length>2000)throw new Error(`Record ${index+1} has invalid ${field} evidence.`);
        result.profileEvidence[field]={value:claim.value,source:claim.source,text:claim.text};
      }
    }
    if(row.archiveProvenance!==undefined){
      const evidence=row.archiveProvenance;
      if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||Object.keys(evidence).length>32)throw new Error(`Record ${index+1} has invalid archive provenance.`);
      const entries=Object.entries(evidence);
      for(const [key,value] of entries)if(!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(key)||['constructor','prototype','__proto__'].includes(key)||!(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=4000||typeof value==='number'&&Number.isSafeInteger(value)))throw new Error(`Record ${index+1} has invalid archive provenance.`);
      result.archiveProvenance=Object.fromEntries(entries);
      if(result.archiveProvenance.sourceUrl)result.archiveProvenance.sourceUrl=safeLink(result.archiveProvenance.sourceUrl,'archive source URL');
    }
    if(row.metadataEvidence!==undefined)result.metadataEvidence=playerMetadataEvidence(row.metadataEvidence,result,index);
    return result;
  });
}

function canonical(value, field) {
  const normalized = clean(value);
  return aliases.find(alias => alias.field === field && alias.values.some(v => clean(v) === normalized))?.canonical || normalized;
}

export function searchPlan(query='', options={}, records=[]) {
  const text = lower(retrievalText(query));
  const filters = { ...options };
  let rest = text;
  const extract = (pattern, handler) => { rest = rest.replace(pattern, (...args) => { handler(args); return ' '; }); };
  const range = (minimum, maximum) => {
    const firstUnit = minimum.trim().match(/[kmb]$/i)?.[0];
    const lastUnit = maximum.trim().match(/[kmb]$/i)?.[0];
    filters.minFollowers = count(!firstUnit && lastUnit ? `${minimum.trim()}${lastUnit}` : minimum);
    filters.maxFollowers = count(!lastUnit && firstUnit ? `${maximum.trim()}${firstUnit}` : maximum);
  };
  extract(new RegExp(`between\\s+${NUM}\\s+(?:and|to|-)\\s+${NUM}\\s*(?:followers)?`, 'gi'), match => {
    range(match[1], match[2]);
  });
  extract(new RegExp(`\\b${NUM}\\s*(?:[-–—]|to)\\s*${NUM}\\s+followers\\b`, 'gi'), match => { range(match[1], match[2]); });
  extract(new RegExp(`(?:at\\s+least|minimum(?:\\s+of)?|>=)\\s*${NUM}\\s*(?:followers)?`, 'gi'), match => { filters.minFollowers = count(match[1]); });
  extract(new RegExp(`(?:more\\s+than|over|above|>)\\s*${NUM}\\s*(?:followers)?`, 'gi'), match => { filters.minFollowers = count(match[1]) + 1; });
  extract(new RegExp(`(?:at\\s+most|maximum(?:\\s+of)?|<=)\\s*${NUM}\\s*(?:followers)?`, 'gi'), match => { filters.maxFollowers = count(match[1]); });
  extract(new RegExp(`(?:less\\s+than|under|below|<)\\s*${NUM}\\s*(?:followers)?`, 'gi'), match => { filters.maxFollowers = count(match[1]) - 1; });
  extract(new RegExp(`(?:around|about|approximately|~)\\s*${NUM}\\s*(?:followers)?`, 'gi'), match => {
    const value = count(match[1]); filters.minFollowers = value * 0.8; filters.maxFollowers = value * 1.2;
  });
  extract(new RegExp(`\\b${NUM}\\s*\\+\\s*followers\\b`, 'gi'), match => { filters.minFollowers = count(match[1]); });
  // A remaining unqualified literal count is exact; qualified bounds were consumed above.
  extract(new RegExp(`\\b${NUM}\\s+followers\\b`, 'gi'), match => {
    filters.minFollowers = count(match[1]); filters.maxFollowers = count(match[1]);
  });
  extract(/(?:find|show|give(?: me)?|list|top|discover)\s+(\d{1,3})\b/gi, match => { filters.limit = Math.max(1, Math.min(100, Number(match[1]))); });
  if (/\b(?:emails?|e-mail|contacts?)\b/i.test(rest)) filters.emailOnly = true;
  extract(/\b(?:emails?|e-mail|contacts?)\s+(?:listed\s+)?in\s+(?:(?:their|the|a)\s+)?bio\b/gi,()=>{filters.emailOnly=true;filters.emailInBio=true;});
  // Learn institution labels from the school field, never from captions or transcripts.
  const schools = [...new Set(records.map(record => record.school).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const name of schools) {
    if (!filters.school && contains(rest, lower(name))) {
      filters.school = name;
      rest = rest.replace(new RegExp(`\\b(?:(?:for|at|from|attending|among|by)\\s+)?${escapeRegExp(lower(name))}(?:\\s+(?:university|college|school))?\\b`, 'gi'), ' ');
    }
  }
  if (!filters.school) {
    const named = rest.match(/(?:^|\b)([a-z][a-z .&'-]{0,70}\b(?:university|college|school)(?:\s+of\s+[a-z][a-z\s.'-]{1,40})?)\s+(?:creators?|influencers?)\b/i);
    const proper = String(query).match(/\b(?:find|show(?:\s+me)?|list|discover|get|give(?:\s+me)?)\s+(?:\d+\s+)?(.+?)\s+(?:creators?|influencers?)\b/i)?.[1]?.trim();
    // Capitalization alone cannot distinguish a content topic from a school.
    // These bare request names retain their existing literal storage keys.
    const bareSchool = ['harvard','stanford','princeton','yale','mit'].includes(lower(proper)) ? lower(proper) : '';
    // Strip request connectors before the institution word, preserving connectors within its name.
    const candidate = named?.[1]?.replace(/^(?:(?!\b(?:university|college|school)\b).)*\b(?:for|at|from|attending|among|by)\s+/i, '').replace(/^(?:find|show(?:\s+me)?|list|discover|get|give(?:\s+me)?)\s+(?:\d+\s+)?/i, '').trim() || bareSchool;
    if (candidate) {
      filters.school = candidate;
      rest = rest.replace(new RegExp(`\\b(?:(?:for|at|from|attending|among|by)\\s+)?${escapeRegExp(lower(candidate))}\\b`, 'gi'), ' ');
    }
  }
  // Longer school phrases first: their location component must not create a second constraint.
  for (const alias of aliases) {
    if (alias.values.some(value => contains(rest, value))) {
      filters[alias.field] = alias.canonical;
      for (const value of alias.values) rest = rest.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, 'gi'), ' ');
    }
  }
  const school = rest.match(/\b(?:at|from|attending)\s+([a-z][a-z\s]{1,45}?)(?=\s+(?:creators?|with|in|under|over|followers?|and)\b|[?.!]|$)/i);
  if (school && !filters.school && !/least|most/.test(school[1])) { filters.school = school[1].trim(); rest = rest.replace(school[0], ' '); }
  const location = rest.match(/\b(?:in|based in|located in)\s+([a-z][a-z\s]{1,45}?)(?=\s+(?:creators?|with|at|under|over|followers?|and)\b|[?.!]|$)/i);
  if (location && !filters.location) {
    const phrase = location[1].trim();
    const niche = records.find(record => record.niche && contains(phrase, lower(record.niche)))?.niche;
    if (niche || /\bniche\b/.test(phrase)) {
      if (niche) filters.niche = niche;
      rest = rest.replace(location[0], niche || phrase);
    } else { filters.location = phrase; rest = rest.replace(location[0], ' '); }
  }
  const terms = clean(rest).split(/\s+/).map(word=>word.replace(/^\.+|\.+$/g,'')).filter(word => word.length > 1 && !stopwords.has(word) && !/^\d/.test(word));
  return { filters, terms };
}

/** Natural-language constraints and explicit options are ANDed. Creator queries deduplicate handles. */
export function searchRecords(records, query = '', options = {}) {
  const { filters, terms } = searchPlan(query, options, records);
  let matches = records.filter(record => {
    if((filters.minFollowers!==undefined||filters.maxFollowers!==undefined)&&record.unavailableMetrics?.includes('followers'))return false;
    if (filters.minFollowers !== undefined && record.followers < Number(filters.minFollowers)) return false;
    if (filters.maxFollowers !== undefined && record.followers > Number(filters.maxFollowers)) return false;
    if (filters.school && canonical(record.school, 'school') !== canonical(filters.school, 'school')) return false;
    if (filters.location && canonical(record.location, 'location') !== canonical(filters.location, 'location')) return false;
    if ((filters.emailOnly || filters.hasEmail) && !record.email) return false;
    if (filters.emailInBio && (!record.email||!lower(record.bio).includes(lower(record.email)))) return false;
    if (filters.niche && !lower(record.niche).includes(lower(filters.niche))) return false;
    if (filters.format && lower(record.format) !== lower(filters.format)) return false;
    if (filters.handle && lower(record.handle) !== lower(filters.handle.startsWith('@') ? filters.handle : `@${filters.handle}`)) return false;
    const haystack = clean([record.handle, record.caption, record.transcript, record.visualDescription, record.hook, record.format, record.niche, record.location, record.school,record.bio].join(' '));
    return terms.every(term => haystack.includes(term));
  });
  if ((filters.uniqueCreators !== false && /\bcreators?|influencers?\b/i.test(query)) || filters.uniqueCreators) {
    const seen = new Set();
    matches = matches.filter(record => { const key = creatorKey(record); if (seen.has(key)) return false; seen.add(key); return true; });
  }
  if (filters.limit !== undefined) matches = matches.slice(0, Math.max(0, Math.min(2000, Number(filters.limit))));
  return matches;
}

const engagement = record => record.views ? ((record.likes + record.comments + record.shares) / record.views) * 100 : 0;
const metricKnown=(record,field)=>!record.unavailableMetrics?.includes(field);
const engagementKnown=record=>['views','likes','comments','shares'].every(field=>metricKnown(record,field));
const rounded = value => Math.round(value * 100) / 100;
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function postingWindow(rows){
    const dates=[];let unknownTimezoneRecords=0;
    for(const record of rows){
      const raw=String(record.postedAt||''),date=raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/)?.[1];
      if(!date||!Number.isFinite(Date.parse(raw))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)continue;
      dates.push(date);if(!/[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw))unknownTimezoneRecords++;
    }
    dates.sort();return {start:dates[0]??null,end:dates.at(-1)??null,knownRecords:dates.length,unknownRecords:rows.length-dates.length,unknownTimezoneRecords,limit:'Supplied posting calendar dates only; unknown dates are omitted and timezones may be unknown. This window does not establish current emergence or growth.'};
  }

export function summarizePatternGroup(group){
    const sourceGroups=new Map();for(const evidence of group.evidence){const key=evidence.field+':'+(evidence.descriptionSource||'');if(!sourceGroups.has(key))sourceGroups.set(key,{field:evidence.field,...(evidence.descriptionSource?{descriptionSource:evidence.descriptionSource}:{}),count:0,sourceIds:[]});const source=sourceGroups.get(key);if(!source.sourceIds.includes(evidence.recordId)){source.count++;source.sourceIds.push(evidence.recordId);}}
    const measured=group.records.filter(r=>metricKnown(r,'views')&&Number.isFinite(r.views)&&r.views>=0);
    const measuredEngagement=group.records.filter(r=>engagementKnown(r)&&['views','likes','comments','shares'].every(f=>Number.isFinite(r[f])&&r[f]>=0)&&r.views>0);
    return {...group,count:group.records.length,creators:[...new Set(group.records.map(creatorKey))],sourceGroups:[...sourceGroups.values()],dateWindow:postingWindow(group.records),
      avgViews:measured.length?Math.round(average(measured.map(r=>r.views))):null,avgEngagementRate:measuredEngagement.length?rounded(average(measuredEngagement.map(engagement))):null,measuredVideos:measured.length};

}

const FORMAT_PATTERNS=[
    {format:'Unboxing',label:/^unboxing$/i,phrase:/\bunbox(?:ing|es)\b/i},
    {format:'Before / after',label:/^before\s*(?:\/|and|[-–—])\s*after(?: transformation)?$/i,phrase:/\bbefore\s*(?:\/|and|[-–—])\s*after\b/i},
    {format:'Step-by-step tutorial',label:/^step[- ]by[- ]step (?:tutorial|demonstration)$/i,phrase:/\bstep[-‐‑–— ]+by[-‐‑–— ]+step\b.{0,45}\b(?:tutorial|demonstration|guide|walkthrough|instructions?)\b|\b(?:tutorial|demonstration|guide|walkthrough)\b.{0,45}\bstep[-‐‑–— ]+by[-‐‑–— ]+step\b/i},
    {format:'Product demonstration',label:/^product demo(?:nstration)?$/i,phrase:/\bproduct demonstrations?\b|\bdemonstrat(?:es|ing)\s+(?:the\s+)?(?:application|use)\s+of\b.{0,50}\bproducts?\b|\bdemonstrat(?:es|ing)\s+(?:(?:various|different|skincare|beauty|the|these|several|a|new)\s+){0,3}products?\b/i},
    {format:'Product review',label:/^product reviews?$/i,phrase:/\bproduct reviews?\b|\breview(?:s|ing)?\s+(?:of\s+)?(?:(?:a|an|the|this|these|their|new|skincare|beauty|makeup|cosmetic)\s+){0,4}products?\b/i},
    {format:'Get ready with me',label:/^(?:grwm|get ready with me)$/i,phrase:/\b(?:grwm|get ready with me)\b/i},
    {format:'Day in the life',label:/^day[- ]in[- ](?:the[- ]|my[- ]|a[- ])?life$/i,phrase:/\bday[- ]in[- ](?:the[- ]|my[- ]|a[- ])?life\b/i}
  ];
/** Attributed evidence for one record; caption mentions are not depicted formats. */
export function formatEvidence(record){
    if(record.format?.trim())return [{format:FORMAT_PATTERNS.find(p=>p.label.test(record.format.trim()))?.format||record.format.trim(),field:'format',excerpt:record.format}];
    if(!hasVisualDescriptionEvidence(record))return [];
    const evidence=[];
    for(const pattern of FORMAT_PATTERNS){
      for(const sentence of record.visualDescription.split(/(?<=[.!?])\s+|[;\n]+/)){
        const match=sentence.match(pattern.phrase);if(!match)continue;
        const before=sentence.slice(0,match.index),after=sentence.slice(match.index+match[0].length);
        // Quoted promotion, negated formats and future suggestions are not depicted formats.
        if(/\b(?:not|no|never|without|isn['’]t|doesn['’]t|didn['’]t|wasn['’]t|rather than|instead of)\b[^.!?;]{0,80}$/i.test(before))continue;
        if(/\b(?:captions?|captioned|text(?: stickers?)?|titles?|titled|hashtags?|says?|said|mentions?|announces?|promises?|advertises?|recommends?|suggests?|discuss(?:es|ing)|debates?|talks? about|is about|explains? why|planned|upcoming)\b[^.!?;]{0,100}$/i.test(before))continue;
        if(/^[^.!?;]{0,65}\b(?:coming soon|tomorrow|next week|is up|will be|linked? in|not shown|without showing|is suggested)\b/i.test(after))continue;
        let start=Math.max(0,match.index-80),end=Math.min(sentence.length,match.index+match[0].length+120);
        if(start>0){const boundary=sentence.indexOf(' ',start);if(boundary>=0&&boundary<match.index)start=boundary+1;}
        if(end<sentence.length){const boundary=sentence.lastIndexOf(' ',end);if(boundary>match.index+match[0].length)end=boundary;}
        evidence.push({format:pattern.format,field:'visualDescription',descriptionSource:record.descriptionSource,excerpt:sentence.slice(start,end).trim()});
        break;
      }
    }
    return evidence;
}

/** Supplied labels or explicit described formats need two distinct creator identities. */
export function getTrends(records) {
  const groups = new Map(),seen=new Set();
  for (const record of records) {
    if(!record||typeof record!=='object')continue;
    const identity=creatorKey(record),id=record.id||record;if(!identity||seen.has(id))continue;seen.add(id);
    for(const evidence of formatEvidence(record)){
      const key=lower(evidence.format);
      if(!groups.has(key))groups.set(key,{format:evidence.format,records:[],evidence:[]});
      const group=groups.get(key);group.records.push(record);group.evidence.push({recordId:record.id,creatorKey:identity,...Object.fromEntries(Object.entries(evidence).filter(([key])=>key!=='format'))});
    }
  }
  return [...groups.values()].map(summarizePatternGroup).filter(group=>group.creators.length>=2).sort((a,b)=>(b.avgViews??-1)-(a.avgViews??-1)||b.creators.length-a.creators.length||a.format.localeCompare(b.format));
}

function statistics(all, matches) {
  const measured=matches.filter(r=>metricKnown(r,'views'));
  const measuredEngagement=matches.filter(engagementKnown);
  return {
    totalRecords: all.length, matchedRecords: matches.length,
    uniqueCreators: new Set(matches.map(creatorKey)).size,
    totalViews: measured.length?measured.reduce((sum, record) => sum + record.views, 0):matches.length?null:0,
    avgViews: measured.length?Math.round(average(measured.map(record => record.views))):matches.length?null:0,
    avgEngagementRate: measuredEngagement.length?rounded(average(measuredEngagement.map(engagement))):matches.length?null:0,
    measuredVideos:measured.length
  };
}

// Output directions belong to synthesis, not the AND-based source search.
function retrievalText(question){
  if(/\b(?:script|transcript)[^:\n]{0,100}:/i.test(question))return String(question);
  // A named-clip evidence question supplies a topic, not a location or extra search words.
  const focus=String(question).replace(/^(?:in|for)\s+(?:the\s+)?([^!?;\n]{1,200}?)\s+(?:clip|video)\s*,?\s*what\s+(?:(?:do|does)\s+(?:the\s+)?(?:sampled\s+)?(?:frames?|images?|clip|video)\s+(?:actually\s+)?show|is\s+(?:actually\s+)?visible)\s*\?/i,'$1.');
  const evidence=focus.replace(/(?:^|[.!?;]\s*)distinguish\s+(?:visible|observed|shown)\s+(?:objects|actions|details|facts|evidence)\s+from\s+(?:any\s+action\s+that\s+is\s+not\s+established|(?:inferred|unverified|unsupported)\s+(?:actions?|details|claims|assumptions))\b/gi,'.');
  return evidence.replace(/^(?:write|draft|suggest|generate|propose|give me)\s+(?:(?:\d+|one|two|three|four|five|some|new|alternative)\s+)*(?:hooks?|openings?|opening lines?|briefs?|scripts?)\s+(?:for|about)\s+/i,'').replace(/(?:[.!?;]\s*|,?\s+and\s+)(?:cite|suggest|write|draft|propose|generate|(?:give me|include)\s+(?:(?:\d+|one|two|three|four|five|some|the)\s+)?(?:hooks?|openings?|examples?|citations?|source videos?|shot lists?)|turn (?:this|these|it) into)\b[\s\S]*$/i,'').trim();
}
export const wantsCreativeBrief=message=>/^(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:(?:(?:write|draft|suggest|give me|generate|propose|make|create)\s+(?:(?:this|these|it)\s+(?:into\s+)?(?=(?:a|an|the)\s+))?|turn\s+(?:this|these|it)\s+into\s+)(?:(?:\d+|one|two|three|four|five|some|alternative|new|more|a|an|the|short|concise)\s+){0,5}(?:creative\s+briefs?|briefs?|shot\s+lists?)\b|(?:a\s+)?(?:creative\s+brief|shot\s+list)\b)/i.test(String(message).trim());
export const wantsWriting=message=>wantsCreativeBrief(message)||/^(?:turn (?:this|these|it) into|make (?:this|these|it|a brief)|(?:write|draft|suggest|give me|generate|propose)\s+(?:(?:\d+|one|two|three|four|five|some|alternative|new|more|a|an)\s+)*(?:hooks?|openings?|opening lines?|scripts?|briefs?|shot lists?))\b/i.test(message);
const writingFollowup=message=>wantsWriting(message)&&!/\b(?:for|about)\s+(?!(?:this|that|these|those|it|them|the above)\b)[a-z]/i.test(message);
export const wantsCreatorSearch=query=>/\b(?:creators?|influencers?)\b/i.test(query)&&(!/\b(?:hooks?|openings?|videos?|formats?|patterns?)\b/i.test(query)||/\b(?:find|show|list|discover|get|give(?: me)?)\s+(?:(?!(?:hooks?|openings?|videos?|formats?|patterns?)\b)[\w@,.-]+\s+){0,8}(?:creators?|influencers?)\b/i.test(query));

/** Resolve refinements before retrieval, so result limits cannot erase prior constraints. */
export function researchQuery(question,history=[]){
  const message = String(question || '').trim();
  const previous = [...history].reverse().find(item => item?.role === 'user' && typeof item.content === 'string' && item.content !== message)?.content;
  if(previous&&writingFollowup(message))return researchQuery(previous,history.filter(item=>item.content!==previous&&item.content!==message));
  return previous && /^(?:only\b|show (?:me )?only\b|those\b|with public emails\b)/i.test(message) ? researchQuery(previous,history.filter(item=>item.content!==previous&&item.content!==message))+' '+message : message;
}

export const wantsSimilarity=query=>/\b(?:like|similar to)\s+(?:her|him|them|this creator|that creator|@[a-z0-9_.-]+)\b|\bsimilar creators?\b/i.test(query);
export const similarityQuery=query=>String(query).replace(/\b(?:like|similar to)\s+(?:her|him|them|this creator|that creator|@[a-z0-9_.-]+)/gi,' ').replace(/\bsimilar creators?\b/gi,'creators').trim();

/** Transparent content similarity: never infer appearance or identity from images. */
export function similarCreators(records,query,reference){
  const cleaned=similarityQuery(query),limit=searchPlan(cleaned).filters.limit??20;
  const constraints=cleaned.replace(/\b(find|show|give(?: me)?|list|top|discover)\s+\d{1,3}\b/gi,'$1');
  const candidates=searchRecords(records,constraints,{uniqueCreators:false});
  const identityTerms=new Set(aliases.flatMap(alias=>alias.values.flatMap(value=>clean(value).split(' '))));
  const tokens=record=>{
    const excluded=new Set([...identityTerms,...clean([record.school,record.location].join(' ')).split(' ')]);
    const content=[record.niche,record.format,record.caption,record.hook,record.transcript,record.visualDescription,record.bio].join(' ').replace(/https?:\/\/\S+|\S+@\S+|@[a-z0-9_.-]+/gi,' ');
    return new Set(clean(content).replace(/[.@]/g,' ').split(/\s+/).filter(word=>word.length>2&&!stopwords.has(word)&&!excluded.has(word)&&!/^\d/.test(word)));
  };
  const referenceTerms=tokens(reference),ranked=new Map();
  for(const record of candidates){
    const key=creatorKey(record);if(key===creatorKey(reference))continue;
    const terms=tokens(record),sharedTerms=[...referenceTerms].filter(term=>terms.has(term));
    const sharedNiche=Boolean(reference.niche&&lower(reference.niche)===lower(record.niche));
    const sharedFormat=Boolean(reference.format&&lower(reference.format)===lower(record.format));
    if(!sharedTerms.length&&!sharedNiche&&!sharedFormat)continue;
    const score=sharedTerms.length/Math.sqrt(Math.max(1,referenceTerms.size*terms.size))+(sharedNiche?1:0)+(sharedFormat?0.6:0);
    const match={record,score,sharedTerms:sharedTerms.slice(0,8),sharedNiche,sharedFormat};
    if(!ranked.has(key)||ranked.get(key).score<score)ranked.set(key,match);
  }
  return [...ranked.values()].sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id)).slice(0,limit);
}

/** Deterministic research is useful without an AI service and never broadens an empty match. */
export function research(records, question, history = [], {reference,sourceQuery}={}) {
  const message = String(question || '').trim();
  const previous = [...history].reverse().find(item => item?.role === 'user' && typeof item.content === 'string' && item.content !== message)?.content;
  const query = retrievalText(sourceQuery??researchQuery(message,history));
  const wantsBrief = wantsCreativeBrief(message);
  const kind = /\b(?:underperform|flop|critique|review this|my (?:script|video)|why did)\b|\b(?:transcript|script)\s*:/i.test(query) ? 'critique'
    : wantsBrief ? 'critique' : /\btrends?|trending|patterns?\b/i.test(query) ? 'trends'
    : wantsCreatorSearch(query)||wantsSimilarity(query) ? 'creators' : 'research';
  const similarity=kind==='creators'&&(Boolean(reference)||wantsSimilarity(query));
  const similar=similarity&&reference?similarCreators(records,query,reference):[];
  let sources = similarity?similar.map(match=>match.record):searchRecords(records, query, { uniqueCreators: kind === 'creators' });
  const sections = [];
  let title = 'Research from your library';
  let summary = '';
  let trends = [];
  if (kind === 'creators') {
    title = 'Creators that match your brief';
    summary = sources.length ? `I found ${sources.length} matching creator${sources.length === 1 ? '' : 's'} among ${records.length} supplied video records. Every profile and contact below comes from those sources.` : 'No creators in the supplied records match all of those filters. Try another school, location or follower range, or import more records.';
    sections.push({ heading: 'How these matches were selected', text: 'School, location, follower range and public email requirements are applied together. Follower bounds keep their requested inclusivity. Contacts appear only when explicitly supplied; school and location labels retain their public-bio self-description evidence.' });
    if(similarity){
      title='Creators with similar content evidence';
      summary=!reference?'Select a reference creator using “Find similar creators” on a source record, then send this request again. A pronoun alone does not identify a person.':sources.length?`${sources.length} creator${sources.length===1?' shares':'s share'} content terms or formats with ${reference.handle||'Creator '+reference.creatorId}, after every requested filter is applied. Similarity uses supplied text and format labels.`:'No eligible creators share content terms or formats with the selected reference. Broaden the filters or add more relevant evidence.';
      sections[0].text='School, location, known follower counts and public bio contacts are checked before content ranking. The selected creator is excluded. Shared terms, niche and format labels determine similarity; appearance and demographic traits are not inferred.';
      for(const match of similar.slice(0,8))sections.push({heading:match.record.handle||'Creator '+match.record.creatorId,sourceIds:[match.record.id],text:[match.sharedNiche?`Shared niche: ${match.record.niche}.`:'',match.sharedFormat?`Shared format: ${match.record.format}.`:'',match.sharedTerms.length?`Shared content terms: ${match.sharedTerms.join(', ')}.`:''].filter(Boolean).join(' ')});
    }
  } else if (kind === 'trends') {
    title = 'Patterns across your library';
    trends = getTrends(sources);
    sources = [...new Map(trends.flatMap(trend=>trend.records).map(record=>[record.id,record])).values()];
    summary = trends.length ? `${trends.length} recurring format${trends.length === 1 ? '' : 's'} appear across multiple creators in the matching records. Groups use supplied format labels or explicit phrases in attributed visual descriptions. These descriptive corpus patterns do not establish current emergence or platform-wide growth.` : 'There is not enough matching format evidence across at least two distinct creators. Add supplied format labels or explicit, attributed visual descriptions; a caption mention alone is insufficient.';
    for(const trend of trends.slice(0,6)){
      const basis=trend.sourceGroups.map(source=>`${source.count} ${source.field==='format'?'supplied format label'+(source.count===1?'':'s'):source.descriptionSource==='upstream-model'?'upstream AI-derived visual description'+(source.count===1?'':'s'):source.descriptionSource==='openreel-vision'?'sampled-frame AI description'+(source.count===1?'':'s'):source.descriptionSource+' visual description'+(source.count===1?'':'s')}`).join('; ');
      const window=trend.dateWindow,dateText=window.knownRecords?`Known supplied posting dates: ${window.start} through ${window.end} (${window.knownRecords} dated; ${window.unknownRecords} unknown dates; ${window.unknownTimezoneRecords} unknown timezones).`:'Posting dates are unavailable for these records.';
      sections.push({heading:trend.format,sourceIds:trend.records.map(record=>record.id),text:`${trend.count} videos from ${trend.creators.length} creators. Evidence: ${basis}. ${dateText} ${trend.avgViews===null?'View metrics are unavailable.':`${trend.measuredVideos} measured videos average ${trend.avgViews.toLocaleString('en-US')} views.`} ${trend.avgEngagementRate===null?'Engagement metrics are unavailable.':`Average engagement per view is ${trend.avgEngagementRate}%.`} ${window.limit} Descriptive averages do not show that the format caused performance.`});
    }
  } else if (kind === 'critique') {
    title = wantsBrief ? 'Creative brief' : 'Video and script critique';
    const provided = (wantsBrief && previous ? previous : query).match(/\b(?:script|transcript)[^:\n]{0,100}:\s*([\s\S]+)/i)?.[1]?.trim();
    const referenced = records.filter(record => record.handle&&query.includes(record.handle) || (record.url && query.includes(record.url)));
    sources = wantsBrief ? sources : referenced;
    const script = provided || sources[0]?.transcript || sources[0]?.caption;
    summary = wantsBrief ? script ? 'Proposed creative brief based on the supplied source text. The shots and copy are suggestions, not observations of available footage or promised performance.' : 'No matching source text or supplied script is available for a grounded brief. Add relevant records or a script.' : script ? 'This critique uses the supplied script or stored transcript and available metrics. It cannot assess footage, delivery, retention or the cause of performance from text alone.' : 'I cannot fetch or watch a pasted video URL. Add its transcript or script, plus metrics, to get a grounded critique.';
    if (script) {
      const opening = script.split(/(?<=[.!?])\s+/)[0].slice(0, 220);
      const sentences = script.split(/(?<=[.!?])\s+/).map(sentence => sentence.trim()).filter(Boolean);
      const substantive = sentences.find(sentence => sentence !== sentences[0] && /\d|turns?|save|instead|because|helps?|without|result|show/i.test(sentence)) || sentences[1] || sentences[0];
      const trimmed = substantive.replace(/^(?:today[, ]+)?(?:i (?:want to|wanted to|am going to|will) (?:tell you about|show you)|let me tell you about|welcome to)\s+/i, '');
      const lead = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      const rewrite = [lead, ...sentences.filter(sentence => sentence !== substantive && !/^(today|hi|hello|hey|i want|welcome)/i.test(sentence))].slice(0, 5).join(' ');
      sections.push({ heading: 'Opening hook', text: `The opening is “${opening}”. ${/^(today|hi|hello|hey|i want|welcome)/i.test(script) ? 'It begins with setup. Test moving the concrete outcome or surprising claim into the first sentence.' : 'Test whether the first sentence gives a specific reason to keep watching. Keep the payoff closely tied to that promise.'}` });
      sections.push({ heading: 'A tighter rewrite', text: rewrite });
      if (wantsBrief) {
        sections.push({ heading: 'Hooks to test', text: `Outcome first: “${lead.slice(0, 220)}”\nOriginal opening, shortened: “${opening.replace(/^(?:today[, ]+)?i (?:want to|wanted to) tell you about\s+/i, '').slice(0, 180)}”\nDemonstration first: Open on the action described by “${sentences.at(-1).slice(0, 180)}”, then explain the context. These are proposed edits based on your text.` });
        sections.push({ heading: 'Suggested shot list', text: `1. Show the concrete idea in “${lead.slice(0, 180)}” as the opening visual.\n2. Film a close-up demonstration of the main action in the supplied script.\n3. Put “${sentences.at(-1).slice(0, 180)}” on screen beside the corresponding action.\n4. Finish on the supplied outcome. Verify every claim before filming; these shots are suggestions, not observations of a video.` });
      }
      sections.push({ heading: 'A practical next test', text: 'Create one alternate opening, keep the rest of the video fixed, and compare retention and completion on similar audiences. Views and likes alone cannot establish why a video underperformed.' });
    }
    if (sources.length) sections.push({ heading: 'Available evidence', text: `${sources.length} supplied record${sources.length === 1 ? '' : 's'} contain ${sources.reduce((sum, record) => sum + record.views, 0).toLocaleString('en-US')} recorded views. Compare against the same creator’s typical results before calling this a flop.` });
  } else {
    summary = sources.length ? `I found ${sources.length} relevant video${sources.length === 1 ? '' : 's'} in your ${records.length}-video library. Here is what the supplied captions, hooks, transcripts and metrics show.` : 'No records in the current library match this question. Import relevant videos or try a more specific creator, niche or hook.';
    const withHooks = sources.filter(record => record.hook || record.transcript || record.caption || record.visualDescription).slice(0, 5);
    for (const record of withHooks) sections.push({ heading: `${record.handle||'Creator '+record.creatorId} · ${record.hook?'Opening hook':record.transcript?'Transcript excerpt':record.caption?'Caption':'Upstream AI summary'}${record.format?' · '+record.format:''}`,sourceIds:[record.id], text: `“${(record.hook || record.transcript || record.caption || record.visualDescription).slice(0, 280)}” — ${metricKnown(record,'views')?`${record.views.toLocaleString('en-US')} recorded views`:'view metrics unavailable'}, ${engagementKnown(record)?`${rounded(engagement(record))}% engagement per view`:'engagement metrics unavailable'}. Treat this as an example to test, not a proven causal explanation.` });
  }
  return { kind, title, summary, sections, sources, creators: kind === 'creators' ? sources : [], stats: statistics(records, sources), trends, mode: 'deterministic', followups: kind === 'creators' ? ['Show matching creators with public emails', 'Find creators around 30K followers'] : ['Which hook formats repeat across creators?', 'Find creators in the beauty niche'] };
}
