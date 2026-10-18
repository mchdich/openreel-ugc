# Live post metadata implementation plan

> Execute inline under the already approved parity continuation and user authorization to implement/publish autonomously. Use the native execution path, regression tests and independent review. No intermediate permission stop.

**Goal:** Live searches and known-creator collection acquire actual posting dates/counts through the existing opt-in public-post reader, making fresh dated research possible without manual per-URL imports.
**Architecture:** An optional shared helper samples at most six independently confirmed official embed records across creators, reads canonical public pages in batches of three within one 20-second deadline, then places successfully inspected records before uninspected records. It binds returned post/creator identities and reapplies all query criteria. Dated trend syntax is removed only from acquisition topic matching; the full question and supplied dates reach the existing comparison engine. API persists actual per-record source types and a mixed acquisition label. Missing/failed metadata stays explicit; source records are never relabeled as direct audiovisual analysis.
**Tech stack:** Node24+/Worker fetch, zero runtime dependencies.
**Spec:** ../specs/2026-10-17-parity-continuation.md requirements3/4/5/6/7.

## Constraints and review focus

- `OPENREEL_POST_METADATA=true` is required. Default acquisition behavior remains compatible. No extra AI calls.
- Candidate input≤120 real official-embed records; ≤6 canonical post GETs, ≤3concurrent, one shared20-second deadline plus existing per-GET 10-second / 1 MiB bounds. Each source ID requested once; no automatic retry/fallback.
- Numeric post-ID descending order is only a selection heuristic, never a posting-date source. Round-robin creator coverage precedes extra posts per creator. Dates come only from actual matching hydration.
- No later metadata batch after a non404 failure, and no metadata calls after a failed profile batch. Already confirmed embed records may remain with unknown dates; incomplete metadata is labeled.
- Exact post/creator binding; no changed-profile criterion can survive fresh metadata revalidation. Unknown metrics do not satisfy filters. Duplicate aliases/numeric identities cannot inflate coverage.
- No requested date/topic/school/contact/follower/count constraints lost while removing temporal wording from acquisition matching. Historical/current comparison windows retain their original full question and dates.
- Request deadline accounts for the bounded metadata phase; stale/cancelled browser requests cannot overwrite later chat/source state.

## Task1: bounded metadata selection and enrichment

Files: create `lib/live-post-metadata.js`, `test/live-post-metadata.test.js`; modify `lib/social.js` to accept an internal cancellation signal in its existing reader.

Interface: `enrichPublicPosts(records, env={}, {skip=false}={})` → `{records, postMetadata?, notice?}`. Disabled mode returns records unchanged with no network. Enabled mode reports checked/enriched/dated/unavailable/failed/notAttempted and selection limit; successful records carry the post reader's source type/profile/date/counts. Identity mismatch is a failed check. Source arrays/records remain immutable.

- [x] Write and run failing tests for opt-out/validation, round-robin six-call cap/three concurrency, explicit source binding, dates/unknowns, failure batch stop/404 skip, skip-after-profile-error, shared abort and immutability.
- [x] Implement selection/merge/budget; run focused tests.

## Task2: integrate complete Live and collection flows

Files: `lib/live.js`, `lib/web-discovery.js`, `lib/api.js`, `public/app.js`, `scripts/build.js`; tests in existing Live/Web/API/Worker suites.

- [x] Reproduce lost current-trend topic matching, stale filter survival, wrong persistence provenance and missing Worker bindings with failing tests. Preserve explicit dates/institutions/counts.
- [x] Integrate enrichment before final filters/limits and return explicit coverage. Preserve default behavior and no post requests after profile failures. Known-creator route uses same helper; configured Apify path retains its own dates/provider.
- [x] Expose `postMetadataConfigured` status and reserve60s Live allowance alongside configured synthesis budget when enabled (40s default). Verify browser timeout selection and no unrelated source regression.
- [x] Run generated Worker tests and full suite/build.

## Task3: actual demo and public release

- [x] Run actual browser Live topic and compound creator requests without response substitutes, inspect every supplied date/source/filter, capture progress/source/reload/mobile and true corpus delta. Record any upstream failures.
- [x] Run a current dated comparison; do not claim emergence unless actual multi-creator evidence proves it. Unrestricted discovery, ongoing corpus refresh and representative audiovisual analysis remain part of the full goal.
- [x] Independent review, documentation and staged secret/data scan. Published implementation commit `68680a4`; its public CI passed. Final source archive and exact release commit/CI are recorded in the release artifact. Keep hosted credential/local boundary intact.

## Actual-run corrections

The first real repeat erased six known primary dates when an unrelated failed profile batch left later embed rows date-less. Added validated `postingEvidence`, `retainPostingDate`, API `retainCorpusPostingDates`, browser merge/request continuity and one bounded native/D1 `getMany` read. Only prior real/provider-observed primary dates are reused by the API; fresh counts and profile fields remain fresh. Explicit generic whole-record imports retain replacement semantics. New schema/adapter/workspace/API tests reproduce the original loss and validate source/time/identity/verification bounds. Record details expose the exact date and its original source citation. Rename/profile propagation and video research-count regressions were independently reproduced and fixed. Current-week evidence remains insufficient to establish an emerging audiovisual format.
