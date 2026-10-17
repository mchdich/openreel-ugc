/** Shared, dependency-free corpus research. All text is plain data for safe rendering. */
export const MAX_RECORDS = 2000;
const TEXT_FIELDS = ['id', 'handle', 'caption', 'transcript', 'hook', 'format', 'niche', 'location', 'school', 'postedAt', 'url', 'thumbnail', 'email', 'bio', 'authorUrl', 'avatar', 'sourceType', 'fetchedAt'];
const METRIC_FIELDS = ['followers', 'views', 'likes', 'comments', 'shares'];
const NUM = '(\\d[\\d,]*(?:\\.\\d+)?\\s*[kmb]?)';
const stopwords = new Set('a an and are as at be by can could content do does did find for from get give has have how i in is it me my of on only or our please show some tell than that the their them there these they this those to us use using video videos want what when where which who why with you your creator creators influencers influencer follower followers email emails public contact contacts least under over above below between around about approximately minimum maximum more less million thousand number top best also university campus college student students competitor competitors hook hooks analyze analyse analysis working work perform performing performance trends trend format formats patterns viral look looking discover list based niche niches right now most successful across multiple'.split(' '));
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
      const limit = field === 'transcript' ? 50000 : ['caption', 'hook'].includes(field) ? 10000 : 2000;
      if (value.length > limit) throw new Error(`Record ${index + 1}: ${field} is too long.`);
      result[field] = value;
    }
    if (!/^@?[a-z0-9_.-]{1,80}$/i.test(result.handle)) throw new Error(`Record ${index + 1} needs a valid creator handle.`);
    result.handle = result.handle.startsWith('@') ? result.handle : `@${result.handle}`;
    result.id ||= `${result.handle.slice(1)}-${index + 1}`;
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
    return result;
  });
}

function canonical(value, field) {
  const normalized = clean(value);
  return aliases.find(alias => alias.field === field && alias.values.some(v => clean(v) === normalized))?.canonical || normalized;
}

export function searchPlan(query='', options={}, records=[]) {
  const text = lower(query);
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
      rest = rest.replace(new RegExp(`\\b${escapeRegExp(lower(name))}(?:\\s+(?:university|college|school))?\\b`, 'gi'), ' ');
    }
  }
  if (!filters.school) {
    const named = rest.match(/(?:^|\b)([a-z][a-z .&'-]{0,70}\b(?:university|college|school)(?:\s+of\s+[a-z][a-z\s.'-]{1,40})?)\s+(?:creators?|influencers?)\b/i);
    const proper = String(query).match(/\b(?:find|show(?:\s+me)?|list|discover|get|give(?:\s+me)?)\s+(?:\d+\s+)?(.+?)\s+(?:creators?|influencers?)\b/i)?.[1]?.trim();
    const candidate = named?.[1]?.replace(/^(?:find|show(?:\s+me)?|list|discover|get|give(?:\s+me)?)\s+(?:\d+\s+)?/i, '').trim()
      || (proper && /^[A-Z]/.test(proper) && !records.some(record => record.niche && contains(lower(proper), lower(record.niche))) ? proper : '');
    if (candidate) {
      filters.school = candidate;
      rest = rest.replace(new RegExp(`\\b${escapeRegExp(lower(candidate))}\\b`, 'gi'), ' ');
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
  const terms = clean(rest).split(/\s+/).filter(word => word.length > 1 && !stopwords.has(word) && !/^\d/.test(word));
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
    const haystack = clean([record.handle, record.caption, record.transcript, record.hook, record.format, record.niche, record.location, record.school,record.bio].join(' '));
    return terms.every(term => haystack.includes(term));
  });
  if ((filters.uniqueCreators !== false && /\bcreators?|influencers?\b/i.test(query)) || filters.uniqueCreators) {
    const seen = new Set();
    matches = matches.filter(record => { const key = lower(record.handle); if (seen.has(key)) return false; seen.add(key); return true; });
  }
  if (filters.limit !== undefined) matches = matches.slice(0, Math.max(0, Math.min(2000, Number(filters.limit))));
  return matches;
}

const engagement = record => record.views ? ((record.likes + record.comments + record.shares) / record.views) * 100 : 0;
const metricKnown=(record,field)=>!record.unavailableMetrics?.includes(field);
const engagementKnown=record=>['views','likes','comments','shares'].every(field=>metricKnown(record,field));
const rounded = value => Math.round(value * 100) / 100;
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

