# Decisions

## 2026-08-02 — Initial Lumen e-reader

- **What:** Greenfield SvelteKit + Bun + Hono e-reader (Lumen) with local-first IndexedDB, EPUB/text/MD import, optional R2/KV sync, Impeccable planetarium-booth design world.
- **Why:** User requested stunning offline reader deployable to Cloudflare Workers; stack locked to SvelteKit/Bun/Hono; design via Impeccable concept-seed (grounded direction #7: planetarium control booth).
- **Not done:** Production `wrangler deploy` left for the user; KV/R2 ids and secrets must be created before cloud sync works.
