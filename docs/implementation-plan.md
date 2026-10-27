# OpsPulse — Implementation Plan

> **For Hermes:** execute issue-by-issue through the `oc-issue` pipeline (one issue per message,
> QA gate `npm test -- --run --reporter=dot`, HermaGuard on risky diffs, independent QA model).
> This plan is the briefing source, not the issue bodies.

**Goal:** Build OpsPulse — an open-source, configuration-first, real-time operations dashboard for
self-hosted media servers (*arr stack, Plex, Tautulli, Scrutiny) as a Next.js app that is a
pixel-faithful implementation of the design handoff "OpsPulse design handoff complete".

**Architecture:** Next.js (App Router, strict TS) renders a dark-first console UI driven entirely by
`tokens.css` custom properties. A small Node sidecar owns connectors and pushes typed events to the
browser over a WebSocket; the client keeps a granular Zustand store with selector subscriptions so a
progress tick repaints one cell, not the table. The queue is TanStack Table + a virtualiser (10,000+
rows, 10 DOM rows). Configuration is `opspulse.yaml` (zod-validated); secrets come from the
environment and never reach the browser. `--demo` swaps every connector for a deterministic mock so
the dashboard runs with no real services.

**Tech stack:** Next.js (App Router) · React · TypeScript strict · Tailwind v4 (`@theme inline`) ·
`zustand` · `@tanstack/react-table` + `@tanstack/react-virtual` · `recharts` · `ws` · `zod` · `yaml` ·
`@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` · Vitest + RTL · Playwright.

---

## Source of truth

**Design project (authoritative, live):**
`~/Library/Application Support/Open Design/namespaces/release-stable/data/projects/bdc23a26-9e5f-413a-a0eb-7fcf0f42fa6a/`
reached through the alias `~/code/OpsPulse Design Handoff`. Project name in the app:
**"OpsPulse design handoff complete"** (run `8d2bb226-82f9-4b0d-9e11-f4f57518d95f`, succeeded 22 Oct 2026).

Authority order (from the spec itself):

1. `tokens.css` — every visual value. Nothing else may introduce a colour/size/duration.
2. `components.md` — props, states and exact values per component.
3. `copy.en.json` / `copy.da.json` — the only place UI strings live.
4. `reference/vision.html` — executable reference to **view**, never to copy.
5. `README.md` — principles, states, a11y, pitfalls, acceptance criteria.

**Do not build from `~/code/design_handoff_opspulse_v2/`** — that is the older Danish "Cockpit"
round (`opspulse-v2-cockpit`, 15 Sep) and diverges substantially.

### Known drifts between README prose and `tokens.css`

`tokens.css` wins. Three table values in README §2.1 are stale — implement the CSS:

| Token | README table | `tokens.css` (implement this) |
|---|---|---|
| `--faint` (dark) | `#545c65` | `#7d858d` |
| `--muted` (light) | `#6c7480` | `#616870` |
| `--faint` (light) | `#8b939c` | `#656d75` |

### Licensing constraints (public repo)

- Connector marks (`reference/assets/icons/`, 16 files) are the projects' own logos — commit them with
  the attribution block from README §8.
- **Posters are non-free Wikipedia artwork and must NOT be committed.** The demo set uses generated
  placeholder art (SVG gradient + title). `reference/assets/posters/` stays out of the repo.
- No API key, token or personal endpoint may appear in the repo, in seed data or in screenshots.
- Add `LICENSE` (MIT, matching the other public repos) + `NOTICE` for the brand marks.

---

## Repo layout

