# Dated format momentum

The full-parity target includes emerging multi-creator trends. Recurring labels and high views alone do not establish emergence. This increment adds an explicit dated comparison using actual source posting dates, while keeping historical data and retrieved-sample limits visible.

## Design

A pure module accepts normalized records and `{asOf, windowDays}`. `asOf` is a strict calendar date; the current window and immediately preceding equal-length window use supplied posting calendar dates. Missing dates are excluded and counted. Unknown timezones remain explicit. Each record is counted once per format and creator identities use numeric IDs when supplied. Existing source-grounded `getTrends` classification retains its upstream-model labels and exact excerpts.

For each eligible group, report actual video and distinct-creator counts, the format's share of all dated records in each window, and the percentage-point change. A positive signal requires at least five current clips, three current creators, prior evidence, and increasing share; call it rising within the supplied sample, never platform-wide emergence or a causal performance claim. Empty/old data cannot become current evidence. No social metric growth is inferred from single cumulative snapshots.

Chat recognizes explicit format/trend momentum requests, with an optional ISO `as of YYYY-MM-DD` and bounded 1–90-day window. Default date is today. Search removes comparison/date syntax while preserving topic terms and creator/profile constraints. Corpus retrieval is bounded and the answer reports retrieved count separately from corpus size. Ordinary recurring-pattern questions retain their current behavior. The new report returns existing research-compatible sections/source IDs so the measured result layout remains usable.

## Tasks and evidence

1. Add `public/temporal.js` and focused tests for calendar boundaries, unknown dates/timezones, source identities, distinct creators, denominator changes, insufficient/zero evidence, historical/current labeling and representative source citations.
2. Integrate validated temporal query parsing and deterministic results into the shared API/Worker bundle. Preserve normal corpus filters, auth, no-model fallback and existing chat/history contracts.
3. Test actual archived records in a clearly identified historical window. Record full queries, counts, source IDs, execution time and acquisition license. This does not close the missing current-source-data requirement.
4. Review independent implementation, run relevant/full checks, then publish matching source/build/deployment. Hosted provider configuration remains separate and awaits user input.
