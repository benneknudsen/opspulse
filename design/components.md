# OpsPulse — component contract

Every value below is a token name from `tokens.css`. If a component needs a
value that is not in the table, the **token scale is wrong**, not the component.
All states are specified — "it looks fine" is not a state.

Shared conventions: 4px spacing base, 14px UI text, 13px in compact density,
`--font-mono` with `tabular-nums` for every number, `1px solid var(--border)`
hairlines, no drop shadows except on overlays (toast, popover, modal).

---

## 1. `KpiCard`

The four headline numbers on the dashboard. Clickable — they drill into history.

| Prop | Type | Values | Notes |
|---|---|---|---|
| `label` | string | i18n key | `.label` style, 11px, uppercase, `--muted` |
| `value` | number | — | `.num`, 28px, 600, `--track-display`; animates 0 → value over 500ms, ease-out cubic |
| `delta` | string | i18n key with `{n}` | 12px `--muted`; `--warn` when the delta is a warning, `--ok` when positive |
| `onClick` | () => void | — | navigates to the history view for this metric |

States: `default` · `hover` (surface-2 + `--border-strong`, 140ms) · `focus-visible`
(2px `--accent` outline, offset 2px) · `counting` (value animating in).
Contrast: label `--muted` on `--surface` ≥ 4.5:1 in both themes.

---

## 2. `QueueTable` — the showcase component

Virtualised (TanStack Table + a virtualiser). 10,000+ rows at 60 fps.

### Columns

| Column | Width | Content | Sortable | Notes |
|---|---|---|---|---|
| Service | 132px | logo 16px + service name | yes | name in `--muted` 12px; logo is the connector's own mark |
| Title | flexible | title (500) + sub-line (12px `--muted`) | yes | ellipsis; the sub-line carries year/episode/runtime |
| Quality | 120px | mono 12px `--fg-2` | yes | `Bluray-1080p`, `WEB-DL-2160p` … |
| Progress | ≥ 140px | 6px track + fill + right-aligned % | yes | fill `--accent`, track `--surface-3`, radius pill; width transitions 400ms ease-out |
| ETA | 90px | mono, right-aligned | yes | `—` when unknown or paused |
| Status | 118px | pill | yes | see status table below |
| Actions | 88px | 2 icon buttons, right-aligned | no | pause/resume + remove; 26×26 hit area, 26px min for touch on mobile cards |

### Status mapping

| Status | Chip class | Colour | Label |
|---|---|---|---|
| downloading | `.chip.ok` | `--ok` | Downloading |
| seeding | `.chip.neutral` | `--muted` | Seeding |
| paused | `.chip.warn` | `--warn` | Paused |
| failed | `.chip.danger` | `--danger` | Failed |

### Progress bar variants

| Variant | Fill | Used when |
|---|---|---|
| default | `--accent` | downloading / seeding |
| paused | `--stale` | progress frozen, row paused |
| failed | `--danger` | the item failed mid-download |

### Toolbar

Global search input (mono, 220px, `--surface-inset` background, `--border-strong`
border, focus → 2px `--accent` outline) + 5 filter chips (All, Downloading,
Seeding, Paused, Failed). Exactly one chip is `aria-pressed="true"`.

### Footer

`{shown} of {total} items` · `Virtualised — {n} rows in the DOM` ·
state legend `Idle · Pending · Confirmed · Rolled back`. All 12px `--muted`,
count numbers in mono with `tabular-nums`.

### Optimistic action states (all four are mandatory)

| State | Row background | Button | Extra | Duration |
|---|---|---|---|---|
| idle | transparent | pause / remove icons, 26×26 | — | — |
| pending | `--accent-soft` | spinner replacing the icon, `disabled` | `.state-tag` "Pending" in `--accent` | until server reply |
| success | `--row-settle` animation `--accent-soft` → transparent | check icon in `--ok` | `.state-tag` "Confirmed" | 1200ms, then back to idle |
| error | `--danger-soft` | cross icon in `--danger` | `.state-tag` "Rolled back" + error toast | 2600ms, then back to idle |

