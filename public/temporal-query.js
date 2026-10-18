const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FORMAT_TOPIC = /\b(?:trends?|formats?|patterns?)\b/i;
const MOVEMENT = '(?:emerging|rising|gaining(?:\\s+in)?\\s+(?:share|traction|popularity|momentum|ground|attention))';

function comparisonPhrases(text) {
  // Context matters: Growth City and Rising Sun University are constraints, not comparison syntax.
  const patterns = [
    /\b(?:trends?|formats?|patterns?)\s+(?:(?:have|has|show|shows|showing|with)\s+)?(momentum|growth)\b/gi,
    new RegExp(`\\b(?:trends?|formats?|patterns?)\\s+(?:(?:are|is|have\\s+been|has\\s+been)\\s+)?(${MOVEMENT})\\b`, 'gi'),
    new RegExp(`\\b(?:are|is|have\\s+been|has\\s+been)\\s+(${MOVEMENT})\\b`, 'gi'),
    /\b(emerging|rising)\b(?=\s+(?:(?!(?:at|from|with|creators?|influencers?|university|college|school)\b)[\w'-]+\s+){0,6}(?:trends?|formats?|patterns?)\b)/gi,
    /\b(momentum|growth)\b(?=\s+(?:in|of|for|across)\s+(?:[\w'-]+\s+){0,6}(?:trends?|formats?|patterns?)\b)/gi
  ];
  const spans = new Map();
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) {
    const start = match.index + match[0].lastIndexOf(match[1]);
    spans.set(start, { start, end: start + match[1].length });
  }
  return [...spans.values()].sort((a, b) => b.start - a.start);
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function calendarDate(value, label) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) throw invalid(`${label} must be a real calendar date in YYYY-MM-DD format.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalid(`${label} must be a real calendar date in YYYY-MM-DD format.`);
  return date;
}

/** Extract an explicit dated format-momentum request without removing its research constraints. */
export function parseTemporalQuery(question, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (typeof question !== 'string' || !question.trim() || question.length > 6000) throw invalid('Question must contain 1–6000 characters.');
  const currentPeriod=/\b(?:this week|today|right now|currently|this month|last \d+ days?)\b/i.test(question);
  const currentTrend=currentPeriod&&/\b(?:trends?|trending|formats?|patterns?)\b/i.test(question);
  if (!FORMAT_TOPIC.test(question) || (!comparisonPhrases(question).length&&!currentTrend)) return null;

  let query = question.trim();
  let asOf = today;
  const dates = [...query.matchAll(/\bas\s+of\b/gi)];
  if (dates.length > 1) throw invalid('Use one as-of date for a dated trend comparison.');
  if (dates.length) {
    const phrase = query.match(/\bas\s+of\s+([^\s]+)/i);
    if (!phrase) throw invalid('Use as of YYYY-MM-DD for a dated trend comparison.');
    asOf = phrase[1].replace(/[.,!?;:]+$/, '');
    calendarDate(asOf, 'As-of date');
    query = query.replace(phrase[0], ' ');
  }
  const end = calendarDate(asOf, 'As-of date');

  const duration = /\b(?:over\s+(?:the\s+)?(?:last|past)|over|last|past)\s+([^\s?!;]+)\s+(days?|weeks?|months?|years?)\b/gi;
  const windows = [...query.matchAll(duration)];
  if (windows.length > 1) throw invalid('Use one day window for a dated trend comparison.');
  let windowDays = /\btoday\b/i.test(query)?1:/\bthis month\b/i.test(query)?30:7;
  if (windows.length) {
    const [, amount, unit] = windows[0];
    if (!/^\d+$/.test(amount) || !/^days?$/i.test(unit) || Number(amount) < 1 || Number(amount) > 90) {
      throw invalid('The trend comparison window must be an integer from 1 to 90 days.');
    }
    windowDays = Number(amount);
    query = query.replace(windows[0][0], ' ');
  }
  if (/\b(?:over|last|past)\s+(?:the\s+)?(?:days?|weeks?|months?|years?)\b/i.test(query)) throw invalid('The trend comparison window must be an integer from 1 to 90 days.');

  const start = new Date(end.getTime() - (windowDays * 2 - 1) * DAY_MS);
  const postedFrom = start.toISOString().slice(0, 10);
  if (!ISO_DATE.test(postedFrom)) throw invalid('The comparison windows must remain within four-digit calendar years.');
  for (const { start, end } of comparisonPhrases(query)) query = query.slice(0, start) + ' ' + query.slice(end);
  if(currentTrend)query=query.replace(/\b(?:this week|today|right now|currently|this month|trending)\b/gi,' ');
  query = query.replace(/\s+/g, ' ').trim();
  return { query, asOf, windowDays, postedFrom, postedThrough: asOf };
}
