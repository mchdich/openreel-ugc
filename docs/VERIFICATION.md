# Verification record

Updated October 17, 2026 for the [full-parity continuation](superpowers/specs/2026-10-17-parity-continuation.md). **Full 1:1 parity has not been established.** This record separates real observations, controlled tests and required missing evidence. It does not freeze a final test count while integration is changing.

## Automated checks

```sh
npm test
npm run build
```

Use Node 24+. The current suite exercises deterministic research, combined creator/profile filters, unknown metrics, safe storage recovery, local media sampling, canonical WAV handling, multipart transcription, strict vision output/citation validation, fixed social endpoints, cost/timeout bounds, SQLite persistence/FTS/classification and HTTP/Worker behavior. Final release evidence must record the output and commit after all integration changes.

Controlled local HTTP providers validate transport, malformed responses, secrets, redirects, bounds and errors. They do not prove recognition or visual quality. Real local model runs below are separate evidence. The Worker build packages the client/API but does not itself publish a deployment or supply Node filesystem SQLite, model weights or configured providers. Actual D1 deployment evidence is recorded separately below.

Published release `52f9866` has [successful test/build CI](https://github.com/mchdich/openreel-ugc/actions/runs/39073232310). Focused numeric-identity, source-pattern, SQLite/D1 and known-handle Live regressions passed, including persistence, source validation, unknown metrics and transcript/description separation. The data-tool run passed 17 Python checks with one optional integration skipped. The 1.3.0 integrated checkout subsequently passed 230 Node tests and 17 Python tests, with one optional PyArrow integration check skipped; the portable Worker built with 12 assets. These local checks remain separate from the next exact matching publication/deployment evidence.

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

Performance was measured separately from functional correctness. A covering index reduced the local full-store statistics call to **576 ms**. Compound school/follower SQL previously took about **20.9 seconds** and still chose the broad follower index after `ANALYZE`; the new `corpus_school_followers` index brought the measured SQL query to about **4 ms**. Later full compound API calls took about **0.6 seconds**, including statistics/response work. These measurements do not predict other storage or query workloads. The genuinely generated incremental `0001` migration contains these indexes, leaves applied `0000` unchanged and was applied successfully in the verified 1.2.0 cloud release.

## Verified public deployment and hosted D1

The public [OpenReel app](https://openreel-ugc-mchdich.red-boar-0376.chatgpt.site/) was verified against published source commit [`52f986625c28c703d0babf5e55109ad65d30e9e3`](https://github.com/mchdich/openreel-ugc/commit/52f986625c28c703d0babf5e55109ad65d30e9e3), with the passing CI run linked above. The recorded Sites deployment is `appgdep_6ad3efeaa2408191982fdd4f0d60fce8`, version `appgprj_6ad3d8c8e6948191bf9d88041ff29697~appgver_9bf8e136168c81918eb378b32ef0df42`. This identifies the verified release; it does not identify a later checkout or prove its deployment.

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

The current published source and deployment match for this recorded release. The dated-momentum checkout requires a new matching deployment check. Indexed-profile refresh is bounded by its seed index and has not been established as working hosted live search.

## Interaction and measured visual evidence

Actual browser checks covered supported file decoding, attachment preview/removal, question preservation, explicit source choice, retained-frame follow-ups, single-attachment counter behavior, reload-safe evidence, creator/source import, bookmarks, chats, alerts and a 390px mobile state without horizontal overflow/page exceptions. Some flows used controlled providers; those results are not described as model-quality evidence.

Desktop measurements included a 762px composer, approximately 151px height, local Inter at 24px in the unfilled state and a 41px avatar, compared against normalized March demo crops. Source overlays/player, thumbnail fan and compact creator results were added. Those measurements do not establish complete pixel/state identity. All demonstrated result layouts/transitions still need a complete reference-aligned audit. Inter’s [OFL notice](INTER-LICENSE.txt) is included.

## Required remaining proof

1. Broader query relevance and transcript/profile coverage beyond the verified target-scale local integration, with matching hosted coverage where claimed. Preserve data licensing, upstream-model/ASR labels and historical observation dates.
2. Representative real UGC critique and current multi-creator hook/trend quality, plus complex combined profile criteria. Valid JSON and public bio self-description do not establish factual visual interpretation or verified affiliation.
3. Complete visual/state fidelity against the demo, including source, creator and follow-up states.
4. Configured current paid keyword discovery, if used, with relevance and run/budget evidence; no fixture fallback.
5. Hosted AI configuration, successful hosted acquisition where claimed, and verification of the next matching published/deployed commit with final test/build and smoke output. D1 persistence and the `52f9866` deployment are already verified above. Docker was not built in this environment.

The real local audiovisual success advances [PARITY.md](PARITY.md); it does not close these requirements or imply the hosted app has local models installed.

## Release integration snapshot

The published `52f9866` release has successful CI and actual hosted D1 evidence above. The full local corpus now has actual product API/browser evidence as well. These results remain separate from verification of the next matching published/deployed revision; no new final Node test total or deployment is asserted here.

Browser regression checks confirmed that explicit Live search overrides retained video context, New chat keeps its selected source after a delayed video response, and indexed sources survive bookmark/reload. Controlled regression checks now also preserve prior Live follow-up filters and a selected reference for “Find 2 more like her”, and separate fictional example views from recorded totals. Known-handle SQL filtering prevents numeric-only archive rows from consuming current-profile refresh slots. These transport/UI checks do not establish live relevance or model quality.

The fresh desktop composer measured 762×151px with 24px Inter; a stable 390px mobile viewport had no horizontal overflow. Screenshots in `docs/screenshots/` show the attachment, actual local-model result, indexed research, home and mobile states. Archive-derived QA remains outside public screenshot assets. Complete visual-state identity and dependable natural-UGC interpretation are still unverified.

## Actual indexed Live UI check

The final local browser integration used the normal application at port 3000, its 154,424-record corpus and real local Qwen server, without request stubs or retries. The NYU + at least 1,000 followers + email-in-bio request returned an actual fresh `@lizzie.crane` profile with 3,859 followers and explicit public-bio NYU evidence. Discovery refreshed three indexed profiles and returned one matching source; only that fresh source entered chat synthesis, with `corpus:false`. Discovery completed at 2.666 seconds and the AI answer at 20.163 seconds after page navigation. The index-coverage notice remained in the rendered and saved answer; there were no page errors. These observations establish bounded indexed-profile refresh and this local combined query, not unrestricted discovery or hosted egress.

The final local suite before publication passed **191 Node tests** and **17 Python tests**, with one optional PyArrow integration test skipped in the base Python environment. The portable Worker built successfully. Later public CI and deployment results are recorded in the release artifact rather than inferred from local checks.

## Dated format momentum verification (1.3.0 increment)

The explicit dated request “What formats are gaining share as of 2024-07-21 over 7 days?” uses independent date-filtered retrieval for July 15–21 and July 8–14. The native Windows application, using its actual 154,424-record product store, returned **500 records per window in Deep** (1,000 total), three eligible groups and ten actual representative sources in approximately **252 ms**. Normal returned 125 per window (250 total) in approximately **205 ms**, with no eligible multi-creator format group. The present-day equivalent returned zero dated records in approximately **304 ms**. These are measured local requests, with no external model call. Equal retrieval allowances do not establish representative population sampling: each window still uses corpus relevance then source-ID order.

The exact result was checked against independent read-only retrieval from the same persisted database. All ten cited source objects matched their actual stored records, retained the CC-BY-NC source provenance and upstream-description labels, and belonged to the requested windows. A native browser rendered the same 500/500 comparison, adjacent source cards and historical limits; the dates and citations survived reload without page errors. The bounded sample’s four current and five prior unboxing clips do not establish a rising signal. They must not borrow the separate complete historical cohort’s denominator or positive result.

Separately, the pure module compared **21,998 actual July 8–21 records**: 10,957 prior and 11,041 current. Strict source-grounded unboxing classification yielded 138 clips / 93 creator IDs versus 154 clips / 104 creator IDs; sample share rose from 1.2595% to 1.3948%, approximately +0.1353 percentage points. All 36 representative citations matched their actual original records, with exact attributed upstream-model excerpts and unknown posting timezones preserved. This offline full-cohort calculation took approximately 402 ms; it is not the capped chat result or current 2026 evidence. [RESEARCH_DATA.md](RESEARCH_DATA.md#historical-format-share-comparison) records the source and license boundary. The acquired cohort and raw result are excluded from the MIT source release.

Review caught and reproduced a combined retrieval cap that admitted 996 prior / four current records in Deep, a natural format count that truncated video evidence, and a non-alias school parser that swallowed topic words. The final implementation queries each window separately, removes requested group counts before video retrieval, and preserves explicit institution/topic/profile constraints in both loaded-library and indexed plans. Regression checks cover these cases, strict date bounds, leap dates, unknown dates/timezones, insufficient evidence, tiny signed changes, source identity, representative citations, provider-independent counts and Worker execution. The new incremental 0002 custom Drizzle migration creates a JSON posting-date index; applied 0000/0001 migrations remain unchanged.

This increment provides dated sample-share comparisons. Current multi-creator audiovisual evidence, broad query/critique quality, complete visual-state parity and configured hosted AI remain open. The exact final published/deployed source and CI result are recorded in the separate release artifact after publication. The integrated local run passed 230 Node tests; Python ran 18 tests with 17 passing and one optional skip. The Worker build contains 12 client assets.

## Observable UI and saved-source audit (1.3.1)

A new independent browser audit compared the current composer/attachment, source, trend-card/row and compound-creator states with the actual retained reference pixels. The existing measured component geometry remains intact. For an actual 250-record cooking retrieval, 243 records matched but only five findings cited clips; 238 uncited cards previously appeared before those findings. The fixed layout displays five cited cards beside their findings and keeps the other 238 records in a closed disclosure afterward. Expansion shows all 243; reload preserves every source object while returning the disclosure to its default closed state. The 390-pixel mobile page remains 390 pixels wide in both states.

The audit also reproduced a more serious continuity defect: a saved corpus conversation reloaded as Library, so its next follow-up would send the 28 fictional starter records. Each chat now retains a validated Corpus, Library or Live source. Independent controlled follow-ups verify Corpus sends no browser records with `corpus:true`, explicit Library remains Library even after delayed status, and Live performs discovery again. History navigation preserves each choice. Explicit structured legacy corpus provenance restores Corpus; prose is never used to guess.

Attachment cancellation, clearing retained context, an intercepted failed analysis, and a new draft’s explicit Library choice all restore the selected source. In-memory video source overrides cannot override a later deliberate Library choice after history navigation. Video frames/audio remain outside persisted workspace data. These transport checks use intercepted providers and are not natural-model accuracy evidence. The integrated suite passes 232 Node tests, including source validation and legacy provenance regressions.

Remaining observed visual limits are source-dependent imagery/identity coverage and third-party player chrome. The actual 243-record answer had only one thumbnail; unknown handles remain unknown. Official TikTok playback works inline, but its creator/social overlays differ from the reference’s bare player. A bounded `controls=0` diagnostic removed bottom controls without removing those overlays, so no blind control-removal change was made. Unshown private UI and mobile pixels are evidence boundaries, not invented extra requirements.

The newer full-sample local-model tests are recorded in [LOCAL_MODELS.md](LOCAL_MODELS.md#additional-natural-video-and-gpu-evidence): low-detail output failed validation/grounding, corrected-detail CPU processing timed out, and an identical GPU request completed in 102.630 seconds but remained repetitive and temporally ungrounded. Improved transport speed does not close critique quality.

## Public-player metadata and local request budgets (1.4.0)

Five sequential ordinary public-player navigations produced four actual matching canonical identities, covers and author-linked avatars; the remaining player was unavailable. The reviewed raw field deltas passed the production validator and were applied through the explicit native Windows CLI to the normal local corpus. The transaction changed exactly four records. An independent before/after comparison checked every protected JSON field and SQL column: creator IDs, captions, transcripts, visual descriptions, posting dates, metrics/missing flags, archive provenance, ingestion source/time, classifications and verification remained identical. Counts stayed at 154,424 real records, 4,621 creator identities and 262 provider-observed records, with zero example/synthetic/unverified rows. SQLite `quick_check` returned `ok`; all four new handles were searchable. The unavailable fifth record remained byte-identical.

An actual native browser cooking request retrieved 250 records and matched 243. Its five cited cards included the four updated sources; all four exact cover URLs and four avatar URLs loaded with nonzero natural dimensions. A bookmark and compact field evidence survived reload; the 390-pixel mobile page had no horizontal overflow or page errors. The other 238 matching sources remained in the closed disclosure. The images are fresh metadata observations of archival sources; the captions, dates and metrics retain their original provenance and data license.

The committed production collector was then run for one separate known post, `7387143945744141599`. It completed one ordinary navigation with HTTP 200, no retry or access barrier, and resolved `@mommatata420`. Both selected `currentSrc` resources matched their observed `src`: a 540×960 cover and a 100×100 author-linked avatar. The raw delta passed the production validator offline. This run performed no database write, playback or media-file save. The DOM remains an undocumented metadata surface, signed URLs can expire, and the collector is an optional local operator tool.

New regressions exercise field/ID binding, raw-value validation, classification preservation, transaction rollback and concurrent updates. Review reproduced a stale-read race and an unbounded browser-call stall; the fixed merge checks all original JSON under its write lock before writing, while the collector watchdog saves partial output and bounds cleanup. The text synthesis deadline retains its 25-second default and accepts an explicit 10–180-second operator budget. Browser regression checks preserve the 65-second default and extend the client deadline when configured. These transport checks do not establish model accuracy.

Controlled browser failures also verify that expired covers reveal existing source text and failed avatars reveal creator initials, while a successfully loaded control stays unchanged. The fallback retains the 160×213.328 source-card geometry, source selection, keyboard details/playback/bookmark controls and persisted URLs/evidence. Exported library/workspace records remain equal to the original normalized records. It changes presentation only.

The conditional-experiment regression also preserves legitimate test questions while rejecting nearby affirmative outcome claims and promises. Actual provider bodies, original errors and later validation-only replays remain separate in the model evidence.

The current integrated run passes 263 Node tests; Python runs 18 tests with 17 passing and one optional PyArrow skip. Exact final publication and hosted checks are recorded with the release artifact after the source is frozen.
