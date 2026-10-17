# Reference and parity

OpenReel recreates the visible research workflow with independently written code and original fictional data. Visual and interaction similarity does not provide access to the original product's backend, video library, model, or results.

## Which Lightreel version?

The initial reference is the [March 16, 2026 launch post](https://x.com/Jibran_05/status/2033589137018917027), with a short demo showing competitor hooks, video-performance critique, and tightly filtered creator discovery. Its 150,000+ video index is a promotional claim in that reference, not an OpenReel dataset.

The [official website](https://lightreel.ai/) and [API documentation](https://lightreel.ai/docs), consulted October 17, 2026, describe a later product with additional research, alerts, sharing, and API capabilities. Current pages are useful references for navigation and interactions; they are not proof that each capability appeared in the March demo. OpenReel does not call the Lightreel API or include its SDK.

## Scope

| Experience or capability | OpenReel behavior | Boundary |
| --- | --- | --- |
| Neutral chat layout, sidebar, rounded composer, example prompts | Independently implemented visual interpretation of the observable experience | No original product source, design files, or demo media included; exact pixel identity is not claimed. |
| New chat and follow-up research | Working conversations, saved in the browser | No cross-device sync or account service. |
| Competitor hooks | Search and comparison grounded in the active corpus, with source cards | No live competitor crawling or platform-wide coverage. |
| Why a video underperformed | Text/metric-based analysis of supplied scripts or transcripts and corpus comparisons | A pasted URL does not fetch, download, transcribe, or visually inspect a video. |
| Creator discovery | Corpus filtering for niche, location/school, followers, count, and public email availability | Results are limited to imported or fictional records; no manufactured matches. |
| Source cards and creator tables | Corpus records and computed metrics | Fixture links and sample identities are fictional; imported source accuracy is the user's responsibility. |
| Trends | Hook-format grouping across multiple creators in the active corpus | Not a live TikTok/Instagram trend feed or prediction service. |
| Bookmarks | Browser-local saved results | No shared team workspace. |
| Alerts | Saved prompts evaluated in the app while open | No email, push notifications, scheduled server job, or monitoring while closed. |
| Corpus count | Actual active library size | No simulated 150,000+ private index. |
| Data settings | JSON/CSV import and local export | No authenticated social account connection or network scraper. |
| AI answers | Deterministic local corpus analysis by default; optional OpenAI-compatible provider | No original proprietary model, model weights, or guaranteed equivalence of responses. |
| API | App-specific `/api/chat` and `/api/status` endpoints | Not a compatible replacement for Lightreel's commercial API, SDK, or MCP service. |
| Teams, billing, platform integrations | Outside this implementation | No account sharing, subscription flow, Lightreel integration, or social publishing. |

## Honest use of fixtures

The bundled examples are original fictional records for exploring the interface. Their creator names, contact details, captions, and metrics are not claims about real people or real TikTok results. Research and trend counts derive from the selected corpus. A well-formed query can return no matches; an empty result should stay empty.

Import your own permitted records to make the same workflows useful on real data. Provider-generated text can be wrong; source cards and corpus metrics are the evidence to inspect.

## Verification scope

Use `npm test` for automated checks and `npm run build` for the portable Worker build. Browser checks should cover the main research examples, filters, chat persistence, bookmarks, imports, alert lifecycle, mobile layout, and keyboard operation. This document defines scope; it does not certify a test run or independent product-parity audit.
