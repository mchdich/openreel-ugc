# Public-player visual evidence pipeline

> Implement inline under the approved full parity continuation and existing publication authorization. No intermediate permission stop. This is an acquisition increment for requirements2/5/6, not a reduced completion target.

**Goal:** Actual current public source clips can acquire timestamped sampled-frame AI descriptions and enter existing corpus research/pattern flows with separate provenance.
**Spec:** ../specs/2026-10-17-parity-continuation.md
**Design:** An optional local CLI validates at most eight direct source URLs, reads matching public post metadata, then navigates one fresh ordinary official player per source. It captures up to eight clean JPEGs through the player's permitted browser canvas, using real decoded dimensions/times and a50MiB/45-second capture bound. No direct video asset fetch, header/cookie spoofing, challenge interaction, retry or downloaded footage. A single bounded vision call describes only visible samples. The command emits reviewable field deltas; explicit atomic apply updates only visual description/provenance and its FTS projection on existing real records. Other record fields, license, classification, ingestion provenance and counts stay unchanged. Existing app research uses the new description origin and exposes its source/time/frame scope. Later acquisition refreshes preserve attributed visual observations separately from fresh profile/metrics.

## Interfaces and constraints

- `visualEvidence`: exact `{sourceType:'tiktok-public-player-frames',sourceUrl,creatorId,observedAt,duration,frames:[{timestamp,sha256}]}`; up to8 chronological unique timestamps within≤600s; exact post-ID and compatible creator binding; canonical sourceURL; UTC observation;64lowercasehex hashes. No image bytes in records. `descriptionSource:'openreel-vision'` requires a nonempty description and this evidence. Citation declarations cannot promote corpus verification.
- `describeVideoFrames(attachment,env,{signal})`: existing JPEG/duration validation; one strict JSON vision call,≤64KiB provider body,≤4000description chars, exact sampled timestamp references; no advice, hypotheses, contacts, social metrics, acoustics, invented chronology or current-emergence claims. Failures remain explicit. No retry.
- `capturePublicPlayer(chromium,source,{executablePath,signal})`: Node-only optional runtime; source contains verified public metadata and expected video dimensions/duration. Ordinary player DOM identity and playable video must agree; canvas taint fails. No browser profile import or automatic dependency installation. Stop on document/login/challenge/unavailable/identity/decode/budget failure. Internal player playback errors remain recorded; actual successful readyState/playback/canvas evidence is required.
- CLI collection≤8 sequential sources, default3, explicit output directory, batch deadline≤600s, stop on failure, persist partial summary. Optional `--save-samples` stores acquired JPEGs only in chosen data output, excluded from source releases.
- `Corpus.applyVisualEvidence(deltas)` and `corpus apply-video-evidence`: existing real rows only, unique IDs, preflight and under-lock conflict check, atomic update of JSON+FTS text; protect every other JSON/SQL field and counts. No schema change. Whole-record generic imports retain replacement semantics.
- Shared browser/Worker normalization and description-origin gates recognize the new source only with valid evidence. API/window/filter semantics, default network budgets and user local credentials remain intact.

## Tasks

- [x] Red→green provenance/schema, safe delta apply/FTS, continuity across native/D1/browser refreshes; protect all old fields/counts and classification.
- [x] Red→green bounded single-call frame description and capture input/budget/failure orchestration; implement optional CLI and existing corpus apply command.
- [x] Integrate description gates, source labels, details and generated Worker bindings; full tests/build and independent review.
- [x] Actual native player/model acquisition for current clips from multiple creators plus earlier-window sources; inspect samples/descriptions, apply reviewed deltas, verify protected hashes/counts and actual app research/pattern/current-date behavior. Do not force a positive emerging signal or confuse sampled vision with continuous/audio analysis.
- [x] Publish source and exact-commit CI/archive; record any failed player/provider cases and remaining full parity gaps.

## Actual outcome

Three reviewed visual deltas applied, all protected fields/counts unchanged; two model descriptions required recorded object/state corrections. Six distinct URLs attempted in separate bounded batches, five captured, four model replies accepted, three applied. One failed player and one rejected reply remain explicit; no retries. Final post-review capture succeeded but was not applied pending content review. Actual app analysis/follow-up returned AI synthesis (4.170/3.399s); details/reload/mobile checks pass. Dated comparison as of October17 has4current/4prior and no qualifying group. Full parity remains active; this increment supplies sampled visual provenance, not representative emergence or continuous/audio analysis.

427 Node tests passed. Independent review found late barrier and cleanup bounds issues, both fixed with red→green regressions and re-reviewed. The first acquisition draft was discarded before final contract-first implementation; actual browser harness selector failure and correction are retained in the verification record.

Implementation publication `834365f` passed exact-commit CI run 39112124041; its source archive byte-matched all 133 tracked files, excluded local acquired data/credentials and contained zero credential findings. The release metadata outside the repository records the final documentation commit and matching artifact checks.
