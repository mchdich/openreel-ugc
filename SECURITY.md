# Security

OpenReel combines browser-local storage, an optional server corpus, configurable model providers, public TikTok integrations and optional paid Apify discovery. It has no account or per-user authorization system.

## Deployment boundaries

- Node 24 binds to loopback by default. Set `HOST` deliberately when network access is intended; Docker uses `0.0.0.0` inside its container.
- Behind a TLS proxy, set the exact `OPENREEL_PUBLIC_ORIGIN`. Forwarded headers are not trusted. Explicit public-origin configuration preserves same-origin checks and disables loopback provider-auth exemptions.
- Keep `OPENAI_API_KEY`, `APIFY_API_TOKEN` and `OPENREEL_API_TOKEN` in server/Worker secrets, outside source control, browser code, imported data, exports and screenshots.
- Public configured model, vision, transcription, visual-pattern detection and paid-discovery paths require the bearer token matching `OPENREEL_API_TOKEN`. The browser retains an entered token in memory until reload. This shared token does not isolate users or protect every corpus/import endpoint.
- Protect private research with HTTPS and hosting access controls. Free creator imports and corpus reads are not an account boundary. In-process rate limiting and body limits are basic controls, not distributed abuse prevention.
- Model base URLs and identifiers are operator configuration. Chat/vision uses `OPENAI_BASE_URL`; speech may use `OPENAI_TRANSCRIPTION_BASE_URL`. URLs reject credentials, queries and fragments; HTTP is limited to configured loopback providers. Requests reject redirects. No request-supplied URL selects a model endpoint.
- Local models can use a nonsecret placeholder key; keep their listeners on loopback. A local CPU setup does not imply a hosted deployment has those models available.

## Local files and audiovisual transfer

The browser reads a selected video up to 50 MiB and 600 seconds. It prepares up to eight timestamped JPEGs; raw video bytes are not uploaded. When speech is configured, browser decoding extracts mono 16 kHz PCM16 WAV chunks, each at most 30 seconds and 1 MiB. Speech requests happen on Send when a manual transcript is absent. Each chunk goes through the server to the configured transcription provider. Unsupported/no-decodable audio stays explicitly unavailable.

Only submitted analysis/follow-ups send frames, metadata, the question and optional transcript to vision. The vision model receives recognized or user-supplied words as unverified text, not the raw audio track. `audioAvailable:false` describes this vision-input boundary; it is compatible with separate audio transcription having occurred. It does not establish music, speaker identity, vocal delivery or word timing.

JPEGs are limited to 160 KiB each and 1,280 KiB total; the API JSON body is capped at 2 MiB. Server image validation checks encoding/markers rather than fully decoding JPEGs. Speech validation checks the canonical WAV structure, exact sample count/rate/channels/bit depth, duration and base64 bounds. Model replies have a 64 KiB body bound and 45-second request deadline. Transcripts are capped at 12,000 characters per chunk. Requests are not automatically retried.

Vision defaults to strict JSON Schema output, followed by local key, text, timestamp and evidence checks. Legacy `json_object` providers still undergo the same local validation. Invalid output is rejected rather than repaired into a fictional answer. Schema validation cannot prove that a model understood the pixels or that a machine transcript is correct.

Decoded audio buffers are cleared and the AudioContext closes. Pending JPEG/WAV payloads and retained frame context stay in browser memory; they are excluded from saved workspace/export data and returned analyses. Successful frame contexts support explicit Video follow-ups for at most two chats. Reload/eviction requires reattachment. Textual answers and evidence metadata can persist.

Providers can retain submitted images, audio and text according to their policies. Operators can inspect requests or configure infrastructure logs. Local storage behavior is not a claim about infrastructure/provider retention.

## Public sources, costs and provenance

Direct video import accepts canonical HTTPS TikTok video URLs and uses a fixed official oEmbed endpoint. Creator collection accepts a validated handle and fetches a fixed public creator embed. Neither follows redirects, fetches arbitrary client URLs, executes returned HTML, downloads source video or bypasses login/CAPTCHA/access barriers. JSON metadata is capped at 256 KiB; creator HTML at 1 MiB. Private/deleted/error states remain empty or fail safely.

Optional `OPENREEL_POST_METADATA=true` selects a single ordinary canonical public-post HTML GET for Import URL. The fixed official host/path, no redirects, 10-second deadline and 1 MiB body cap apply. A matching public hydration record may supply actual dates/counts and profile metadata. Error/private/friends-only/taken-down content rejects; no raw HTML, media addresses or provider scripts enter the application response. No fallback, retry, media request or paid model call occurs. The undocumented hydration shape may change.

With the same opt-in, Live/creator acquisition can inspect at most six confirmed public post IDs in batches of three under one 20-second budget. No later batch follows a non404 metadata failure; a failed profile batch suppresses post checks. Source/creator binding and fresh filters apply before persistence. One latest-fetched profile observation is attributed across same-creator records; provider cache freshness is not independently verified. Prior independently observed creation dates can remain with their original `postingEvidence`, while current analytics/profile fields replace old snapshots. Corpus lookups require a prior real/provider-observed record; supplied citation objects never confer that classification. The bulk read is one bounded parameterized query.

Creator bio fields and metric snapshots are public-source observations, not independently verified identity or affiliation. School/location self-description retains its citation and original bio segment. Caption mentions do not establish those fields. Missing metrics remain unknown even where a numeric payload placeholder is zero.

Optional Apify discovery makes one authenticated request with at most 30 results, requested maximum charge $0.25, 40-second Actor timeout and 45-second client deadline. Downloads, subtitle fetching, provider transcription/AI add-ons and automatic retries are disabled. A timeout can leave a charged run; inspect it before repeating. Tests do not establish final billing or successful paid discovery.

Visual-pattern detection sends at most 60 attributed descriptions of 1,800 characters each to the configured text provider. Its two-call maximum shares a 45-second deadline and uses strict output plus a 64 KiB cap per response. It is an explicit paid action with public bearer/origin checks; browsing and typing do not trigger it. Exact source matching and a bounded predicate catalog constrain output but cannot prove that upstream descriptions match footage. There is no automatic retry or corpus write.

Imported/provider text, filenames, bios, transcripts, on-screen text and model replies are untrusted data. Field/size/URL validation and escaped rendering reduce exposure. Report any path that executes source HTML, leaks credentials, bypasses fixed endpoint restrictions or promotes unavailable metrics into measured evidence.

## Persistent corpus and browser storage

[SQLite corpus files](docs/CORPUS.md), including WAL/SHM sidecars, contain research records and public contacts. Keep them out of source control and public static assets; secure access and backups at the deployment layer. Classification and provenance validation cannot independently audit every imported fact. Synthetic/example rows must not be promoted as provider-observed real acquisition.

The portable Worker cannot use Node’s filesystem SQLite backend. A separate hosted storage implementation requires its own verification; an in-progress adapter is not a deployed privacy or persistence guarantee.

Browser `localStorage` and exports are unencrypted. Same-origin scripts and anyone with browser-profile access may read saved chats, records and contacts. Browser storage does not isolate users, sync devices or delete already-transmitted provider data when cleared. Import only necessary data you are permitted to use.

## Reporting

There is no dedicated security email or guaranteed response SLA. Use the repository’s private **Security → Report a vulnerability** flow if enabled, otherwise a published private owner contact. Do not post credentials, private records or public-deployment exploit details in a public issue.

Include the affected revision, provider/storage mode, minimal fictional-data reproduction, expected behavior and impact. Revoke leaked keys/tokens at their issuer and replace server secrets. No independent security audit or long-term support policy is claimed.
