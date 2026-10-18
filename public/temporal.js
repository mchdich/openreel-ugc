import { getTrends, creatorKey, formatEvidence } from './engine.js';

const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|([+-])(\d{2}):?(\d{2}))?)?$/i;
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const rounded = value => Math.round(value * 10_000) / 10_000;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function calendarDay(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return null;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / DAY_MS : null;
}

function dayLabel(day) {
  const label = new Date(day * DAY_MS).toISOString().slice(0, 10);
  if (!DATE.test(label)) throw invalid('The comparison calendar windows must remain within four-digit years.');
  return label;
}

// Keep the source calendar date: a known offset must not move a post into another day.
function postingDate(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.match(STAMP);
  if (!match) return null;
  const day = calendarDay(match[1]);
  if (day === null || (match[2] !== undefined && (+match[2] > 23 || +match[3] > 59 || +(match[4] || 0) > 59))) return null;
  if (match[7] !== undefined && (+match[7] > 23 || +match[8] > 59)) return null;
  return { day, date: match[1], unknownTimezone: !match[5] };
}

function dateWindow(records, dates) {
  const supplied = records.map(record => dates.get(record.id)).sort((a, b) => compareText(a.date, b.date));
  return {
    start: supplied[0]?.date ?? null, end: supplied.at(-1)?.date ?? null,
    knownRecords: supplied.length, unknownRecords: 0,
    unknownTimezoneRecords: supplied.filter(date => date.unknownTimezone).length,
    limit: 'Supplied posting calendar dates only; unknown timezones are preserved. These dates do not establish present-day or platform-wide emergence.'
  };
}

function representatives(records, dates) {
  const sorted = [...records].sort((a, b) => compareText(dates.get(b.id).date, dates.get(a.id).date) || compareText(a.id, b.id));
  const selected = [], creators = new Set();
  for (const record of sorted) {
    if (!creators.has(creatorKey(record))) {
      selected.push(record); creators.add(creatorKey(record));
      if (selected.length === 3) return selected;
    }
  }
  const ids = new Set(selected.map(record => record.id));
  for (const record of sorted) {
    if (!ids.has(record.id)) { selected.push(record); ids.add(record.id); }
    if (selected.length === 3) break;
  }
  return selected;
}

function periodStats(records, denominator, dates) {
  return {
    videoCount: records.length,
    creatorCount: new Set(records.map(creatorKey)).size,
    sharePercent: denominator ? rounded(records.length / denominator * 100) : null,
    dateWindow: dateWindow(records, dates),
    sourceIds: representatives(records, dates).map(record => record.id)
  };
}

function basisText(sourceGroups) {
  return sourceGroups.map(source => `${source.count} ${source.field === 'format' ? 'supplied format labels' : source.descriptionSource === 'upstream-model' ? 'upstream AI-derived visual descriptions' : source.descriptionSource + ' visual descriptions'}`).join('; ');
}

