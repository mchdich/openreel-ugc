# Verification record

Updated October 17, 2026 for the [full-parity continuation](superpowers/specs/2026-10-17-parity-continuation.md). **Full 1:1 parity has not been established.** This record separates real observations, controlled tests and required missing evidence. It does not freeze a final test count while integration is changing.

## Automated checks

```sh
npm test
npm run build
```

Use Node 24+. The current suite exercises deterministic research, combined creator/profile filters, unknown metrics, safe storage recovery, local media sampling, canonical WAV handling, multipart transcription, strict vision output/citation validation, fixed social endpoints, cost/timeout bounds, SQLite persistence/FTS/classification and HTTP/Worker behavior. Final release evidence must record the output and commit after all integration changes.

Controlled local HTTP providers validate transport, malformed responses, secrets, redirects, bounds and errors. They do not prove recognition or visual quality. Real local model runs below are separate evidence. The Worker build packages the client/API but does not itself publish a deployment or supply Node filesystem SQLite, model weights or configured providers. Hosted storage work in progress is not treated as deployed.

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

## Real social acquisition and corpus evidence

- Official oEmbed fetched real metadata for a known direct public TikTok video without credentials: author, caption, thumbnail, canonical source and missing-metric flags. A browser import displayed unavailable followers as `—` and opened/closed the canonical player. A created iframe verifies integration, not uninterrupted third-party playback.
- Official public creator embeds for two public handles returned actual bio/profile counts and selected video IDs. One newly discovered CeraVe URL successfully enriched through oEmbed. No login/CAPTCHA/access barrier was bypassed, and no source video was downloaded.
- Sequential collection of one known public creator populated a local SQLite database with **10 provider-observed real records**. The database is not bundled. API/CLI tests verify deduplication, no automatic retry, profile provenance and atomic imports.
- The separate Node 24/SQLite benchmark stored **150,000 synthetic rows and zero real**. Observed import was 123.177 seconds; a broad FTS query returning 20 records took 5.598 seconds. Hardware/filesystem/query shape affect those timings. See [CORPUS.md](CORPUS.md).
- A candidate described as 950k did not provide 950k unique videos: inspection found 4,162 distinct IDs. No real 150,000-video corpus claim is based on that candidate.
- Apify keyword discovery is tested at its HTTP/schema boundary, with requested cost/result/time limits. No paid end-to-end query or final billing outcome was verified.

## Interaction and measured visual evidence

Actual browser checks covered supported file decoding, attachment preview/removal, question preservation, explicit source choice, retained-frame follow-ups, single-attachment counter behavior, reload-safe evidence, creator/source import, bookmarks, chats, alerts and a 390px mobile state without horizontal overflow/page exceptions. Some flows used controlled providers; those results are not described as model-quality evidence.

Desktop measurements included a 762px composer, approximately 151px height, local Inter at 24px in the unfilled state and a 41px avatar, compared against normalized March demo crops. Source overlays/player, thumbnail fan and compact creator results were added. Those measurements do not establish complete pixel/state identity. All demonstrated result layouts/transitions still need a complete reference-aligned audit. Inter’s [OFL notice](INTER-LICENSE.txt) is included.

## Required remaining proof

1. Independently acquired target-scale unique real corpus with permitted provenance, actual transcripts/visual descriptions, profile coverage, counts, indexing runtime and complete research/citation queries.
2. Representative real UGC and multi-creator hook/trend quality, plus complex combined profile criteria. Public bio self-description alone is not verified affiliation.
3. Complete visual/state fidelity against the demo, including source, creator and follow-up states.
4. Configured current paid keyword discovery, if used, with relevance and run/budget evidence; no fixture fallback.
5. Hosted AI/storage configuration and the final matching published/deployed commit, full test/build output and deployment smoke checks. Docker was not built in this environment.

The real local audiovisual success advances [PARITY.md](PARITY.md); it does not close these requirements or imply the hosted app has local models installed.
