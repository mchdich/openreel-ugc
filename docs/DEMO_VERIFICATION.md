# Local demo verification — 1.5.2

Verified October 18, 2026, against the real local Node app at http://127.0.0.1:3000 with an OpenAI API key stored only in ignored server configuration. Text and vision use GPT-5.4 mini; transcription uses whisper-1. No provider responses were substituted in the browser acceptance runs.

The tested research, writing, creator-filter and upload paths work. **Full equivalence to the original advert is not established.** Broad new-creator discovery and current emerging-trend coverage remain missing data capabilities. The separately hosted site still runs 1.5.0 and has no provider key; these results concern the local app.

## Repeat the demo

1. Start a new chat with Corpus selected. Ask: **Analyze cooking hooks across creators. Cite five source videos and suggest three openings for a 20-second recipe video.** The tested answer returned AI synthesis from 243 matching videos, cited distinct creators, and proposed three original openings in 6.4 seconds.
2. Click **Make a brief**. The tested follow-up kept the cooking sources and returned hook options and a 20-second shot list in 6.7 seconds.
3. Start another Corpus chat: **Find UCLA creators with at least 1,000 followers and email in bio**. Two profiles matched; both included public-bio school self-descriptions and email evidence. This includes alumni descriptions and does not verify current enrollment.
4. Attach a video and ask: **Why did my video only get 200 views? Give me three concrete changes and a stronger opening.** The browser extracts up to eight sampled frames and available audio. The model can suggest edits; it cannot establish why a reported metric occurred. Actual upload and natural-footage results are recorded below.
5. Choose Live search and ask: **Find NYU creators with at least 1,500 followers and public emails**. The actual discovery and chat endpoints both returned HTTP 200; the flow refreshed three known public profiles and returned one matching creator in 3.8 seconds. Coverage is limited to creators selected from the seed index.

## Browser and provider evidence

- Original failure reproduced: the full cooking prompt returned zero creators instead of hook research. Writing instructions had become strict search terms, and the word creators selected the wrong result type.
- Fixed: output instructions stay with synthesis; source retrieval keeps the topic and constraints. Corpus video research retains multiple clips by the same creator.
- Fixed: implicit writing follow-ups retain the research topic; explicit new topics replace it; a dated trend follow-up can produce a brief without losing the date bounds.
- Fixed: trailing email constraints survive citation cleanup. Creator bio, school, location, posting dates and profile provenance reach the provider rather than disappearing before synthesis.
- Source previews: available supplied media can enter the bounded synthesis context. Missing media stays missing; no generated thumbnails stand in for creators.
- Playback: a real cited TikTok player reached readyState 4 and advanced by about 1.46 seconds. Another older post returned Video currently unavailable. The playable embed also emitted an external media-source error during initialization; playback subsequently succeeded. The app cannot guarantee availability of third-party posts.
- Bookmarks survived reload. The tested 390 × 844 layout had no horizontal overflow.
- Vision: camera framing such as package view at a timestamp is distinguished from claimed social views. Actual metric assertions and unobserved timestamps still reject. An invalid model narrative gets at most one correction attempt within the original deadline; a second invalid answer remains an error.

## Adaptive video sampling (1.5.2)

The old eight fixed timestamps missed a one-second visual change at 4–5 seconds in a generated 12.1-second test clip. The updated browser flow inspects at most 128 tiny frames locally and selects up to eight JPEGs, preserving the opening and ending. Distinct visual states fill the remaining slots before temporal coverage. Descriptors are never sent to the provider or saved in the attachment.

The actual decoded JPEGs now include the green product-reveal card at 4.332 seconds. The app's real `/api/video/analyze` request sent that selected frame, returned HTTP 200 in 3.9 seconds, and identified the blue-to-green-to-blue change. No frame data persisted in browser storage; no page errors occurred. This generated fixture is regression evidence, not real creator footage or corpus coverage. The natural-footage inference recorded below remains a separate check.

The repeatable browser script generates its own fixture and makes no AI calls. With the local app running and Playwright/Chromium already installed:

```sh
node scripts/verify-video-sampling.js \
  --playwright-module /absolute/path/to/playwright \
  --browser-path /absolute/path/to/chrome \
  --base-url http://127.0.0.1:3000
```

The actual repeat run selected the reveal at 4.337 seconds, emitted eight JPEGs, completed inspection/verification in 101 ms on this small fixture, and passed cancellation and progress bounds. Timing depends on clip and device. RGB novelty is not semantic recognition; the scan and output caps can still miss brief states, motion, cuts or pacing.

The final speech-bearing upload repeat returned HTTP 200 for transcription, critique and its shot-list follow-up, with the first answer arriving in 23.0 seconds from attachment start and no page errors. Its advice also inferred slow pacing from similar stills; that inference does not establish intervening cuts or continuous timing. This remains an open critique-quality limit despite the successful transport and follow-up checks.

## Final checks

- Node: 309 tests passed, zero failures, including four new visual-selection regressions.
- Python: 17 passed, one optional test skipped.
- Portable Worker build completed; publication of this revision to Sites was not requested.
- The complete browser upload test returned HTTP 200 for transcription and both vision turns. Its first answer arrived about 20.2 seconds after file attachment started.
- The actual natural-footage request used eight source frames from a 26.6-second video, returned one visual observation and three editing suggestions through the normal app API with HTTP 200 in 15.8 seconds. No transcript was provided for that sample.
- Earlier natural-footage failures were retained in the local audit. Passing these final examples does not certify arbitrary clips or continuous-video interpretation.
- Independent review findings were reproduced, fixed and rechecked; its final bounded review had no outstanding findings.

## Remaining limits

A current-week cooking-trend request found no dated records in its comparison windows. The app now reports that gap instead of calling 2024 examples current. The recurring-pattern browser describes its bounded archival sample and is not proof of an emerging trend today.

An actual OpenAI web-search probe returned TikTok topic/channel pages without verifiable individual post links or October 2026 dates. That probe was not integrated or presented as broad discovery. A larger continuously refreshed index or a functioning discovery provider is still needed for the original broad-search and early-trend claims.

A further UCLA/contact profile-search probe returned no usable public profile or post URLs. Official public creator embeds returned fresh selected videos and metrics but no posting-date field. These checks do not close current-date or unrestricted discovery coverage.

Uploaded video analysis uses sampled stills plus an optional machine transcript. It does not process continuous footage or provide raw acoustics to the vision model. New editing advice is a proposal, not a demonstrated performance improvement.
