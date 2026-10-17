# Parity continuation implementation plan

**Goal:** Move the existing released app toward the complete1:1 target, retaining every requirement in the continuation spec.
**Spec:** ../specs/2026-10-17-parity-continuation.md
**Architecture:** Browser samples attached videos; Web API modules analyze frames and ingest/discover real social records. Core auth stays in lib/api.js. Pure modules are independently testable and bundled into the existing Worker. Persist no provider keys or image payloads in browser chat history.

## Task1 — Video analysis

Files: lib/media.js,test/media.test.js; public/media.js,test/media-client.test.js; root integrates lib/api.js and public/app.js.

- Write failing tests for validated frame payloads, actual provider multimodal messages, unknown provider errors, and controlled responses that cannot manufacture metrics or claim audio.
- Implement validateVideoAttachment(input)->{name,duration,width,height,frames:[{timestamp,dataUrl}],transcript}; analyzeVideo(attachment,question,env)->research-compatible result.8JPEGframes max,160KB JPEG/frame max, duration≤600sec, name≤160chars, transcript≤12000chars. Provider errors must be actionable and secret-free. API auth applies before requests.
- Browser decode local File≤50MiB, metadata/seek timeouts, deterministic sampling, safe objectURL lifecycle,≤960px JPEG frames, cover preview; test real generated video in Chromium. Attachment payload remains in memory, not localStorage; chat retains only analysis evidence metadata.

## Task2 — Real video ingest/discovery

Files: lib/social.js,test/social.test.js; root integrates API,record schema and app.

- Verify official TikTok oEmbed with public examples. Write failing tests for URL allowlist, fixed endpoint/no arbitraryfetch, missing fields/unknown metrics, sanitized untrusted records, payload bounds.
- Implement ingestTikTok(url,env)->record from official oEmbed; discoverVideos(query,options,env)->records through configured Apify actor. Configure API token server side only, result cap≤30, timeout≤45sec, preserve direct canonical sources and profile evidence.
- Integrate endpoint and explicit live/library query mode. Direct URL ingestion adds records and source links; errors preserve prior library. Unknown followers must not match follower constraints. Do not silently fall back from failed live discovery to fixtures.

## Task3 — Measured visual parity

- Read independent work/fidelity-audit.md against original component frames.
- Replace invented serif hero/copy and synthetic phone art with original layout hierarchy and actual attachment/source thumbnail stacks. Preserve keyboard/mobile behavior.
- Add inline attachment cover/removal, user avatar, visible research mode, source playback where known video URLs exist and direct source links otherwise. Do not label metadata-only sources as watched.

## Task4 — Verify and publish increment

- Run Node suite and Worker build; browser test real video decoding, attach/remove, import URL errors, query modes, stored-state recovery, desktop/mobile screenshots.
- Independent review; fix material findings with reproducing tests.
- Update capability matrix by evidence (implemented/unverified/missing), push exact source to GitHub and Sites, verify CI and deployment. Keep goal active until the full spec's required end state is proved.
