# Security

OpenReel is a small self-hosted app with browser-local storage and an optional model-provider connection. There is no account system or shared server-side database.

## Deployment boundaries

- The Node server binds to loopback by default. Set `HOST=0.0.0.0` only when network access is intended; the Docker image uses that address inside its container.
- Keep `OPENAI_API_KEY` in server or Worker secrets. Never put it in browser bundles, git, screenshots, exports, or imported records.
- Configure `OPENREEL_API_TOKEN` before exposing AI-backed research publicly. Public provider-backed requests require this bearer token. The browser requests it when necessary. It grants access to research; it is not a full user/role system.
- Use HTTPS for remote deployment and set host access controls and usage budgets appropriate to your audience. Request limits are basic safeguards, not a complete abuse-prevention service.
- `OPENAI_BASE_URL` is operator configuration. Use a provider endpoint you trust; prompts and research context are sent there when AI mode is enabled.
- Do not assume that an exported corpus or conversation is encrypted. `localStorage` is readable by scripts running on the same origin and by someone with access to the browser profile.

## Data handling

JSON/CSV imports are untrusted input. Validation restricts supported fields, record sizes, and link schemes. The app should render imported content as text, avoid executable HTML, and only accept HTTP(S) source/thumbnail links. Report any bypass of these boundaries.

Importing is a browser action. Research transmits the question and corpus context to the app server; an optional provider can receive that context. Source links and externally hosted thumbnails can also reveal requests to their hosts when used. Infrastructure logs and the configured provider have their own retention policies.

Do not import secrets or unnecessary sensitive personal data. Import only records and contact information you have permission to use. Removing browser data does not remove data already sent to an operator's logs or a model provider.

## Reporting a vulnerability

There is no dedicated security email address or guaranteed response SLA for this project. If the hosted repository offers private vulnerability reporting, use its **Security → Report a vulnerability** flow. Otherwise contact the repository owner privately through a channel they publish. Do not post credentials, private records, or an exploit against a public deployment in an issue.

Include the affected revision, deployment mode, a minimal reproduction with fictional data, expected behavior, and impact. For a leaked key or access token, revoke it at its issuer and replace the server secret.

Security fixes target the current source version. No long-term support or independent security audit is claimed.