Rule: the **server** decides the outcome. The client never invents a success.
On error the row is restored to its exact previous state and a toast appears
with the title of the item and the reason.

### Stale (connection lost) state

Banner above the grid: `--warn` border, `--warn-soft` background, title
"Reconnecting to the OpsPulse backend" + one line of explanation + a
`Reconnecting…` chip on the right. **All** data widgets inside receive
`.stale-fade`: `opacity 0.45` and `filter: saturate(0.15)`, transitioned over
400ms. The banner and the chrome do not fade — only data does.

---

## 3. `ActivityFeed`

| Prop | Type | Notes |
|---|---|---|
| `events` | `FeedEvent[]` | newest first |
| `serviceFilter` | `string \| null` | service id; `null` = all services |
| `maxItems` | number | 6 visible, "Show more" expands |
| `onAction` | `(event) => void` | optional actionable event (retry, open) |

Row: 26px icon tile (connector logo, 15px) · title (14px 500) · sub-line
(12px `--muted`: "Radarr · Download finished") · timestamp (mono 12px
`--faint`, right).

Severity: `ok` (default) · `warn` (icon tile gets `--warn` border and
`--warn-soft` background) · `error` (same with `--danger`, and the title text
turns `--danger`).

New events animate in with `op-feed-in` (220ms, translateY(-6px) → 0, opacity
0 → 1). The list is **not** re-rendered; new items are prepended.

---

## 4. `StreamList`

| Prop | Type | Notes |
|---|---|---|
| `streams` | `Stream[]` | from Plex via the OpsPulse backend |
| `onSelect` | `(stream) => void` | opens the stream detail |

Row: 40px poster (rounded 4px, 1px border, `object-fit: cover`, real artwork) ·
title (500) · meta line 1: user · device · bitrate (mono) · meta line 2:
"Started 42 min ago" · right column: mode chip + optional CPU meter.

Mode chip: **Direct Play** = `.chip.ok`; **Transcode** = `.chip.warn`.
The Transcode row also carries a CPU meter — 92px track, 6px bar, 11px label
row "Transcoder load" + right-aligned mono percentage.

CPU meter thresholds: `< 45%` `--ok` · `45–70%` `--warn` · `> 70%` `--danger`.

Empty state: "No active streams" + "Nobody is watching right now." with a calm
line illustration (play triangle inside a frame, 120×60, `--faint`).

---

## 5. `DiskHealthCard`

| Prop | Type | Notes |
|---|---|---|
| `device` | string | e.g. "Media" |
| `tempC` | number | current temperature |
| `minC` / `maxC` | number | 24h range |
| `smart` | `ok \| warning \| failed` | |
| `uptime` | string | |
| `history` | number[] | 24 points, one per hour |

Temperature value: 28px mono 600, coloured `--ok` < 40°, `--warn` 40–50°,
`--danger` > 50°. Sparkline: 120×34 SVG, area fill + 1.5px line in `--warn`,
with a `--danger` 10%-opacity band above 50° so the threshold is visible.
SMART badge: `.chip.ok` / `.chip.warn` / `.chip.danger`.
Threshold legend line under the card: "Green below 40° · yellow 40–50° · red above 50°".

---

## 6. `ContainerStatusGrid`

| Prop | Type | Notes |
|---|---|---|
| `containers` | `Container[]` | name, logo, state, uptime |
| `filter` | string | text filter on name |

Row: logo 18px · name 13px · spacer · state chip · uptime (mono 12px,
`--muted`, fixed 78px so the column does not jitter).
State: Up = `.chip.ok` + `--ok` dot · Down = `.chip.danger` + `--danger` dot ·
Restarting = `.chip.warn` with a spinner.
Header shows a counter chip `11/12 up`.

---

## 7. `ErrorPanel`

| Prop | Type | Notes |
|---|---|---|
| `errors` | `ErrorEvent[]` | severity, service, text, timestamp |

