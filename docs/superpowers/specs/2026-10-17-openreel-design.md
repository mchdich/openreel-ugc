# OpenReel design

Build an independently written, MIT-licensed recreation of the observable Lightreel launch experience. The user's priority is high visual and interaction fidelity and a public source release without intermediate approval stops. The reference is https://x.com/Jibran_05/status/2033589137018917027 (March 16, 2026), inspected through remote browser playback and public Lightreel pages on October 17, 2026.

## Experience

White/neutral canvas, quiet gray sidebar, black controls, ample space, rounded bordered composer with attachment, video library count and submit arrow. Sidebar has New Chat, Trends, Alerts, Bookmarks and a local library/settings entry. Home centers the product wordmark and conversational prompt above the composer, followed by example research questions. Responses have readable prose, source cards, creator tables and follow-up prompts. Preserve these visible flows: competitor hooks, why a video underperformed, tightly filtered creator discovery and trends. Add browser-local saved conversations, bookmarks, import/export and research alerts that refresh when the app is open. Clearly indicate demo fixtures versus imported data and deterministic research versus configured AI. Responsive mobile sidebar and keyboard operation are required.

## Data and research

Ship original, fictional fixtures to make the app immediately explorable; never present them as real TikTok results or inflate the corpus count. User can import JSON/CSV video records with handle, caption/transcript, hook, niche, location, school, followers, metrics, date and optional public contact/source/thumbnail fields. Validate input, bound record counts and accept only http/https links. Search/filter and metrics must actually derive from the active corpus. Natural language creator queries honor university/location, minimum/maximum follower constraints, requested count and email availability. Empty results must stay empty. Trend grouping requires multiple creators per hook format. Video critique works from provided transcripts/scripts and available metrics; it must not claim to have watched or fetched a pasted URL. No private Lightreel data, source or third-party demo video is redistributed.

## Architecture

Zero runtime dependencies. Browser ES modules in public/ contain UI, original fixtures and shared research engine. Node 22+ server exposes /api/chat and /api/status; optional OpenAI-compatible backend configured by server environment enriches grounded research. Full source and the local app work without keys using deterministic corpus research. Browser data is localStorage; no shared hosted database. Cloudflare Worker bundle serves the same assets and API for portable Sites hosting. AI keys never enter client code. API is same-origin, validates body sizes, applies request limits and requires an API bearer token when AI is configured for non-loopback deployments. Remote AI provider URL comes only from server configuration, not user input.

## Verification and release

Node built-in tests for import validation, numeric filters, empty results, trend grouping, XSS-sensitive inputs, optional provider error paths and endpoint validation. Browser smoke tests cover all main flows, chat persistence, bookmarks, JSON import, alert lifecycle and mobile overflow. Run build and inspect real screenshots. Release includes MIT license, setup guide, precise parity matrix, fixture schema, security notes, Dockerfile and CI. Publish to a new public GitHub repository if available authenticated access permits it; otherwise supply a complete licensed source archive and describe the exact publication blocker. Deploy usable preview through Sites. Never claim private index/model/data parity.
