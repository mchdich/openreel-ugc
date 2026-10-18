# Dated public-post metadata

Continue the approved parity scope inline. The original user authorizes implementation and public source publication; no new approval stop is needed.

A real ordinary canonical TikTok post GET returned statusCode0 with a matching post ID, public author and `createTime` plus actual engagement counts. The creator embed omitted those fields. Add an operator opt-in `OPENREEL_POST_METADATA=true` to the existing Import URL flow so real dates/metrics can enter indexed research without paid scraping or an inferred ID timestamp. Default oEmbed remains compatible. This does not by itself supply current multi-creator audiovisual evidence.

- [x] Reproduce parser/transport/API gaps with tests: exact post binding, public visibility, valid UTC date, real zero/unknown metrics, profile self-description, unsafe imagery, no raw video/HTML, input/stream/deadline/redirect bounds and no automatic fallback/retry.
- [x] Implement a pure bounded hydration reader and one canonical GET in the existing social module, guarded by explicit server opt-in. API persists its actual source identity. Bundle remains Worker compatible.
- [x] Verify actual browser Import URL and date/metrics/reload against a fresh independent public page observation; preserve all earlier claims and current-trend limits.
- [ ] Review, run appropriate full tests/build, document, publish source/archive and exact-commit CI. Keep full parity goal open.

Reject private, friends-only, prohibited, taken-down, shell/error and mismatched post data. Read JSON as data without executing scripts, requesting media or following redirects. A canonical direct post URL selects only a fixed official HTTPS host/path. The response has a1MiB cap and10-second deadline. No key or provider call is required. Invalid/missing date stays unknown; displayed date never comes from captions, IDs or fetchedAt. Missing counts remain unavailable. The canonical returned author may correct an old handle, just as the current oEmbed path does.
