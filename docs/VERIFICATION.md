# Verification record

Updated October 17, 2026 for the [full-parity continuation](superpowers/specs/2026-10-17-parity-continuation.md). **Full 1:1 parity has not been established.** This record separates real observations, controlled tests and required missing evidence. It does not freeze a final test count while integration is changing.

## Automated checks

```sh
npm test
npm run build
```

Use Node 24+. The current suite exercises deterministic research, combined creator/profile filters, unknown metrics, safe storage recovery, local media sampling, canonical WAV handling, multipart transcription, strict vision output/citation validation, fixed social endpoints, cost/timeout bounds, SQLite persistence/FTS/classification and HTTP/Worker behavior. Final release evidence must record the output and commit after all integration changes.

Controlled local HTTP providers validate transport, malformed responses, secrets, redirects, bounds and errors. They do not prove recognition or visual quality. Real local model runs below are separate evidence. The Worker build packages the client/API but does not itself publish a deployment or supply Node filesystem SQLite, model weights or configured providers. Actual D1 deployment evidence is recorded separately below.

Published release `b27849e` has [successful test/build CI](https://github.com/mchdich/openreel-ugc/actions/runs/39070597861). Focused numeric-identity, source-pattern, SQLite/D1 and known-handle Live regressions passed, including persistence, source validation, unknown metrics and transcript/description separation. The data-tool run passed 17 Python checks with one optional integration skipped. A final full Node-suite count for the newer integrated changes is still pending; earlier suite totals are not proof of the next release.

## Actual browser and model inference

The successful full browser run used installed Chrome 155.0.8059.82, native Node 24.19.0, official whisper.cpp CPU tiny.en and actual local Qwen2-VL-2B through llama.cpp. Both model providers ran on loopback; neither response was mocked/repaired. A new local SAPI speech recording was combined with changing blue-bottle canvas artwork into an 11.2444-second MP4.

Observed at 2026-10-17T21:04:25.564Z:

| Stage | Actual observation |
| --- | --- |
| Browser preparation | Actual attached MP4; preview displayed audio ready; eight chronological JPEG samples. |
| Speech request | Extracted 11.093-second audio, real multipart WAV upload, HTTP 200 from the actual speech recognizer. |
| Recognition | 27 reference words, 27 recognized words, zero normalized word edits. |
| Vision request | Eight actual frames plus machine-recognized text; HTTP 200 from the actual vision model; assistant response rendered. |
| Sample timestamps | 0.04, 0.65, 1.5, 3, 5.622, 6, 8.433, 11.204 seconds. |
| End-to-end Send latency | 39,171 ms. |
| Browser/result state | One assistant reply, no error message/page exception, `transcriptProvided:true`. |
| Persistence | No JPEG or WAV payload in localStorage. |

A separate direct production-adapter test transcribed an actual locally synthesized 11.095-second PCM WAV in 674 ms, again with zero edits across 27 words. Chrome also successfully extracted nonzero PCM16 mono 16 kHz WAVs from locally generated WebM VP8+Opus and MP4 H.264+AAC. Video-only WebM produced explicit unavailable audio and zero chunks. These are clean synthetic-speech/illustration cases; they do not establish broad real-world ASR or creative-critique quality.

`videoAnalysis.audioAvailable:false` is retained because vision receives recognized words, not raw acoustics. Speech recognition occurred separately. It does not establish music, vocal quality, word timing, continuous movement, unseen cuts or social-performance causes.

Earlier real model checks had meaningful failures: JSON-object output failed the required schema, duplicate timestamp citations were rejected, and one schema-valid image interpretation misidentified lettering color. These outcomes motivated the strict JSON Schema default and remain limits on quality claims. The successful later eight-frame/audio run does not erase them. [LOCAL_MODELS.md](LOCAL_MODELS.md) provides pinned setup rather than distributing raw provider responses or private test media.

A separate natural-UGC check sent two actual frames, at 1 and 12 seconds of a 26.633-second public clip, through the production vision adapter to the actual local 2B model. No audio or transcript was supplied. The original 45-second request timed out. With an explicit 90-second deadline, a later response passed production validation in about **4.77 seconds**, using **807 of 808 cached prompt tokens**. That is a warm-cache observation, not cold-start latency. The response included unsupported child/age, opening and hand-action claims and no useful editing experiment. Schema/citation validity therefore did not establish accurate natural-UGC critique; the timeout and semantic failures remain part of the record. The default deadline is still 45 seconds.

## Real social acquisition and corpus evidence

- Official oEmbed fetched real metadata for a known direct public TikTok video without credentials: author, caption, thumbnail, canonical source and missing-metric flags. A browser import displayed unavailable followers as `—` and opened/closed the canonical player. A created iframe verifies integration, not uninterrupted third-party playback.
- Official public creator embeds for two public handles returned actual bio/profile counts and selected video IDs. One newly discovered CeraVe URL successfully enriched through oEmbed. No login/CAPTCHA/access barrier was bypassed, and no source video was downloaded.
- An earlier sequential collection of one known public creator populated a local SQLite database with **10 provider-observed real records**. The database is not bundled. Later local public-profile snapshots contributed 262 real records to the hosted seed described below. API/CLI tests verify deduplication, no automatic retry, profile provenance and atomic imports.
- The separate Node 24/SQLite benchmark stored **150,000 synthetic rows and zero real**. Observed import was 123.177 seconds; a broad FTS query returning 20 records took 5.598 seconds. Hardware/filesystem/query shape affect those timings. See [CORPUS.md](CORPUS.md).
- A candidate with 950,656 repeated rows yielded 4,162 distinct eligible video IDs. Those archival records are imported in the hosted seed; repeated upstream rows do not increase the real-video count.
- The [optional noncommercial research archive](RESEARCH_DATA.md) supplies 150,000 distinct actual video IDs, actual numeric creator identities, 60,322 nonempty upstream transcripts and 150,000 upstream model summaries. Those records are now imported into the normal local product corpus and exercised through actual API/browser paths below. Unknown usernames remain empty. This is archival upstream evidence, not fresh OpenReel video analysis; MIT application code does not relicense it.
- Apify keyword discovery is tested at its HTTP/schema boundary, with requested cost/result/time limits. No paid end-to-end query or final billing outcome was verified.

## Verified full local product corpus

The normal Node application was configured with `OPENREEL_CORPUS_PATH=data/research-nc.sqlite`. The actual persisted store combines **150,000 NC research records + 4,162 publisher-declared MIT archive records + 262 fresh public-profile/video records**. At **2026-10-17T21:53:52.139Z**, the product proof reported **154,424 real records, 4,621 creator identities, 262 provider-observed records and zero example/synthetic/unverified rows**.

Actual Deep API requests returned HTTP 200 for skincare, cooking and unboxing research. Skincare matched all 1,000 retrieved records; cooking matched 938 and unboxing 968 of their 1,000-record subsets. These are bounded retrieval results, not quality scores or global counts. Compound school + at least 1,000 followers + email-in-bio queries returned one NYU and two UCLA creators, retaining public-bio evidence and alum/alumna qualifiers. The natural query “What skincare trends repeat across creators?” also returned cited pattern groups after the query-planner correction.

A native Windows browser used the full application corpus to display source `tiktok-7386507456479825195`, bookmark it and restore it after reload. Its `handle` remained empty, numeric creator identity and official player source were retained, and `sourceType` remained `lingbow-archival-dataset`. No page errors occurred. This verifies the ordinary product path, rather than a standalone research-index demonstration.

In a separate direct 1,000-record skincare subset, source-grounded grouping returned **six patterns and 152 unique cited records**: product demonstration, GRWM, unboxing, step-by-step tutorial, product review and before/after. Each group spans at least two actual creator identities. Evidence excerpts identify upstream-model descriptions; original transcripts and blank format fields remain unchanged. The known posting windows fall in **2024**, with unknown timezones explicitly counted. They do not demonstrate current emergence, platform growth or performance causation. An actual-source browser modal check also preserved exact excerpts and original fields.

Performance was measured separately from functional correctness. A covering index reduced the local full-store statistics call to **576 ms**. Compound school/follower SQL previously took about **20.9 seconds** and still chose the broad follower index after `ANALYZE`; the new `corpus_school_followers` index brought the measured SQL query to about **4 ms**. Later full compound API calls took about **0.6 seconds**, including statistics/response work. These measurements do not predict other storage or query workloads. The genuinely generated incremental `0001` migration contains these indexes, leaves applied `0000` unchanged and is **not yet deployed** in the recorded cloud release.

## Verified public deployment and hosted D1

The public [OpenReel app](https://openreel-ugc-mchdich.red-boar-0376.chatgpt.site/) was verified against published source commit [`b27849ea9ad1a94b9d01672a51de2c395d5758a3`](https://github.com/mchdich/openreel-ugc/commit/b27849ea9ad1a94b9d01672a51de2c395d5758a3), with the passing CI run linked above. The recorded Sites deployment is `appgdep_6ad3e6e33f288191a1a1733a1c4ed068`, version `e7e0ae2d91088191a9d5a4f19a81cb98`. This identifies the verified release; it does not identify a later checkout or prove its deployment.

An actual hosted D1 migration and persistent seed were exercised. Observed at **2026-10-17T21:30:57.284Z**:

| Check | Actual cloud result |
| --- | --- |
| Persistent corpus | 4,424 real records, 2,755 distinct creators; zero example, synthetic or unverified records. |
| Seed composition | 4,162 archival records plus 262 freshly collected public-profile/video records. All were operator-imported as `user-supplied`; `providerObservedReal: 0`. |
| NYU + at least 1,000 followers + email in bio | HTTP 200; one creator with original public-bio evidence. |
| UCLA + at least 1,000 followers + email in bio | HTTP 200; two creators. The cited bios explicitly say alum/alumna; this is not verified current enrollment. |
| Deterministic corpus chat, “Analyze cooking hooks” | HTTP 200; 11 matched caption-source records among 17 retrieved. Keyword matches include non-food uses of “cooking”, so this is a retrieval/persistence check, not a relevance-quality benchmark. |
| Direct `/api/videos/creator` request | HTTP 502, `CREATOR_UNAVAILABLE`. Successful local official requests do not establish cloud egress success. |
| Hosted AI | No AI credentials configured; hosted vision, speech and model synthesis are not verified. |

The current published source and deployment match for this recorded release. The newer checkout requires fresh full-suite/build output, browser regressions and a new matching deployment check. In particular, the new indexed-profile refresh is bounded by its seed index and has not been established as working hosted live search.

## Interaction and measured visual evidence

Actual browser checks covered supported file decoding, attachment preview/removal, question preservation, explicit source choice, retained-frame follow-ups, single-attachment counter behavior, reload-safe evidence, creator/source import, bookmarks, chats, alerts and a 390px mobile state without horizontal overflow/page exceptions. Some flows used controlled providers; those results are not described as model-quality evidence.

Desktop measurements included a 762px composer, approximately 151px height, local Inter at 24px in the unfilled state and a 41px avatar, compared against normalized March demo crops. Source overlays/player, thumbnail fan and compact creator results were added. Those measurements do not establish complete pixel/state identity. All demonstrated result layouts/transitions still need a complete reference-aligned audit. Inter’s [OFL notice](INTER-LICENSE.txt) is included.

## Required remaining proof

1. Broader query relevance and transcript/profile coverage beyond the verified target-scale local integration, with matching hosted coverage where claimed. Preserve data licensing, upstream-model/ASR labels and historical observation dates.
2. Representative real UGC critique and current multi-creator hook/trend quality, plus complex combined profile criteria. Valid JSON and public bio self-description do not establish factual visual interpretation or verified affiliation.
3. Complete visual/state fidelity against the demo, including source, creator and follow-up states.
4. Configured current paid keyword discovery, if used, with relevance and run/budget evidence; no fixture fallback.
5. Hosted AI configuration, successful hosted acquisition where claimed, and verification of the next matching published/deployed commit with final test/build and smoke output. D1 persistence and the `b27849e` deployment are already verified above. Docker was not built in this environment.

The real local audiovisual success advances [PARITY.md](PARITY.md); it does not close these requirements or imply the hosted app has local models installed.

## Release integration snapshot

The published `b27849e` release has successful CI and actual hosted D1 evidence above. The full local corpus now has actual product API/browser evidence as well. These results remain separate from verification of the next matching published/deployed revision; no new final Node test total or deployment is asserted here.

Browser regression checks confirmed that explicit Live search overrides retained video context, New chat keeps its selected source after a delayed video response, and indexed sources survive bookmark/reload. Controlled regression checks now also preserve prior Live follow-up filters and a selected reference for “Find 2 more like her”, and separate fictional example views from recorded totals. Known-handle SQL filtering prevents numeric-only archive rows from consuming current-profile refresh slots. These transport/UI checks do not establish live relevance or model quality.

The fresh desktop composer measured 762×151px with 24px Inter; a stable 390px mobile viewport had no horizontal overflow. Screenshots in `docs/screenshots/` show the attachment, actual local-model result, indexed research, home and mobile states. Archive-derived QA remains outside public screenshot assets. Complete visual-state identity and dependable natural-UGC interpretation are still unverified.

## Actual indexed Live UI check

The final local browser integration used the normal application at port 3000, its 154,424-record corpus and real local Qwen server, without request stubs or retries. The NYU + at least 1,000 followers + email-in-bio request returned an actual fresh `@lizzie.crane` profile with 3,859 followers and explicit public-bio NYU evidence. Discovery refreshed three indexed profiles and returned one matching source; only that fresh source entered chat synthesis, with `corpus:false`. Discovery completed at 2.666 seconds and the AI answer at 20.163 seconds after page navigation. The index-coverage notice remained in the rendered and saved answer; there were no page errors. These observations establish bounded indexed-profile refresh and this local combined query, not unrestricted discovery or hosted egress.

The final local suite before publication passed **191 Node tests** and **17 Python tests**, with one optional PyArrow integration test skipped in the base Python environment. The portable Worker built successfully. Later public CI and deployment results are recorded in the release artifact rather than inferred from local checks.
