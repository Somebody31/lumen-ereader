import { describe, expect, test } from 'bun:test';
import {
	formatBytes,
	packHtmlParts,
	renderTextChunks,
	WARN_SIZE_BYTES,
	LARGE_SIZE_BYTES
} from '../src/lib/client/textRender';

describe('text render performance helpers', () => {
	test('packHtmlParts groups paragraphs into chunks', () => {
		const parts = Array.from({ length: 50 }, (_, i) => `<p>${'word '.repeat(80)}${i}</p>`);
		const chunks = packHtmlParts(parts, 5000);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.join('')).toContain('word');
	});

	test('renderTextChunks splits plain text without one giant string requirement', async () => {
		const body = 'Lorem ipsum dolor sit amet. '.repeat(40);
		const raw = Array.from({ length: 80 }, (_, i) => `Paragraph ${i}. ${body}\n\n`).join('');
		const chunks = await renderTextChunks(raw, 'text');
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.some((c) => c.includes('Paragraph 0'))).toBe(true);
		expect(chunks.some((c) => c.includes('Paragraph 79'))).toBe(true);
	});

	test('size thresholds and formatBytes', () => {
		expect(WARN_SIZE_BYTES).toBeGreaterThan(1024 * 1024);
		expect(LARGE_SIZE_BYTES).toBeGreaterThan(WARN_SIZE_BYTES);
		expect(formatBytes(500)).toBe('500 B');
		expect(formatBytes(2048)).toContain('KB');
		expect(formatBytes(3 * 1024 * 1024)).toContain('MB');
	});
});
