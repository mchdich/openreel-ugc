# Direct video critique: valid responses, model quality and latency

Continue the approved full-parity specification inline. The user already authorized local model calls, autonomous fixes and public publication; no additional design approval is needed for this increment.

The published baseline is 1.14.0 at 100510734c7adb01135a2309c727cbfc45297132. Its actual source opening audio/critique/follow-up and research/brief/creator/pattern flows pass, while natural-video interpretation remains imperfect. Current experiments compare unchanged real source images and text; they are purposeful diagnostics, not a representative accuracy estimate.

## Evidence and decision

Literal-state experiments with GPT-5.4 distinguish the grinder, display and pale-liquid pitcher states that mini confused; a closed upright shaker remains separate from its straining subtitle. Text synthesis on those states still overstates continuous pacing. Retain the direct production pipeline rather than ship an extra extraction stage. Direct GPT-5.4 gives better object distinctions in these cases, but medium-reasoning latency and valid-response corrections make the demo slow. A separate actual low-reasoning comparison completed a 200-view follow-up in 13.647 seconds, with the key object states distinguished and pacing limitations still present.

## Implementation

- Preserve independent raw count checks, supplied-frame identity/times, request deadlines, bounded correction, source capture/audio ownership, no corpus writes and no persisted raw media.
- Fix reproduced comparison-like, negative cause, explicit rounded metadata-duration and narrow missing-speech wording false rejections. Add meaningful red/green tests including mixed-claim negatives and temporal locator variants. Do not exempt an entire sentence or general negation.
- Add an explicit server `OPENAI_VISION_REASONING_EFFORT` choice of low, medium or high, default medium. Validate before paid work. Apply only through existing reasoning-model request controls; legacy providers keep their existing request shape. Use GPT-5.4/low in the ignored local demo only after actual built-app verification.
- Keep source and upload/follow-up contracts unchanged. Test configuration defaults/invalid options, real provider request body, actual source review/follow-up on both creators, source/hash/row/reload/mobile invariants and the broader demo smoke.
- Publish the final code, exact-commit CI/archive and measured outcomes. Preserve 1.14.0 evidence and failed/model comparisons separately. Full continuous-footage quality, current audiovisual emergence, representative discovery and remaining reference states stay open.

## Measured outcome

The actual low-reasoning app completed Morgan review/follow-up in 53.319/27.773 seconds and Ethan in 64.386/11.855 seconds. Each source used one ASR request and three vision requests across two answers. One proposed-duration reply per case needed a bounded correction; this preserves remaining false rejections rather than claiming first-response acceptance. Both final browser harnesses passed exact capture reuse, frame/audio hashes, native row equality, unchanged corpus statistics, receipt/transcript reload, no saved raw media/token, mobile layout and no page errors. All 484 Node tests and 17 Python checks pass, with one optional Python skip. Forty-four separately captured replies pass controlled replay; the new low-reasoning captures are not added to that claim. The remaining full-parity gaps stay open. Publication artifacts record the final exact commit and CI after publication.
