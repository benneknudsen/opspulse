# OpsPulse

Real-time operations dashboard for self-hosted media servers — Plex, the *arr stack, Tautulli,
Scrutiny and friends, in one console instead of six tabs.

**Configuration-first.** OpsPulse renders whatever your `opspulse.yaml` declares. No service, no
container and no language is baked into the product.

**Your server is the only caller.** API keys and Plex tokens never leave the backend. The UI shows
masked keys; the only place a key is ever typed is the onboarding wizard's password field.

**Dark-first, one accent, status colours that mean something.** Built as a console, not a landing page.

> **Status:** design handoff complete. Implementation in progress — issues are tracked in
> [Issues](https://github.com/benneknudsen/opspulse/issues); the build plan lives in
> [`docs/implementation-plan.md`](docs/implementation-plan.md).

## Stack

Next.js (App Router) · strict TypeScript · Tailwind v4 over a single `tokens.css` · TanStack Table +
virtualiser · Zustand with selector-level subscriptions · a small Node WebSocket sidecar for live
events · Recharts · Danish and English from day one.

## License

MIT — see [LICENSE](LICENSE). Service marks (Radarr, Sonarr, Prowlarr, Plex, Tautulli, Overseerr,
Scrutiny, Maintainerr, Unpackerr, Kometa, Portainer, Watchtower, FlareSolverr) are the respective
projects' own logos, used only to identify the service in the UI.
