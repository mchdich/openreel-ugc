# Data, provenance and audiovisual evidence

OpenReel keeps captions, profile bios, scripts/transcripts, measured metrics and sampled pixels distinct. The starter library is fictional; its identities, contacts and analytics must not be presented as real creator research.

## Sources and storage

The browser library accepts up to **2,000 records**. Optional [SQLite corpus storage](CORPUS.md) indexes iterable imports beyond that limit. Corpus research retrieves a bounded subset; global corpus totals are reported separately from the records examined in an answer. Node 24 is required. Node’s filesystem SQLite backend is unavailable in the portable Worker; the separately verified hosted D1 corpus has 4,424 records. The configured local corpus and hosted store remain separate.

Acquisition paths are JSON/CSV imports, official direct-video oEmbed metadata, free official creator embeds, optional canonical public-post metadata, web-assisted handle proposals with independent profile verification, and configured Apify keyword discovery. Public creator collection provides currently exposed videos and profile snapshots; it does not discover every creator or retrieve complete histories. No source-video download or URL transcription is performed.

The normal local corpus contains **154,452 real records across 4,627 creator identities**, including 290 provider-observed records. The optional 150,000-record research archive supplies upstream transcripts/visual descriptions under its separate CC-BY-NC license. A separate synthetic capacity benchmark supplies no real evidence. See [CORPUS.md](CORPUS.md) and [RESEARCH_DATA.md](RESEARCH_DATA.md) for exact sources and limits.

## Import JSON or CSV

Choose Import data in Library or Settings & data. A JSON import is an array of records; CSV uses the same field names as headers. Validation is atomic: a rejected import preserves the current library. Empty imports are invalid; zero search matches are valid.

```json
[
  {
    "id": "fictional-001",
    "handle": "@example.creator",
    "caption": "Three lessons from campus cooking",
    "transcript": "Here are three changes that helped.",
    "hook": "Three changes that helped",
    "format": "List",
    "niche": "cooking",
    "bio": "Fictional example profile",
    "school": "New York University",
    "location": "New York City",
    "followers": 28000,
    "views": 42000,
    "likes": 2100,
    "comments": 90,
    "shares": 210,
    "email": "creator@example.com",
    "postedAt": "2026-10-01",
    "url": "https://example.com/videos/fictional-001",
    "demo": true
  }
]
```

This example is fictional. Quote CSV values containing commas/newlines/quotes; double internal quotation marks. Use JSON for nested `profileEvidence` objects and `unavailableMetrics` arrays; CSV import does not decode these nested structures.

| Field | Meaning |
| --- | --- |
| `handle`, `creatorId` | At least one is required. Actual handles normalize with `@`; numeric creator IDs preserve identity when the username is unknown. |
| `id` | Optional stable record ID; duplicate IDs reject a browser import. TikTok adapters use `tiktok-<video-id>`. |
| `caption`, `hook` | Post description and a separately supplied opening/hook. Captions do not become spoken hooks automatically. |
| `transcript` | Supplied or explicitly acquired text; provenance/accuracy must be assessed separately. |
| `format`, `niche` | Supplied content labels used for research/grouping. |
| `bio` | Public profile text; caption text is not a substitute. |
| `school`, `location` | Supplied profile attributes or conservative public-bio self-description. |
| `followers`, `views`, `likes`, `comments`, `shares` | Nonnegative known counts; missing/null/blank values remain unavailable. |
| `unavailableMetrics` | Array naming unknown metric fields, even when their numeric placeholder is zero. |
| `email` | Optional valid public contact. Creator adapters extract it only from the public bio. |
| `postedAt` | Supplied posting date, normally ISO; retrieval time is separate. |
| `postingEvidence` | Optional exact primary date citation: `sourceType: tiktok-public-post`, canonical `url`, UTC `observedAt` and matching UTC `postedAt`. Source ID/date/shape/range are validated. A supplied citation does not confer provider verification. |
| `url`, `thumbnail`, `authorUrl`, `avatar` | Absolute HTTP(S) links without credentials; adapters apply stricter source allowlists. |
| `sourceType`, `fetchedAt` | Source label and retrieval timestamp; adapters use `tiktok-oembed`, `tiktok-creator-embed`, `tiktok-public-post`, mixed `tiktok-public-profile-and-post`, or `apify`. |
| `profileEvidence` | Public profile citation/timestamp and optional school/location self-description claims. |
| `demo` | Fictional marker, enabled by boolean `true` or CSV `true`. |