/** Compare adjacent dated windows within the supplied records, without clock or network access. */
export function analyzeMomentum(records, { asOf, windowDays = 7 } = {}) {
  if (!records || typeof records === 'string' || typeof records[Symbol.iterator] !== 'function') throw invalid('records must be an array or iterable of normalized source records.');
  const end = calendarDay(asOf);
  if (end === null) throw invalid('asOf must be a real calendar date in YYYY-MM-DD format.');
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 90) throw invalid('windowDays must be an integer from 1 to 90.');
  const currentStart = end - windowDays + 1, priorStart = end - windowDays * 2 + 1;
  const windows = {
    current: { start: dayLabel(currentStart), end: asOf, recordCount: 0 },
    prior: { start: dayLabel(priorStart), end: dayLabel(currentStart - 1), recordCount: 0 }
  };
  const coverage = {
    retrievedRecords: 0, uniqueRecords: 0, duplicateRecords: 0, invalidRecords: 0,
    exampleRecordsExcluded: 0, missingDates: 0, invalidDates: 0, datedRecords: 0,
    beforeWindows: 0, afterAsOf: 0, comparedRecords: 0,
    unknownTimezoneRecords: 0, comparedUnknownTimezoneRecords: 0,
    detectedGroups: 0, reportedGroups: 0, citedRecords: 0
  };
  const dates = new Map(), compared = [], currentIds = new Set(), seen = new Set(), comparedCreators = new Set();
  for (const record of records) {
    coverage.retrievedRecords++;
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id || !creatorKey(record)) { coverage.invalidRecords++; continue; }
    if (seen.has(record.id)) { coverage.duplicateRecords++; continue; }
    seen.add(record.id); coverage.uniqueRecords++;
    if (record.demo === true) { coverage.exampleRecordsExcluded++; continue; }
    if (record.postedAt === undefined || record.postedAt === null || record.postedAt === '') { coverage.missingDates++; continue; }
    const date = postingDate(record.postedAt);
    if (!date) { coverage.invalidDates++; continue; }
    coverage.datedRecords++;
    if (date.unknownTimezone) coverage.unknownTimezoneRecords++;
    if (date.day < priorStart) { coverage.beforeWindows++; continue; }
    if (date.day > end) { coverage.afterAsOf++; continue; }
    coverage.comparedRecords++; comparedCreators.add(creatorKey(record));
    if (date.unknownTimezone) coverage.comparedUnknownTimezoneRecords++;
    if (date.day >= currentStart) windows.current.recordCount++;
    else windows.prior.recordCount++;
    // Unclassified rows still count in every denominator, without retaining their payload.
    if (formatEvidence(record).length) {
      dates.set(record.id, date); compared.push(record);
      if (date.day >= currentStart) currentIds.add(record.id);
    }
  }
  // Sort before classification so supplied label casing and representative order are stable.
  compared.sort((a, b) => compareText(a.id, b.id));
  const classified = getTrends(compared);
  coverage.detectedGroups = classified.length;
  const groups = classified.map(pattern => {
    const currentRecords = pattern.records.filter(record => currentIds.has(record.id));
    const priorRecords = pattern.records.filter(record => !currentIds.has(record.id));
    const current = periodStats(currentRecords, windows.current.recordCount, dates);
    const prior = periodStats(priorRecords, windows.prior.recordCount, dates);
    const rawChange = windows.current.recordCount && windows.prior.recordCount ? (currentRecords.length / windows.current.recordCount - priorRecords.length / windows.prior.recordCount) * 100 : null;
    const risingWithinSample = current.videoCount >= 5 && current.creatorCount >= 3 && prior.videoCount >= 1 && rawChange > 0;
    const cited = new Set([...current.sourceIds, ...prior.sourceIds]);
    return {
      format: pattern.format, current, prior,
      changePercentagePoints: rawChange,
      risingWithinSample, signal: risingWithinSample ? 'rising-within-sample' : 'no-positive-signal',
      evidence: pattern.evidence.filter(item => cited.has(item.recordId)),
      sourceGroups: pattern.sourceGroups.map(source => ({ ...source, sourceIds: source.sourceIds.filter(id => cited.has(id)) })),
      dateWindow: dateWindow(pattern.records, dates),
      _rankChange: rawChange
    };
  }).sort((a, b) => Number(b.risingWithinSample) - Number(a.risingWithinSample) || (b._rankChange ?? -Infinity) - (a._rankChange ?? -Infinity) || b.current.creatorCount - a.current.creatorCount || b.current.videoCount - a.current.videoCount || b.prior.videoCount - a.prior.videoCount || compareText(a.format, b.format)).slice(0, 6).map(({ _rankChange, ...group }) => group);
  const byId = new Map(compared.map(record => [record.id, record])), sourceMap = new Map();
  const sections = groups.map(group => {
    const sourceIds = [...group.current.sourceIds, ...group.prior.sourceIds];
    for (const id of sourceIds) sourceMap.set(id, byId.get(id));
    const share = value => value === null ? 'unavailable (no dated records in that window)' : value + '%';
    const change = group.changePercentagePoints;
    const delta = change === null ? 'Share change is unavailable without dated records in both windows.' : change !== 0 && Math.abs(change) < 0.0001 ? `Share ${change > 0 ? 'increased' : 'decreased'} by less than 0.0001 percentage points.` : `Share changed by ${change > 0 ? '+' : ''}${rounded(change)} percentage points.`;
    return {
      heading: group.format, sourceIds,
      text: `${windows.current.start} through ${windows.current.end}: ${group.current.videoCount} clips from ${group.current.creatorCount} creators, ${share(group.current.sharePercent)} of all ${windows.current.recordCount} retrieved dated records in that window. ${windows.prior.start} through ${windows.prior.end}: ${group.prior.videoCount} clips from ${group.prior.creatorCount} creators, ${share(group.prior.sharePercent)} of all ${windows.prior.recordCount} retrieved dated records in that window. ${delta} ${group.risingWithinSample ? 'Rising within the supplied sample.' : 'No positive signal: this format does not meet every requirement of five current clips, three current creators, prior evidence and increasing share.'} Evidence: ${basisText(group.sourceGroups)}. Sources below are representative clips from each available window; counts use every matching clip. Posting dates and unknown timezones are supplied metadata. Upstream descriptions remain separate from original transcripts.`
    };
  });
  const sources = [...sourceMap.values()];
  coverage.reportedGroups = groups.length; coverage.citedRecords = sources.length;
  const rising = groups.filter(group => group.risingWithinSample).length;
  const summary = !coverage.comparedRecords ? `No dated records fall within the two comparison windows ending ${asOf}. No rising-format signal can be established.` : rising ? `${rising} format${rising === 1 ? ' is' : 's are'} rising within the supplied sample for the dated window ending ${asOf}. This compares ${windows.current.recordCount} current-window and ${windows.prior.recordCount} prior-window records; it does not measure platform-wide growth.` : `No format meets the rising-within-sample requirements in the dated windows ending ${asOf}. This compares ${windows.current.recordCount} current-window and ${windows.prior.recordCount} prior-window records.`;
  const notice = 'These are retrieved-sample comparisons anchored to the supplied as-of calendar date, which may be historical, not evidence of what is emerging today or across the platform. Unknown timezones are preserved. A single cumulative views or engagement snapshot cannot establish metric growth, cause or performance gains.';
  sections.push({
    heading: 'Coverage and limits', sourceIds: [],
    text: `${coverage.retrievedRecords} retrieved rows; ${coverage.uniqueRecords} unique source records; ${coverage.duplicateRecords} duplicate rows and ${coverage.invalidRecords} invalid records excluded. ${coverage.comparedRecords} dated records compared; ${coverage.missingDates} missing and ${coverage.invalidDates} invalid posting dates excluded; ${coverage.beforeWindows} dated records precede the windows and ${coverage.afterAsOf} follow the as-of date. ${coverage.exampleRecordsExcluded} fictional example records excluded. ${coverage.comparedUnknownTimezoneRecords} compared records have unknown timezones. ${coverage.detectedGroups} eligible multi-creator formats; ${groups.length} reported; ${sources.length} actual representative clips cited. Shares use all dated records in each window, including records with no supported format; a clip can support multiple formats, so shares need not sum to 100%. ${notice}`
  });
  return {
    kind: 'trends', mode: 'deterministic', title: `Dated format momentum as of ${asOf}`,
    summary, notice, sections, sources, creators: [],
    stats: {
      totalRecords: coverage.retrievedRecords, matchedRecords: coverage.comparedRecords,
      retrievedRecords: coverage.retrievedRecords, comparedRecords: coverage.comparedRecords, citedRecords: sources.length,
      uniqueCreators: comparedCreators.size,
      totalViews: null, avgViews: null, avgEngagementRate: null, measuredVideos: 0
    },
    temporal: { asOf, windowDays, windows, groups, coverage }
  };
}