Row: 3px severity bar (`.sev.error` `--danger`, `.sev.warning` `--warn`,
`.sev.info` `--accent`) · message 13px + sub-line 12px `--muted`
("Unpackerr · Error") · timestamp mono 12px `--faint`.
Header chip: `{n} errors in the last 24 hours` — counts **error severity only**;
warnings and info are listed but not counted as errors. Empty state: "No
errors" + "Every service reported healthy in the last 24 hours."

---

## 8. `ConnectorCard` (generic, community-extensible)

The plug-in surface. A connector declares a type, a display name, a logo and a
health check; OpsPulse renders the card the same way for every one of them.

| Prop | Type | Notes |
|---|---|---|
| `type` | string | `radarr`, `sonarr`, `plex`, `tautulli`, `scrutiny`, `overseerr`, `prowlarr`, `unpackerr`, `maintainerr`, `kometa`, `portainer`, `watchtower`, `flaresolverr`, … community types allowed |
| `name` | string | display name |
| `logo` | string | 22px mark, `object-fit: contain` |
| `status` | `up \| down \| degraded \| unknown` | drives the chip colour |
| `lastSync` | string | relative time, mono |
| `maskedKey` | string | last 4 characters only, e.g. `••••••••a1f3`; never the full key |
| `onTest` | () => Promise<void> | runs the connector's health check |

Card: 22px logo · name 13px 500 · type 12px `--muted` · masked key (mono,
`--muted`, letterspaced) · last sync (mono 12px) · test chip · edit icon button
· delete icon button (danger on hover only).

**Credentials never reach the browser.** The settings list shows a masked key.
The only place a key is typed is the onboarding wizard, in a `type="password"`
field, and it is posted to the OpsPulse backend — never rendered back.

---

## 9. `OnboardingWizard` (3 steps)

**Step 1 — pick services.** Grid of `ServiceTile` (3 columns): 22px logo, name
13px 500, type 12px `--muted`, a 16px check box on the right. Selected tiles
get a `--accent` border and `--accent-soft` background. Header shows
"{n} selected".

**Step 2 — connect and authenticate.** Per selected service: logo + name + type
chip, then a URL field (`--surface-inset`, mono, placeholder
`http://localhost:7878`) and a key field (`type="password"`, mono, never
prefilled), then a **Test connection** button with a live result line.

| Test result | Colour | Copy |
|---|---|---|
| testing | `--muted`, button shows a spinner and is disabled | "Testing…" |
| success | `--ok` with a check | "Connection succeeded" |
| failure | `--danger` with a cross | "Could not reach the service — check the URL, the port and that the service is running." |

Beside the form, a live `opspulse.yaml` preview shows the generated config
with `${RADARR_API_KEY}`-style env references, plus the note: the key can come
from the environment and is never written into the config file.

**Step 3 — done.** Confirmation + a mini dashboard preview + one primary CTA
("Open the dashboard"). A secondary ghost button ("Skip for now") is allowed
here because it is a different action, not a second copy of the CTA.

Stepper: 18px circular pips (✓ when done, accent when active, muted when
todo), separated by 28px hairlines.

---

## 10. `SettingsView`

Three tabs: **Connectors**, **Interface**, **Widgets**.

All three panels stay mounted. The tab strip marks the active one and scrolls
to it — it does not unmount the other two, so a static export of the
reference shows the whole settings surface.

*Connectors* is a six-column table: **Service / Endpoint / Key / Last sync /
Status / Actions**.

| Column | Content |
|---|---|
| Service | connector logo, display name, role (`svcType.*`) |
| Endpoint | base URL, monospace; `No web endpoint` when the service exposes no HTTP API |
| Key | masked `••••••••{last4}`, or `No key stored` — never the original value |
| Last sync | relative time (`Synced 4s ago`) |
| Status | `Reachable` chip, or a neutral `No web UI` chip for services without an HTTP API |
| Actions | **Test**, edit, delete |

- *Interface* — theme (Dark / Light / System), language (Dansk / English),
  density (Comfortable / Compact). All three are radio groups; the density
  row explains the effect: "Compact reduces row height and padding across
  every table and list." A masked key sample sits below as the storage
  reference.
