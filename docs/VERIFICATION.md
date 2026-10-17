# Release verification

Verified October 17, 2026.

- Node built-in suite: 40 passing tests for corpus normalization, creator filters, numerical bounds, school matching, script critique, creative briefs, multi-creator trends, API validation, provider failure/grounding, origin checks, authentication, rate limits, storage recovery and the generated Worker.
- The Worker build was imported and exercised as a real Fetch handler. Its home page matches the client source; API, not-found and method handling were checked.
- Chromium desktop and 390px mobile smoke checks: creator query, conversation persistence, bookmarks, six example trend groups, alert creation/pause/deletion, script critique and creative-brief follow-up.
- Browser edge checks: malformed stored workspace recovers, unsafe URL import leaves the library unchanged, valid JSON import works, HTML in hooks renders as text, record details open, empty creator results stay empty, no mobile horizontal overflow and no page/console errors.
- Independent source review identified nested workspace validation, school matching, follower range parsing and HTTPS proxy issues. Each was fixed with a failing regression followed by a passing suite.

The optional model provider was tested with controlled responses; a paid live provider was not configured. A Docker image was not built in this environment. There is no claim of visual pixel parity, live TikTok indexing, raw video understanding, or parity with Lightreel's private backend. See [PARITY.md](PARITY.md).
