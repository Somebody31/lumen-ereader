# Agent notes — Lumen

- Product truth: `PRODUCT.md`
- Visual system: `DESIGN.md` (planetarium booth; one star accent)
- Meaningful changes: append `docs/DECISIONS.md`
- Stack: SvelteKit + Bun + Hono + adapter-cloudflare; no React
- Local-first IndexedDB; R2/KV sync only when secrets + bindings exist
- Do not run production deploy unless the user asks
