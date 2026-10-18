# In-app source video review

Under the approved full parity continuation; implement inline without another permission stop. The previous goal turn was progress (published 1.12.0 with actual player acquisition, reviewed corpus annotations and browser analysis/brief evidence). Full requirements remain unchanged.

## Design

Extend existing source-record details with Review video when the local Node server has explicitly configured installed browser/runtime paths and a vision provider. One explicit click performs an ordinary source metadata read, bounded official-player frame capture and the existing multimodal critique, returning actual source/time/hash provenance and a cited source card. No automatic generic description or corpus annotation is needed. Existing upload flow stays available. Worker deployments report the optional capability unavailable and never import Node browser code.

The Node service keeps at most two validated frame sets in memory, for at most ten minutes from capture. A random opaque session enables explicit follow-ups without another capture; sessions and raw frames are never persisted/exported. Server restart/expiry fails clearly; there is no silent recapture. One active source operation per server, 240s overall deadline, existing 45s/50MiB capture bounds and model timeout/correction policy. Cancellation propagates from Node HTTP disconnect through capture and model. Remote access requires the existing operator bearer token even when only browser resources would be used. All URLs, source identity, receipt hashes and payload shapes validate before expensive work. Invalid/expired/busy/barrier/model errors produce no fictional answer or cache entry. No direct media fetching, access challenge handling, login/profile import or browser installation.

The UI reuses the Video context for immediate follow-ups, showing a source-context label and original link. Browser workspace stores only the result and validated receipt/source references, never the session token or frame bytes. Reload preserves the analysis/citations; reviewing the source again explicitly creates new ephemeral context. Source analysis remains sampled still evidence with no source audio. Broader audiovisual/emergence fidelity stays open.

## Tasks

- [x] Red→green service validation, source/hash binding, bounded cache/expiry/eviction, concurrency and cancellation; optional native runtime configuration.
- [x] API auth/status/Worker-unavailable contracts; HTTP disconnect abort; existing vision signal support.
- [x] Existing details/composer/submit integration and saved receipt normalization, with meaningful browser/client checks.
- [x] Real built-app click→capture→vision→source citation→follow-up, actual held-out clip quality review, failures/reload/mobile checks; full suite/build and independent review.
- [ ] Publish verified public source and matching CI/archive/evidence. Keep goal active until all original requirements are met.

## Actual result

Two actual public-source critique/follow-up flows returned AI results. Final complete browser checks pass: source/time citations, same capture reused, source row/statistics unchanged, reload, no saved raw frames/token, mobile and no page errors. Morgan 20.648/6.861s; Ethan 15.757/10.933s. The initial Morgan harness expected structured times not yet preserved; the final flow verifies the added arrays. An initial wrong-cwd report error occurred before source/model calls. Ethan initially failed because camera view(s) phrases hit the metric guard; actual provider diagnostics isolated the false rejection, controlled replay and fresh browser verify the fix. Independent review found saved receipt inconsistency and camera/count exemptions; regressions added. One unedited Ethan section still confuses portafilter/pitcher, explicitly a remaining quality limit. No corpus annotation or positive emergence claim. 437 Node tests pass; publication evidence is finalized outside the repository only after exact-commit CI/archive checks.
