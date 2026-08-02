import { getBook, listBooks, putBook } from './idb';
import type { BookRecord } from './types';

const SAMPLE_FLAG = 'lumen-sample-v4';

/** Import bundled sample once per browser if library is empty; refresh sample cover art when flag advances */
export async function ensureSampleBook(): Promise<void> {
	if (typeof localStorage === 'undefined') return;

	const flag = localStorage.getItem(SAMPLE_FLAG);
	if (flag === '1') return;

	const existing = await listBooks();

	// Migrate old sample cover when flag bumps
	if (existing.length > 0) {
		const sampleMeta = existing.find(
			(b) => b.fileName === 'the-star-room.txt' || b.title === 'The Star Room'
		);
		if (sampleMeta) {
			const full = await getBook(sampleMeta.id);
			if (full) {
				full.coverDataUrl = coverSvg(full.title, full.author);
				full.updatedAt = Date.now();
				await putBook(full);
			}
		}
		localStorage.setItem(SAMPLE_FLAG, '1');
		return;
	}

	try {
		const res = await fetch('/samples/the-star-room.txt');
		if (!res.ok) return;
		const text = await res.text();
		const blob = new Blob([text], { type: 'text/markdown' });
		const now = Date.now();
		const book: BookRecord = {
			id: crypto.randomUUID(),
			title: 'The Star Room',
			author: 'Lumen Samples',
			format: 'markdown',
			mimeType: 'text/markdown',
			fileName: 'the-star-room.txt',
			coverDataUrl: coverSvg('The Star Room', 'Lumen Samples'),
			addedAt: now,
			updatedAt: now,
			sizeBytes: blob.size,
			blob
		};
		await putBook(book);
		localStorage.setItem(SAMPLE_FLAG, '1');
	} catch {
		/* ignore offline first-run without static */
	}
}

/** Editorial typeset poster — newsprint field, crimson kicker, display hierarchy */
function coverSvg(title: string, author: string): string {
	const t = escapeXml(title.slice(0, 36));
	const a = escapeXml(author.slice(0, 28));
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F7F6F1"/>
      <stop offset="100%" stop-color="#EBEAE4"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#g)"/>
  <rect x="18" y="18" width="364" height="564" fill="none" stroke="#0B0B0B" stroke-width="1.25"/>
  <rect x="28" y="28" width="344" height="544" fill="none" stroke="#0B0B0B" stroke-opacity="0.12" stroke-width="1"/>
  <text x="48" y="64" fill="#7A1C1C" font-family="Georgia,serif" font-size="11" font-weight="600" letter-spacing="3.5">LUMEN</text>
  <line x1="48" y1="78" x2="352" y2="78" stroke="#0B0B0B" stroke-width="1"/>
  <circle cx="320" cy="140" r="36" fill="none" stroke="#0B0B0B" stroke-opacity="0.15" stroke-width="1"/>
  <circle cx="320" cy="140" r="2" fill="#7A1C1C"/>
  <line x1="320" y1="104" x2="320" y2="176" stroke="#0B0B0B" stroke-opacity="0.12" stroke-width="1"/>
  <line x1="284" y1="140" x2="356" y2="140" stroke="#0B0B0B" stroke-opacity="0.12" stroke-width="1"/>
  <text x="48" y="380" fill="#0B0B0B" font-family="Georgia,serif" font-size="34" font-weight="600">${t}</text>
  <line x1="48" y1="402" x2="128" y2="402" stroke="#0B0B0B" stroke-width="1.5"/>
  <text x="48" y="432" fill="#6A6A66" font-family="system-ui,sans-serif" font-size="13" letter-spacing="0.5">${a}</text>
  <text x="48" y="548" fill="#6A6A66" font-family="system-ui,sans-serif" font-size="10" letter-spacing="2.5">SAMPLE · OFFLINE</text>
</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
