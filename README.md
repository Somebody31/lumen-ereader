# Lumen

Local-first e-reader with an editorial nocturne UI (near-black ground, warm ivory type, Newsreader + Source Sans 3 + Literata, crimson emphasis, soft radii). Import EPUB, Markdown, or plain text; read offline; optionally sync to Cloudflare R2 + KV behind a passphrase.

**Stack:** SvelteKit · Bun · Hono · Tailwind v4 · IndexedDB · `@sveltejs/adapter-cloudflare`

## Features

- Library with continue-reading, search, delete, drag-drop import
- Reader: Night / Paper / Sepia / High-contrast, type scale, measure, focus mode
- EPUB (epubjs) + text/Markdown
- Chinese webnovel translation (DeepSeek V4 Flash): pick chapters, one glossary for the model and the reader, ZH/EN toggle on the same book
- Progress restore (local); optional cloud push/pull when configured
- Sample story seeds on first empty library

## Develop

```bash
bun install
bun run dev
```

Open the printed local URL. Import a `.epub`, `.md`, or `.txt`, or open the seeded sample.

To translate a Chinese EPUB, set a server-side key (never commit it):

```bash
# local
echo 'DEEPSEEK_API_KEY=sk-...' >> .env

# Cloudflare
bunx wrangler secret put DEEPSEEK_API_KEY
```

Then open **Translate**, drop the EPUB, check the chapters you want, and start. The English copy lives on the same library card; press **L** or the ZH/EN control in the reader. **G** opens the glossary.

```bash
bun run check   # types
bun run build   # production build
bun run preview # preview build (adapter-dependent)
```

## Cloudflare setup (before deploy)

1. Install / login Wrangler: `bunx wrangler login`
2. Create R2 bucket: `bunx wrangler r2 bucket create lumen-books`
3. Create KV: `bunx wrangler kv namespace create lumen-meta`  
   Copy the id into `wrangler.jsonc` → `kv_namespaces[0].id` (and preview id if used).
4. Secrets:
   ```bash
   bunx wrangler secret put SESSION_SECRET    # long random string
   bunx wrangler secret put READER_PASSPHRASE # your unlock phrase
   ```
5. Deploy when ready:
   ```bash
   bun run deploy
   ```

Without secrets/bindings, the app still works **fully offline** (local-only). Settings will report that cloud sync is unavailable.

## Keyboard (reader)

| Key | Action |
|-----|--------|
| `Esc` | Library / close panels |
| `F` | Focus mode (hide chrome) |
| `T` | Table of contents |
| `G` | Glossary |
| `L` | Switch Chinese / English |
| `+` / `-` | Font size |
| `←` `→` or `J` `K` | EPUB page |

## Project map

- `src/routes` — library, reader, settings, translate, API bridge
- `src/lib/client` — IndexedDB, import, sync, text render, EPUB translate, glossary
- `src/lib/server` — Hono app (auth, books, progress, DeepSeek proxy)
- `PRODUCT.md` / `DESIGN.md` — product + visual system (Impeccable)

## License

Personal project scaffold. Sample story is original demo text for Lumen.
