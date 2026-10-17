import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecords, searchRecords, getTrends, research } from '../public/engine.js';

const fixture = [
  { id: 'a', handle: '@mina', caption: 'Campus beauty routine', transcript: 'Three things I wish I knew', hook: 'Three things', format: 'List', niche: 'beauty', school: 'New York University', location: 'New York City', followers: 28000, views: 10000, likes: 900, comments: 50, shares: 50, email: 'mina@example.com' },
  { id: 'b', handle: '@jo', caption: 'Dorm beauty routine', format: 'List', niche: 'beauty', school: 'NYU', location: 'NYC', followers: 32000, views: 20000, likes: 1000, comments: 100, shares: 100 },
  { id: 'c', handle: '@sam', caption: 'Los Angeles fitness', format: 'Story', niche: 'fitness', school: 'UCLA', location: 'Los Angeles', followers: 250000, views: 30000, likes: 3000 },
  { id: 'd', handle: '@ari', caption: 'Campus beauty', format: 'Story', niche: 'beauty', school: 'University of California, Los Angeles', location: 'LA', followers: 12000, views: 5000, email: 'ari@example.com' },
  { id: 'e', handle: '@sam', caption: 'Another fitness story', format: 'Solo', niche: 'fitness', school: 'UCLA', location: 'LA', followers: 250000, views: 1000 },
  { id: 'f', handle: '@sam', caption: 'Another solo', format: 'Solo', niche: 'fitness', school: 'UCLA', location: 'LA', followers: 250000, views: 2000 }
];

test('normalizes numeric shorthand and copies only declared fields', () => {
  const record = normalizeRecords([{ handle: 'person', followers: '12.5K', views: '1,200,000', likes: '3M', postedAt: '2026-01-01', email: 'hello@example.com', injected: '<script>secret</script>', demo: true }])[0];
  assert.equal(record.handle, '@person');
  assert.equal(record.followers, 12500);
  assert.equal(record.views, 1200000);
  assert.equal(record.likes, 3000000);
  assert.equal(record.email, 'hello@example.com');
  assert.equal(record.demo, true);
  assert.equal(Object.hasOwn(record, 'injected'), false);
});

test('rejects invalid imports atomically and unsafe resource links', () => {
  for (const input of [null, {}, [], [{ caption: 'missing handle' }], [{ handle: 'a', views: -1 }], [{ handle: 'a', views: 'not a number' }], [{ handle: 'a', url: 'javascript:alert(1)' }], [{ handle: 'a', thumbnail: 'data:text/html,x' }], [{ handle: 'a', email: 'invented' }], Array.from({ length: 2001 }, () => ({ handle: 'a' }))]) {
    assert.throws(() => normalizeRecords(input));
  }
  assert.doesNotThrow(() => normalizeRecords([{ handle: '@safe', caption: '<img src=x onerror=alert(1)>', url: 'https://example.com/video' }]));
});

test('creator discovery honors around, university, location, email and requested count', () => {
  const records = normalizeRecords(fixture);
  assert.deepEqual(searchRecords(records, 'Find 1 beauty creator at NYU in NYC around 30k followers with public emails').map(r => r.id), ['a']);
  assert.deepEqual(searchRecords(records, 'Find UCLA creators under 20,000 followers').map(r => r.id), ['d']);
  assert.deepEqual(searchRecords(records, 'Find creators with at least 0.2M followers').map(r => r.id), ['c']);
});

test('minimum, maximum and structured filters do not leak unrelated matches', () => {
  const records = normalizeRecords(fixture);
  assert.deepEqual(searchRecords(records, 'Find NYU creators between 28K and 31K followers').map(r => r.id), ['a']);
  assert.deepEqual(searchRecords(records, 'Find creators', { school: 'NYU', minFollowers: 30000, maxFollowers: 40000 }).map(r => r.id), ['b']);
  assert.deepEqual(searchRecords(records, 'Find Harvard creators with at least 1M followers'), []);
  assert.deepEqual(searchRecords(records, 'robotic carpentry'), []);
});

test('trends require at least two distinct creators and calculate actual metrics', () => {
  const trends = getTrends(normalizeRecords(fixture));
  assert.deepEqual(trends.map(t => t.format).sort(), ['List', 'Story']);
  const list = trends.find(t => t.format === 'List');
  assert.equal(list.count, 2);
  assert.equal(list.creators.length, 2);
  assert.equal(list.avgViews, 15000);
  assert.equal(list.avgEngagementRate, 8);
});

