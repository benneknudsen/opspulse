# OpsPulse — design specification

Real-time operations dashboard for self-hosted media servers.
Open-source, configuration-first, dark-first.

> **Status:** design handoff. This document is the contract. `tokens.css` is the
> single source of truth for visual values; `components.md` is the contract for
> component props and states; `copy.en.json` / `copy.da.json` are the only
> place UI strings live; `reference/vision.html` is the executable reference.

---

## 1. Design principles

**1 — Configuration first, never hardcoded.**
OpsPulse renders whatever the user's `opspulse.yaml` (or the onboarding wizard)
declares. No service, no container, no library path and no language is baked
into the product. The connector card is generic: a community contributor adds a
type by implementing the connector interface, and the UI needs no change.

**2 — The server is the only caller.**
The browser talks to the OpsPulse backend and to nothing else. API keys, Plex
tokens and service URLs never leave the server. The UI's only credential
surface is a `type="password"` field in the onboarding wizard; the settings
list shows a masked key (`••••••••a1f3`) and never the original.

**3 — One accent, used sparingly.**
`--accent` is a single blue, reserved for interactive elements, focus rings and
one focal element per screen. Status colours are **functional**, never
decorative: green = ok/complete, yellow = warning/transcode, red = error/down,
grey = stale. If a colour does not encode a state, it does not exist.

**4 — Dark first, because this is a tool people stare at.**
Dark is the default theme and the one that gets the most attention. Light is a
first-class theme with the same token names, not an afterthought. No gradients,
no glassmorphism, no purple wash — the reference is a console, not a landing
page.

**5 — Real-time, without the noise.**
Motion is reserved for information that actually changed: a feed item arriving,
a number moving, a row settling, a live indicator pulsing. A badge that can
never change state does not get rendered.

**6 — Density is a first-class token.**
Comfortable (44px rows) and compact (32px rows) are the same layout at two
scales, switched by one attribute on `<html>`. Long sessions need the second
one; a projector needs the first.

**7 — Honest about failure.**
Losing the backend is a designed state, not an error page: a banner, the data
greyed out, and a plain sentence saying the numbers are no longer live.
Optimistic actions can fail, and failure is shown as a rollback, not hidden.

---

## 2. Tokens

Full definitions with light/dark values live in `tokens.css`; the mapping into
Tailwind lives in `tailwind.config.ts`. Both files reference the same names.

### 2.1 Colour

| Token | Role | Dark | Light |
|---|---|---|---|
| `--bg` | page canvas | `#0b0c0e` | `#f5f6f8` |
| `--surface` | cards, panels | `#121417` | `#ffffff` |
| `--surface-2` | headers, hover, inset rows | `#171a1e` | `#f1f3f5` |
| `--surface-3` | raised, chip fills | `#1e2226` | `#e7eaee` |
| `--surface-inset` | inputs, sunken areas | `#0e1012` | `#eef0f3` |
| `--fg` | primary text | `rgba(0,0,0,0.95)`-equivalent `#e9ebee` | `#14171a` |
| `--fg-2` | secondary text | `#a8b0b8` | `#454c54` |
| `--muted` | labels, captions | `#79818a` | `#6c7480` |
| `--faint` | timestamps, disabled | `#545c65` | `#8b939c` |
| `--border` | hairline | `rgba(255,255,255,.09)` | `rgba(0,0,0,.11)` |
| `--border-strong` | inputs, chips | `rgba(255,255,255,.16)` | `rgba(0,0,0,.2)` |
| `--accent` | the one accent | `#4c8dff` | `#1f6feb` |
| `--accent-hover` / `--accent-active` | button states | `#6ba1ff` / `#3a78e0` | `#1a5fd0` / `#1854b8` |
| `--ok` | ok / complete / up | `#3fb950` | `#1a7f37` |
| `--warn` | warning / transcode / paused | `#d29922` | `#9a6700` |
| `--danger` | error / down / failed | `#f85149` | `#cf222e` |
| `--stale` | stale data, neutral | `#6b7280` | `#8b949e` |

Each status colour ships with a `-soft` variant (`--ok-soft` …) used for chip
and banner backgrounds so a status can be tinted without a second hue.

### 2.2 Data visualisation

Two scales, both required:

- **Sequential** `--viz-seq-1` … `--viz-seq-7` — seven distinguishable steps
  from a single hue family, ordered dark→light in dark theme and light→dark in
  light theme. Used for heat maps, density and magnitude.
- **Categorical** `--viz-cat-1` … `--viz-cat-6` — six hues chosen to stay
  separable at 2px stroke width and in greyscale: blue, green, amber, red,
  violet, teal. Used for series identity.

Charts always use **filled** data encoding — an area with a gradient fill, or
bars with a solid fill. An outline alone is not a chart.

### 2.3 Typography

