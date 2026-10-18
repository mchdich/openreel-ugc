# Persistent local and hosted corpus

The Node corpus stores normalized video records in SQLite; the Worker uses the asynchronous D1 adapter. Both index captions, transcripts, separately labeled visual descriptions, hooks, niches, public bios, schools, locations and actual handles with FTS5. Local iterable imports exceed the browser's 2,000-record limit; hosted writes use explicit bounded batches. Both return bounded ranked result pages.

**The normal local product corpus now has 154,462 real records across 4,627 creator identities, with 300 provider-observed records and zero example, synthetic or unverified rows.** Product API queries and native browser bookmark/reload have been verified against it. The separately verified hosted D1 seed remains 4,424 records. The synthetic capacity benchmark below is a different dataset and does not supply real evidence.

## Runtime and storage

Use **Node.js 24 or newer**, with its built-in [SQLite module](https://nodejs.org/docs/latest-v24.x/api/sqlite.html); there are no package dependencies. The default path resolves from the module to this checkout's `data/corpus.sqlite`, independently of the current working directory. It never defaults to a home directory. Pass `--db` to choose another explicit location.

The SQLite file and its WAL/SHM sidecars contain local research data and are excluded from source control. Back them up with an appropriate SQLite backup process. The module uses WAL mode and transactions; synchronous SQLite work runs on the Node event loop. It is a local storage/search engine, not a distributed indexing service.

`node:sqlite` and local files are unavailable inside the portable Worker. The Worker instead uses the asynchronous D1 adapter below. The local Node database and hosted D1 database are separate stores; configuring one does not copy data into the other.

## Verified full local product corpus

The acquired database at `data/research-nc.sqlite` is connected through the normal `OPENREEL_CORPUS_PATH` server configuration. It combines:

| Source | Real records | Evidence boundary |
| --- | --- | --- |
| Optional lingbow research archive | 150,000 | CC-BY-NC-4.0; actual numeric identities, archival metrics, 60,322 upstream transcripts and 150,000 upstream model descriptions. |
| Publisher-declared MIT archive | 4,162 | Eligible distinct captioned videos from repeated source rows; archival/profile limitations remain. |
| Fresh public-profile/video snapshots | 262 | Provider-observed public metadata; absent measurements remain unknown. |

The October 17, 2026 product proof reports **154,424 real records, 4,621 creator identities and `providerObservedReal: 262`**. Deep API queries retrieved 1,000 skincare records, with actual caption/transcript/description sources; cooking and unboxing queries also returned cited real evidence. Compound NYU and UCLA queries returned one and two matching creators, retaining original public-bio qualifiers. Native Windows browser research displayed actual `tiktok-7386507456479825195`, bookmarked it and restored it after reload with its unknown username still empty and `sourceType: lingbow-archival-dataset` intact.

```sh
OPENREEL_CORPUS_PATH=data/research-nc.sqlite npm start
```

That command uses an already acquired/imported database; it does not download or bundle the data. Follow [RESEARCH_DATA.md](RESEARCH_DATA.md) to reproduce acquisition/import in a separate destination. Source licenses, historical observation dates and upstream-model/ASR labels remain attached. The verified local integration does not mean the full corpus has been copied to hosted D1.

A direct 1,000-record skincare subset produced six recurring-format groups with 152 distinct cited records. Clear phrases in upstream model descriptions supplied the pattern evidence; original `format` and transcript fields remained unchanged. The retained windows cover 2024 supplied calendar dates, with unknown timezones disclosed. These are archival patterns, not evidence of emergence now.

### Default pattern browsing

`POST /api/corpus/patterns` accepts `{ "query": "" }`. An empty query reads one general page of at most 100 real records and seven format probes of at most 30 distinct creators each, sequentially. From at most 310 unique candidates, shared evidence rules form eligible multi-creator groups. Two distinct creator anchors per group are reserved before filling up to 100 unique records across groups; supplied covers receive selection priority. The response includes `selection.method`, `queryCount` and `candidateRecords` separately from global corpus statistics. Selection is purposeful format coverage, not random sampling or a current trend ranking. Unsupported or single-creator groups stay absent. No corpus records or inferred format labels are written.

A nonempty query uses the normal bounded 100-record search and preserves its topic/profile constraints. The browser keeps selection provenance with that result and clears it on the next query/source change. The actual local default request returned seven groups from 86 records and 309 candidates; all 20 fan covers loaded. Fifteen metadata-only public-player merges supplied additional identities and previews without changing archival fields or counts. See [the current demo report](DEMO_VERIFICATION.md).

### Specific visual-pattern detection (1.8.0)

`POST /api/corpus/visual-patterns` accepts the same bounded query, but is an explicit model action. Empty-query selection is independent of the seven generic format groups: one general 100-record page and six 20-creator probes (`split screen`, `overhead shot`, `mirror selfie`, `close up`, `hands`, `side by side`) produce at most 220 unique candidates. Round-robin selection retains up to 100 eligible real records with attributed descriptions. Nonempty queries preserve the ordinary topic/profile filters and 100-record bound. `selection.method: "visual-coverage"` identifies this purposeful default selection, not a population estimate.

The server chooses at most 60 distinct creator identities, prioritizing supplied covers, and truncates each description to 1,800 characters. Up to two strict structured model calls share one 45-second deadline; each requests at most 6,000 output tokens with a 64 KiB response cap. A second adjudication may omit or revise first-pass proposals using only each original pattern's source IDs. Review failure never falls back to unreviewed proposals. At most three groups with two or three components and two to four members per component are accepted.

A shared 19-feature vocabulary supplies explicit predicates for framing, objects, actions and layout. Each retained member must have an exact attributed source span for every component and the group must span at least two creator identities. Displayed titles, descriptions and component labels are built from accepted predicates, rather than trusting model prose. Negation/uncertainty checks conservatively reject entire candidate sentences. Clothing, opening actions, people visibility and simultaneous phone arrangements require explicit relationships. This bounded lexical gate can miss valid descriptions and cannot independently establish upstream description accuracy. It is composable beyond seven broad formats, but not open-ended audiovisual recognition. Source records, dates, metrics and original format fields remain unchanged.

The browser repeats grounding, exposes all bounded component excerpts, cancels stale query/source/view results, and caches only in memory for the same query. Entry and typing remain read-only; explicit errors never substitute fictional patterns or automatically retry paid calls. Server credentials stay local. Dates printed inside a described clip are not treated as posting dates. Actual browser results and prior semantic failures are recorded in [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md).

## Hosted D1 corpus

The Worker binds `env.DB` through `openWorkerCorpus(DB)` from `lib/corpus-worker.js`. The source hosting manifest uses `d1: "DB"`. Deployment must apply the supplied `drizzle/0000_corpus.sql` and its genuine Drizzle metadata before requests use the database. Sites packaging carries this directory to `dist/.openai/drizzle/`. The adapter never creates or alters tables inside an API request.

The base table, indexes, constraint, snapshot, and journal were generated with a temporary `drizzle-kit` development tool. Clearly marked custom SQL was appended to that first migration for FTS5 synchronization and an atomic guard against promoting existing example/synthetic IDs into the real class. No Drizzle runtime dependency was added. The actual Drizzle migration reader parsed all twelve statements and applied them successfully to SQLite during verification.

D1 provides [FTS5](https://developers.cloudflare.com/d1/sql-api/sql-statements/) and [transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/). Hosted writes validate the entire input before one batch and accept at most **40 records** at a time, within the [free plan's per-invocation query limit](https://developers.cloudflare.com/d1/platform/limits/). They return `{processed, changed}` without scanning global corpus counts; request statistics explicitly after the final acquisition batch. Larger acquisitions need explicit batches; no automatic retry or hidden partial splitting is performed. Source normalization, availability flags, profile evidence, creator filters, and category counts match the local corpus contract.

An operator can submit acquired records to `POST /api/corpus/import`. Set `OPENREEL_API_TOKEN` on the server and send the matching bearer token even for local operator ingestion. The JSON body needs a `records` array of 1–40 real-source records plus a nonempty `source` label; the normal 2 MiB body limit applies. Imported claims remain labeled `user-supplied` rather than provider-observed. The following assumes `import-batch.json` already contains that object:

```sh
curl --fail-with-body "$OPENREEL_URL/api/corpus/import" \
  -H "Authorization: Bearer $OPENREEL_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @import-batch.json
```

The existing corpus CLI below operates on local SQLite. Public creator/oEmbed/Apify acquisition routes can add their actually observed records through the configured corpus handle when their provider request succeeds.

Verification first used real SQLite behind an asynchronous D1 binding shim, including real profile acquisition, atomic rollback, full-text updates and parity checks against the Node corpus. An actual hosted migration and persistent cloud seed were then verified on release `b27849e`. At **2026-10-17T21:30:57.284Z**, D1 held **4,424 real records and 2,755 distinct creators**, with zero example, synthetic or unverified rows: 4,162 archival records plus 262 fresh public-profile/video records.

The cloud returned one NYU and two UCLA creators for queries combining school, at least 1,000 followers and email in bio. UCLA evidence includes alum/alumna self-descriptions, not verified current enrollment. A deterministic corpus chat returned real caption sources. All seed rows were imported as `user-supplied`, so hosted `providerObservedReal` was zero despite the source of the fresh observations. Direct cloud creator collection returned HTTP 502 (`CREATOR_UNAVAILABLE`); local official creator requests worked. Persistent cloud search does not prove working hosted TikTok acquisition or configured AI. See [VERIFICATION.md](VERIFICATION.md).

## Commands

```sh
node scripts/corpus.js init --db data/corpus.sqlite
node scripts/corpus.js import records.json --kind real --source permitted-export --db data/corpus.sqlite
node scripts/corpus.js search "Find NYU creators with at least 1500 followers" --db data/corpus.sqlite
node scripts/corpus.js stats --db data/corpus.sqlite
```

An import file is a JSON array or `{ "records": [...], "kind": "...", "source": "..." }`. It uses the [record schema](DATA.md). The command-line `--kind` and `--source` override manifest values. A malformed row rolls back the whole import, including any earlier updates and FTS changes. Identical records upsert without duplicates or timestamp churn.

Canonical TikTok video URLs and strict official player URLs without an explicit ID derive the same `tiktok-<video-id>` identifier used by the social adapters. Other source-only records derive a stable source hash; records without a source derive a content hash including creator identity. Supply explicit IDs when source-less records must retain identity across content edits.

Search defaults to real records. Use `--kind example`, `synthetic`, `unverified`, or `all` deliberately when inspecting other classes. Options include `--limit` (1–1,000), `--offset`, `--school`, `--location`, `--min-followers`, `--max-followers`, and `--email-only`. The shared research query planner extracts natural-language bounds and constraints; remaining terms are quoted literal FTS tokens. SQL parameters are bound. Explicit filters and parsed filters apply together. Creator queries deduplicate by actual numeric creator ID when supplied, otherwise by handle, before applying the requested count.

## Real data, examples, and provenance

Counts remain separate:

- **real:** explicitly imported or acquired source records. Each requires `sourceType`, a valid `fetchedAt` provenance timestamp, and either a canonical TikTok video URL matching its handle or a strict official player URL with numeric creator identity and matching post ID.
- **example:** fictional fixtures, marked `demo: true`.
- **synthetic:** generated capacity/test records, also marked as examples for browser rendering.
- **unverified:** ordinary imports lacking an explicit real classification; this is the default for unmarked non-example imports.

An existing example/synthetic ID cannot be promoted into the real class. `stats().total` is all stored rows; `stats().byKind.real` is the real-class count. `providerObservedReal` is a separate count of real rows written by trusted acquisition with provider-observed provenance. `uniqueCreators` and `knownViewRecords` describe the complete database, across classes.

**Classification is not an independent truth audit.** A `--kind real` JSON import validates source/provenance structure but cannot establish that its asserted caption or statistics are true; its verification label is `user-supplied`. The acquisition helper marks successfully observed provider responses `provider-observed`. Trusted local module callers control that label. Provider observations can still be stale, incomplete, or inaccurate. No file format or database label proves target-scale parity.

Missing/null/blank numeric measurements and explicit `unavailableMetrics` flags remain unknown. SQLite stores unknown metric columns as `NULL`; normalized result payloads retain availability flags. Unknown followers cannot pass follower bounds; genuine measured zeroes remain known. Profile evidence, including public self-description citations, survives normalization and storage. Search never infers a university merely from a caption mention when a school constraint is present.

Numeric-only records retain `handle: ""` and the actual `creatorId`; an unknown username is never replaced by `@<id>`. A player source must use exactly `https://www.tiktok.com/player/v1/<postid>`, without credentials, a query or fragment, and its record ID must equal `tiktok-<postid>`. The existing database handle column stores an internal identity key for grouping, while returned JSON retains the actual handle. Handle filters inspect that actual field. Named and unnamed rows sharing a numeric creator ID count as one creator. The internal boolean `knownHandlesOnly` search option checks the genuine JSON handle before creator deduplication, limits and offsets; indexed Live refresh uses it to avoid selecting unknown usernames.

`visualDescription` requires a declared `descriptionSource`. Its text and the actual handle are projected into the existing transcript **index column only**; `record_json.transcript` remains the original transcript. Returned descriptions therefore remain distinguishable from spoken words. These changes in `f0506b5` require no schema migration, and their focused local/D1-shim tests passed; they do not establish a hosted target-scale import.

Data rights remain separate from the application license. An [optional research archive](RESEARCH_DATA.md) can retain a noncommercial license while the original application code remains MIT. Keep source attribution, license terms, observation dates and upstream-model labels with that corpus; source-code licensing does not relicense its records or embedded media.

## Collect public creator profiles

Create `handles.txt` containing one known public handle per line, or a JSON array of handles, then run:

```sh
node scripts/corpus.js collect-profiles handles.txt --db data/corpus.sqlite
```

The collector validates the whole list, normalizes/deduplicates handles, and calls `discoverCreator(handle, env)` sequentially **once per unique handle**. It uses the official public creator-embed adapter without a paid provider token. There are no automatic retries. Private/deleted/unavailable profiles remain empty or produce a safe failure record in the command summary; failures do not generate video records. Each successful profile import is atomic.

The adapter returns a bounded public profile snapshot and currently exposed video records, not a complete history or automatic discovery of every creator. It preserves public source identity, profile evidence, retrieval time, known views/followers, and unknown analytics. It does not download videos or create missing transcripts/visual descriptions. Obtain and retain the rights/provenance needed for any larger acquisition.

An earlier implementation check used one actual request for `@scout2015` to populate a local database with **10 real records from one creator** and `providerObservedReal: 10`. That historical local check is separate from the hosted 4,424-record seed above. Databases are ignored by Git; a source checkout does not itself contain the hosted corpus or optional research archive.

## Optional web-assisted acquisition

With `OPENREEL_WEB_DISCOVERY=true` and a compatible server OpenAI key/model, Live search proposes at most three candidate handles using web-search context and independently checks their official public embeds alongside up to three indexed profiles. Only matching official records are persisted as real/provider-observed. Search pages are global proposal context; they are not independently verified page-to-handle associations. Unknown dates, transcripts and analytics stay unknown. See [the demo evidence](DEMO_VERIFICATION.md).

The first actual browser acquisition raised the local store to 154,428 records, 4,624 creator identities and 266 provider-observed records. This four-record/three-identity increase is distinct from later refreshes, which update observation timestamps without increasing coverage. The hosted store was not changed.

## Optional dated public-post imports

Set `OPENREEL_POST_METADATA=true` in server configuration to make the existing `POST /api/videos/import` and browser **Import URL** action inspect one ordinary canonical public post page instead of oEmbed. The default remains oEmbed. The request is fixed to the validated official HTTPS host/path, rejects redirects, has a 10-second deadline and 1 MiB HTML bound, and never retries or falls back automatically. No scripts execute, raw provider HTML reaches the client, or source video/subtitle URLs are fetched.

The parser reads exactly one `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON script and requires statusCode0, the exact requested post ID, a valid public author identity and explicit public visibility. Private/friends-only/prohibited/taken-down/error/shell data rejects. The returned verified author may correct a stale pasted handle; the post ID must still match. This hydration shape is an observed undocumented metadata surface and may change.

`createTime` Unix seconds supply a UTC `postedAt` only when valid and within the supported past-to-observation range (including a five-minute clock-skew allowance). Captions, video IDs and retrieval time never supply posting dates. Actual numeric counts retain genuine zeros; missing/negative/noninteger counts remain unavailable. Public author bio school/location fields use the existing conservative self-description rules. Nothing establishes current enrollment, residence, full post history or current emergence. New records retain `sourceType: tiktok-public-post`, their exact canonical source, retrieval timestamp and profile evidence. They use the ordinary corpus import path, which updates an existing same-ID record rather than adding a duplicate. This is a fresh whole-record snapshot, not the archival-preserving player-delta merge below.

The actual local browser imported `7648984799574510861` with posting time `2026-06-08T11:28:30.000Z`, 1.1M views and available likes/comments/shares. An independent native read verified the persisted date/counts/source identity against the actual response. Corpus counts remained 154,428 real records / 4,624 identities / 266 provider-observed records. The cover/avatar loaded and browser reload preserved the library card and posting age; 390px mobile had no overflow. See [DEMO_VERIFICATION.md](DEMO_VERIFICATION.md).

### Incremental primary-date coverage (1.11.0)

The opted-in reader prefers confirmed posts without a previously persisted real/provider-observed primary date. It reads up to120 candidates in at most three forty-ID bulk queries, then keeps the existing six-page, three-concurrent, twenty-second acquisition budget. Custom adapters without bulk reads preserve the original selection rather than adding per-candidate lookups. Exact source, identity and date evidence are required for known-date priority; archival and user-supplied dates do not qualify. A failed coverage read makes no post request. Disabled or profile-skipped phases do not query coverage.

Live acquisition retains all successfully inspected public post records in its internal result. The API indexes their deduplicated union with final matching rows (at most 30+6=36), then returns only filtered/count-limited matches. The internal record array is not serialized. Structured indexing counts distinguish inspected observations from displayed matches; updates are not labeled new unique videos. Acquisition may therefore index inspected posts outside the final creator-deduplicated result. No extra page or AI call is added.

Actual collection added four primary dates to existing records. Two real known-profile creator searches added six then four dated posts, while each displayed one creator and indexed five additional inspected observations. Primary dated records grew from ten to twenty-four; the two known-profile searches added nine unique records while dating ten posts. The earlier partial web-assisted run added one undated record. Overall the normal corpus gained ten unique real records, reaching 154,462 /4,627 identities /300 provider-observed. A separate default web-assisted run retained its one failed-profile notice and skipped metadata. The final default browser returned actual AI synthesis for four verified profiles; this does not prove unrestricted discovery. See [the measured browser report](DEMO_VERIFICATION.md#incremental-dated-acquisition-and-verified-synthesis-1110).

### Live and known-creator metadata (1.10.0)

The same opt-in now applies to Live search and **Collect creator**. Up to120 confirmed real embed records are candidates; round-robin creator coverage selects at most six posts, using numeric post-ID descending order only as a selection heuristic. The IDs never supply posting dates. Canonical GETs run in batches of three with one 20-second phase deadline and the existing per-GET 10-second / 1 MiB limits. A non404 failure stops later batches; no post requests follow a failed profile batch. Confirmed embed records remain available with explicit partial coverage. No extra AI call or automatic retry is added. Configured Apify retains its own provider/date path.

Every inspected post must match the expected video and numeric creator identity, or the same known handle where an embed omitted the numeric ID. Successfully inspected records precede uninspected records, then all topic, school, contact, follower and requested-count filters run again. Video/format research across creators retains multiple clips per creator; creator lookup still returns unique identities. Temporal comparison wording is removed only from acquisition topic matching: the full question and actual dates reach the existing adjacent-window comparison.

The latest fetched public-post profile observation within the request supplies one attributed profile snapshot across that creator's returned records. This is observation order, not independent proof of provider cache freshness. Uninspected video fields/dates remain separate; their `tiktok-public-profile-and-post` source label and exact `profileEvidence.url` identify the mixed source. Canonical URLs stay consistent after observed handle changes. Unknown new followers cannot satisfy a bound. Public bio labels still do not establish independently verified affiliation.

A real repeat exposed known dates disappearing after a date-less refresh. API acquisition and browser merges now retain only a valid primary posting date with structured `postingEvidence`; fresh analytics, bio and follower values are not borrowed from the old record. The API reuses only prior real/provider-observed primary-date evidence. JSON import evidence remains a supplied citation and does not confer that verification label. One bulk read of at most 30 incoming IDs preserves dates before persistence; native/D1 `getMany` supports up to 40 IDs with one parameterized SELECT, keeping a 30-row write within the hosted query allowance. Explicit generic whole-record imports/CLI writes remain replacement operations.

The actual browser collected ten coffee records with six dated sources in 1.856 seconds, with 20 loaded cover/avatar images. Current-week Live research took 8.620 seconds and returned 15 matching records, including four dated posts and three current-week creator identities. A compound NYU/follower/public-email request took 8.576 seconds and returned a dated October 14 post from @lizzie.crane. Six original coffee dates remained present or were freshly re-observed after later acquisitions; native persistence checks matched the actual latest responses. The store grew from 154,430/ 4,626/ 268 to 154,452 real records/ 4,627 identities/ 290 provider-observed records, with zero example/synthetic/unverified rows. [The demo report](DEMO_VERIFICATION.md) keeps the failed earlier date-continuity run and insufficient trend-growth evidence separate.

## Optional public-player metadata collection

The local collector can resolve imagery and a current handle for explicitly supplied known post IDs when TikTok exposes them in its ordinary public player. It does not search for posts. Put **1–5 unique numeric post ID strings** in a JSON array; use strings to preserve large IDs exactly. An explicit `--limit` permits up to 40 IDs in one sequential batch. Missing or unavailable sources remain unresolved.

Playwright and a browser are optional **local operator tools**, separate from the application and its dependency-free runtime. Install Playwright manually into a separate tools directory if needed, for example `npm install --prefix /absolute/path/browser-tools playwright`, and supply its absolute module path plus an already installed browser executable. The collector never installs packages or downloads a browser automatically.

```sh
node scripts/collect-player-metadata.js \
  --ids /absolute/path/post-ids.json \
  --out /absolute/path/player-observations \
  --playwright-module /absolute/path/browser-tools/node_modules/playwright \
  --browser-path /absolute/path/browser-executable
```

Use a new output directory for each run, outside the source release. The command requires both paths explicitly and makes one ordinary [official public-player navigation](https://developers.tiktok.com/docs/en/embed-player) per selected ID, with `autoplay=0`. It does not request playback, save media files, call private APIs manually, or retry. It blocks Service Workers, cancels downloads and aborts recognized media requests; normal player networking still occurs, so these checks do not establish zero media network bytes. A detected HTTP 401/403/429, login/CAPTCHA, navigation failure or total batch deadline stops collection and retains the partial report. A player that renders unavailable produces an observation without an invented handle or cover.

Defaults are a 15-second navigation timeout, up to 10 seconds waiting for metadata and a 120-second batch budget. `--navigation-timeout-ms` permits 1,000–30,000, `--settle-timeout-ms` permits 0–20,000, and `--batch-timeout-ms` permits 1,000–600,000. A separate watchdog covers stalled browser calls, saves the active attempt and allows at most 500 ms for browser cleanup before exiting the collector. `--limit` defaults to 5 and has a hard maximum of 40; an oversized input is rejected before any navigation. A stopped run exits nonzero. `navigationCount` counts explicit player navigations, rather than all underlying HTTP requests.

The output directory contains `observations.json`, `deltas.json` and `summary.json`. Deltas contain only `handle`, canonical `url`, `authorUrl`, optional `thumbnail`, and optional `avatar`, each with its own raw `metadataEvidence`. Identity requires a video link with the exact requested post ID and a matching author link. Avatar evidence requires an image nested in that author's link. Images retain the observed `src`, selected `currentSrc`, `srcset`, dimensions and selector; `loadedSourceVerified` distinguishes a selected loaded URL from a legacy `src` observation. This evidence supplies no bio, school, location, metrics, transcript or posting-date claim. The DOM is an observed implementation detail, not a documented metadata API; signed image URLs can expire and are not permanent stored assets.

Review the deltas, then apply them separately to an **explicit existing local database**:

```sh
node scripts/corpus.js apply-player-metadata \
  /absolute/path/player-observations/deltas.json \
  --db /absolute/path/existing-corpus.sqlite
```

The apply command performs no fetching. It accepts a raw delta array or `{ "deltas": [...] }`, requires 1–40 deltas and `--db`, and validates the complete input before opening the database. It calls the transactional `Corpus.applyPlayerMetadata` merge; do not use ordinary `import` for a delta, because import replaces full records. Missing, conflicting or non-real record IDs reject the whole batch.

The merge preserves numeric creator IDs, captions, transcripts, separately labeled descriptions, posting dates, metrics and missing flags, archive/profile provenance, original ingestion source/time, corpus classification and verification. Only the observed fields and compact `metadataEvidence` change. Its field list identifies the covered metadata; it does not promote the whole archival record to `provider-observed`. Original dataset and underlying-content rights remain attached, including CC-BY-NC restrictions where applicable. A recent handle/cover observation does not establish current trend activity or newly analyzed archival text. Keep acquired reports and creator content outside source control; none are bundled with this collector.

## Optional public source-frame descriptions

This local acquisition command requires an already installed Playwright module and Chromium executable, plus your own configured vision API key/model. The app still has no runtime package dependencies. Nothing installs automatically or copies a local key to hosting.

```sh
node --env-file=.env scripts/collect-player-visuals.js --urls source-urls.json --out data/source-visuals --playwright-module /absolute/path/to/playwright --browser-path /absolute/path/to/chromium --save-samples
node scripts/corpus.js apply-video-evidence data/source-visuals/deltas.json --db data/corpus.sqlite
```

`source-urls.json` contains 1–3 unique canonical `https://www.tiktok.com/@handle/video/ID` URLs by default; `--limit` allows at most eight. These must already have real rows in the target database before applying. The collector makes one normal bounded public metadata read and one fresh ordinary official-player navigation per source, then captures up to eight JPEGs through the permitted in-page video canvas. Identity, duration, geometry, decoded playhead and access checks must pass. It never fetches a raw media URL itself, imports a browser profile, changes authentication, interacts with access challenges, retries a failed source or saves video footage. Internal player fallback requests/errors remain in the report and do not count as a collector retry.

Each capture has a 45-second deadline and a 50 MiB CDP-observed data budget; that is observed response data rather than a guarantee about all wire traffic. Cleanup has a separate 500 ms bound; a stalled cleanup stops the collector process after preserving the report. The default batch deadline is 240 seconds, adjustable up to 600 seconds. A source failure ends the batch. The configured vision provider receives only validated timestamped JPEGs, once per successfully captured source, under the shared batch deadline and provider timeout. No speech/audio is acquired. Opening/later fixed samples differ from the adaptive local-upload scan and can miss short events.

The command writes `observations.json`, `deltas.json` and `summary.json` without touching the database. `--save-samples` also writes JPEGs for review; it is off by default. Review every description against its samples before applying. Actual tests caught two object/state errors that required explicit factual corrections; schema validation cannot establish visual accuracy. Keep reports, media and acquired data outside published source.

`apply-video-evidence` requires an existing explicit database, at most eight unique deltas and a bounded input file. It atomically changes only `visualDescription`, `descriptionSource`, `visualEvidence` and the FTS projection on existing real rows. Other JSON/SQL fields, ingestion timestamps, classification, verification, licensing and counts stay intact. Whole-record imports retain replacement behavior. Source receipts hold canonical identity, creator ID, UTC capture time, duration and chronological JPEG hashes; no raw frames enter records. Receipts declare capture provenance and do not promote user-supplied records to independently verified acquisition. Normal acquisition retains earlier visual evidence only from persisted real/provider-observed rows, while explicit browser-library receipts retain their declared source.

The app labels this origin **Sampled-frame AI description** and displays capture date, cited sample times and source link in record details. Chat receives the same limited scope. Pattern grouping reads descriptions; a captured description does not turn that grouping into direct footage/audio analysis or prove an emerging format.

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

Exports are `Corpus`, `openCorpus(path = DEFAULT_CORPUS_PATH, {readOnly = false})`, `DEFAULT_CORPUS_PATH`, and `collectCreatorHandles(corpus, handles, {env, discoverCreator})`. Handle methods are `upsert(iterable, {kind, source, verification})`, local-only `applyPlayerMetadata(deltas)`, `search(query, options)`, `get(id)`, `stats()`, and `close()`.

Search/get return normalized records with `corpusKind`, `corpusVerification`, `corpusSource`, and `corpusImportedAt`. `upsert` returns `{processed, changed, total}`. Search supports the CLI filters plus `niche`, `format`, `handle`, `emailInBio`, `uniqueCreators` and boolean `knownHandlesOnly`. The acquisition helper returns request/import/change counts and safe per-handle failures.

Focused tests in `test/corpus.test.js` and `test/corpus-worker.test.js` exercise disk persistence, atomic rollback, FTS updates, classification boundaries, unknowns, numeric identities, player-source validation, visual-description separation, follower/profile filters, literal query safety, imports beyond the browser cap, actual CLI behavior, collection deduplication/no retries and creator-count ordering. Run those files together, followed by the full `npm test` command before release.

The incremental, genuinely generated `drizzle/0001_corpus_statistics.sql` adds `corpus_statistics` and `corpus_school_followers` without changing the applied initial migration. On the 154,424-record local store, the covering statistics index reduced a large-text table scan to an observed **576 ms** statistics call. The compound school/follower query had chosen the broad follower index and took about **20.9 seconds**; `ANALYZE` did not change that plan. The composite school/kind/followers index selected the narrow range and the measured SQL query took about **4 ms**. Full API latency also includes statistics and response work; the later compound API checks took about 0.6 seconds.

Node creates these indexes on a writable open. The hosted corpus has applied migrations `0000`, `0001` and `0002` through the migration system. Worker requests do not create indexes. These are storage/query-specific observations, not a general latency guarantee.