test('research remains grounded and empty creator results do not manufacture contacts', () => {
  const records = normalizeRecords(fixture);
  const answer = research(records, 'Find 10 beauty creators at NYU with public emails');
  assert.equal(answer.kind, 'creators');
  assert.deepEqual(answer.creators.map(r => r.id), ['a']);
  assert.equal(answer.stats.matchedRecords, 1);
  assert.equal(answer.stats.totalRecords, 6);
  assert.equal(answer.mode, 'deterministic');
  assert.match(answer.summary, /1/);
  const empty = research(records, 'Find Harvard creators with over 1M followers and emails');
  assert.deepEqual(empty.creators, []);
  assert.deepEqual(empty.sources, []);
  assert.match(empty.summary, /no|0/i);
});

test('video critique acknowledges pasted links and uses supplied script rather than claiming to watch', () => {
  const answer = research([], 'Why did this video underperform? https://example.com/video');
  assert.equal(answer.kind, 'critique');
  assert.match(answer.summary, /cannot|not fetch|not watched|transcript/i);
  assert.deepEqual(answer.sources, []);
  const script = research([], 'Review this script: Today I want to tell you about my daily routine.');
  assert.equal(script.kind, 'critique');
  assert.ok(script.sections.some(s => /opening|hook/i.test(s.heading)));
});

test('natural follower bounds respect strict and inclusive boundaries', () => {
  const records = normalizeRecords([{ handle: 'lo', followers: 9999 }, { handle: 'eq', followers: 10000 }, { handle: 'hi', followers: 10001 }]);
  assert.deepEqual(searchRecords(records, 'creators under 10k followers').map(r => r.handle), ['@lo']);
  assert.deepEqual(searchRecords(records, 'creators over 10k followers').map(r => r.handle), ['@hi']);
  assert.deepEqual(searchRecords(records, 'creators at most 10k followers').map(r => r.handle), ['@lo', '@eq']);
  assert.deepEqual(searchRecords(records, 'creators at least 10k followers').map(r => r.handle), ['@eq', '@hi']);
});

test('research questions recognize niche language without mistaking it for a city', () => {
  const records = normalizeRecords(fixture);
  const result = research(records, 'What hooks are competitors using in the beauty niche?');
  assert.deepEqual(result.sources.map(r => r.id), ['a', 'b', 'd']);
  assert.ok(research(records, 'What trends are working right now?').trends.length > 0);
});

test('script-only messages and constrained followups use the supplied context', () => {
  const script = research([], 'Script: Today I want to tell you about my morning routine.');
  assert.equal(script.kind, 'critique');
  assert.match(script.sections[0].heading, /hook/i);
  const followup = research(normalizeRecords(fixture), 'Only those with public emails', [{ role: 'user', content: 'Find beauty creators at NYU around 30K followers' }]);
  assert.equal(followup.kind, 'creators');
  assert.deepEqual(followup.creators.map(r => r.id), ['a']);
});

test('final interface trend prompt retrieves recurring formats', () => {
  const result = research(normalizeRecords(fixture), 'What content trends are working across multiple creators?');
  assert.equal(result.kind, 'trends');
  assert.equal(result.trends.length, 2);
});

test('script composer produces a concrete rewrite and a brief followup uses the original script', () => {
  const prompt = 'Review this video script and suggest concrete improvements:\n\nToday I want to tell you about my study app. It turns lecture notes into five practice questions. Open your notes and choose a topic.';
  const result = research([], prompt);
  assert.equal(result.kind, 'critique');
  const rewrite = result.sections.find(section => /rewrite/i.test(section.heading));
  assert.ok(rewrite);
  assert.match(rewrite.text, /five practice questions/);
  assert.doesNotMatch(rewrite.text, /^Today I want/);
  const brief = research([], 'Turn this into a creative brief with hooks and a shot list', [{ role: 'user', content: prompt }]);
  assert.match(brief.title, /creative brief/i);
  assert.ok(brief.sections.some(section => /hooks/i.test(section.heading)));
  assert.ok(brief.sections.some(section => /shot list/i.test(section.heading)));
  assert.ok(brief.sections.some(section => /lecture notes|practice questions/.test(section.text)));
});

