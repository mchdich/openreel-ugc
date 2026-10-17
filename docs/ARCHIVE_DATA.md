# Reproducing the optional archival metadata subset

OpenReel's source code is MIT licensed. That license does not automatically license datasets, TikTok posts, profiles, or other underlying content. No dataset is bundled by this acquisition script.

The primary publisher [EinzzCookie/TikTrack's dataset card](https://huggingface.co/datasets/EinzzCookie/tiktok-videos-users-info/blob/68899264e287bef0fffe389e683fdb1043b2a03f/README.md) declares MIT for its archive and requires users to comply with TikTok terms, privacy law, and underlying rights. We preserve that declaration and attribution; we have not independently cleared underlying content rights. This is an optional archival import, not a promise of commercially cleared data or fresh platform observations.

## What was actually verified

At revision `68899264e287bef0fffe389e683fdb1043b2a03f`, the 3,868,804,371-byte Parquet file contains 950,656 rows, with extensive repetition. Scanning selected columns produced **4,162 distinct eligible captioned videos**, mapped to **2,731 actual creator IDs/usernames**. An independent ID-only census found 6,258 distinct posts of all types and 4,201 distinct posts labeled video; requiring valid joined identities, duration, caption, and posting date yields the smaller importable subset. These counts do not establish a 150,000-video corpus.

The verified subset contains 4,162 captions, **zero transcripts**, and zero model summaries. Only 17 videos have known follower counts; 4,145 zero-filled profile-stat stubs are treated as unknown. The subset has 3,528 nonempty public bios and 716 emails extracted from those bios. These are archival public contact strings, not verified current addresses. Posting dates span June 9–September 6, 2026, UTC. No video, audio, cover, or avatar files were downloaded.

The actual selected-column extraction received **73,412,876 Parquet bytes across 162 HTTP Range responses**, in 54.485 seconds on the verification host. This includes the Parquet footer, not just exported text. Separate inspection and an independent census brought that investigation's Parquet traffic to 84,158,242 bytes. These are measured results of the original extraction, not guaranteed transfer size or performance for every PyArrow version. The portable script reuses its pinned source, columns, selection, and mappings; it is also tested against a local HTTP Parquet fixture and all 4,162 previously acquired real records without repeating that download.

## Acquire and import

Use Python 3.11+ and Node 24+. Python/PyArrow is optional tooling; the running app does not need it. Install the dependency in a project-local environment:

```sh
python3 -m venv work/data-tools
work/data-tools/bin/python -m pip install -r scripts/requirements-data.txt
work/data-tools/bin/python scripts/acquire-archive.py --output work/archive-68899264
node scripts/corpus.js import work/archive-68899264/records.json --kind real --source 'EinzzCookie archive 68899264; publisher-declared MIT' --db data/archive.sqlite
node scripts/corpus.js stats --db data/archive.sqlite
node scripts/corpus.js search cooking --db data/archive.sqlite --limit 3
```

The destination must be new; an existing directory is never overwritten. The script uses the pinned revision URL, HTTP `Range`, identity encoding, selected nested Parquet columns, and a default **128 MiB Parquet transfer budget**. It refuses a `200` full-file response before reading its body, mismatched `Content-Range`, truncated ranges, and budget exhaustion. There is no full-download fallback, authentication, paid service, or direct TikTok scraping. The small publisher card is downloaded separately, capped at 64 KiB. On error, `.partial.json` is incomplete and must not be imported; use a fresh output directory for a deliberate retry.

The output directory contains:

- `records.json`: Node corpus CLI input, with a `records` array, per-record `archiveProvenance`, and dataset provenance.
- `manifest.json`: selected columns, actual byte/request counts, per-range hashes, output hash, revision, attribution, timing, counts, and rights caveat.
- `publisher-README.md`: the complete pinned publisher card, including its license declaration, source, citation, and limitations.

Retain all three together. The publisher's advertised whole-file SHA-256 is recorded but **not verified**, because the whole file is never fetched. Each fetched range and the export have their own measured hashes.

## Mapping and evidence limits

Selection is deterministic: the first eligible occurrence of each actual video ID in pinned row order wins. Real `author.uid` must agree with `author_user_id` when present. The actual `author.unique_id` supplies the username, canonical video URL, and profile URL. Missing or invalid identities are rejected; no handles or contacts are invented. `creatorId`, original username, source row/group, duration, region/language fields, revision, and license attribution survive in `archiveProvenance` in the export.

The Node CLI normalizes records into its existing schema and classifies this import as **user-supplied real archival data**, not provider-observed live results. Its normalized database does not retain every extra `archiveProvenance` field; preserve the export and manifest to retain original numeric creator IDs and the complete audit trail. The explicit separate `data/archive.sqlite` avoids replacing your default corpus.

Only explicit engagement integers within JavaScript's safe integer range are mapped. Missing, invalid, or zero-filled profile statistics remain unknown. A genuine zero follower count is retained only when other profile statistics show the object is not a wholly empty stub. Unknown followers cannot satisfy a strict follower bound. School/location, transcript, visual summary, hook, and inferred niche remain empty.

Upstream publication time is `2026-09-07T14:42:23.000Z`. For compatibility with the existing import contract, `fetchedAt` carries that archive publication timestamp. **It is not a known TikTok metric/profile observation time.** Per-record `platformObservationAt`, `metricObservationAt`, and `profileObservationAt` are explicitly null. Original posting time is separate; archival counts must not be presented as today's counts.

## Tests and remaining corpus goal

```sh
python3 -m unittest discover -s test -p 'test_acquire_archive.py' -v
```

Mapping, identity joins, deduplication, unknown metrics, text limits, and HTTP refusal/budget tests need only the Python standard library. The real Parquet-over-local-HTTP integration test additionally runs when the optional PyArrow dependency is installed. It uses synthetic fixtures explicitly labeled in the test; they are never exported as real research evidence.

The goal of at least 150,000 distinct legitimate TikTok videos with transcripts and usable creator profiles remains open. An isolated 150,000-video capacity proof using [lingbow's primary archive](https://huggingface.co/datasets/lingbow/tiktok-video-engagement-200k) is **CC-BY-NC-4.0 research data**, contains 60,322 upstream transcripts and no upstream usernames, and stays outside this product and its default corpus. The repository code license does not relicense that data. It is not a commercially usable replacement for the missing corpus.
