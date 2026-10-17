# OpenReel

An independently written, open source recreation working toward full parity with Lightreel’s March 2026 launch demo: video critique, creator discovery, hooks, trends, and cited research.

![OpenReel research workspace](docs/screenshots/home.png)

**Full 1:1 parity remains open.** The current implementation has real public TikTok imports and creator collection, local video/audio preparation, configurable vision and speech models, and persistent SQLite research. A real browser run successfully combined local speech recognition and eight-frame vision analysis. The required independently acquired 150,000+ real-video corpus, broad transcript/profile coverage, complete visual-state verification, and hosted AI deployment still need evidence. See [the parity matrix](docs/PARITY.md) and [verification record](docs/VERIFICATION.md).

The starter library is fictional. Free creator collection and deterministic library research work without paid credentials. Lightreel’s private index, application source, proprietary models, and demo media are not included.

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

The portable Worker entry point is `dist/server/index.js`. Building does not publish it. Node’s filesystem SQLite backend is separate from the Worker; see [CORPUS.md](docs/CORPUS.md). An in-progress hosted storage adapter is not a verified deployment.

## Research flows

- **Library:** research imported records or the labeled fictional examples. Creator filters combine topic, school/location, follower bounds, counts, public contacts, and email-in-bio requirements. Unknown metrics cannot satisfy numeric filters.
- **Collect creator:** enter a known public TikTok handle in Library or Settings & data. The official public creator embed supplies its available video selection, public bio, followers, and views without a paid API. This is a bounded profile snapshot, not arbitrary keyword search or the creator’s complete history.
- **Import URL:** fetch a direct public TikTok video’s caption, author and thumbnail through official oEmbed. Short links are rejected. Missing metrics remain unavailable; captions are not transcripts.
- **Video:** attach or drop a supported file up to 50 MiB and ten minutes. The browser prepares up to eight timestamped JPEGs. When transcription is configured, it also extracts mono audio locally and transcribes it when you send. A manual transcript takes precedence. The configured vision model receives samples and unverified transcript text.
- **Video follow-ups:** successful analysis retains the video’s frame context in memory for at most two chats. Choose Video to reuse it. Reload or eviction requires reattachment. Explicit Library, Corpus, or Live search selection does not silently reuse retained frames.
- **Corpus:** when server storage is configured, research a bounded retrieved subset of its real records. Global corpus counts remain separate from records examined in an answer.
- **Live search:** configure Apify for current keyword discovery. Normal requests up to 15 records; Deep research up to 30. Failed discovery stays an error instead of substituting examples. A paid end-to-end Apify run has not been verified.
- **Sources and trends:** open source links or canonical TikTok players. Trends require repeated supplied format labels across distinct creators; they do not establish platform-wide emergence.
- **Workspace:** browser-local chats, bookmarks, imports/exports and saved alerts are available. Alerts check the library while the app is open; there is no background email/push service.

Public-bio school/location matches are self-description evidence, not independently verified enrollment or residence. Ambiguous prose, caption mentions, negation and conflicting bio labels do not establish those fields. See [DATA.md](docs/DATA.md).

## Persistent corpus

```sh
node scripts/corpus.js init --db data/corpus.sqlite
node scripts/corpus.js collect-profiles handles.txt --db data/corpus.sqlite
node scripts/corpus.js stats --db data/corpus.sqlite
```

`handles.txt` contains one known public handle per line. Collection is sequential, deduplicated, and makes one request per handle without automatic retries. To expose that local database in the app, set `OPENREEL_CORPUS_PATH=data/corpus.sqlite` before starting Node.

The implementation verification collected **10 provider-observed real records from one creator** into a local, unbundled database. A separate benchmark stored and searched **150,000 synthetic records, zero real**. That proves tested storage capacity, not real corpus parity. [CORPUS.md](docs/CORPUS.md) documents classification, provenance, commands and measured timings.

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
| `OPENAI_VISION_MODEL` | Vision model; falls back to an explicitly configured text model. |
| `OPENAI_VISION_RESPONSE_FORMAT` | `json_schema` by default; optional legacy `json_object`. |
| `OPENAI_TRANSCRIPTION_MODEL` | Explicit speech model; no text/vision-model fallback. |
| `OPENAI_TRANSCRIPTION_BASE_URL` | Optional speech base URL; falls back to `OPENAI_BASE_URL`. |
| `APIFY_API_TOKEN`, `APIFY_ACTOR_ID` | Optional paid discovery; Actor defaults to `clockworks~tiktok-scraper`. |
| `OPENREEL_API_TOKEN` | Shared access token required for public configured model/discovery requests. |

Apify requests have a requested maximum charge of **$0.25**, at most 30 results, a 40-second Actor timeout and a 45-second client deadline. Downloads, transcription/AI add-ons and automatic retries are disabled. A timeout can leave a charged run; inspect it before retrying. Contract tests do not prove billing or paid discovery quality.

For public provider requests, configure `OPENREEL_API_TOKEN` and enter it in Settings & data → Server access token. It stays in memory for the tab and is distinct from provider keys. Use HTTPS and hosting access controls; the shared token is not an account system. See [SECURITY.md](SECURITY.md).

## Data and privacy

Library records, chats, bookmarks and alerts use browser `localStorage`. Optional SQLite records stay on the server. Local files are read in the browser. Raw video files are not uploaded; sending analysis can transmit sampled JPEGs and extracted WAV chunks through your server to configured providers. Transcription text, questions, metadata and sampled frames then support the vision request.

JPEGs, WAV payloads and retained video context stay out of saved chats/exports; frame context remains in memory until eviction/reload. Textual model answers and evidence metadata can persist. `videoAnalysis.audioAvailable:false` means the vision model did not receive raw acoustics; it does not mean the separate speech recognizer never processed audio. `transcriptProvided` records whether text was supplied to vision.

Direct/creator imports and inline playback contact TikTok; Live search contacts Apify. Thumbnails/source links contact their hosts. Providers and infrastructure can retain submitted requests according to their policies. Browser storage is origin/profile-specific and does not sync devices; export what you need to keep.

## Docker and references

```sh
docker build -t openreel .
docker run --rm -p 127.0.0.1:3000:3000 openreel
```

The Node 24 image listens on `0.0.0.0` inside the container and ships without provider credentials. Pass secrets at runtime; persist a configured corpus with an explicit volume. A Docker build has not been verified in this environment.

The primary reference is Jibran Khalil’s [March 16, 2026 launch post](https://x.com/Jibran_05/status/2033589137018917027). The later [website](https://lightreel.ai/) and [API documentation](https://lightreel.ai/docs) were inspected October 17, 2026. This project is independent and unaffiliated. Its [MIT license](LICENSE) covers original code and fictional fixtures. [Inter](public/InterVariable.woff2) uses the separate [SIL Open Font License](docs/INTER-LICENSE.txt). Imported data, embedded media and optional model weights retain their own rights and licenses; model weights and demo media are not bundled.

See [CONTRIBUTING.md](CONTRIBUTING.md), [DATA.md](docs/DATA.md), [CORPUS.md](docs/CORPUS.md), [LOCAL_MODELS.md](docs/LOCAL_MODELS.md), [PARITY.md](docs/PARITY.md), and [VERIFICATION.md](docs/VERIFICATION.md).
