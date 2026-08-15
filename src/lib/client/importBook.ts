import JSZip from 'jszip';
import type { BookFormat, BookRecord } from './types';
import { putBook } from './idb';
import { resolvePath } from './epubTranslate';

function uid(): string {
	return crypto.randomUUID();
}

function formatFromName(name: string): BookFormat | null {
	const lower = name.toLowerCase();
	if (lower.endsWith('.epub')) return 'epub';
	if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
	if (lower.endsWith('.txt') || lower.endsWith('.text')) return 'text';
	return null;
}

function mimeFor(format: BookFormat): string {
	if (format === 'epub') return 'application/epub+zip';
	if (format === 'markdown') return 'text/markdown';
	return 'text/plain';
}

function titleFromFileName(name: string): string {
	return name.replace(/\.(epub|md|markdown|txt|text)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
}

function textCover(title: string, author: string): string {
	const safeTitle = title.slice(0, 48).replace(/[<>&]/g, '');
	const safeAuthor = author.slice(0, 32).replace(/[<>&]/g, '');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121722"/>
      <stop offset="100%" stop-color="#0B0E14"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#g)"/>
  <rect x="24" y="24" width="352" height="552" rx="12" fill="none" stroke="#2A3142" stroke-width="1"/>
  <circle cx="200" cy="120" r="6" fill="#E8A54B"/>
  <text x="40" y="280" fill="#E8E6E1" font-family="system-ui,sans-serif" font-size="28" font-weight="600">${escapeXml(safeTitle)}</text>
  <text x="40" y="320" fill="#9A9A96" font-family="system-ui,sans-serif" font-size="16">${escapeXml(safeAuthor)}</text>
</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function parseEpubMeta(file: File): Promise<{ title: string; author: string; coverDataUrl?: string }> {
	const buf = await file.arrayBuffer();
	const zip = await JSZip.loadAsync(buf);
	const container = await zip.file('META-INF/container.xml')?.async('text');
	if (!container) {
		return { title: titleFromFileName(file.name), author: 'Unknown' };
	}
	const rootMatch = container.match(/full-path="([^"]+)"/);
	const opfPath = rootMatch?.[1];
	if (!opfPath) {
		return { title: titleFromFileName(file.name), author: 'Unknown' };
	}
	const opf = await zip.file(opfPath)?.async('text');
	if (!opf) {
		return { title: titleFromFileName(file.name), author: 'Unknown' };
	}

	const title =
		opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)?.[1]?.trim() || titleFromFileName(file.name);
	const author =
		opf.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)?.[1]?.trim() || 'Unknown';

	let coverDataUrl: string | undefined;
	const coverId =
		opf.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i)?.[1] ||
		opf.match(/<item[^>]+id="cover-image"[^>]+href="([^"]+)"/i)?.[1];

	const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

	if (coverId) {
		const href =
			opf.match(new RegExp(`<item[^>]+id="${coverId}"[^>]+href="([^"]+)"`, 'i'))?.[1] ||
			(coverId.includes('.') ? coverId : undefined);
		if (href) {
			const coverPath = resolvePath(opfDir, href);
			const entry = zip.file(coverPath);
			if (entry) {
				const base64 = await entry.async('base64');
				const ext = href.split('.').pop()?.toLowerCase();
				const mime =
					ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
				coverDataUrl = `data:${mime};base64,${base64}`;
			}
		}
	}

	// Fallback: first image in manifest
	if (!coverDataUrl) {
		const imgHref = opf.match(/href="([^"]+\.(?:jpe?g|png|webp|gif))"/i)?.[1];
		if (imgHref) {
			const coverPath = resolvePath(opfDir, imgHref);
			const entry = zip.file(coverPath);
			if (entry) {
				const base64 = await entry.async('base64');
				const ext = imgHref.split('.').pop()?.toLowerCase();
				const mime =
					ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
				coverDataUrl = `data:${mime};base64,${base64}`;
			}
		}
	}

	return { title, author, coverDataUrl };
}

async function parseTextMeta(file: File, format: BookFormat): Promise<{ title: string; author: string }> {
	const text = await file.slice(0, 4000).text();
	const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	let title = titleFromFileName(file.name);
	let author = 'Unknown';

	if (format === 'markdown') {
		const h1 = lines.find((l) => /^#\s+/.test(l));
		if (h1) title = h1.replace(/^#\s+/, '').trim();
	} else if (lines[0] && lines[0].length < 80) {
		// First non-empty short line as title heuristic
		title = lines[0];
	}

	const byLine = lines.find((l) => /^by\s+/i.test(l));
	if (byLine) author = byLine.replace(/^by\s+/i, '').trim();

	return { title, author };
}

export async function importFile(file: File): Promise<BookRecord> {
	const format = formatFromName(file.name);
	if (!format) {
		throw new Error('Unsupported format. Use .epub, .txt, or .md');
	}

	const now = Date.now();
	let title: string;
	let author: string;
	let coverDataUrl: string | undefined;

	if (format === 'epub') {
		const meta = await parseEpubMeta(file);
		title = meta.title;
		author = meta.author;
		coverDataUrl = meta.coverDataUrl;
	} else {
		const meta = await parseTextMeta(file, format);
		title = meta.title;
		author = meta.author;
	}

	if (!coverDataUrl) {
		coverDataUrl = textCover(title, author);
	}

	// Normalize to a typed Blob so IDB restore + epubjs ArrayBuffer open stay reliable.
	// Storing the raw File can lose type/name across browsers after IDB round-trip.
	const mimeType = file.type || mimeFor(format);
	const bytes = await file.arrayBuffer();
	const blob = new Blob([bytes], { type: mimeType });

	const book: BookRecord = {
		id: uid(),
		title,
		author,
		format,
		mimeType,
		fileName: file.name,
		coverDataUrl,
		addedAt: now,
		updatedAt: now,
		sizeBytes: blob.size,
		blob
	};

	await putBook(book);
	return book;
}

export async function importFiles(files: FileList | File[]): Promise<BookRecord[]> {
	const list = Array.from(files);
	const results: BookRecord[] = [];
	for (const f of list) {
		results.push(await importFile(f));
	}
	return results;
}
