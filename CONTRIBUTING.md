# Contributing to OpenReel

OpenReel is an independently written recreation with original code, artwork, and fictional example data. Keep the distinction between observable UI fidelity and private data/model capabilities clear.

## Development

Use Node.js 22 or newer. Run `npm start` to serve the app at `http://localhost:3000`. No runtime dependency install or provider key is needed for the default research engine.

Before submitting a change, run:

```sh
npm test
npm run build
```

Report which checks you ran and their actual results. For interface changes, exercise the affected flow in a browser, keyboard navigation, and a narrow mobile viewport. For research changes, check filtering, empty results, and that each claim can be traced to the active corpus. Add focused tests when behavior or security boundaries change.

## Contributions we can review

- Describe the concrete problem, the resulting behavior, and how you checked it.
- Keep runtime dependencies at zero unless a change explicitly revisits that design.
- Preserve local operation without keys and keep provider secrets server-side.
- Use text-safe rendering and validated HTTP(S) links for imported data.
- Update `docs/DATA.md` for import changes and `docs/PARITY.md` when feature scope changes.
- Keep fixtures fictional and clearly labeled. Do not submit private indexes, scraped media, credentials, personal data without permission, or copied proprietary application code.
- Include attribution and license information for any new asset. The repository's MIT license does not relicense imported third-party material.

Do not claim that corpus research watches videos, queries a live social platform, or reproduces Lightreel's proprietary model. A provider integration should preserve the same evidence boundary and explain any data it sends externally.

Use the repository's issue or pull-request tools once hosted. For sensitive vulnerabilities, follow `SECURITY.md` rather than posting exploit details publicly.

By submitting a contribution, you agree to make your original contribution available under the repository's MIT license.
