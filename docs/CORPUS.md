# Persistent local corpus

The Node-only corpus module stores normalized video records in SQLite and indexes their captions, transcripts, hooks, niches, public bios, schools, locations, and handles with FTS5. It accepts iterable imports without the browser's 2,000-record limit and supports bounded ranked result pages.

This is infrastructure toward the full demo target. **An actual, independently acquired 150,000+ video corpus with transcripts/visual evidence and complete research queries is still required.** The synthetic capacity benchmark below does not supply that corpus.

## Runtime and storage

Use **Node.js 24 or newer**, with its built-in [SQLite module](https://nodejs.org/docs/latest-v24.x/api/sqlite.html); there are no package dependencies. The default path resolves from the module to this checkout's `data/corpus.sqlite`, independently of the current working directory. It never defaults to a home directory. Pass `--db` to choose another explicit location.

The SQLite file and its WAL/SHM sidecars contain local research data and are excluded from source control. Back them up with an appropriate SQLite backup process. The module uses WAL mode and transactions; synchronous SQLite work runs on the Node event loop. It is a local storage/search engine, not a distributed indexing service.

**Cloudflare Worker limitation:** `node:sqlite` and local filesystem storage are unavailable in the portable Worker environment. Keep `lib/corpus.js` out of the Worker bundle. Node integration can bind a corpus handle to its API; Worker deployments need a separately implemented persistent backend or retain their browser-library behavior. A Worker build alone does not demonstrate indexed-corpus support.

## Commands

```sh
node scripts/corpus.js init --db data/corpus.sqlite
node scripts/corpus.js import records.json --kind real --source permitted-export --db data/corpus.sqlite
node scripts/corpus.js search "Find NYU creators with at least 1500 followers" --db data/corpus.sqlite
node scripts/corpus.js stats --db data/corpus.sqlite
```

An import file is a JSON array or `{ "records": [...], "kind": "...", "source": "..." }`. It uses the [record schema](DATA.md). The command-line `--kind` and `--source` override manifest values. A malformed row rolls back the whole import, including any earlier updates and FTS changes. Identical records upsert without duplicates or timestamp churn.

Canonical TikTok URLs without an explicit ID derive the same `tiktok-<video-id>` identifier used by the social adapters. Other source-only records derive a stable source hash; records without a source derive a content hash. Supply explicit IDs when source-less records must retain identity across content edits.

Search defaults to real records. Use `--kind example`, `synthetic`, `unverified`, or `all` deliberately when inspecting other classes. Options include `--limit` (1–1,000), `--offset`, `--school`, `--location`, `--min-followers`, `--max-followers`, and `--email-only`. The shared research query planner extracts natural-language bounds and constraints; remaining terms are quoted literal FTS tokens. SQL parameters are bound. Explicit filters and parsed filters apply together. Creator queries deduplicate matching handles before applying the requested count.

## Real data, examples, and provenance

Counts remain separate:

- **real:** explicitly imported or acquired source records. Each requires a non-fictional canonical TikTok video URL matching its handle, `sourceType`, and a valid `fetchedAt` retrieval timestamp.
- **example:** fictional fixtures, marked `demo: true`.
- **synthetic:** generated capacity/test records, also marked as examples for browser rendering.
- **unverified:** ordinary imports lacking an explicit real classification; this is the default for unmarked non-example imports.

An existing example/synthetic ID cannot be promoted into the real class. `stats().total` is all stored rows; `stats().byKind.real` is the real-class count. `providerObservedReal` is a separate count of real rows written by trusted acquisition with provider-observed provenance. `uniqueCreators` and `knownViewRecords` describe the complete database, across classes.

**Classification is not an independent truth audit.** A `--kind real` JSON import validates source/provenance structure but cannot establish that its asserted caption or statistics are true; its verification label is `user-supplied`. The acquisition helper marks successfully observed provider responses `provider-observed`. Trusted local module callers control that label. Provider observations can still be stale, incomplete, or inaccurate. No file format or database label proves target-scale parity.

Missing/null/blank numeric measurements and explicit `unavailableMetrics` flags remain unknown. SQLite stores unknown metric columns as `NULL`; normalized result payloads retain availability flags. Unknown followers cannot pass follower bounds; genuine measured zeroes remain known. Profile evidence, including public self-description citations, survives normalization and storage. Search never infers a university merely from a caption mention when a school constraint is present.

## Collect public creator profiles

Create `handles.txt` containing one known public handle per line, or a JSON array of handles, then run:

```sh
node scripts/corpus.js collect-profiles handles.txt --db data/corpus.sqlite
```

The collector validates the whole list, normalizes/deduplicates handles, and calls `discoverCreator(handle, env)` sequentially **once per unique handle**. It uses the official public creator-embed adapter without a paid provider token. There are no automatic retries. Private/deleted/unavailable profiles remain empty or produce a safe failure record in the command summary; failures do not generate video records. Each successful profile import is atomic.

The adapter returns a bounded public profile snapshot and currently exposed video records, not a complete history or automatic discovery of every creator. It preserves public source identity, profile evidence, retrieval time, known views/followers, and unknown analytics. It does not download videos or create missing transcripts/visual descriptions. Obtain and retain the rights/provenance needed for any larger acquisition.

During implementation, one actual request for `@scout2015` populated the local default database with **10 real records from one creator**, with no example/synthetic rows and `providerObservedReal: 10`. That database is local and ignored by Git; the source release does not include a 150,000-record real dataset.

## Synthetic capacity benchmark

Use an explicitly separate, empty database:

```sh
node scripts/corpus.js benchmark --db data/synthetic-benchmark.sqlite --count 150000
```

The command refuses the default implicit path and a nonempty benchmark database. Every generated row is classified synthetic, labeled as an example, and counted separately. It reports import and search time plus actual database counts.

Observed October 17, 2026, using Node v24.22.0 / SQLite 3.53.4 on the mounted Windows project filesystem:

| Measurement | Observed result |
| --- | --- |
| Stored records | 150,000 synthetic; **0 real** |
| Distinct generated handles | 5,000 |
| Transactional import | 123.177 seconds |
| Broad `cooking` FTS query returning 20 records | 5.598 seconds |

These timings are implementation-run measurements, not a latency guarantee. The broad query matches the generated corpus and includes ranking; hardware, storage, corpus text, query selectivity, and concurrent work affect timings. This proves storage and query operation at the tested row count. It does not prove real acquisition, live relevance, audiovisual understanding, or complete demo parity.

## Integration exports

```js
import {openCorpus, DEFAULT_CORPUS_PATH, collectCreatorHandles} from './lib/corpus.js';

const corpus = openCorpus(DEFAULT_CORPUS_PATH);
try {
  const records = corpus.search('Find NYU creators with at least 1500 followers', {
    kind: 'real', limit: 20, offset: 0
  });
  const globalStats = corpus.stats();
  // Feed the bounded normalized records to the research engine.
  // Report globalStats separately from statistics over retrieved records.
} finally {
  corpus.close();
}
```

Exports are `Corpus`, `openCorpus(path = DEFAULT_CORPUS_PATH, {readOnly = false})`, `DEFAULT_CORPUS_PATH`, and `collectCreatorHandles(corpus, handles, {env, discoverCreator})`. Handle methods are `upsert(iterable, {kind, source, verification})`, `search(query, options)`, `get(id)`, `stats()`, and `close()`.

Search/get return normalized records with `corpusKind`, `corpusVerification`, `corpusSource`, and `corpusImportedAt`. `upsert` returns `{processed, changed, total}`. Search supports the CLI filters plus `niche`, `format`, `handle`, `emailInBio`, and `uniqueCreators`. The acquisition helper returns request/import/change counts and safe per-handle failures.

Focused tests in `test/corpus.test.js` exercise disk persistence, atomic rollback, FTS updates, classification boundaries, unknowns, follower/profile filters, literal query safety, imports beyond the browser cap, actual CLI behavior, collection deduplication/no retries, and creator-count ordering. Run `node --test test/corpus.test.js`, followed by the full `npm test` command before release.
