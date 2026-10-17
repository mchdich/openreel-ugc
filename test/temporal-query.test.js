import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTemporalQuery } from '../public/temporal-query.js';
import { normalizeRecords, searchRecords } from '../public/engine.js';

const today = '2026-10-17';
const parse = question => parseTemporalQuery(question, { today });
const badRequest = expression => assert.throws(expression, error => error instanceof Error && error.status === 400 && error.message.length > 0);

test('ordinary recurrence and creator requests keep their existing path', () => {
  for (const question of [
    'What skincare patterns repeat?',
    'What skincare trends are working across creators?',
    'Which skincare formats are trending?',
    'Find rising UCLA creators with at least 1,000 followers',
    'Find creators sharing skincare growth tips',
    'Which video formats are best for gaining weight?',
    'What skincare patterns repeat as of 2024-02-30 over 0 days?'
  ]) assert.equal(parse(question), null, question);
});

test('explicit momentum language activates dated comparison without becoming a topic term', () => {
  for (const question of [
    'What skincare formats are gaining share?',
    'Which skincare trends are emerging?',
    'Show rising skincare patterns',
    'Show skincare format momentum',
    'Compare skincare trend growth',
    'Which skincare patterns are gaining in popularity?'
  ]) {
    const result = parse(question);
    assert.ok(result, question);
    assert.equal(result.asOf, today);
    assert.equal(result.windowDays, 7);
    assert.equal(result.postedFrom, '2026-10-04');
    assert.equal(result.postedThrough, today);
    assert.match(result.query, /skincare/i);
    assert.doesNotMatch(result.query, /\b(?:gaining|share|emerging|rising|momentum|growth|popularity)\b/i);
  }
});

test('ISO as-of and duration syntax produce both inclusive adjacent windows', () => {
  assert.deepEqual(parse('What skincare formats are gaining share as of 2024-07-21 over 7 days?'), {
    query: 'What skincare formats are ?', asOf: '2024-07-21', windowDays: 7,
    postedFrom: '2024-07-08', postedThrough: '2024-07-21'
  });
});

test('last, past and over the last windows respect their numeric bounds', () => {
  for (const [phrase, windowDays, postedFrom] of [
    ['last 1 day', 1, '2024-07-20'],
    ['past 90 days', 90, '2024-01-24'],
    ['over the last 7 days', 7, '2024-07-08']
  ]) {
    const result = parse(`Show rising skincare formats as of 2024-07-21 ${phrase}`);
    assert.equal(result.windowDays, windowDays);
    assert.equal(result.postedFrom, postedFrom);
    assert.doesNotMatch(result.query, /\b(?:over|last|past|days?)\b/i);
  }
});

test('UTC calendar arithmetic handles leap days and year boundaries', () => {
  for (const [asOf, days, postedFrom] of [
    ['2024-03-01', 1, '2024-02-29'],
    ['2000-03-01', 1, '2000-02-29'],
    ['1900-03-01', 1, '1900-02-28'],
    ['2024-01-01', 7, '2023-12-19']
  ]) assert.equal(parse(`Show emerging skincare formats as of ${asOf} over ${days} days`).postedFrom, postedFrom);
});

test('strict actual dates reject normalization, human dates and appended timestamps', () => {
  for (const value of [
    '2023-02-29', '1900-02-29', '2024-04-31', '2024-13-01', '2024-00-05',
    '2024-01-00', '2024-2-01', '2024-02-30', 'tomorrow', 'July 21, 2024',
    '2024-07-21T00:00:00Z', '2024-07-21suffix'
  ]) badRequest(() => parse(`Show rising skincare formats as of ${value}`));
  badRequest(() => parse('Show rising skincare formats as of?'));
});

test('as-of dates allow sentence punctuation but not conflicting or duplicate clauses', () => {
  assert.equal(parse('Show emerging skincare formats as of 2024-02-29.').asOf, '2024-02-29');
  assert.equal(parse('Show emerging skincare formats as of 2024-02-29, over 7 days.').asOf, '2024-02-29');
  badRequest(() => parse('Show rising skincare formats as of 2024-07-21 as of 2024-07-22'));
  badRequest(() => parse('Show rising skincare formats as of 2024-07-21 as of 2024-07-21'));
});

test('invalid explicit windows fail rather than defaulting or truncating', () => {
  for (const value of ['0', '91', '-1', '1.5', '1e1', 'NaN', 'Infinity', 'seven', '7,000', '+7']) {
    badRequest(() => parse(`Show rising skincare formats over ${value} days`));
  }
  badRequest(() => parse('Show rising skincare formats over days'));
  badRequest(() => parse('Show rising skincare formats over 2 weeks'));
  badRequest(() => parse('Show rising skincare formats last 7 days past 14 days'));
});

