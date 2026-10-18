# Complete dated cohorts in local Deep research

Continue the approved full-parity scope inline. Existing authorization covers local fixes, actual provider/browser checks and public publication. No additional design stop is required.

## Problem and decision

A capped relevance/ID sample returned a declining historical format while the separately verified complete cohort increased. Local Deep comparisons must count the complete filtered dated cohort under one statement snapshot. Normal and adapters without a local complete scan retain explicit sample notices. Counts remain corpus-scoped and dated; this cannot make archival footage current.

## Implementation and verification

- Reuse validated topic/profile/date SQL predicates without creator deduplication. Stream one unordered native SQLite statement with a 250,001-row sentinel. Fail above 250,000 matches or 256 MiB source JSON; never use a partial result.
- Let the pure reducer accept an iterable and retain only format-supported rows. Every valid dated match still contributes to denominators and unique creator counts. Preserve deterministic grouping/citations and existing exclusions.
- Route only non-writing local Corpus Deep temporal questions to the complete method; preserve normal/sample and writing paths. Return a controlled 413 for resource limits.
- Add a >1,000-record real SQLite/API regression that reverses the old capped sign, combined-profile filters, iterable error closure, no paid calls, explicit failure and no preliminary payload sort. Extend the generated Worker test with nonempty dated evidence.
- Run actual read-only full historical/current scans and the ordinary browser; compare the independent historical proof, reload, mobile and corpus stability. Review, run required checks and publish exact source/archive/CI evidence.

## Outcome

All 489 Node tests pass; Python passed 17 with one optional skip. Independent review found a missing Worker binding and SQLite payload sort; meaningful red/green regressions cover both. No significant review findings remain. The actual final browser completed historical Deep in 1.176s with 21,998 records (11,041 current / 10,957 prior), Normal in 0.240s with 125/125 and current Deep in 0.115s with 4/5 and no format group. Full historical groups, stats and cited IDs equal the independent proof. Reload counts/citations/scope, 390px layout, page errors and unchanged native/browser corpus statistics pass. The final direct full scan took 0.983s. Publication artifacts record the exact final commit and CI. Remaining full-parity gaps stay open.
