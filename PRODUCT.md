# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who want a private, calm place to read long-form text on a phone or laptop. Primary job: open a book they already have (EPUB or plain text/Markdown), keep reading where they left off, and stay offline when the network is gone. Secondary job: optionally sync the same library across devices when they choose to sign in.

## Product Purpose

**Lumen** is a local-first e-reader that makes importing a file and continuing a chapter feel effortless and beautiful. Success means: a book is open within seconds of drop, position always restores, reading chrome stays out of the way, and the app still works with no server.

## Positioning

Local-first storage (IndexedDB) is the source of truth for reading. Cloudflare R2 + KV are an optional sync layer behind passphrase auth, not a gate to open a book. The product is an instrument for reading, not a storefront, social feed, or cloud library marketplace.

## Operating Context

- Desktop and mobile browsers; progressive enhancement for touch and keyboard.
- Files come from the user's device (drag-drop or file picker): `.epub`, `.txt`, `.md`.
- Reading happens in long sessions; UI must hide and restore without losing place.
- Deploy target: Cloudflare Workers (SvelteKit + Hono API).

## Capabilities and Constraints

**v1 capabilities**
- Library: list, search, continue reading, delete, import.
- Formats: EPUB (client-side), plain text and Markdown.
- Reader: themes (night, paper, sepia, high-contrast), type scale, margins, line height, TOC (EPUB), progress, simple bookmarks, focus mode, keyboard shortcuts.
- Offline: full read/import without network.
- Optional cloud: R2 for book blobs, KV for metadata/progress; passphrase session auth.

**Constraints**
- No PDF in v1.
- No multi-user SaaS admin, DRM, or store.
- Auth is optional; missing secrets means local-only with a clear status.
- Stack: SvelteKit, Bun, Hono, `@sveltejs/adapter-cloudflare`.

**Open decisions**
- Product name **Lumen** is a working name (assumption).
- Auth strategy **A**: passphrase → HMAC session cookie (assumption).

## Brand Commitments

None locked by the user beyond: very high UI/UX quality, Impeccable-driven design, not a generic cream-paper “book app” cliché unless intentionally chosen.

## Evidence on Hand

No real user library, covers, or branding assets. Sample content must be public-domain or clearly labeled synthetic. Do not invent customers, reviews, or benchmarks.

## Product Principles

1. **Reading first** — the page is the product; chrome recedes.
2. **Local-first** — never block reading on network or account.
3. **Honest empty states** — teach import; no fake shelves.
4. **Instrument, not marketplace** — no storefront patterns.
5. **Keyboard and touch equal** — power users and phones both work.

## Accessibility & Inclusion

Target WCAG 2.2 AA for core chrome and reader controls. Support `prefers-reduced-motion`. High-contrast reading theme required. Body text in reader aims for comfortable measure (~65–75ch) and adjustable size.
