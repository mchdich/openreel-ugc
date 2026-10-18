# Local demo verification — 1.7.1

Verified October 18, 2026, against the real local Node app at http://127.0.0.1:3000 with an OpenAI API key stored only in ignored server configuration. Text and vision use GPT-5.4 mini; transcription uses whisper-1. No provider responses were substituted in the browser acceptance runs.

The tested research, writing, creator-filter and upload paths work. **Full equivalence to the original advert is not established.** Web-assisted candidates can now reach outside the seed index, with independently checked official profile facts. Unrestricted discovery, representative coverage and current emerging-trend evidence remain open. The separately hosted site still runs 1.5.0 and has no provider key; these results concern the local app.

## Repeat the demo

1. Start a new chat with Corpus selected. Ask: **Analyze cooking hooks across creators. Cite five source videos and suggest three openings for a 20-second recipe video.** The tested answer returned AI synthesis from 243 matching videos, cited distinct creators, and proposed three original openings in 6.4 seconds.
2. Click **Make a brief**. The tested follow-up kept the cooking sources and returned hook options and a 20-second shot list in 6.7 seconds.
3. Start another Corpus chat: **Find UCLA creators with at least 1,000 followers and email in bio**. Two profiles matched; both included public-bio school self-descriptions and email evidence. This includes alumni descriptions and does not verify current enrollment.
4. Attach a video and ask: **Why did my video only get 200 views? Give me three concrete changes and a stronger opening.** The browser extracts up to eight sampled frames and available audio. The model can suggest edits; it cannot establish why a reported metric occurred. Actual upload and natural-footage results are recorded below.
5. Choose Live search and ask: **Find coffee creators**. With optional web discovery enabled locally, the final actual flow returned @jameshoffmanncoffee, @morgandrinkscoffee and @ryantagcoffee in 7.1 seconds. Start another Live chat: **Find NYU creators with at least 1,500 followers and public emails**. It returned @lizzie.crane with 3,858 observed followers and a public-bio email in 6.2 seconds. Both discovery/chat endpoints returned HTTP 200, all four table avatars loaded and the latest result survived reload. Coverage is a bounded set of checked profiles, not all TikTok.
6. Open **Trends → Corpus**. The verified default browse now displays seven recurring formats with real source previews. Open a card to inspect its records, provenance and dates; these examples are archival, not emerging trends today.

## Web-assisted creator discovery (1.7.0)

Before acquisition, native read-only corpus checks found zero rows for @morgandrinkscoffee and @jameshoffmanncoffee by either handle or numeric creator ID. The first actual browser Live query obtained model proposals using OpenAI web-search context, independently fetched official TikTok embeds, applied the query and persisted actual matching records. Across the two first flows the corpus increased from 154,424 real records / 4,621 creator identities / 262 provider-observed records to 154,428 / 4,624 / 266. These are four additional videos and three identities, not every video from six checked profiles. No examples, synthetic rows or unverified records entered the store.

The initial coffee run included an irrelevant pet account based on one coffee caption. The fixed fresh creator filter requires all remaining topic terms in handle/bio/niche, or in at least two distinct posts comprising half of that profile's selected sample. Ordinary topic-video searches still find individual matching clips. This is a conservative sample heuristic, not an exhaustive niche classifier. Actual final coffee results excluded the pet account and incidental college-event match. Missing followers or caption-only contacts still fail their corresponding profile requirements.

A real repeat also exposed a Responses detail: an overall completed reply can retain an unfinished search item after `max_tool_calls:1`. The implementation now accepts exactly one completed search and ignores unfinished tool entries as evidence; two completed searches or an incomplete overall response reject. The regression proves unfinished source URLs cannot authorize candidates. A separate review found that a proposed source URL's presence in a search trace does not verify its association with a handle. Returned `webSearchSources` are global proposal context only; verified identity/profile/video facts come from official embeds. No handle-to-page attribution is emitted.

The final actual coffee discovery took 4.355 seconds; discovery plus synthesis took 7.099 seconds and rendered three creators with three loaded avatars. NYU discovery took 4.504 seconds; its final answer took 6.150 seconds and rendered one matching creator/avatar. Both API pairs returned HTTP 200. Reload retained the NYU table; no page errors, saved provider-key patterns or 390px horizontal overflow occurred. Later refreshes left corpus counts unchanged. Provider replies were captured transparently for diagnosis; none were replaced in these browser flows.

Web discovery is explicit server opt-in, using the existing local key. One Responses request, a 25-second provider deadline, strict structured output and a 128 KiB response cap bound the model phase. At most three indexed plus three proposed profiles are checked, with at most three concurrent official GETs; output is capped at 30 actual records. Explicit profile 404s are counted and skipped. In 1.7.1 a failed batch stops further profile acquisition and preserves only independently confirmed matches with a visible partial-results notice; no confirmed matches still yields the original error. Public paid requests retain bearer/origin checks. There is no automatic retry or stale-result substitution. Generated Worker/D1 tests exercise the same path with controlled transport fixtures; those fixtures prove behavior, not actual discovery quality.

## Capitalized topics and upstream partial results (1.7.1)