test('date controls and momentum terms are case insensitive', () => {
  const result = parse('WHAT SKINCARE FORMATS ARE GAINING SHARE AS OF 2024-07-21 OVER 7 DAYS?');
  assert.equal(result.asOf, '2024-07-21');
  assert.equal(result.postedFrom, '2024-07-08');
  assert.match(result.query, /SKINCARE/);
  assert.doesNotMatch(result.query, /GAINING|SHARE|AS OF|OVER 7 DAYS/);
});

test('topic and every creator filter survive temporal stripping without broadening matches', () => {
  const records = normalizeRecords([
    {id:'match',handle:'one',caption:'skincare moisturizer',niche:'skincare',school:'UCLA',location:'Los Angeles',followers:1500,email:'one@example.com',bio:'one@example.com'},
    {id:'wrong-school',handle:'two',caption:'skincare moisturizer',niche:'skincare',school:'NYU',location:'Los Angeles',followers:1500,email:'two@example.com',bio:'two@example.com'},
    {id:'wrong-location',handle:'three',caption:'skincare moisturizer',niche:'skincare',school:'UCLA',location:'New York',followers:1500,email:'three@example.com',bio:'three@example.com'},
    {id:'too-small',handle:'four',caption:'skincare moisturizer',niche:'skincare',school:'UCLA',location:'Los Angeles',followers:900,email:'four@example.com',bio:'four@example.com'},
    {id:'no-bio-contact',handle:'five',caption:'skincare moisturizer',niche:'skincare',school:'UCLA',location:'Los Angeles',followers:1500,email:'five@example.com'},
    {id:'wrong-topic',handle:'six',caption:'woodworking',niche:'crafts',school:'UCLA',location:'Los Angeles',followers:1500,email:'six@example.com',bio:'six@example.com'}
  ]);
  const result = parse('What skincare formats are gaining share for UCLA creators in Los Angeles with at least 1,000 followers and email in bio as of 2024-07-21 over 7 days?');
  for (const phrase of ['skincare','UCLA creators','in Los Angeles','at least 1,000 followers','email in bio']) assert.ok(result.query.includes(phrase), phrase);
  assert.deepEqual(searchRecords(records, result.query).map(record => record.id), ['match']);
});

test('over follower bounds remain distinct from an explicit day window', () => {
  const result = parse('Show rising skincare formats for UCLA creators with over 1,000 followers and public emails over 7 days');
  assert.match(result.query, /over 1,000 followers/);
  assert.match(result.query, /public emails/);
  assert.equal(result.windowDays, 7);
  assert.doesNotMatch(result.query, /over 7 days/);
});

test('bounded untrusted questions are rejected without invoking coercion', () => {
  let coerced = false;
  for (const value of [null, undefined, 7, {}, [], {toString(){coerced=true;return 'rising formats';}}, '', ' ', 'x'.repeat(6001)]) badRequest(() => parse(value));
  assert.equal(coerced, false);
  assert.ok(parse('Show rising formats'.padEnd(6000, ' ')));
});

test('injected today is validated only for an actual temporal request', () => {
  badRequest(() => parseTemporalQuery('Show rising formats', {today:'2024-02-30'}));
  assert.equal(parseTemporalQuery('What patterns repeat?', {today:'2024-02-30'}), null);
});

test('omitting today uses the actual UTC calendar date', () => {
  const before = new Date().toISOString().slice(0,10);
  const result = parseTemporalQuery('Show emerging skincare formats');
  const after = new Date().toISOString().slice(0,10);
  assert.ok([before,after].includes(result.asOf));
  assert.equal(result.postedThrough, result.asOf);
});

test('proper school and location names are never stripped as momentum keywords', () => {
  const question = 'Show emerging skincare formats for Rising Sun University creators in Growth City with public emails as of 2024-07-21 over 7 days';
  const result = parse(question);
  assert.ok(result.query.includes('Rising Sun University creators'));
  assert.ok(result.query.includes('in Growth City'));
  assert.ok(result.query.includes('public emails'));
  assert.doesNotMatch(result.query, /emerging/i);
  const records = normalizeRecords([
    {id:'match',handle:'one',caption:'skincare',school:'Rising Sun University',location:'Growth City',email:'one@example.com'},
    {id:'wrong-school',handle:'two',caption:'skincare',school:'Sun University',location:'Growth City',email:'two@example.com'},
    {id:'wrong-location',handle:'three',caption:'skincare',school:'Rising Sun University',location:'City',email:'three@example.com'}
  ]);
  assert.deepEqual(searchRecords(records, result.query).map(record => record.id), ['match']);
  assert.equal(parse('What growth marketing patterns repeat?'), null);
});

test('explicit growth and momentum predicates remain temporal', () => {
  for (const question of [
    'Which skincare formats show growth?',
    'Which skincare patterns have momentum?',
    'Compare growth across skincare trends'
  ]) {
    const result = parse(question);
    assert.ok(result, question);
    assert.match(result.query, /skincare/);
    assert.doesNotMatch(result.query, /\b(?:growth|momentum)\b/);
  }
});
