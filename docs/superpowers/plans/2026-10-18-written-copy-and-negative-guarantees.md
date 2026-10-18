# Written copy and negative guarantees

> Implement natively under the approved parity continuation scope; no approval stop. Use test-driven development and verification before completion.

**Goal:** Avoid rejecting actual useful video edits solely because written overlays “tell” viewers something or a clause explicitly denies a performance guarantee.

**Evidence:** Private unmodified GPT-5.4 low replies in `work/source-scan-experiment/critique12.json` contain both false rejections. The twelve-frame/structured experiment remains private and is not acceptance evidence for the shipped app.

**Architecture:** Keep the existing source schema, exact citations, byte/deadline limits and independent metric/contact/audio checks. Normalize only written-message subject + tell, and only the bounded negative guarantee clause. Do not exempt a whole sentence or mixed promises.

**Files:** `lib/media.js`, `test/media.test.js`. No public API or response schema change.

**Review focus:** Written text plus actual speech in one sentence; negative guarantee plus promised gain in another conjunct; invented metric in a limitation; unknown source timestamps; ordinary source and follow-up still requiring a real provider.

- [x] Write two real-validator tests for literal legitimate phrases and mixed unsupported claims; observe the expected rejection before edits.
- [x] Normalize written message verbs narrowly; recognize an explicit negative guarantee without bypassing raw numeric, mixed-conjunct or acoustic checks.
- [ ] Run focused tests, all tests and Worker build. Request independent review under the review skill.
- [ ] Replay preserved replies as validation-only evidence, then test actual ordinary browser review/follow-up; retain failures and distinguish quality from schema validity.
- [ ] Publish only with matching source/CI/archive evidence. Full parity goal stays active.


## Findings and resolution

Both original legitimate cases failed before implementation. Independent review exposed two Important bypasses: a negative guarantee could exempt a following promise, and a person “reading the text” could be the actual subject of “tells”. Both were reproduced with failing tests. The fix now removes only a bounded negative outcome phrase and requires the written message to begin the clause or an explicit edit instruction. All other metrics/acoustic words remain checked.

A new actual fitness source review still failed. Its transparently retained original provider replies both said “no spoken opening words can be verified/recognized”. These are absence-of-evidence limitations, not positive acoustic observations. A separate regression failed red before the bounded limitation normalization; mixed narrator/music assertions and asserted absence of speech still reject. The first earlier fitness failure did not retain its raw reply, so its exact defect remains unknown.

No twelve-frame prototype, structured format or higher reasoning configuration is shipped by this increment. Those experiments retain factual mistakes and two response-budget failures. The full parity scope remains active.