A regression reproduced “Find Coffee creators” being parsed as an unknown university solely because Coffee was capitalized. Capitalization now carries no institution meaning. Explicit institution phrases, actual loaded school fields and existing NYU/UCLA aliases retain their behavior; a conservative request-name list preserves earlier bare Harvard/Stanford/Princeton/Yale/MIT constraints without changing stored keys or canonicalization. SQLite and generated Worker/D1 regressions verify full institution names and content-topic searches. This is not a general institution recognizer.

The capitalized actual browser repeat initially failed when one official public profile returned an upstream error. That previously discarded independently confirmed matches from the other requests. The updated adapter settles the current bounded batch, stops before any later profile batch, and returns only fresh confirmed matches with `incomplete:true`, `profilesFailed` and a visible partial-results notice. With no confirmed matches it propagates the original failure. It performs no retry, stale-record substitution or access-barrier workaround. A proposed-profile batch is never started after an indexed-profile batch fails.

The final actual “Find Coffee creators” flow returned @jameshoffmanncoffee, @morgandrinkscoffee and @ryantagcoffee in 8.174 seconds; it checked four profiles and explicitly reported one failed check. The NYU/follower/public-email flow returned @lizzie.crane in 7.415 seconds, checked six profiles and explicitly reported one failure. Both discovery/chat pairs returned HTTP 200. Three coffee avatars and the NYU avatar loaded; both answers displayed “Partial results”. Reload, no saved key patterns, no page errors and no 390px horizontal overflow passed. Counts remained 154,428 records / 4,624 creator identities / 266 provider-observed. These partial acquisitions do not claim all proposed profiles were available or checked successfully.

## Format coverage and measured layout (1.6.0)

The previous default browse used the first 100 records in index order and exposed one eligible group. The new read-only sampler considers at most 310 candidates: a general 100-record page and up to 30 distinct creators for each of seven format queries. Existing evidence rules still require two creator identities and a supplied format label or explicit attributed description. Two creator anchors per eligible group precede a bounded fill to at most 100 unique records. Nonempty topic queries keep the ordinary search and all parsed filters. No formats are written into corpus records.

The actual browser request returned 86 real records from 309 unique candidates in 1.964 seconds. It rendered seven groups: Before / after, Product review, Day in the life, Unboxing, Step-by-step tutorial, Product demonstration and Get ready with me. All 20 supplied fan images loaded; the last group has two creators and therefore two images. No fictional records, response substitutes or generated thumbnails entered that run. The visible note identifies purposeful format coverage and archival dates. Sample shares, averages and group counts are not corpus-wide estimates or current rankings.

Sixteen ordinary public-player navigations resolved 15 post identities, covers and author-linked avatars for those actual records. One unavailable post remained unchanged. The metadata-only merge preserved all protected JSON/SQL fields, corpus statistics, archival text, dates, metrics, verification and licenses; native SQLite hash checks passed. These signed source URLs may expire and external posts may become unavailable.

The attached wide composer was measured against the launch frame's 1330 × 538 component at a normalized 762px width. Its final height is 308.641px versus 308.238px in the measured reference. Preview, avatar, badge and submit offsets/sizes differ by at most 0.753px. This is measured geometry, not pixel identity: original/user imagery, controls, text and branding differ. The activity badge counts successfully reviewed attachments. At viewport widths 761, 770, 820, 1000 and 1512, both attached and unattached states with Deep selected keep Submit inside the border. The tested 390px layout has no page overflow; attachment removal restores its action. No page errors occurred.

Independent review found and reproduced a day-in-the-life query parsing error and a narrow-desktop badge overflow. Both were fixed and rechecked. The generated Worker/D1 route test also retrieves actual SQLite fixture records without request-side writes; fixtures prove behavior, not corpus coverage.

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

- Node: 339 tests passed, zero failures, including web discovery, relevance/compound filters, error boundaries, format coverage, selection provenance and generated Worker/D1 retrieval.
- Python: 17 passed, one optional test skipped.
- Portable Worker build completed; publication of this revision to Sites was not requested.
- The complete browser upload test returned HTTP 200 for transcription and both vision turns. Its first answer arrived about 20.2 seconds after file attachment started.
- The actual natural-footage request used eight source frames from a 26.6-second video, returned one visual observation and three editing suggestions through the normal app API with HTTP 200 in 15.8 seconds. No transcript was provided for that sample.
- Earlier natural-footage failures were retained in the local audit. Passing these final examples does not certify arbitrary clips or continuous-video interpretation.
- Independent review findings were reproduced, fixed and rechecked; its final bounded review had no outstanding findings.

## Remaining limits

A current-week cooking-trend request found no dated records in its comparison windows. The app now reports that gap instead of calling 2024 examples current. The recurring-pattern browser describes its bounded archival sample and is not proof of an emerging trend today.

Earlier TikTok-only web searches returned topic/channel pages without verifiable individual post links or October 2026 dates. The later unrestricted web-context path finds candidate handles and independently verifies official profiles, as recorded above. It still does not establish unrestricted TikTok search, complete creator coverage or current posting dates. A larger continuously refreshed dated index or functioning keyword provider is still needed for the original broad-search and early-trend claims.

A further UCLA/contact profile-search probe returned no usable public profile or post URLs. Official public creator embeds returned fresh selected videos and metrics but no posting-date field. These checks do not close current-date or unrestricted discovery coverage.

Uploaded video analysis uses sampled stills plus an optional machine transcript. It does not process continuous footage or provide raw acoustics to the vision model. New editing advice is a proposal, not a demonstrated performance improvement.
