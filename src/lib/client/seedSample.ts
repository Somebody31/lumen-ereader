import { listBooks, putBook } from './idb';
import type { BookRecord } from './types';

const SAMPLE_FLAG = 'lumen-sample-v3';

/** Import bundled sample once per browser if library is empty; refresh sample cover art when flag advances */
export async function ensureSampleBook(): Promise<void> {
	if (typeof localStorage === 'undefined') return;

	const flag = localStorage.getItem(SAMPLE_FLAG);
	if (flag === '1') return;

	const existing = await listBooks();

	// Migrate old sample cover when flag bumps
	if (existing.length > 0) {
		const sample = existing.find(
			(b) => b.fileName === 'the-star-room.txt' || b.title === 'The Star Room'
		);
		if (sample) {
			sample.coverDataUrl = coverSvg(sample.title, sample.author);
			sample.updatedAt = Date.now();
			await putBook(sample);
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

/** Editorial broadsheet plate — newsprint ground, black ink type, crimson kicker */
function coverSvg(title: string, author: string): string {
	const t = escapeXml(title.slice(0, 36));
	const a = escapeXml(author.slice(0, 28));
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#F3F2ED"/>
  <rect x="20" y="20" width="360" height="560" fill="none" stroke="#0B0B0B" stroke-width="1"/>
  <line x1="44" y1="72" x2="356" y2="72" stroke="#0B0B0B" stroke-width="1"/>
  <text x="44" y="58" fill="#7A1C1C" font-family="Georgia,serif" font-size="11" font-weight="600" letter-spacing="3">LUMEN</text>
  <text x="44" y="400" fill="#0B0B0B" font-family="Georgia,serif" font-size="30" font-weight="600">${t}</text>
  <line x1="44" y1="420" x2="120" y2="420" stroke="#0B0B0B" stroke-width="1"/>
  <text x="44" y="450" fill="#6A6A66" font-family="system-ui,sans-serif" font-size="13" letter-spacing="1">${a}</text>
  <text x="44" y="540" fill="#6A6A66" font-family="system-ui,sans-serif" font-size="10" letter-spacing="2">SAMPLE · OFFLINE</text>
</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