```
~/code/opspulse/                     (new public repo, benneknudsen/opspulse)
  design/                            byte-identical handoff import (provenance)
    README.md components.md tokens.css tailwind.config.ts copy.en.json copy.da.json
    assets/icons/*                  16 marks (attribution in NOTICE + design/README tail)
    reference/vision.html           reference only, not shipped to the app
  app/
    layout.tsx globals.css          theme/density/lang bootstrap (no FOUC)
    page.tsx                        dashboard
    history/page.tsx                drilldown
    onboarding/page.tsx             3-step wizard
    settings/page.tsx               3 panels
  components/
    shell/{Topbar,Nav,ConnectionPill,DemoBadge}.tsx
    kpi/KpiCard.tsx
    queue/{QueueTable,QueueToolbar,QueueFooter,MobileQueueCard,ProgressBar,StatusChip}.tsx
    feed/ActivityFeed.tsx
    streams/{StreamList,StreamRow,CpuMeter}.tsx
    health/{DiskHealthCard,Sparkline,ContainerStatusGrid}.tsx
    errors/ErrorPanel.tsx
    connectors/ConnectorCard.tsx
    onboarding/{Stepper,ServiceTile,ConnectionForm,YamlPreview}.tsx
    settings/{ConnectorsTable,InterfacePanel,WidgetsGrid}.tsx
    history/HistoryChart.tsx
    common/{Toast,EmptyState,Chip,MaskedKey,IconButton}.tsx
  lib/
    config/{schema.ts,load.ts}      zod schema + yaml parse + env resolution
    connectors/{types.ts,registry.ts,radarr.ts,sonarr.ts,plex.ts,tautulli.ts,scrutiny.ts,overseerr.ts,docker.ts,demo.ts}
    events/{types.ts,bus.ts}
    store/{connection.ts,queue.ts,feed.ts,ui.ts}
    i18n/{index.ts,useT.ts}          key-path lookup from the imported copy JSON
    format/{time.ts,number.ts}       relative time, tabular numbers
  server/
    ws.ts                           ws server: polls connectors, pushes events
    simulate.ts                     progress/ETA/stream/error tickers for demo parity
  public/brands/                    16 marks copied from design/assets/icons
  test/                             vitest unit + Playwright e2e + parity screenshots
```

---

## Phase 0 — Bootstrap and freeze the contract (Issue 1)

**Objective:** an empty app that already renders the design tokens correctly, plus a byte-identical
copy of the handoff and a QA harness.

Tasks:

1. `npx create-next-app@latest opspulse --ts --app --tailwind --eslint --src-dir=false`, set
   `"strict": true`, `noUncheckedIndexedAccess: true`.
2. Import the bundle byte-identically into `design/` — copy from the OpenDesign project dir, **not**
   from the old export:
   ```bash
   OD="$HOME/Library/Application Support/Open Design/namespaces/release-stable/data/projects/bdc23a26-9e5f-413a-a0eb-7fcf0f42fa6a"
   mkdir -p design/reference design/assets
   cp "$OD"/{README.md,components.md,tokens.css,tailwind.config.ts,copy.en.json,copy.da.json} design/
   cp -R "$OD"/reference/vision.html "$OD"/reference/vision.html.artifact.json "$OD"/reference/.build-qa.py design/reference/
   cp -R "$OD"/reference/assets/icons design/assets/
   shasum -a 256 design/*.md design/*.css design/*.json design/*.ts | tee design/.checksums
   ```
   Commit `assets/posters/` **nowhere**. Add a `design/README-IN-REPO.md` note pinned to the end that
   names the OpenDesign project id and the run id, and states that `reference/vision.html` is a board
   to read, not markup to copy.
3. `app/globals.css`: `@import "../design/tokens.css";` once, then map it into Tailwind v4 via
   `@theme inline { --color-bg: var(--bg); … }`. **Pitfall:** `design/tailwind.config.ts` is the v3
   shape; with Tailwind v4 the `theme` object cannot be imported — port every entry to `@theme inline`
   keeping the token *names* identical, then delete the unused config file from the app root.
4. Self-host fonts: `npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`, import the four
   weights in `app/layout.tsx`. Do **not** link Google Fonts (a self-hosted tool must not call out).
5. No-FOUC bootstrap in `app/layout.tsx`: inline `<script>` reading `localStorage.opspulse.ui` and
   setting `data-theme`, `data-density`, `lang` on `<html>` before paint; server default is
   `dark` / `comfortable` / `da`.