Two families, one of them monospace.

| Role | Token | Family | Size / weight |
|---|---|---|---|
| UI text | `--font-ui` | IBM Plex Sans (system fallback) | 14px / 400 |
| UI emphasis | — | — | 500 (interactive), 600 (headings) |
| Numbers, timestamps, ETAs, percentages, quality tags | `--font-mono` | IBM Plex Mono | 12–28px, `tabular-nums` |
| Labels | — | UI | 11px, uppercase, `letter-spacing: .06em` |

Every number that can change in place (progress %, ETA, uptime, counts) uses
`font-variant-numeric: tabular-nums` so digits do not jitter as they update.

### 2.4 Spacing, radius, elevation

Spacing is a 4px base with an 8/12/16/20/24/32/40/48/64 scale
(`--sp-1` … `--sp-16`). Radius: 4px controls, 6px small cards, 8px widgets,
12px large panels, pill for chips. Elevation is **border-first**: hairlines and
surface tints carry the structure; shadows appear only on true overlays
(toast, popover, modal) as `--shadow-1/2/3`.

### 2.5 Density

| Token | Comfortable | Compact |
|---|---|---|
| `--row-h` | 44px | 32px |
| `--cell-py` / `--cell-px` | 11px / 14px | 5px / 10px |
| `--feed-item-py` | 10px | 5px |
| `--widget-pad` | 16px | 12px |
| `--fs-cell` / `--fs-feed` | 14px | 13px |

Switched with `data-density` on `<html>`; the queue table and the activity
feed both respond.

---

## 3. Animation

| Id | Name | Duration | Easing | Applies to |
|---|---|---|---|---|
| A1 | Feed item enters | 220ms | `cubic-bezier(.16,1,.3,1)` | new activity row (translateY -6px → 0) |
| A2 | Optimistic row settles | 400ms | `cubic-bezier(.16,1,.3,1)` | success state, `--accent-soft` → transparent |
| A3 | Live dot pulse | 1200ms loop | `cubic-bezier(.4,0,.2,1)` | connection pill dot |
| A4 | Progress bar width | 400ms | `cubic-bezier(.16,1,.3,1)` | queue progress fill |
| A5 | Toast enter | 220ms | `cubic-bezier(.16,1,.3,1)` | toast (translateY 10px, scale .98) |
| A6 | Stale fade | 400ms | ease-out | data widgets, opacity .45 + saturate(.15) |
| A7 | Hover / focus | 140ms | `cubic-bezier(.4,0,.2,1)` | every interactive element |
| A8 | Pending spinner | 900ms loop | linear | pending action button |
| A9 | KPI count-up | 500ms | ease-out cubic | KPI values on first paint |
| A10 | Chart draw-in | 400ms | ease-out | history area/line |

Motion budget: nothing else moves. Under `prefers-reduced-motion: reduce`,
A1, A3, A9 and A10 are disabled and state changes become instant.

---

## 4. State overview

### 4.1 Connection

| State | Trigger | Presentation |
|---|---|---|
| live | WebSocket open | `--ok` "Live" pill with a pulsing dot |
| connecting | initial handshake | `--muted` "Connecting…" pill, data hidden |
| reconnecting | socket dropped, retrying | `--warn` "Reconnecting…" pill + banner over the grid, data greyed (`.stale-fade`) |
| lost | retries exhausted | full-width banner: title, one line of explanation, "Try again" button |

Stale data is **visibly stale**: desaturated and dimmed, never presented as
current. A silent "frozen" screen is the failure mode this state exists to
prevent.

### 4.2 Optimistic actions

| State | Row | Button | Feedback |
|---|---|---|---|
| idle | transparent | pause/resume + remove | — |
| pending | `--accent-soft` | spinner, disabled | "Pending" tag in `--accent` |
| success | settle animation | check in `--ok` | "Confirmed" tag, toast, reverts after 1200ms |
| error | `--danger-soft` | cross in `--danger` | "Rolled back" tag + error toast, reverts after 2600ms |

The client applies the change immediately, the server is the source of truth,
and a failure restores the exact previous state.

### 4.3 Empty states

No services configured (with CTA to onboarding) · no active streams · no errors
· connection lost. Each carries a calm line illustration, one sentence of
explanation, and at most one action.

### 4.4 Theme, language, density

Theme `dark | light | system`, language `da | en`, density
`comfortable | compact` — all three live in the interface settings and are
applied instantly in the reference.

---

## 5. Accessibility

- Every interactive element has a visible `:focus-visible` ring: 2px
  `--accent` outline, 2px offset.
- Body text meets 4.5:1 in both themes; large text and icons meet 3:1.
- Status is never colour-only: every status chip carries a word.
- Charts are not the only source of truth — every chart has a table-equivalent
  summary (peak / total / average) and labelled data points.