Numeric strings may use commas and K/M/B shorthand, e.g. `"12.5K"`. Values round to integers; invalid, negative or unsafe-range numbers are rejected. Text fields are bounded; unknown fields are dropped. A genuine measured zero remains known. Unavailable values display as `—`, cannot meet numeric filters and are excluded from applicable averages.

## Creator evidence and research filters

Creator queries combine topic, school/location, follower bounds, requested count and contact criteria. Examples: `1,000+ followers` is inclusive, `1500 followers` is exact, `10k–20k followers` is inclusive, and `around 1500 followers` allows ±20%. Handles are deduplicated before a requested creator count is applied. Empty matches stay empty.

School constraints use the school field, never caption mentions. Free creator collection recognizes a narrow set of unambiguous bio segments, such as `NYU '27 | based in NYC`; conflicting schools/cities, negation and prose mentions stay blank. This indicates public self-description, not independently verified enrollment or residence. The matching original segment and citation are retained:

```json
{
  "url": "https://www.tiktok.com/@example.creator",
  "fetchedAt": "2026-10-17T12:00:00Z",
  "school": {
    "value": "New York University",
    "source": "public-bio-self-description",
    "text": "NYU '27"
  }
}
```

This is the shape of `profileEvidence`; the handle above is fictional. Direct oEmbed does not provide followers/bio/engagement. Creator embeds can supply followers and views but do not supply per-video likes/comments/shares or transcripts. Missing fields stay unknown. Profile/private/error states never become synthetic results.

“Email in bio” requires an actual email in `bio`; an email in a caption or separate contact field alone does not meet it. The API’s public contact field does not imply outreach permission or identity verification.

Trend groups require at least two distinct creators sharing a supplied format. Engagement per view is `(likes + comments + shares) / views × 100` when all inputs are known; zero-view records use zero. Averages use measured records only, and an entirely unmeasured average is `null`. Format repetition in this corpus does not prove a platform-wide emerging trend or causal performance effect.

## Local video, audio and transcription

Supported local files are limited to **50 MiB** and **600 seconds**. The browser samples up to eight chronological frames, favoring the opening and covering later footage. JPEGs fit within 960px, at most 160 KiB each and 1,280 KiB total. Submitting sends samples/metadata to `/api/video/analyze`; raw video bytes remain local.

When transcription is configured, the browser uses AudioContext to decode the local audio track, mixes it to mono 16 kHz PCM16 and prepares WAV chunks up to 30 seconds/1 MiB each. On Send, chunks go sequentially to `/api/audio/transcribe` if no manual transcript exists. Completed chunk text can be reused in memory after a failed later request. Decoder failure means no decodable audio or unsupported codec, not proven silence. No speech is substituted on failure.

A manual transcript accepts up to 12,000 characters and takes precedence. Machine text also remains unverified. The vision provider receives sampled images and text, not raw acoustics. `videoAnalysis` retains name, duration, frame count, timestamps, `audioAvailable:false` and `transcriptProvided`. Here `audioAvailable:false` means raw audio was unavailable to vision; a separate speech recognizer may have processed extracted audio. Neither words nor stills establish music, speaker identity, acoustic delivery, word timing or unseen continuous motion.

Vision requests default to strict JSON Schema, then local validation checks the narrative/citations. Every section must cite actual supplied timestamps. A legacy JSON-object override does not disable validation. Invalid provider output stays an explicit error.

After successful analysis, up to two chats retain frame context in memory for explicit Video follow-ups. Other research selectors use their named data source. Reload/eviction requires reattachment. The “videos watched today” counter records successful submitted attachments; retained follow-ups do not add another count. It is not a count of a private or fully watched index.

## Persistence, transfers and export

Library records, chats, bookmarks and alerts use the current origin’s localStorage. JPEGs, raw files, WAV payloads and retained visual context do not enter saved workspace/export data. Model answers and evidence metadata can persist. Corpus SQLite files and sidecars stay on the configured server filesystem and need separate backups/access controls.

Submitting research sends relevant context to your server and enabled providers. Direct/creator imports and inline playback contact TikTok; Live search contacts Apify; thumbnails/source links contact their hosts. Infrastructure/provider retention policies still apply. Imported links and dataset labels do not grant reuse rights or prove factual accuracy.

Browser storage does not sync origins/devices; clearing it removes local saved state. Export what you need to retain. Exports and corpus files can contain public contacts/conversation text, so handle them accordingly. See [SECURITY.md](../SECURITY.md), [CORPUS.md](CORPUS.md) and [PARITY.md](PARITY.md).