- *Widgets* — a 6-column placement grid matching the `widgets:` block in
  `opspulse.yaml`. Each tile is positioned at its `[x, y, w, h]` coordinates
  and shows them, so the preview is the config file. Tiles carry a drag
  handle and a hover state; "Reset layout" restores the default.

---

## 11. `HistoryChart`

| Prop | Type | Notes |
|---|---|---|
| `range` | `hour \| day \| week` | segmented control, one selected |
| `series` | `{ downloads: number[]; errors: number[] }` | — |
| `labels` | `string[]` | x axis |

Geometry: viewBox 720×260, padding 40/16/16/34. Downloads render as a **filled**
area chart — a `--viz-cat-1` gradient from 45% to 2% opacity — plus a 2px
stroke and 3px dots. Errors render as 6×10 `--danger` bars on the same
baseline. Gridlines every quarter of the max value, labels in mono 11px.

All bar and line geometry is **computed from the data** (`value / max × extent`),
never eyeballed as a percentage. One `--max` per chart.

Hover: a vertical rule at the nearest x, an enlarged 5px dot, and a tooltip
above the point showing the bucket label, the download count and the error
count. Tooltip background `--surface-3` with a `--border-strong` border and
`--shadow-2` so it stays readable over the plot.

Summary cells: Peak / Total / Average — 22px mono 600.

---

## 12. `EmptyState`

| Prop | Type | Notes |
|---|---|---|
| `art` | SVG | calm line illustration, 120×60, `--faint` |
| `title` | i18n key | 16px 600 |
| `body` | i18n key | 13px `--muted`, max 42ch, centred |
| `action` | `{ label, onClick }` | optional; one primary button max |

Four shipped states: **no services configured** (CTA → onboarding),
**no active streams**, **no errors**, **connection lost** (`--warn` art +
"Try again"). The connection-lost body states plainly that the data shown is
the last known state and is no longer live.

---

## 13. `Toast`

| Prop | Type | Notes |
|---|---|---|
| `title` | string | 13px 500 |
| `body` | string | optional, 12px `--muted` |
| `variant` | `info \| error` | left border `--accent` / `--danger` |
| `onDismiss` | () => void | ✕ button, 12px `--muted` |

Width 280–380px, `--surface-3` background, `--border-strong` border,
`--shadow-3`, 3px left accent bar. Enters with `op-toast-in` (220ms).
Auto-dismiss after 6 s.

---

## 14. `MobileQueueCard` (< 720px)

The queue table becomes a card list. Each card: 34px connector logo · title
13px 500 · sub-line 11px `--muted` (service · quality) · chevron button
44px touch target. Expanding reveals the progress bar with its percentage, the
status chip, the ETA, and the pause / remove buttons as full-width 44px-tall
buttons. The first card is expanded by default so the pattern is legible
without interaction.

---

## Motion index

| Id | Name | Duration | Easing | Where |
|---|---|---|---|---|
| A1 | Feed item enters | 220ms | `cubic-bezier(0.16,1,0.3,1)` | new activity row |
| A2 | Optimistic row settles | 400ms | `cubic-bezier(0.16,1,0.3,1)` | success state |
| A3 | Live dot pulse | 1200ms loop | `cubic-bezier(0.4,0,0.2,1)` | connection pill |
| A4 | Progress bar width | 400ms | `cubic-bezier(0.16,1,0.3,1)` | queue progress |
| A5 | Toast enter | 220ms | `cubic-bezier(0.16,1,0.3,1)` | toast |
| A6 | Stale fade | 400ms | ease-out | connection lost |
| A7 | Hover / focus | 140ms | `cubic-bezier(0.4,0,0.2,1)` | all controls |
| A8 | Pending spinner | 900ms loop | linear | pending action |
| A9 | KPI count-up | 500ms | ease-out cubic | KPI values |
| A10 | Chart draw-in | 400ms | ease-out | history view |

`prefers-reduced-motion: reduce` disables A1, A3, A9 and A10; state changes
become instant rather than animated.
