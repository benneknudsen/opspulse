# Design handoff — in-repo note

This directory is a byte-identical import of the OpenDesign handoff. Treat
`README.md`, `components.md`, `tokens.css`, `tailwind.config.ts`,
`copy.en.json`, `copy.da.json` and `reference/` as frozen contract files: any
divergence from the source is a review finding, not a judgement call.

- OpenDesign project: `bdc23a26-9e5f-413a-a0eb-7fcf0f42fa6a` ("OpsPulse design handoff complete")
- Run: `8d2bb226-82f9-4b0d-9e11-f4f57518d95f` (succeeded 2026-10-22)
- Imported: 2026-10-27

`reference/vision.html` is a board to *read*, never markup to copy. Rebuild
components from `components.md` and the tokens, so the implementation stays
honest to the contract instead of growing a second, drifting stylesheet.

`assets/posters/` is deliberately absent. That artwork is non-free Wikipedia
material and must not be committed.

`design/.checksums` records SHA-256 hashes for the contract files. Verify with:

```bash
cd design && shasum -a 256 -c .checksums
```