6. Harness: `vitest` + `@testing-library/react` + `pnpm/npm scripts`, `playwright` with
   `webServer` config, `npm run test` = `vitest --run`, `npm run e2e`, `npm run typecheck`.

**Verify:** `npm run build` green; a throwaway page rendering `<div class="bg-surface text-fg">`
computed-style resolves to `#121417` / `#e9ebee` in Playwright (`--op` sanity check: read
`getComputedStyle(document.documentElement).getPropertyValue('--accent')` → `#4c8dff`).

---

## Phase 1 — Shell, theme, density, language (Issue 2)

**Objective:** topbar + nav + the live connection pill, with all three switches working instantly.

- `shell/Topbar`: search input (220px, mono, `--surface-inset`, `--border-strong`, focus ring),
  theme radio (Dark/Light/System), language (Dansk/English), density (Comfortable/Compact),
  connection pill (`Live` / `Connecting…` / `Reconnecting…` / `Connection lost`), demo badge.
- `shell/Nav`: Dashboard · History · Add services · Settings, active = `--accent-soft` background +
  `--accent` text, never accent elsewhere (README principle 3).
- `store/ui.ts`: persisted `theme|language|density`; `useEffect` writes attributes on `<html>`.
- `lib/i18n`: `useT()` resolves dot-paths from the imported `copy.<lang>.json`, interpolates `{n}`
  `{title}` `{last4}`. Missing key → test failure (Vitest asserts both JSONs have identical key sets).

**Verify:** e2e — clicking Light switches `data-theme`, computed `body` background `#f5f6f8`; clicking
Compact sets `--row-h: 32px`; switching to Dansk changes all nav labels; a key-parity unit test passes.

---

## Phase 2 — Config, connectors, event bus, demo data (Issue 3)

**Objective:** real data shape behind a seam, so the UI never knows whether it is demo or live.

- `lib/config/schema.ts` — zod: `services[]` (`id,type,url,api_key|token`), `ui{theme,language,density}`,
  `widgets[]` as `[x,y,w,h]`. `load.ts` parses `opspulse.yaml`, resolves `${ENV_VAR}` from
  `process.env`, and **never** exposes a resolved secret to the client: the serialised DTO carries
  `maskedKey` only (`••••••••{last4}`).
- `lib/connectors/types.ts` — the community contract:
  ```ts
  export interface Connector {
    type: string; displayName: string; logo: string;
    hasWebEndpoint: boolean;
    healthCheck(): Promise<ConnectorStatus>;      // up|down|degraded|unknown
    queue?(): Promise<QueueItem[]>;
    streams?(): Promise<Stream[]>;
    disk?( ): Promise<DiskSample>;
    containers?(): Promise<Container[]>;
    errors?(): Promise<ErrorEvent[]>;
  }
  ```
  `registry.ts` maps type → factory; unknown type must not crash the dashboard (renders a
  `ConnectorCard` with `status: unknown`).
- Concrete connectors, in this order: `radarr`, `sonarr` (queue, `/api/v3/queue`, `X-Api-Key`),
  `plex` (`/status/sessions`, `X-Plex-Token`), `tautulli`, `scrutiny`, `overseerr`, `docker` (local
  socket). All server-side only.
- `lib/events/bus.ts` — typed `ServerEvent` union (queue.updated, item.progress, feed.appended,
  stream.updated, disk.sample, container.state, error.appended, connector.status, action.result).
- `lib/connectors/demo.ts` — deterministic PRNG seeded from a constant: **12,480 queue rows** (the
  reference's count), 8 posters as generated SVG placeholders, 8 feed events, 3 streams (1 transcode
  at 68 %), 12 containers (11 up / 1 restarting), 24-point disk history, 4 errors.

**Verify:** unit tests — yaml with `${VAR}` resolves; DTO has no key >4 chars; unknown connector type
returns `unknown`; demo generator is stable across runs (snapshot hash).

---

## Phase 3 — Realtime transport + granular store (Issue 4)

**Objective:** one socket, one store, selector-level subscriptions.

