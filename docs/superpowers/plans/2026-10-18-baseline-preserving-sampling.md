# Baseline-preserving video samples

> Execute inline under the approved parity continuation. Use TDD, actual browser verification and independent review; no new approval stop.

**Goal:** Retain every existing eight-frame temporal sample while adding at most four separated measured visual states, so a novel-scene scan cannot discard known useful footage.
**Evidence:** Actual private global-novelty scan lost grinder/display/pitcher views. Baseline-plus-four retained all of them and exposed espresso extraction missed by the coffee critique. It still made an object error; extra frames are coverage, not guaranteed interpretation.
**Architecture:** Shared maximum12frames. Local uploads use existing≤128low-resolution scans and baseline-plus-novel selection. Optional `OPENREEL_SOURCE_SCAN=true` enables the same scan for public source review, retaining the ordinary fixed-eight collector default. This explicit local option uses the existing60-second capture maximum to accommodate≤30seconds of audio; network≤50MiB, total JPEG≤1280KiB and overall review≤240seconds remain unchanged. Scans never become stored evidence; only actual selected JPEG hashes do.
**Files:** public/{engine,media,workspace}.js; lib/{media,frame-description,player-visuals,source-video}.js; scripts/{build,verify-video-sampling}.js; related tests; .env.example/README/docs. No new runtime dependency or client asset.

Review focus: loss of baseline times; selected clustered duplicates; byte overflow with12frames; invalid/late identity or challenge during scanning; exact twelve-frame receipt/citations/reload; old eight-frame records and Worker requests remain valid.

- [x] Red tests for preserved baseline and a brief intermediate state, bounded input and spaced selection; validate12bounded JPEGs/receipt/citations/reload and reject13or excess aggregate bytes.
- [x] Implement shared12-frame ceiling and baseline-plus-novel selector; preserve per-image160KiB validation, compress prepared images to≤1280/12KiB.
- [x] Red tests for optional source-scan configuration and late challenge/cancellation before any result; implement bounded source scan with access checks before/after every seek.
- [x] Full Node suite and independent review. Reviewer found the deduplicated-baseline edge; reproduced RED and fixed with the relative +4 cap. Python/Worker and final actual checks are recorded with publication evidence.
- [ ] Enable the option only in ignored local config, then actual normal browser coffee review/follow-up; compare exact returned receipts to inspected frames and assess whether missing extraction is now recognized. Keep failures, no response replay as success.
- [ ] Publish only verified source/artifacts/CI; retain full parity limits.


## Review and actual evidence

Independent review found one P2: an exact12-second clip deduplicates the6-second baseline and could gain five extras. A new regression failed before bounding additions relative to baseline length; all504Node tests then passed. The real generated-upload script now explicitly checks that every baseline time survives, alongside the intermediate reveal and cancellation.

Actual ordinary source browser capture used twelve frames for the latte-art clip. Every digest exactly matches an independently inspected image from the private prototype; all original eight samples remain. Both real answers now recognize espresso extraction, whereas the earlier eight-frame answer recommended recording an extraction bridge that already exists. Some prose still generalizes sampled gaps/pacing; extra samples are not continuous interpretation or a factual-correctness guarantee. The second source and final publication outcome are recorded externally.


## Visible example follow-through (1.16.1)

The actual reference-state audit found the first compact trend row had zero images although the group contained records with usable preview URLs. A new actual-browser assertion failed with 0 rather than 2 images. Prefer preview-bearing records only for the bounded example list, retaining their original order within each availability class and leaving source records, group counts, metrics and evidence unchanged. Pair adjacent examples from that same ordered list. The browser rechecks actual loaded 58×58 images, row 530×121 geometry, 19px text, source links and mobile overflow. This does not fabricate media where none is supplied.
