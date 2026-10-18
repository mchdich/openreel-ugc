# Natural visual language in source critique

Continue the approved full parity goal without changing its requirements. Version 1.13.0 is public with matching successful CI/archive. Its two actual source flows work but factual interpretation quality remains open.

## Diagnosis and design

Two actual calls through the unchanged analyzer using GPT-5.4 each completed both bounded provider attempts but failed prose validation. Controlled diagnosis of the four saved replies found ordinary singular camera `view` phrases missing from a finite adjective list, plus `share attention` and a `less like` comparison interpreted as social-share/like assertions. This is validator behavior, separate from model factual quality. Adding an unlimited list of camera adjectives would repeat the same defect.

Keep numeric extraction and validation for singular/plural social metrics unchanged. Treat singular `view` as ordinary composition prose unless a numerical count, comparative or performance predicate indicates a metric, or an explicit count/rate/number noun follows it; plural `views` and the other metric nouns keep their existing claim gates. Numeric extraction also covers a bare metric followed directly by its figure, so falsely reported `view 999999` cannot bypass count validation. Permit the narrow visual idiom `share attention` / `share the frame` and comparison idioms such as `less like`, preserving numeric/performance/count constructions. No numerical claim, fake attribution, guarantee or unseen time gains permission. The same public Worker and local upload/source analyzers share this fix.

Use regression tests for the actual rejected clauses and existing metric negatives, then controlled replay of all saved replies. Only after these checks assess their unedited factual accuracy against all actual images. A real call from the app must prove the final configured model; a replay is not that proof. Keep failures and precise sample limits. A local model configuration can change only after the actual evaluation supports it; no automatic retry, paid fallback, automatic corpus annotation or audio claim is added.

## Browser lifecycle diagnosis

A subsequent actual app source review failed with `CAPTURE_CLEANUP_TIMEOUT` after 8.545s before any model work. The fixed 500ms close allowance rejected an otherwise completed capture. Separate transparent timing of a distinct actual capture succeeded with eight frames and a 152ms close; this does not erase the earlier failure or measure its eventual close. Code inspection also found swallowed close failures and cancellation before launch completion not accounting for the owned late browser. A shared three-second cleanup bound and matching source-operation drain preserve bounded termination, with no sample release until close succeeds; failed/unknown cleanup quarantines new source work. Tests cover a normally delayed 750ms close, throwing close, late launch cancellation and draining 800ms cleanup before another explicit operation. No access, byte, capture, session or model bounds are loosened.

## Tasks

- [x] Red→green natural singular-camera and visual-sharing language, preserved metric negatives.
- [x] Controlled replay of four actual stronger-model replies (with unsupported content graded separately) plus previous real mini replies; full suite/build and independent review.
- [x] Grade actual unedited model answers against inspected frames and a non-coffee source; final app call and follow-up with selected local configuration.
- [ ] Publish source, exact-commit CI/archive and actual evidence. Keep full parity goal active unless all requirements are proved.

## Actual outcome

Final full built-app review/follow-up passed in 16.285/8.350s, one provider call each, with receipt/citations, persistence/reload and mobile checks. Earlier cleanup and validation failures remain recorded. Actual speech proposals and curly limitations were isolated without substituting responses. Proposed lines now explicitly label original on-screen copy. Counter/mixed-guarantee/unseen-time regressions found in review are fixed. All 445 Node tests pass. The actual purposeful stronger-model comparison retained factual errors and higher latency, so local model configuration remains unchanged. Final app prose still overstates sampled motion/pacing; representative accuracy, current audiovisual emergence, discovery coverage and remaining visuals stay open. Publication evidence is finalized outside the repository after matching CI/archive checks.