- `server/ws.ts` (`ws`): tick loop per active connector (queue progress every 1 s in demo, 5 s live),
  broadcasts `ServerEvent`s; monitors reconnects with exponential backoff; exposes
  `action.result {id, ok, reason?}` so the client never invents success.
- `npm run dev` = `next dev` + `tsx server/ws.ts` concurrently (`dev:ws`, `dev:web`).
- `store/queue.ts` — normalised `Record<id, QueueItem>` + `ids: string[]`; each row subscribes with
  `useQueueItem(id)` so a progress tick re-renders one cell. **Never** subscribe the table to the
  item map (README pitfall 1).
- `store/connection.ts` — `live|connecting|reconnecting|lost`, retry count, lastSync; drives the pill,
  the stale banner and `actionsEnabled` (actions disabled while not live).
- Optional speed knob: show a `Virtualised — {n} rows in the DOM` footer counter fed by the
  virtualiser, so the perf claim is observable in the UI.

**Verify:** unit test — dispatching 1,000 `item.progress` events does not change the identity of any
unrelated row object; Playwright — kill the ws server, pill moves live → reconnecting within 2 s.

---

## Phase 4 — Dashboard widgets (Issue 5)

Build in `components.md` order, each with states from the contract:

1. `KpiCard` — 4 cards (Downloads today / Active streams / Items in queue / Disk temperature, plus
   Errors), 28px mono 600 value, A9 count-up 500 ms ease-out cubic (skipped under reduced motion),
   hover `surface-2` + `--border-strong` 140 ms, click → `/history?metric=…`.
2. `ActivityFeed` — 26px logo tile, title 14/500, sub-line 12 `--muted`, timestamp mono `--faint` right;
   severity ok/warn/error tints the tile; new items prepend with `op-feed-in` (A1); 6 visible, "Show more".
3. `StreamList` — 40px poster (generated placeholder), mode chip Direct Play `.ok` / Transcode `.warn`,
   CPU meter 92×6 with thresholds <45 `--ok`, 45–70 `--warn`, >70 `--danger`; empty state with the
   120×60 play-in-frame line illustration.
4. `DiskHealthCard` — 28px mono temp coloured <40/40–50/>50, 120×34 sparkline with area fill +
   1.5px `--warn` line and the `--danger` 10 % band above 50°, SMART chip, threshold legend.
5. `ContainerStatusGrid` — 18px logo, 13px name, state chip with dot, uptime in a fixed 78px mono
   column, header counter `11/12 up`, text filter.
6. `ErrorPanel` — 3px severity bar (error/warning/info), 13px message + 12px sub-line, mono timestamp,
   header counts **error severity only** (README/components rule), empty state.
7. Layout: 6-column grid honouring `widgets:` `[x,y,w,h]` from config; gap `--sp-4`; `--page-max 1600px`.

**Verify:** RTL — each component's states render the exact token class; Playwright screenshot of the
dashboard matches `reference/vision.html#view-dashboard` within the parity budget (Phase 9).

---

## Phase 5 — QueueTable, the showcase (Issue 6)

**Objective:** 12,480 rows, 10 DOM rows, 60 fps, zero horizontal scroll on mobile.

- Columns exactly as `components.md` §2: Service 132 · Title flex · Quality 120 · Progress ≥140 ·
  ETA 90 · Status 118 · Actions 88; `--row-h` from density; `--border-soft` row dividers.
- `useVirtualizer` with a fixed row height per density (44/32) — **do not** measure dynamically.
- Memory cells: `React.memo` row + per-cell selectors; progress fill width via CSS transition
  (A4 400 ms), never a re-render of the row.
- Toolbar: search 220px mono + 5 filter chips, exactly one `aria-pressed="true"`.
- Footer: `{shown} of {total} items` · `Virtualised — {n} rows in the DOM` · `Idle · Pending ·
  Confirmed · Rolled back` legend, numbers mono `tabular-nums`.
- Mobile (<720px): `MobileQueueCard` list — 64px collapsed cards, first expanded by default, chevron
  44×44, expanded row holds progress %, status chip, ETA and full-width 44px pause/remove buttons.