/** A pattern needs evidence from two distinct handles; duplicate clips alone are insufficient. */
export function getTrends(records) {
  const groups = new Map();
  for (const record of records) {
    if (!record.format) continue;
    const key = lower(record.format);
    if (!groups.has(key)) groups.set(key, { format: record.format, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()].map(group => ({
    ...group, count: group.records.length,
    creators: [...new Set(group.records.map(record => lower(record.handle)))],
    avgViews: group.records.some(r=>metricKnown(r,'views'))?Math.round(average(group.records.filter(r=>metricKnown(r,'views')).map(record => record.views))):null,
    avgEngagementRate: group.records.some(engagementKnown)?rounded(average(group.records.filter(engagementKnown).map(engagement))):null,
    measuredVideos:group.records.filter(r=>metricKnown(r,'views')).length
  })).filter(group => group.creators.length >= 2).sort((a, b) => b.avgViews - a.avgViews);
}

function statistics(all, matches) {
  const measured=matches.filter(r=>metricKnown(r,'views'));
  const measuredEngagement=matches.filter(engagementKnown);
  return {
    totalRecords: all.length, matchedRecords: matches.length,
    uniqueCreators: new Set(matches.map(record => lower(record.handle))).size,
    totalViews: measured.length?measured.reduce((sum, record) => sum + record.views, 0):matches.length?null:0,
    avgViews: measured.length?Math.round(average(measured.map(record => record.views))):matches.length?null:0,
    avgEngagementRate: measuredEngagement.length?rounded(average(measuredEngagement.map(engagement))):matches.length?null:0,
    measuredVideos:measured.length
  };
}

/** Resolve refinements before retrieval, so result limits cannot erase prior constraints. */
export function researchQuery(question,history=[]){
  const message = String(question || '').trim();
  const previous = [...history].reverse().find(item => item?.role === 'user' && typeof item.content === 'string' && item.content !== message)?.content;
  return previous && /^(?:only\b|show (?:me )?only\b|those\b|with public emails\b)/i.test(message) ? researchQuery(previous,history.filter(item=>item.content!==previous&&item.content!==message))+' '+message : message;
}

/** Deterministic research is useful without an AI service and never broadens an empty match. */
export function research(records, question, history = []) {
  const message = String(question || '').trim();
  const previous = [...history].reverse().find(item => item?.role === 'user' && typeof item.content === 'string' && item.content !== message)?.content;
  const query = researchQuery(message,history);
  const wantsBrief = /\bcreative brief|\bshot list\b/i.test(message);
  const kind = /\b(?:underperform|flop|critique|review this|my (?:script|video)|why did)\b|\b(?:transcript|script)\s*:/i.test(query) ? 'critique'
    : wantsBrief ? 'critique' : /\btrends?|trending|patterns?\b/i.test(query) ? 'trends'
    : /\bcreators?|influencers?\b/i.test(query) ? 'creators' : 'research';
  let sources = searchRecords(records, wantsBrief && previous ? previous : query, { uniqueCreators: kind === 'creators' });
  const sections = [];
  let title = 'Research from your library';
  let summary = '';
  let trends = [];
  if (kind === 'creators') {
    title = 'Creators that match your brief';
    summary = sources.length ? `I found ${sources.length} matching creator${sources.length === 1 ? '' : 's'} in the ${records.length}-video library. Every profile and contact below comes from your records.` : 'No creators in the current library match all of those filters. Try another school, location or follower range, or import more records.';
    sections.push({ heading: 'How these matches were selected', text: 'School, location, follower range and public email requirements are applied together. Around a follower count means within 20%. Results are unique by handle; contacts appear only when explicitly supplied.' });
  } else if (kind === 'trends') {
    title = 'Patterns across your library';
    trends = getTrends(sources);
    sources = trends.flatMap(trend => trend.records);
    summary = trends.length ? `${trends.length} recurring format${trends.length === 1 ? '' : 's'} appear across multiple creators in the matching library. These are corpus patterns, not a live platform-wide trend feed.` : 'There is not enough matching evidence for a recurring trend. A format needs videos from at least two distinct creators.';
    for (const trend of trends.slice(0, 6)) sections.push({ heading: trend.format, text: `${trend.count} videos from ${trend.creators.length} creators. ${trend.avgViews===null?'View metrics are unavailable.':`${trend.measuredVideos} measured videos average ${trend.avgViews.toLocaleString('en-US')} views.`} ${trend.avgEngagementRate===null?'Engagement metrics are unavailable.':`Average engagement per view is ${trend.avgEngagementRate}%.`} This is descriptive, not proof that the format caused the performance.` });
  } else if (kind === 'critique') {
    title = wantsBrief ? 'Creative brief from your script' : 'Video and script critique';
    const provided = (wantsBrief && previous ? previous : query).match(/\b(?:script|transcript)[^:\n]{0,100}:\s*([\s\S]+)/i)?.[1]?.trim();
    const referenced = records.filter(record => query.includes(record.handle) || (record.url && query.includes(record.url)));
    sources = wantsBrief ? sources : referenced;
    const script = provided || sources[0]?.transcript || sources[0]?.caption;
    summary = script ? 'This critique uses the supplied script or stored transcript and available metrics. It cannot assess footage, delivery, retention or the cause of performance from text alone.' : 'I cannot fetch or watch a pasted video URL. Add its transcript or script, plus metrics, to get a grounded critique.';
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
    const withHooks = sources.filter(record => record.hook || record.transcript || record.caption).slice(0, 5);
    for (const record of withHooks) sections.push({ heading: `${record.handle} · ${record.hook?'Opening hook':record.transcript?'Transcript excerpt':'Caption'}${record.format?' · '+record.format:''}`, text: `“${(record.hook || record.transcript || record.caption).slice(0, 280)}” — ${metricKnown(record,'views')?`${record.views.toLocaleString('en-US')} recorded views`:'view metrics unavailable'}, ${engagementKnown(record)?`${rounded(engagement(record))}% engagement per view`:'engagement metrics unavailable'}. Treat this as an example to test, not a proven causal explanation.` });
  }
  return { kind, title, summary, sections, sources, creators: kind === 'creators' ? sources : [], stats: statistics(records, sources), trends, mode: 'deterministic', followups: kind === 'creators' ? ['Show matching creators with public emails', 'Find creators around 30K followers'] : ['Which hook formats repeat across creators?', 'Find creators in the beauty niche'] };
}
