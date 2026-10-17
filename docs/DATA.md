# Corpus data

Creator queries support inclusive `1,000+ followers`, literal exact `1500 followers`, inclusive ranges such as `10k–20k followers` or `10k to 20k followers`, and approximate `around 1500 followers` (±20%). School constraints match the school field, rather than mentions in a caption.

OpenReel researches the active corpus in your browser. The bundled corpus is fictional example data, written for this project. Its identities, captions, contact details, and metrics must not be presented as real creator research.

An imported corpus provides records for search, creator filters, source cards, hook comparisons, and trends. It does not grant access to a social platform or retrieve the contents of a source URL.

## Import JSON or CSV

Open data settings in the sidebar and choose a JSON or CSV file. Imports are validated before becoming the active corpus. A rejected import should leave the existing library intact. The corpus can contain up to **2,000 records**. An empty import is invalid; research may still legitimately have zero matching records.

Use a JSON array of objects:

```json
[
  {
    "id": "example-001",
    "handle": "@example.creator",
    "caption": "Three lessons from my first month of campus cooking",
    "transcript": "I stopped buying lunch every day. Here are the three changes that helped.",
    "hook": "Three changes that helped me cook on campus",
    "format": "List",
    "niche": "cooking",
    "location": "New York City",
    "school": "New York University",
    "followers": 28000,
    "views": 42000,
    "likes": 2100,
    "comments": 90,
    "shares": 210,
    "postedAt": "2026-10-01",
    "email": "creator@example.com",
    "url": "https://example.com/videos/example-001",
    "demo": true
  }
]
```

This example is fictional. CSV uses the same field names as column headers:

```csv
id,handle,caption,transcript,hook,format,niche,location,school,followers,views,likes,comments,shares,postedAt,email,url,demo
example-001,@example.creator,"Three lessons from campus cooking","Three changes that helped","Three changes",List,cooking,New York City,New York University,28000,42000,2100,90,210,2026-10-01,creator@example.com,https://example.com/videos/example-001,true
```

Quote CSV values containing commas, newlines, or quotation marks. Escape a quotation mark inside a quoted value by doubling it. Keep each column in the same order as its header.

## Fields

| Field | Type and meaning |
| --- | --- |
| `handle` | Required creator identifier: 1–80 letters, digits, periods, underscores, or hyphens, optionally prefixed by `@`. A missing `@` is added. |
| `id` | Optional record identifier. Generated from the handle and row number when omitted. Duplicate IDs reject the import. |
| `caption` | Post caption or a short description. |
| `transcript` | Transcript or script you supply; the app does not create one from a URL or video upload. |
| `hook` | Opening line or hook text. |
| `format` | A consistent hook-format label such as `List` or `Story`; used for trend grouping. |
| `niche` | Topic/category used in research and filters. |
| `location` | Creator location as text. |
| `school` | University or school as text. |
| `followers` | Nonnegative follower count. |
| `views` | Nonnegative video-view count. |
| `likes`, `comments`, `shares` | Nonnegative engagement counts. |
| `postedAt` | Posting date; use an ISO date such as `2026-10-01`. |
| `email` | Optional valid, publicly available contact email you have permission to use. |
| `url` | Optional source link; only absolute `http:` or `https:` URLs without embedded credentials are accepted. |
| `thumbnail` | Optional image link; same URL restrictions as `url`. |
| `demo` | Fictional-example marker; only boolean `true` or CSV text `true` enables it. Keep it enabled for fictional records. |

Numeric values may be numbers or strings, including comma-separated values and shorthand such as `"12.5K"`, `"1.2M"`, or `"1B"`. Values round to integers; negative, invalid, and values above JavaScript's safe integer range are rejected. Omitted or blank metrics become `0`. Optional text defaults to an empty string.

Transcripts have a 50,000-character limit, captions and hooks have a 10,000-character limit, and other text fields have a 2,000-character limit in addition to the handle restriction. Dates must be parseable; ISO dates are recommended. Unknown properties are discarded. Text stays text; imported HTML is not a supported rendering format. Unsafe source/thumbnail schemes such as `javascript:` and `data:` are rejected.

Prefer complete, current records. Missing metrics cannot establish that a creator or video performed poorly. Use a consistent format label across creators so trend comparisons are meaningful. Imported labels and source links are user-supplied evidence, not independently verified facts.

## How research uses records

Creator discovery applies the available corpus fields to the requested niche, location/school, follower range, requested count, and public-email requirement together. It deduplicates by creator handle and returns only available matches. "Around" a follower count means within 20%. NYU/New York University, UCLA/University of California Los Angeles, NYC/New York City, and LA/Los Angeles have explicit alias handling. Other school/location filters use the supplied text. It cannot find creators absent from the corpus or infer missing contact details.

Trend groups require at least two distinct creators with the same format. Metrics and counts are calculated from the active corpus. Engagement per view is `(likes + comments + shares) / views × 100`; zero-view records use zero. Average engagement is the mean of each record's rate, and average views is the mean record view count. Missing metrics normalized to zero participate in those calculations. A few imported examples cannot establish a platform-wide trend, and multiple videos from one creator do not by themselves establish a multi-creator trend.

Critique works from supplied transcripts/scripts, captions, hooks, and metrics. A source URL provides a citation link. It does not mean the app fetched, downloaded, transcribed, or watched the linked video.

The default engine is deterministic. An optional server-configured model provider can enrich the prose while corpus records remain the source of cards and metrics. Check the evidence before using generated advice.

## Storage, transfer, and export

The browser stores imported records, chats, bookmarks, and alerts in `localStorage` for the current origin. Reading an import file happens locally in that browser. Running research sends the question and corpus context to your app server; an enabled provider can receive that context. Do not import secrets or unnecessary sensitive data.

Opening source links or loading externally hosted thumbnails can make requests to those hosts. Source links do not grant copyright or reuse permission. You remain responsible for the rights, accuracy, and permitted use of imported content.

Use data settings to export what you want to retain or restore the fictional corpus. Browser storage does not sync across origins or devices; clearing site data removes it. Exports may contain your imported contact data and conversation text, so store and share them accordingly.