**Verify:** Playwright perf trace — scroll the full list, assert ≥ 55 fps over 5 s and DOM rows ≤ 14;
`document.scrollingElement.scrollWidth <= innerWidth` at 390×844.

---

## Phase 6 — Optimistic actions, toast, rollback (Issue 7)

- `store/queue.ts` gains `applyOptimistic(id, patch)`, `confirm(id)`, `rollback(id, reason)`: the row
  keeps `prevState` and restores it **exactly** on error.
- Row states: idle → pending (`--accent-soft`, spinner replaces icon, `disabled`, tag `Pending`) →
  success (`--row-settle` A2, check in `--ok`, tag `Confirmed`, 1200 ms) or error
  (`--danger-soft`, cross `--danger`, tag `Rolled back` + error toast, 2600 ms).
- `Toast` — 280–380px, `--surface-3`, `--border-strong`, `--shadow-3`, 3px left accent/danger bar,
  `op-toast-in` 220 ms, auto-dismiss 6 s, `role="status"`.
- The **server** decides: the ws `action.result` is the only source of success; a rejected promise
  from the ws RPC rolls back. Actions disabled in `reconnecting`/`lost`.

**Verify:** e2e with the demo connector forced to fail one action — row shows Pending, then Rolled
back, toast text matches `toast.actionFailed`, and the row's progress/status equal the pre-action
values to the pixel.

---

## Phase 7 — Connection states (Issue 8)

- `reconnecting`: `--warn` banner over the grid (`Reconnecting…` chip right), **all data widgets only**
  get `.stale-fade` (opacity .45 + `saturate(.15)`, A6 400 ms); chrome and banner do not fade.
- `lost`: full-width banner + `EmptyState` variant "Connection lost" (`--warn` art, `Try again`),
  body text states plainly that the data is last-known and no longer live.
- `connecting`: data hidden, muted pill.
- Actions disabled while not `live` (README §4 / states view).
- Reconnect: exponential backoff 1/2/4/8/15 s, resume automatically, keep last values on screen.

**Verify:** e2e — stop ws → banner + stale-fade on data only (`getComputedStyle(banner).opacity === '1'`,
row container `0.45`); restart ws → banner gone, values resume, no page reload.

---

## Phase 8 — History, onboarding, settings (Issues 9–11)

**History** (`/history?metric=downloads|streams|errors`): segmented `hour|day|week`, `HistoryChart`
viewBox 720×260, padding 40/16/16/34, filled area with `--viz-cat-1` gradient 45 %→2 % + 2px stroke +
3px dots, errors as 6×10 `--danger` bars, gridlines per quarter of max, mono 11px labels, hover rule +
5px dot + tooltip (`--surface-3`, `--border-strong`, `--shadow-2`), summary cells Peak/Total/Average
22px mono 600. **All geometry computed from data** (`value/max × extent`); A10 draw-in 400 ms.

**Onboarding** (3 steps, `components.md` §9): service grid with 16px checkboxes and `{n} selected`;
per-service URL (`--surface-inset`, mono) + password-typed key (never prefilled) + Test connection
(testing/success/failure copy from `copy.*`); a live `opspulse.yaml` preview showing `${RADARR_API_KEY}`
style env references; step 3 confirmation; 18px stepper pips with 28px hairlines.

**Settings** (`components.md` §10): **all three panels stay mounted**; tab strip scrolls, never
unmounts. Connectors table = Service / Endpoint / Key (masked or `No key stored`) / Last sync /
Status (`Reachable` or `No web UI`) / Actions (Test, edit, delete). Interface = 3 radio groups.
Widgets = real 6-column placement grid at each tile's `[x,y,w,h]`, drag handles, "Reset layout".

**Verify:** e2e — typing a key never renders it back (`document.body.textContent` contains only the
masked form); settings tab switch keeps all three panels in the DOM; wizard Test failure shows the
exact `onboarding.testFailBody` string in both languages.

---

## Phase 9 — Empty states, mobile shell, a11y, parity QA (Issues 12–14)

