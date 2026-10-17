# OpenReel

An independently written, MIT-licensed recreation of the visible Lightreel research experience: ask about hooks, compare creator performance, discover creators, and explore trends in a corpus you control.

OpenReel starts with fictional example records and deterministic analysis. It does **not** include Lightreel's private 150,000+ video index, proprietary models, source code, or third-party demo video. It does not scrape TikTok or Instagram, download videos, or watch raw video. Import transcripts or scripts to ground video critique. An optional OpenAI-compatible provider can enrich answers using the records you supply.

## Run locally

Requires Node.js 22 or newer. There are zero runtime dependencies.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). The server binds to loopback by default. No API key or external service is required for deterministic research.

```sh
npm test
npm run build
```

The build produces a portable Cloudflare Worker containing the app and API. It does not publish or deploy anything. Its entry point is `dist/server/index.js`.

## Use the app

- **New chat:** select an example prompt or ask a question about the active corpus. Follow up in the same conversation; chats persist in this browser.
- **Creator discovery:** combine niche, location or school, follower ranges, requested counts, and public email availability. Empty matches remain empty.
- **Hooks and critique:** inspect source cards and corpus-derived metrics. Critique uses supplied text and metrics; a pasted video URL alone does not provide its audiovisual content.
- **Trends:** compare hook formats represented by multiple creators in the active corpus. These are corpus patterns, not a live platform-wide trend feed.
- **Bookmarks:** save useful results in this browser.
- **Alerts:** save research prompts and review their results while the app is open. There is no background job, email, or push notification service.
- **Data settings:** import your JSON/CSV records, export local data, or restore the fictional examples. The displayed library count reflects the active corpus.

See [the data format](docs/DATA.md) for imports and [the parity matrix](docs/PARITY.md) for the scope of the recreation.

## Optional model provider

Configure credentials in the server environment, then restart the server. Do not put a provider key in browser code or imported records.

```sh
OPENAI_API_KEY='your-provider-key' \
OPENAI_BASE_URL='https://api.openai.com/v1' \
OPENAI_MODEL='your-provider-model' \
npm start
```

Use a provider's supported model name and OpenAI-compatible chat endpoint base URL. Provider charges and retention policies apply when this mode is enabled. Without a provider key, the app uses deterministic corpus research.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP listen port; default `3000`. |
| `HOST` | Listen address; defaults to loopback. Use `0.0.0.0` deliberately for a container or remote host. |
| `OPENAI_API_KEY` | Optional server-side model-provider credential. |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible provider base URL. |
| `OPENAI_MODEL` | Provider model identifier. |
| `OPENREEL_API_TOKEN` | Access token for the research API. Configure this before exposing provider-backed research publicly. |

Public AI requests require the bearer token configured by `OPENREEL_API_TOKEN` on the server. Enter it under Settings & data → Server access token when needed. This token is distinct from the provider API key: give authorized users the app access token, never the provider key. Protect a public deployment with HTTPS and appropriate access controls; see [security notes](SECURITY.md).

## Data and privacy

Chats, corpus records, bookmarks, and alert settings are stored in this browser's `localStorage`. Importing a local file reads it into the browser. When you run research, the question and relevant corpus data are sent to your OpenReel server; a configured model provider can receive that research context. The server has no shared hosted database. A deployment operator can still observe requests and configure infrastructure logs.

Browser storage is specific to the site origin and browser profile. Clearing site data removes it, and using another device does not sync it. Export anything you need to keep. Imported source or thumbnail URLs may contact their hosts when opened or displayed; import only data you are permitted to use.

## Docker

```sh
docker build -t openreel .
docker run --rm -p 127.0.0.1:3000:3000 openreel
```

The image binds `HOST=0.0.0.0` inside the container so port forwarding works. It ships with no model credentials. Pass provider configuration and a separate `OPENREEL_API_TOKEN` as runtime environment variables if you enable AI. Avoid baking secrets into an image.

## Reference and provenance

The visual reference is Jibran Khalil's [March 16, 2026 Lightreel launch post](https://x.com/Jibran_05/status/2033589137018917027). The project also consulted the [official Lightreel website](https://lightreel.ai/) and [official API documentation](https://lightreel.ai/docs) on October 17, 2026. The October product has evolved beyond the March demo; OpenReel's [parity matrix](docs/PARITY.md) separates those references from this implementation.

This project is independent and is not affiliated with or endorsed by Lightreel. The MIT license covers this repository's original code and fictional fixtures. Product names remain their owners' marks; imported third-party content retains its own rights. No private index, model weights, or demo media is redistributed.

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). See [LICENSE](LICENSE) for the license and [SECURITY.md](SECURITY.md) for reporting guidance.