- All touch targets are ≥ 44px on the mobile layout.
- `prefers-reduced-motion` is honoured.
- The queue table exposes row state through text tags ("Pending", "Confirmed",
  "Rolled back"), not through a colour alone.

---

## 6. Pitfalls

1. **Do not re-render the queue on every progress tick.** The showcase claim
   is 10,000+ rows at 60fps. Only the changed cell updates — progress width
   transitions, the rest of the row is untouched.
2. **Do not show full credentials anywhere.** The settings list shows
   `••••••••a1f3`. There is no "reveal" and no copy-to-clipboard of a secret.
3. **Do not let the status palette drift into decoration.** A violet card
   header because it looks nice is a bug, not a choice.
4. **Do not freeze the screen silently when the socket dies.** Grey the data,
   show the banner, keep the chrome alive.
5. **Do not let the mobile queue table scroll horizontally.** Below 720px it
   becomes a card list with expandable rows.
6. **Do not invent numbers.** Every metric in the reference comes from the demo
   data set; there are no marketing-style "10× faster" claims anywhere.
7. **Do not use emoji as icons.** Connector marks are the projects' own logos;
   everything else is a monoline SVG.
8. **Do not hotlink images.** Posters and service marks are project-local
   files under `reference/assets/`.

---

## 7. Acceptance criteria

- [x] All views from the brief exist in `reference/vision.html`: dashboard,
      onboarding wizard (3 steps), settings (connectors / interface / widgets),
      empty states, history drilldown, mobile breakpoint, token reference.
- [x] All four optimistic-UI states are shown for queue actions
      (idle / pending / confirmed / rolled back, with the error toast).
- [x] The stale-connection state is designed: warn banner + data greyed and
      desaturated, plus a separate full "connection lost" empty state.
- [x] Tokens cover colours (incl. four functional status colours and a
      7-step sequential + 6-step categorical data-viz palette), typography
      (incl. mono with tabular numerals), spacing, radius, shadows, motion
      timings and both densities.
- [x] Light and dark themes are specified from the same token names; the
      reference switches at runtime.
- [x] Danish and English copy is complete in `copy.da.json` / `copy.en.json`,
      and the reference switches language at runtime from those strings.
- [x] Density toggle is demonstrated on the queue table and the activity feed
      (comfortable 44px / compact 32px rows).
- [x] Mobile breakpoint is designed: feed and streams stack, the queue becomes
      a card list with an expandable row and 44px touch targets.
- [x] No API keys or auth beyond the onboarding input: password field only,
      masked values everywhere else.

---

## 8. Deliverables

| File | Purpose |
|---|---|
| `tokens.css` | single source of truth for colours, type, spacing, radius, shadows, motion, density |
| `tailwind.config.ts` | Tailwind mapping of the same token names — no new values |
| `components.md` | component contract: props, states, exact values |
| `copy.en.json` / `copy.da.json` | every UI string, both languages |
| `reference/vision.html` | executable design reference — all views, live theme/language/density switching |
| `reference/assets/icons/` | connector logos (each project's own mark) |
| `reference/assets/posters/` | real poster artwork used in the stream and queue views |
| `reference/.build-qa.py` | regenerates the QA renders (`all` / `spec` / `states` / `danish`) from `vision.html` |

### Attribution

- Connector marks are the projects' own logos (Radarr, Sonarr, Prowlarr,
  Tautulli, Plex, Overseerr, Scrutiny, Maintainerr, Unpackerr, Kometa,
  Portainer, Watchtower, FlareSolverr), used to identify the service in the UI.
- Poster artwork is from Wikipedia and is non-free; it is used here only as
  mock data for the design reference and is not part of the product.

### Settings navigation

The settings view keeps all three panels — **Connectors**, **Interface** and
**Widgets** — mounted at once. The tab strip marks the active panel and
scrolls to it; it does not hide the other two. A handoff document that hides
two thirds of a screen behind a click is not a handoff, and a static export
would otherwise never show them.

The **Widgets** panel is a real placement preview, not a list of names: it
renders the same 6-column grid the `widgets:` block in `opspulse.yaml`
declares, with each tile at its `[x, y, w, h]` position and a drag handle.

### Implementation notes

- Next.js App Router, strict TypeScript. `tokens.css` is imported once in
  `app/globals.css`; `tailwind.config.ts` maps its variables.
- The queue table is TanStack Table + a virtualiser; the 12,480-row demo set
  in the reference renders 10 DOM rows.
- Real-time state is a granular store (Zustand/Jotai) with selector-based
  subscriptions so a progress tick updates one cell, not the table.
- Charts are Recharts or visx. Every series is computed from the data — no
  hand-tuned bar percentages.
- i18n from day one: the copy files are loaded by key, and the reference
  already switches between them.
