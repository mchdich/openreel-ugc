# Optional 150,000-video research corpus

OpenReel can use a separately acquired, attributed **CC-BY-NC-4.0** TikTok research corpus. Its data is not relicensed by the application's MIT code license and is not bundled into the source repository or public app build. Commercial reusability is not required to demonstrate the requested indexed-research capability; the optional dataset still retains its noncommercial use terms.

The primary source is [TikTok Creator and Video Engagement (200K), published by lingbow](https://huggingface.co/datasets/lingbow/tiktok-video-engagement-200k/tree/ef0da889e05dea58754bc0ce2d0e2ed6b697fdf2), pinned to revision `ef0da889e05dea58754bc0ce2d0e2ed6b697fdf2`. The publisher supplies 209,543 video rows, daily engagement, and creator statistics, with upstream speech-to-text transcripts and AI-generated descriptions. The card describes the derived fields as model-based measurements rather than ground truth. It supplies no usernames, bios, school/location evidence, or contact addresses.

Attribute the dataset and its cited work: Wensi Zhang, Ying Xie, and Lingbo Wang, *When Does Trend-Following Pay Off? Evidence from Trending Content and Hashtag Use* (2026), [SSRN 7371418](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7371418). Retain the complete publisher card, source/revision, changes notice, and [CC-BY-NC-4.0 license link](https://creativecommons.org/licenses/by-nc/4.0/). The license permits noncommercial reuse subject to attribution and its other terms; it provides no warranty of underlying rights. See its [legal code](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en).

## Acquire or reuse metadata

Use Python 3.11+ with the optional data tooling and Node 24+. The app itself does not require Python. No TikTok API account, paid provider, video download, or audio download is needed.

```sh
python3 -m venv work/data-tools
work/data-tools/bin/python -m pip install -r scripts/requirements-data.txt
work/data-tools/bin/python scripts/acquire-research.py --source-dir work/research-source --output work/research-export --download --limit 150000
node scripts/import-research.mjs --input work/research-export/records.jsonl --db data/research.sqlite
node scripts/corpus.js stats --db data/research.sqlite
node scripts/corpus.js search skincare --db data/research.sqlite --limit 3
```

The downloader fetches only three pinned metadata Parquets, totaling **135,533,144 bytes**, plus the publisher card (under 64 KiB). Each Parquet's complete size and SHA-256 must match the pinned primary source. Existing files are verified and reused; mismatched files are rejected instead of being silently replaced or redownloaded. The default 150,000 limit counts distinct eligible actual video IDs, not duplicate rows. The maximum supported selection is the source's 209,543 rows.

For metadata already acquired, omit `--download`. Supply its actual original retrieval time and the pinned publisher card:

```sh
work/data-tools/bin/python scripts/acquire-research.py --source-dir work/research-source --attribution-dir work/research-attribution --output work/research-export --retrieved-at 2026-10-17T21:06:24.583045Z --limit 150000
```

The timestamp above is the measured metadata retrieval completion time for the verified example run; replace it with your actual acquisition timestamp. The tool will not invent a retrieval date for cached input. Place the card at `work/research-source/publisher-README.md`, or use `--attribution-dir` containing `publisher-README.md`. The original acquisition's `lingbow--tiktok-video-engagement-200k-README.md` filename is also accepted. Its pinned SHA-256 is verified.

Outputs must go into a new directory. The tool never overwrites a populated export or application database. A failed `.partial.jsonl` is not a complete export and must not be imported. Keep the original Parquets together with:

- `records.jsonl`: deterministic UTF-8 records, one actual video per LF-delimited JSON object.
- `sample.json`: the first 20 actual exported records in the existing corpus CLI's JSON shape, for inspection and a small integration check.
- `manifest.json`: raw source files/hashes, original retrieval and publication dates, per-phase timing, counts, observation-date ranges, selection/change notices, output SHA-256, and current-run network bytes.
- `publisher-README.md` and `ATTRIBUTION.txt`: the original pinned card and explicit attribution, license, and changes notice.

The same source bytes, selection limit, and retrieval timestamp produce identical `records.jsonl` bytes. Measured execution times in the manifest can differ between runs. The raw sources preserve original fields that the normalized import does not index.

## Import safely without loading the corpus into browser memory

`import-research.mjs` requires both `--input` and an explicit separate `--db`; it has no implicit default database. Its default source label includes the dataset revision and CC-BY-NC-4.0. An optional `--source` overrides the label while per-record license/revision provenance remains intact.

The importer streams strict UTF-8 chunks into `corpus.upsert(iterable)`. It splits only on LF, preserves escaped newlines and U+2028 inside text, rejects malformed JSON/UTF-8 and oversized lines, and closes the file on error. The SQLite import is atomic: a bad later row rolls back earlier changes from the same run. Existing records use their stable `tiktok-<actualVideoId>` identities; repeated identical imports are idempotent. This script does not replace your default corpus unless you explicitly choose that database path.

To use the completed corpus in a local Node server, configure its explicit path:

```sh
OPENREEL_CORPUS_PATH=data/research.sqlite npm start
```

Select the server corpus in the research composer. Never put the dataset, its Parquets, the JSONL export, or its database inside public assets or the MIT source release. Publicly serving data or its adaptations must still comply with the dataset's license and attribution terms.

## Identity, descriptions, and dates

Each record has `handle:''`, the actual numeric `creatorId` as a string, and an official numeric-ID player URL. A missing username is not replaced with a numeric handle, `_`, or a guessed identity. The UI can display `Creator <id>` and group videos by actual creator ID, without inventing a profile URL. School, location, bio, email, format, and inferred niche stay empty.

`visualDescription` contains the original `gpt_summary`; `descriptionSource:'upstream-model'` labels it explicitly. `transcript` contains the upstream ASR text when present; an empty transcript remains empty. These are searchable archival content evidence, not a claim that OpenReel freshly watched or heard the original footage. Missing/invalid metrics remain unknown; explicit observed zero counts remain zero.

`fetchedAt` is the actual metadata retrieval time. The archive's publication date (`2026-09-05T22:23:34.000Z`), original posting timestamp, latest known engagement observation date, and latest known creator observation date are separate. The publisher's raw posting timestamps are timezone-naive; their timezone remains unknown instead of gaining an invented UTC suffix. Latest snapshot selection uses the greatest upstream observation date; the first row wins an exact-date tie. Thus follower and view counts may have different historical observation dates and are never labeled as today's counts.

`archiveProvenance` preserves dataset, revision, data license, pinned source URL, archive publication date, actual video and creator IDs, source row ordinal, original posting timestamp/timezone, per-video engagement date, per-creator statistics date, and upstream-ASR availability. Keep that provenance in database records and exports.

## Official citation and playback

TikTok documents `https://www.tiktok.com/player/v1/<numeric_post_id>` as an [official embedded-player route](https://developers.tiktok.com/docs/en/embed-player). It does not require a username. Use that URL as the source citation/player until a current canonical username is actually observed.

A real browser check on October 17, 2026 loaded archive IDs `7387143945744141599` and `7385547361449250091`. Both official players emitted `onStateChange:1`, advanced `onCurrentTime` beyond one second, and exposed playing video elements with `readyState:4` and no media error. The player also displayed actual usernames and canonical links for those samples. No media files or recordings were saved, and this observation is not bulk username enrichment. Sample `7386071738137709854` instead emitted `INVALID_VIDEO` (1001): archival identity does not guarantee a post remains public or playable today. A player HTML HTTP 200 alone is not playback evidence.

## What the verified corpus establishes

The isolated 150,000-video proof contains 150,000 distinct actual TikTok IDs from 1,866 numeric creator IDs, 136,031 captions, 60,322 upstream transcripts, and 150,000 upstream model descriptions. Its full-text queries include real source IDs, archival observation dates, and evidence excerpts. It establishes a substantial actual text/description research corpus; it does not establish complete transcript coverage, current social discovery, current emerging trends, or school/contact/profile evidence absent from the source.

The verified portable export is 364,933,545 bytes (SHA-256 `366852df00dbce52306991a5d04bc7c69bf0a85d38b4501770efc0a848f39d64`), with zero network bytes during cached preparation. Snapshot selection took 23.317 seconds and JSONL export 11.35 seconds. The actual product SQLite import subsequently processed all 150,000 records in 39.920 seconds; real skincare, unboxing, and tutorial searches returned source records. These are measured host-specific results. Inspect your generated manifest and database stats rather than inferring counts from the dataset title. This establishes an optional actual research corpus without requiring commercial reusability.

## Tests

```sh
python3 -m unittest discover -s test -p 'test_acquire_research.py' -v
node --test test/import-research.test.js
```

These unit tests use explicitly synthetic fixtures, not redistributed NC records. They cover actual numeric identity mapping, unknown metrics, separate historical dates, deterministic deduplication/export, pinned hash rejection, UTF-8/newline/U+2028 streaming, mandatory database paths, and atomic rollback. The optional PyArrow dependency is imported only when processing the actual metadata.
