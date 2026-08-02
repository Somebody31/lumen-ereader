import { listBooks, putBook } from './idb';
import type { BookRecord } from './types';

const SAMPLE_FLAG = 'lumen-sample-v2';

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

/** Atelier flat-ink plate — indigo ground, cream type, vermillion seal */
function coverSvg(title: string, author: string): string {
	const t = escapeXml(title.slice(0, 36));
	const a = escapeXml(author.slice(0, 28));
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#1F3A68"/>
  <rect x="28" y="28" width="344" height="544" rx="0" fill="none" stroke="#F4F1EA" stroke-opacity="0.18" stroke-width="1"/>
  <circle cx="340" cy="56" r="10" fill="#E03C2B"/>
  <text x="44" y="72" fill="#F4F1EA" fill-opacity="0.55" font-family="system-ui,sans-serif" font-size="11" font-weight="500" letter-spacing="2.4">LUMEN</text>
  <text x="44" y="420" fill="#F4F1EA" font-family="system-ui,sans-serif" font-size="28" font-weight="600">${t}</text>
  <text x="44" y="458" fill="#F4F1EA" fill-opacity="0.65" font-family="system-ui,sans-serif" font-size="14">${a}</text>
  <line x1="44" y1="520" x2="100" y2="520" stroke="#F4F1EA" stroke-opacity="0.35" stroke-width="2"/>
</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

