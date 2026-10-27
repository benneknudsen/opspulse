# Agent notes — OpsPulse

Design contract lives in [`design/`](design/). Read
[`design/README-IN-REPO.md`](design/README-IN-REPO.md) before changing
anything visual: the handoff files are frozen, `tokens.css` is the single
source of truth, and `reference/vision.html` is a board to read, never markup
to copy.

## QA commands

Run these from the repository root before reporting work as done:

```bash
npm run build
npm run typecheck
npm run lint
npm test -- --run --reporter=dot
```

End-to-end tests (Playwright) live in `test/e2e`:

```bash
npm run e2e
```

## Frozen handoff

`design/` is frozen: every file there is byte-identical to the handoff and
must never be edited without a new handoff round. Verify with:

```bash
cd design && shasum -a 256 -c .checksums
```

## Z-index

Tailwind v4 exposes z-index through the `--z-index-*` namespace. The port
maps `--z-index-toast: var(--z-toast)` (and the other layers) in
`app/globals.css`, so use the generated utility `z-toast`, `z-overlay`,
`z-dropdown` or `z-sticky`. Use the arbitrary form `z-[var(--z-toast)]` only
when no namespace utility exists.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