test('school requests constrain the school field rather than caption mentions', () => {
  const records = normalizeRecords([
    { id: 'harvard', handle: 'harvard', school: 'Harvard', caption: 'Student routine' },
    { id: 'stanford', handle: 'stanford', school: 'Stanford', caption: 'Visiting Harvard University and meeting Harvard creators' },
    { id: 'toronto', handle: 'toronto', school: 'University of Toronto', caption: 'Campus routine' }
  ]);
  for (const question of ['Find Harvard creators', 'Find harvard creators', 'Find Harvard University creators', 'Find creators at Harvard', 'Find creators from Harvard']) {
    assert.deepEqual(searchRecords(records, question).map(record => record.id), ['harvard'], question);
  }
  assert.deepEqual(searchRecords(records, 'Find University of Toronto creators').map(record => record.id), ['toronto']);
  assert.deepEqual(searchRecords(records.filter(record => record.id !== 'harvard'), 'Find Harvard creators'), []);
  assert.deepEqual(searchRecords(records, 'Find Princeton University creators'), []);
});

test('dash follower ranges enforce both bounds and propagate a trailing unit', () => {
  const records = normalizeRecords([
    { handle: 'low', followers: 100 }, { handle: 'min', followers: 10000 }, { handle: 'middle', followers: 15000 }, { handle: 'max', followers: 20000 }, { handle: 'high', followers: 30000 }
  ]);
  for (const range of ['10k–20k', '10k-20k', '10k—20k', '10,000–20,000', '10-20k']) {
    assert.deepEqual(searchRecords(records, `Find creators with ${range} followers`).map(record => record.handle), ['@min', '@middle', '@max'], range);
  }
});

test('plus follower notation sets an inclusive minimum alongside school filters', () => {
  const records = normalizeRecords([
    { handle: 'low', school: 'UCLA', followers: 999 },
    { handle: 'minimum', school: 'UCLA', followers: 1000 },
    { handle: 'above', school: 'UCLA', followers: 1500 },
    { handle: 'other-school', school: 'NYU', followers: 5000 }
  ]);
  assert.deepEqual(searchRecords(records, 'Find UCLA creators with 1,000+ followers').map(record => record.handle), ['@minimum', '@above']);
});

test('unqualified literal follower counts require an exact match', () => {
  const records = normalizeRecords([
    { handle: 'below', followers: 1499 }, { handle: 'exact', followers: 1500 }, { handle: 'above', followers: 1501 }
  ]);
  assert.deepEqual(searchRecords(records, 'Find creators with 1500 followers').map(record => record.handle), ['@exact']);
});

test('ordinary to follower ranges enforce inclusive bounds', () => {
  const records = normalizeRecords([
    { handle: 'below', followers: 9999 }, { handle: 'minimum', followers: 10000 }, { handle: 'maximum', followers: 20000 }, { handle: 'above', followers: 20001 }
  ]);
  assert.deepEqual(searchRecords(records, 'Find creators with 10k to 20k followers').map(record => record.handle), ['@minimum', '@maximum']);
});

test('missing imported measurements stay unknown and cannot match follower bounds',()=>{
  const records=normalizeRecords([{handle:'unknown'},{handle:'zero',followers:0,views:0}]);
  assert.ok(records[0].unavailableMetrics.includes('followers'));
  assert.ok(!records[1].unavailableMetrics.includes('followers'));
  assert.deepEqual(searchRecords(records,'creators with at least 0 followers').map(r=>r.handle),['@zero']);
});
test('email in bio is applied to profile text rather than captions or a separate contact field',()=>{
  const records=normalizeRecords([
    {handle:'profile',school:'UCLA',followers:1500,bio:'UCLA | contact hello@example.com',email:'hello@example.com'},
    {handle:'caption',school:'UCLA',followers:1500,caption:'email hello@example.com',email:'hello@example.com'},
    {handle:'unrelated',school:'UCLA',followers:1500,bio:'other@example.com',email:'hello@example.com'}
  ]);
  assert.deepEqual(searchRecords(records,'Find UCLA creators with email in bio and 1000+ followers').map(r=>r.handle),['@profile']);
});
test('normalized creator evidence keeps the public profile citation and self-description status',()=>{
  const records=normalizeRecords([{handle:'profile',profileEvidence:{url:'https://www.tiktok.com/@profile',fetchedAt:'2026-10-17T00:00:00Z',school:{value:'NYU',source:'public-bio-self-description',text:'NYU'}}}]);
  assert.equal(records[0].profileEvidence.school.source,'public-bio-self-description');
  assert.match(records[0].profileEvidence.url,/tiktok/);
});

test('a social caption is identified as caption evidence rather than an observed video opening',()=>{
  const records=normalizeRecords([{handle:'maker',caption:'A caption about cooking',views:12}]);
  const result=research(records,'cooking');assert.match(result.sections[0].heading,/Caption/);assert.doesNotMatch(result.sections[0].heading,/opening/i);
});
