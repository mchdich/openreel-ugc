# Incremental dated acquisition plan

> Execute inline under the approved full parity continuation and public publication authorization. The existing checkout is the user's local demo; keep its ignored runtime/configuration and public main workflow. No new approval gate.

**Goal:** Repeated normal Live/creator requests accumulate independently observed post dates instead of rechecking only the same six posts or discarding inspected dates through creator-result deduplication.
**Spec:** ../specs/2026-10-17-parity-continuation.md requirements3/4/5/6/7.
**Architecture:** Read existing trusted primary-date evidence in batches of at most40 IDs for at most120 confirmed embed candidates. Prefer undated candidates globally, round-robin across creators and descending numeric ID within each creator; fill remaining slots with already dated candidates. IDs never supply dates. Retain the six-post, three-concurrent, twenty-second limits. Return inspected records through an internal flow field; the API indexes their bounded union with displayed results (at most36) but exposes only fully filtered/deduplicated result rows. No caller payload grants provider verification.
**Stack:** Existing Node24/SQLite and generated Worker/D1; no dependencies or schema changes.

## Constraints / review focus

- Opt-out or failed-profile skip makes no coverage lookup or post calls. Existing error/deadline/identity/profile and missing-metric behavior stays intact.
- Only real/provider-observed exact-source creation-date evidence changes priority. User-supplied/archival/mismatched/malformed dates do not.
- At most3 bulk lookups for120 candidates; at most40 IDs each. API final persistence union≤36 for30 returned+6 inspected, below D1's40-record batch limit. Missing adapters preserve compatible sampling.
- All displayed query filters/counts and current profile fields still apply. Extra inspected rows may be indexed as real observations but are excluded from public result arrays; notices/counts distinguish indexed observations from matches and never call updates new unique videos.
- Generic corpus replacement semantics and local credentials remain unchanged. This expands dated coverage; it does not independently establish audiovisual formats, representative sampling or emergence.

## Tasks

- [x] Reproduce repeating six checks and discarded creator-deduplicated dates with failing tests using real in-memory SQLite and bounded external-response fixtures.
- [x] Implement trusted-date prioritization, chunked existing bulk reads and internal inspected-record propagation; preserve disabled/failure behavior.
- [x] API indexes deduplicated union before returning filtered result rows; verify hidden internal field, whole-query constraints and36-row bound.
- [x] Generated Worker/D1 repeat proves distinct date acquisition and persistence within query budget. Run full Node suite/build and independent review.
- [x] Actual browser repeated creator/Live calls without substitutes, inspect real coverage progression, source links/retained dates, corpus delta and current comparison; document only observed outcomes.
- [x] Prepare verified source for public publication and scan secrets/data. Exact release commit, public CI/archive and artifact identity are gated and recorded in the release artifact. Leave full parity goal active until all requirements are proved.

## Actual-run corrections

Actual collection added four dates and the known-profile browser path added ten dates across two creator-deduplicated requests. The default web-assisted request encountered one failed profile and skipped metadata, correctly preserving the failure. The known-profile answers exposed an unrelated existing validation error: a successful provider reply ending a supplied handle with sentence punctuation was rejected, then mislabeled as a provider outage. A transparent real-provider diagnostic captured HTTP200/finish_reason stop with the exact supplied handle plus a period. Added exact contact-token comparison with terminal prose punctuation handling (and rejection of previously accepted prefix-only invented references), supplied canonical source URLs to synthesis context, distinct rejected-reply versus unavailable-provider notices, and source-specific deterministic labels bound to each saved answer. The generic creator-count copy now describes supplied records, consistent with Live and Library inputs. These QA-driven corrections are required for a truthful usable demo; they do not expand acquisition/network bounds.
