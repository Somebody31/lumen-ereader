import { describe, expect, test } from 'bun:test';
import { formatBytes, renderTextContent } from '../src/lib/client/textRender';

describe('text render', () => {
	test('renderTextContent plain text becomes paragraphs', async () => {
		const html = await renderTextContent('Hello\n\nWorld', 'text');
		expect(html).toContain('<p>Hello</p>');
		expect(html).toContain('<p>World</p>');
	});

	test('renderTextContent markdown produces HTML', async () => {
		const html = await renderTextContent('# Title\n\nA paragraph.', 'markdown');
		expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
		expect(html).toContain('paragraph');
	});

	test('formatBytes units', () => {
		expect(formatBytes(500)).toBe('500 B');
		expect(formatBytes(2048)).toContain('KB');
		expect(formatBytes(3 * 1024 * 1024)).toContain('MB');
	});
});
