import { listBooks, putBook } from './idb';
import type { BookRecord } from './types';

const SAMPLE_FLAG = 'lumen-sample-v1';

/** Import bundled sample once per browser if library is empty */
export async function ensureSampleBook(): Promise<void> {
	if (typeof localStorage === 'undefined') return;
	if (localStorage.getItem(SAMPLE_FLAG)) return;

	const existing = await listBooks();
	if (existing.length > 0) {
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
			coverDataUrl: undefined,
			addedAt: now,
			updatedAt: now,
			sizeBytes: blob.size,
			blob
		};
		// generate cover via import helper path — inline simple cover
		book.coverDataUrl = coverSvg(book.title, book.author);
		await putBook(book);
		localStorage.setItem(SAMPLE_FLAG, '1');
	} catch {
		/* ignore offline first-run without static */
	}
}

function coverSvg(title: string, author: string): string {
	const t = title.slice(0, 40);
	const a = author.slice(0, 32);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect fill="#0B0E14" width="400" height="600"/><rect x="24" y="24" width="352" height="552" rx="12" fill="none" stroke="#2A3142"/><circle cx="200" cy="140" r="7" fill="#E8A54B"/><text x="48" y="300" fill="#E8E6E1" font-family="system-ui,sans-serif" font-size="26" font-weight="600">${t}</text><text x="48" y="340" fill="#9A9A96" font-family="system-ui,sans-serif" font-size="15">${a}</text></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
