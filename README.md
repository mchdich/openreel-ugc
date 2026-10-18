# OpenReel

An independently written, open source recreation working toward full parity with Lightreel’s March 2026 launch demo: video critique, creator discovery, hooks, trends, and cited research.

![OpenReel research workspace](docs/screenshots/home.png)

**Full 1:1 parity remains open.** The normal local product corpus now serves **154,486 real records across 4,637 creator identities** through the API and browser. The separately verified hosted corpus contains **4,424 real records**. Real local speech/vision inference also works, with documented interpretation errors. Broad profile and critique quality, current trend evidence, complete visual-state verification and hosted AI remain open. See [the parity matrix](docs/PARITY.md) and [verification record](docs/VERIFICATION.md).

[Hosted snapshot; AI unconfigured](https://openreel-ugc-mchdich.red-boar-0376.chatgpt.site/) · [Source](https://github.com/mchdich/openreel-ugc) · [CI](https://github.com/mchdich/openreel-ugc/actions/workflows/ci.yml). The source includes saved-source continuity, bounded real-corpus pattern browsing, source-aware cover badges, public-player metadata collection and configurable local chat deadlines. Exact matching publication/deployment checks are recorded with each source release artifact.

The starter library is fictional. Free creator collection and deterministic library research work without paid credentials. Lightreel’s private index, application source, proprietary models, and demo media are not included.

**Baseline-preserving samples (1.16.0):** uploads retain every original temporal sample and add up to four measured visual states. Optional local public-source scanning uses the same selection, with exact source receipts and twelve-frame citations/reload. Two actual public-video reviews and their three-edit/three-opening-line follow-ups pass; all 24 JPEG hashes match directly inspected images. The coffee answer now recognizes extraction it previously missed.504 Node tests pass. Some prose still overstates sampled gaps; this is not continuous video interpretation. [Measured evidence](docs/DEMO_VERIFICATION.md#baseline-preserving-source-samples-1160).

**Current evidence and source errors (1.16.2):** named-clip questions no longer turn evidence instructions into search constraints; inline creator filters remain enforced. A post without playable geometry returns a clear source limitation before capture/model work. Four reviewed source annotations expand local visual coverage; an actual twelve-frame review/follow-up and reload/mobile checks pass, but a separate repeat failed validation and object errors remain.507 Node tests pass. [Actual results and failures](docs/DEMO_VERIFICATION.md#current-source-evidence-and-retrieval-boundaries-1162).

## Run locally

Use **Node.js 24 or newer**. There are zero runtime package dependencies; optional corpus storage uses Node’s built-in SQLite.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). The server binds to loopback by default. To check and package the source:

```sh
npm test
npm run build
```

The portable Worker entry point is `dist/server/index.js`. Building does not publish it. Node uses filesystem SQLite; the deployed Worker uses a migrated D1 database. They are separate stores; see [CORPUS.md](docs/CORPUS.md).

**Local demo fixes (1.5.1):** citation and writing directions no longer become search terms; hook comparisons keep all matching clips; follow-up briefs retain the topic and filters; creator bios and school evidence reach synthesis; current-week requests enforce dates. OpenAI GPT-5/6 request controls and a bounded vision correction attempt are supported. See [the actual demo test report](docs/DEMO_VERIFICATION.md). An OpenAI key alone does not provide broad TikTok discovery or a current trend index.

**Video sampling (1.5.2):** a bounded local scan now selects distinct visual states while retaining opening and closing coverage. An actual browser regression reproduced a one-second reveal missed by the previous fixed samples; the new samples captured it and the real model identified it. This remains sampled evidence, not continuous video analysis.

**Pattern browsing and layout (1.6.0):** the default Corpus Trends page selects records across formats and now displays seven real multi-creator groups with loaded source previews in the verified local store. Topic searches keep their normal constraints. The wide attached composer matches the measured launch component within 0.8px at the tested width; intermediate desktop sizes and mobile were checked separately. These results do not establish current emergence or full visual identity.

**Web-assisted discovery (1.7.0):** optional Live search can propose handles outside the seed index using one completed OpenAI web search, then independently verify public TikTok profiles. The actual browser found previously unindexed coffee creators. The verified 1.7.0 run returned three relevant coffee creators in 7.1 seconds and a compound NYU/contact match in 6.2 seconds, with loaded avatars. Topic checks reject an incidental caption as creator-niche evidence. This is bounded candidate discovery, not unrestricted TikTok keyword search or current-trend coverage.

**Discovery resilience (1.7.1):** capitalized topics such as “Find Coffee creators” retain their topic meaning. Known school requests and existing SQLite/D1 keys remain compatible. A failed official-profile batch stops further profile requests while preserving confirmed matches with a visible partial-results notice; no confirmed matches still yields an error. The actual browser repeat returned the same three coffee creators in 8.2 seconds and the NYU/contact match in 7.4 seconds despite one failed profile check in each flow. All avatars loaded and partial coverage was explicitly shown.

**Specific visual patterns (1.8.0):** Trends → Corpus → **Detect visual patterns** proposes shared combinations of framing, objects and actions from a separate bounded description sample. Every retained member must match each accepted component; card wording and exact excerpts come from a composable 19-feature catalog. The detector uses up to two model calls sharing one 45-second deadline and never writes inferred formats into the corpus. Ordinary browsing/typing makes no detection call; same-query toggles reuse the in-memory result. This is attributed-description research, not direct footage inspection, open-ended visual recognition or evidence of current emergence. See [the actual browser verification](docs/DEMO_VERIFICATION.md).

**Dated public-post imports (1.9.0):** opt in with `OPENREEL_POST_METADATA=true` to import an actual posting timestamp and available engagement counts from one ordinary canonical public TikTok page. The real browser import returned a matching public post in 0.85 seconds, loaded its cover/avatar and survived reload. Default configuration retains official oEmbed. No raw video, transcript or visual description is acquired; missing dates/counts stay unknown. This supplies dated records without establishing current trend coverage.

**Compound topic evidence (1.15.2):** Live creator filtering can combine a topic term explicitly stated in a public bio with another term recurring in the selected posts. Every term still requires explicit profile evidence or recurring posts, and exact profile/contact filters remain intact. Actual latte-art and strength-training browser flows pass. [Measured outcomes](docs/DEMO_VERIFICATION.md#compound-topic-evidence-across-profiles-and-recurring-posts-1152).

**Research recovery (1.15.1):** a completed invalid AI reply gets one correction under the same deadline, with all source/contact validation preserved. An actual browser run rejected an invented handle derived from a numeric creator ID, corrected it and completed the cooking answer in 7.981s. Outages remain single-call failures. [Actual outcomes and limits](docs/DEMO_VERIFICATION.md#bounded-research-reply-correction-1151).

**Complete dated cohorts (1.15.0):** local Corpus → Deep research now compares every matching dated record under one SQLite statement snapshot, with bounded representative citations. The real 21,998-record historical query matches the independent full-cohort proof; current sparse evidence stays inconclusive. Normal/Worker samples remain explicitly bounded. [Actual browser evidence](docs/DEMO_VERIFICATION.md#complete-local-dated-cohorts-1150).

**Direct vision quality (1.14.1):** fixes valid comparison, cause-limitation and rounded-duration responses being rejected, while preserving numeric/source-time checks. The configured local demo now uses GPT-5.4 vision after actual source comparisons and built-app tests; the experimental extra frame-description stage was not shipped. Natural-video interpretation still has documented limits. [Actual outcomes](docs/DEMO_VERIFICATION.md#direct-vision-quality-and-natural-response-validation-1141).

**Public-source opening speech (1.14.0):** optional `OPENREEL_SOURCE_AUDIO=true` adds up to 30 seconds of actual ordinary-player audio to **Review video**. One transcription supplies unverified opening words to the vision critique; immediate follow-ups reuse the same frames and transcript. Saved answers retain the source interval and transcript, with no WAVs, JPEGs or session token. Later audio, exact word timing and raw acoustics remain unverified. [Configuration and scope](docs/CORPUS.md#in-app-public-source-review) · [actual verification](docs/DEMO_VERIFICATION.md#public-source-opening-speech-1140).

**Source-critique reliability (1.13.1):** fixes ordinary visual/script language rejected as metrics or heard speech, scopes limitations so they cannot excuse performance guarantees, and waits for bounded owned-browser cleanup. The final actual source review and “200 views” follow-up returned AI results in 16.285s and 8.350s, one provider call each; reload, citations and mobile checks passed. Natural-video factual/continuous interpretation remains imperfect. [Actual outcomes and failures](docs/DEMO_VERIFICATION.md#source-critique-validation-and-browser-lifecycle-1131).

**In-app public-video review (1.13.0):** with an explicitly configured local browser runtime, open a source record and choose **Review video**. The app captures actual player frames, runs multimodal critique and supports immediate follow-ups from the same temporary capture. Two real coffee-video flows returned source-linked critiques and editing suggestions; the final full browser run passed reload/citation/mobile checks. A camera-word validation bug is fixed. One unedited critique still confused a portafilter with a pitcher, so factual accuracy and continuous/audio coverage remain open. [Setup and limits](docs/CORPUS.md#in-app-public-source-review) · [actual tests and failed cases](docs/DEMO_VERIFICATION.md#in-app-public-video-review-1130).

**Sampled source visuals (1.12.0):** an optional local browser collector acquires up to eight clean decoded frames from a known public source and makes one vision-description call. Reviewed field deltas add separate visual provenance without changing existing transcripts, dates, metrics, licenses or counts. Three actual descriptions from two creators entered the local corpus; two needed explicit corrections after frame review. The app returned source-linked analysis and a follow-up brief in 4.17 and 3.40 seconds. This does not establish representative automated visual accuracy or current emergence. [Collection and review workflow](docs/CORPUS.md#optional-public-source-frame-descriptions) · [actual evidence and failures](docs/DEMO_VERIFICATION.md#sampled-public-source-visuals-1120).

**Incremental acquisition and reliable synthesis (1.11.0):** repeated requests prioritize confirmed posts without a verified primary date and retain every already inspected post in the index, including posts beyond a creator-deduplicated result. Actual known-profile searches gained six dates, then four, while displaying one creator each. Normal acquisition limits stay unchanged. A real-provider failure caused by punctuation after a supplied handle is fixed; unknown contact prefixes still reject. Unverified replies and provider outages have distinct notices, and deterministic answers retain the source used for that turn. The final default Live browser returned AI synthesis for four actual coffee creators with an explicit partial-profile notice. [Measured outcomes and remaining limits](docs/DEMO_VERIFICATION.md).

**Dated Live research (1.10.0):** the existing post-metadata opt-in now enriches Live and known-creator collection with up to six selected canonical post reads. Actual browser Live research returned current-week coffee posts from three creators; a compound NYU/follower/public-email request cited an October 14 post. Date comparison preserves all matching videos across creators and reports insufficient growth evidence honestly. Known primary posting dates survive a later date-less refresh with their original citation; fresh counts/profile fields replace old snapshots. Full current-emergence and audiovisual-pattern coverage remain open.

## Research flows

- **Library:** research imported records or the labeled fictional examples. Creator filters combine topic, school/location, follower bounds, counts, public contacts, and email-in-bio requirements. Unknown metrics cannot satisfy numeric filters.
- **Collect creator:** enter a known public TikTok handle in Library or Settings & data. The official public creator embed supplies its available video selection, public bio, followers, and views without a paid API. This is a bounded profile snapshot, not arbitrary keyword search or the creator’s complete history.
- **Import URL:** fetch a direct public TikTok video’s caption, author and thumbnail through official oEmbed. Short links are rejected. Missing metrics remain unavailable; captions are not transcripts.
- **Video:** attach or drop a supported file up to 50 MiB and ten minutes. The browser scans at most 128 tiny frames locally, then prepares up to twelve timestamped JPEGs: every original opening/closing/temporal sample plus up to four separated measured visual states. Scan descriptors stay in the browser. When transcription is configured, it also extracts mono audio locally and transcribes it when you send. A manual transcript takes precedence. The configured vision model receives samples and unverified transcript text.
- **Video follow-ups:** successful analysis retains the video’s frame context in memory for at most two chats. Choose Video to reuse it. Reload or eviction requires reattachment. Explicit Library, Corpus, or Live search selection does not silently reuse retained frames.
- **Corpus:** when server storage is configured, research a bounded retrieved subset of its real records. Global corpus counts remain separate from records examined in an answer.
- **Live search:** optional `OPENREEL_WEB_DISCOVERY=true` uses the existing server OpenAI key to propose up to three candidate handles and refresh up to three indexed profiles. All returned records come from independent official public-profile checks; model-proposed metrics, contacts and dates never become records. The final actual browser returned three coffee creators and one NYU creator meeting the follower/contact filters. No-key mode refreshes only indexed profiles. Configured Apify takes precedence and supports bounded keyword discovery: up to 15 records in Normal or 30 in Deep. Hosted acquisition and paid end-to-end Apify discovery remain unverified.
- **Sources and trends:** Trends offers explicit Corpus and Library sources. A configured corpus is the default; an explicit Library choice survives reload. Default corpus browsing selects up to 100 real records for coverage across formats; topic searches retain their normal filters. Sample metrics stay separate from global totals, with cancellation and retry. Available supplied covers represent distinct creators. Open canonical TikTok links or official numeric-ID players. Pattern groups require at least two distinct creator identities and use supplied format labels or explicit phrases in attributed visual descriptions. Groups retain exact evidence excerpts and posting-date coverage; upstream AI descriptions and archival patterns do not establish current emergence.
- **Dated format momentum (1.3.0):** ask Library or Corpus, “What skincare formats are gaining share as of 2024-07-21 over 7 days?” The deterministic answer compares adjacent supplied posting-date windows and reports clip/creator counts, sample shares, and actual representative sources. Without an as-of date it uses today’s UTC calendar date; the default window is seven days, with an explicit 1–90-day range. Corpus retrieves each dated window separately: at most 125 records per window in Normal or 500 per window in Deep (250/1,000 total). Topic/profile filters precede each limit; relevance/ID ordering is not random or representative sampling. These bounded samples and a separate full historical cohort are [documented separately](docs/RESEARCH_DATA.md#historical-format-share-comparison); neither establishes what is emerging today across TikTok.
- **Workspace:** composer cover previews use the selected source and latest applicable answer; unavailable imagery stays neutral. Pattern research uses the displayed pattern’s source. Browser-local chats retain their selected Corpus, Library or Live source across reload and history navigation. Cancelling or clearing an attachment restores the prior source; video frames remain in memory only. Cited clips stay beside findings, while additional matching records remain available in an expandable list. Bookmarks, imports/exports and saved alerts are available. Alerts check the library while the app is open; there is no background email/push service.

Public-bio school/location matches are self-description evidence, not independently verified enrollment or residence. Ambiguous prose, caption mentions, negation and conflicting bio labels do not establish those fields. See [DATA.md](docs/DATA.md).

## Persistent corpus

```sh
node scripts/corpus.js init --db data/corpus.sqlite
node scripts/corpus.js collect-profiles handles.txt --db data/corpus.sqlite
node scripts/corpus.js stats --db data/corpus.sqlite
```

`handles.txt` contains one known public handle per line. Collection is sequential, deduplicated, and makes one request per handle without automatic retries. To expose that local database in the app, set `OPENREEL_CORPUS_PATH=data/corpus.sqlite` before starting Node.

An optional [public-player collector](docs/CORPUS.md#optional-public-player-metadata-collection) resolves public handles, links, covers and avatars for explicitly supplied post IDs. It uses a separately installed browser, emits evidence for review, and applies a bounded metadata delta to an existing local corpus. The transactional merge preserves archival text, dates, metrics, licenses and ingestion verification. Four actual cited records were merged and displayed with loaded covers/avatars; the unavailable fifth remained unknown. Acquired reports and creator media are excluded from the source release.

The normal local database at `data/research-nc.sqlite` now contains **154,462 real records, 4,627 creator identities and 300 provider-observed records**, with zero example, synthetic or unverified rows. It combines the 150,000-record [optional research archive](docs/RESEARCH_DATA.md), 4,162 publisher-declared MIT archival records and 300 independently observed public-profile/video records. Actual Deep API queries returned cited skincare, cooking and unboxing records; a native Windows browser displayed, bookmarked and restored an actual numeric-ID source after reload. Use `OPENREEL_CORPUS_PATH=data/research-nc.sqlite npm start` with that acquired database. Databases and acquired data are excluded from the source release.

The smaller hosted D1 snapshot at **2026-10-17T21:30:57.284Z** contained **4,424 real records**: the 4,162 archival plus 262 fresh records, with zero examples or synthetic rows. Hosted NYU and UCLA searches combining followers and email in bio returned one and two creators; UCLA evidence includes explicit alum/alumna descriptions. That cloud import remains `user-supplied` with `providerObservedReal: 0`; it is distinct from the full local store and its provenance counts.

The 150,000-record research portion retains its **CC-BY-NC-4.0** data license, original observation dates and upstream ASR/model-description labels. Its application import is verified; that does not make the archival material current or freshly analyzed by OpenReel. The separate 150,000-row **synthetic** benchmark remains capacity evidence only. MIT code does not relicense imported data. [CORPUS.md](docs/CORPUS.md) documents the stores and boundaries.

## Optional model providers

Set server environment variables or a local `.env`, then restart. Provider keys never belong in browser code or imported records. [LOCAL_MODELS.md](docs/LOCAL_MODELS.md) gives manual setup for the actual free CPU vision/speech models used in verification.

```sh
OPENAI_API_KEY='your-provider-key' \
OPENAI_BASE_URL='https://api.openai.com/v1' \
OPENAI_MODEL='your-text-model' \
OPENAI_VISION_MODEL='your-vision-capable-model' \
OPENAI_TRANSCRIPTION_MODEL='your-transcription-model' \
npm start
```

Vision requires multiple `image_url` inputs and **strict JSON Schema** structured output by default. Set `OPENAI_VISION_RESPONSE_FORMAT=json_object` only for a compatible legacy provider; local response validation still applies. `OPENAI_VISION_MODEL` falls back to an explicitly configured `OPENAI_MODEL`. Speech requires an explicit transcription model and multipart `/audio/transcriptions` support. `OPENAI_TRANSCRIPTION_BASE_URL` can point to a separate speech server; otherwise it uses `OPENAI_BASE_URL`.

Missing or invalid providers produce explicit errors, with no simulated audiovisual analysis. A local speech model recognizes words; the vision model receives those words as unverified text. Neither this path nor eight stills establishes music, acoustic delivery, continuous motion, or causes of social performance.

| Variable | Purpose |
| --- | --- |
| `HOST`, `PORT` | Listen address/port; defaults `127.0.0.1:3000`. |
| `OPENREEL_PUBLIC_ORIGIN` | Exact public origin behind a TLS proxy; preserves origin/auth checks. |
| `OPENREEL_CORPUS_PATH` | Optional local Node SQLite database path. |
| `OPENAI_API_KEY` | Server-side model credential; local no-auth models can use a local placeholder. |
| `OPENAI_BASE_URL` | Chat/vision base; default `https://api.openai.com/v1`. |
| `OPENAI_MODEL` | Text model; text synthesis defaults to `gpt-4.1-mini`. |
| `OPENREEL_CHAT_TIMEOUT_MS` | Text synthesis deadline; default 25,000 ms, configurable from 10,000–180,000. The browser uses the validated public budget. |
| `OPENAI_VISION_MODEL` | Vision model; falls back to an explicitly configured text model. |
| `OPENAI_VISION_REASONING_EFFORT` | `low`, `medium` (default) or `high` for reasoning-model vision requests; legacy request controls stay unchanged. |
| `OPENAI_VISION_RESPONSE_FORMAT` | `json_schema` by default; optional legacy `json_object`. |
| `OPENREEL_VISION_TIMEOUT_MS` | Vision deadline; default 45,000 ms, configurable from 10,000–180,000 for slower providers. |
| `OPENAI_TRANSCRIPTION_MODEL` | Explicit speech model; no text/vision-model fallback. |
| `OPENAI_TRANSCRIPTION_BASE_URL` | Optional speech base URL; falls back to `OPENAI_BASE_URL`. |
| `OPENREEL_PLAYWRIGHT_MODULE`, `OPENREEL_BROWSER_PATH` | Optional absolute installed runtime/executable paths for explicit Node source review. |
| `OPENREEL_SOURCE_AUDIO` | Opt in with `true` to sample up to 30 opening source seconds before frame seeks; requires the source browser and a configured transcription model. |
| `OPENREEL_WEB_DISCOVERY`, `OPENAI_DISCOVERY_MODEL` | Opt in with `true`; requires Responses `web_search` and strict JSON output. Discovery model falls back to `OPENAI_MODEL`, then `gpt-5.4-mini`. |
| `APIFY_API_TOKEN`, `APIFY_ACTOR_ID` | Optional paid discovery; Actor defaults to `clockworks~tiktok-scraper`. |
| `OPENREEL_API_TOKEN` | Shared access token required for public configured model/discovery requests. |

Web-assisted discovery is disabled by default. It makes one provider request with `max_tool_calls:1`, at most 2,200 output tokens, a 25-second deadline and a 128 KiB reply cap. At most six official profile GETs run in groups of three; the output is capped at 30 actual videos. There are no automatic retries. One unfinished tool entry can occur after the provider limit; only the single completed search supplies source context. This is a request bound, not a dollar-price guarantee. Web pages are global model context, not verified handle-to-page attributions. Profile 404s are counted and skipped; a failed batch stops further profile requests. Independently confirmed matches can be returned with explicit partial-coverage fields and a visible notice; without confirmed matches the original error remains. Creator-topic eligibility requires identity text or at least two matching distinct selected posts comprising half the available selection; it is a relevance heuristic, not a complete creator classification.

Apify requests have a requested maximum charge of **$0.25**, at most 30 results, a 40-second Actor timeout and a 45-second client deadline. Downloads, transcription/AI add-ons and automatic retries are disabled. A timeout can leave a charged run; inspect it before retrying. Contract tests do not prove billing or paid discovery quality.

For public provider requests, configure `OPENREEL_API_TOKEN` and enter it in Settings & data → Server access token. It stays in memory for the tab and is distinct from provider keys. Use HTTPS and hosting access controls; the shared token is not an account system. See [SECURITY.md](SECURITY.md).

## Data and privacy

Library records, chats, bookmarks and alerts use browser `localStorage`. Optional SQLite/D1 records stay in the configured server database. Local files are read in the browser. Raw video files are not uploaded; sending analysis can transmit sampled JPEGs and extracted WAV chunks through your server to configured providers. Transcription text, questions, metadata and sampled frames then support the vision request.

JPEGs, WAV payloads and retained video context stay out of saved chats/exports; frame context remains in memory until eviction/reload. Textual model answers and evidence metadata can persist. `videoAnalysis.audioAvailable:false` means the vision model did not receive raw acoustics; it does not mean the separate speech recognizer never processed audio. `transcriptProvided` records whether text was supplied to vision.

Direct/creator imports and inline playback contact TikTok. Live acquisition contacts TikTok for profile checks, OpenAI web search when enabled, or Apify when configured. Thumbnails/source links contact their hosts. Providers and infrastructure can retain submitted requests according to their policies. Browser storage is origin/profile-specific and does not sync devices; export what you need to keep. The verified public deployment has no hosted AI credentials configured.

## Docker and references

```sh
docker build -t openreel .
docker run --rm -p 127.0.0.1:3000:3000 openreel
```

The Node 24 image listens on `0.0.0.0` inside the container and ships without provider credentials. Pass secrets at runtime; persist a configured corpus with an explicit volume. A Docker build has not been verified in this environment.

The primary reference is Jibran Khalil’s [March 16, 2026 launch post](https://x.com/Jibran_05/status/2033589137018917027). The later [website](https://lightreel.ai/) and [API documentation](https://lightreel.ai/docs) were inspected October 17, 2026. This project is independent and unaffiliated. Its [MIT license](LICENSE) covers original code and fictional fixtures. [Inter](public/InterVariable.woff2) uses the separate [SIL Open Font License](docs/INTER-LICENSE.txt). Imported data, embedded media and optional model weights retain their own rights and licenses; model weights and demo media are not bundled.

See [CONTRIBUTING.md](CONTRIBUTING.md), [DATA.md](docs/DATA.md), [CORPUS.md](docs/CORPUS.md), [RESEARCH_DATA.md](docs/RESEARCH_DATA.md), [LOCAL_MODELS.md](docs/LOCAL_MODELS.md), [PARITY.md](docs/PARITY.md), and [VERIFICATION.md](docs/VERIFICATION.md).


`OPENREEL_SOURCE_SCAN=true` optionally applies the same baseline-preserving scan to local public-source reviews. It scans at most 128 tiny frames inside the ordinary player, retains all eight fixed samples and adds up to four separated visually different states. Only selected JPEGs reach the provider; descriptors are discarded. This option uses the existing 60-second capture maximum to accommodate opening audio and scanning. The 50 MiB network / 1280 KiB aggregate JPEG / 240-second review limits remain unchanged. Default source collection remains fixed-eight. More samples improve coverage but do not verify continuous pacing or guarantee correct object/action interpretation.