- `EmptyState` ×4 (no services + CTA, no streams, no errors, connection lost) with 120×60 `--faint`
  line art, 16/600 title, 13 `--muted` body max 42ch, one action max.
- Mobile shell ≤720px: 5 fixed bottom tabs (Dashboard/Activity/Queue/Streams/Settings), queue badge
  carries the paused count, one-column stacking, 44px touch targets.
- A11y: `:focus-visible` 2 px `--accent` + 2 px offset on every control; status never colour-only
  (word in every chip); charts carry a table-equivalent summary; `prefers-reduced-motion` disables
  A1/A3/A9/A10; axe pass on all four routes with zero serious violations.
- **Parity gate:** Playwright renders both `design/reference/vision.html` (served over http from the
  project root so `../tokens.css` resolves) and the app at identical viewports (1440×900, 390×844),
  screenshots full page + each `.app` block, and diffs with a small pixel-perceptual threshold. Report
  the delta per view; investigate anything above 2 %.
  ```bash
  OD="$HOME/Library/Application Support/Open Design/namespaces/release-stable/data/projects/bdc23a26-9e5f-413a-a0eb-7fcf0f42fa6a"
  cd "$OD" && python3 -m http.server 8898 --bind 127.0.0.1   # reference, NOT a copy
  ```
- Perf: 60 fps queue scroll, INP < 200 ms on filter switch, no long task > 50 ms on a progress tick.
- Docs: root `README.md` (what it is, `opspulse.yaml` example, `--demo`, screenshots), `CONTRIBUTING.md`
  with the connector interface (the community-extensible promise), `LICENSE` MIT, `NOTICE` attribution.

---

## Acceptance criteria (from README §7) — mapping

| Criterion | Covered by |
|---|---|
| All views exist (dashboard, 3-step wizard, settings, empty states, history drilldown, mobile, token reference) | Issues 2, 4, 5, 8, 9, 12 |
| Four optimistic states + error toast | Issue 7 |
| Stale connection + lost state designed | Issue 8 |
| Tokens complete (status, 7-step sequential, 6 categorical, mono tabular) | Issue 1 |
| Light/dark from same token names, runtime switch | Issues 1, 2 |
| Complete da/en copy, runtime switch | Issue 2 + key-parity test |
| Density switch on queue + feed | Issues 2, 6 |
| Mobile breakpoint, card list, 44px targets | Issues 6, 12 |
| No secrets beyond the onboarding password field | Issues 3, 10 |

---

## Risks and open decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | Transport: WebSocket sidecar vs SSE in a route handler | **DECIDED (Benjamin, 27 Oct 2026): WS sidecar, local/Docker deployment first.** The spec's state table and the showcase claim both say WebSocket. Vercel hosting is explicitly not a constraint, so no SSE fallback is built; the portfolio links to a Docker compose + screenshots instead of a hosted demo. |
| 2 | Charts: Recharts vs visx | **Recharts** (allowed by README) with CSS-var colours passed straight through; the exact viewBox geometry in `components.md` §11 is honoured by a custom `shape`, not by library defaults. |
| 3 | Tailwind v3 config vs v4 `@theme` | **v4 `@theme inline`**; keep the shipped `tailwind.config.ts` in `design/` as documentation, never imported. |
| 4 | Repo visibility | **Public** (portfolio showcase + open source). MIT, no posters, attribution for marks. |
| 5 | Hosting | Local/Docker first (`node server/ws.ts` + Next in one container); a hosted demo needs a fake connector service. Portfolio link can point at a Docker compose + screenshots. |
| 6 | Fractional drift: README colour table vs `tokens.css` | **tokens.css wins** (three stale values listed above). Fix the README prose in `design/` only after the app is green — it is a handoff artefact. |
| 7 | Poster licensing | Generated placeholders in `public/`; the Wikipedia artwork never enters the repo. |

## Estimated shape

14 issues · ~4.5–6k LOC including tests · the long poles are Issue 6 (virtualised queue) and Issue 9
(chart geometry from data). Everything else is contract-following, which is why the handoff is
imported byte-identically first: any divergence is then a review finding, not a judgement call.
