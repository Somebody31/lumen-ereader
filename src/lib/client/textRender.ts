import { marked } from 'marked';

marked.setOptions({
	gfm: true,
	breaks: true
});

/** Soft warning when opening / importing large files */
export const WARN_SIZE_BYTES = 1.5 * 1024 * 1024;
/** Stronger banner; still opens, but expect slower first paint without chunking */
export const LARGE_SIZE_BYTES = 4 * 1024 * 1024;
/** Target characters per virtual chunk for text/markdown */
export const CHUNK_TARGET_CHARS = 10_000;
/** How many chunks to keep mounted around the viewport */
export const CHUNK_WINDOW = 4;

function escapeHtml(raw: string): string {
	return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function paragraphsFromPlain(raw: string): string[] {
	const escaped = escapeHtml(raw);
	const parts = escaped.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
	if (!parts.length) return [`<p>${escaped}</p>`];
	return parts.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
}

function blocksFromMarkdown(raw: string): string[] {
	// Split on blank lines — approximate MD blocks; each block parsed separately.
	const parts = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
	return parts.length ? parts : [raw];
}

/** Pack HTML paragraph strings into larger chunks for virtualization */
export function packHtmlParts(parts: string[], targetChars = CHUNK_TARGET_CHARS): string[] {
	if (!parts.length) return ['<p></p>'];
	const chunks: string[] = [];
	let buf = '';
	for (const part of parts) {
		if (buf && buf.length + part.length > targetChars) {
			chunks.push(buf);
			buf = part;
		} else {
			buf = buf ? `${buf}\n${part}` : part;
		}
	}
	if (buf) chunks.push(buf);
	return chunks;
}

export async function renderTextContent(raw: string, format: 'text' | 'markdown'): Promise<string> {
	const chunks = await renderTextChunks(raw, format);
	return chunks.join('\n');
}

/**
 * Parse text/markdown into HTML chunks, yielding between batches so the UI stays responsive.
 */
export async function renderTextChunks(
	raw: string,
	format: 'text' | 'markdown',
	onProgress?: (done: number, total: number) => void
): Promise<string[]> {
	if (format === 'text') {
		const parts = paragraphsFromPlain(raw);
		const packed = packHtmlParts(parts);
		onProgress?.(packed.length, packed.length);
		return packed;
	}

	const blocks = blocksFromMarkdown(raw);
	const htmlParts: string[] = [];
	const batch = 40;
	for (let i = 0; i < blocks.length; i++) {
		const html = (await marked.parse(blocks[i], { async: true })) as string;
		htmlParts.push(html);
		if (i % batch === batch - 1) {
			onProgress?.(i + 1, blocks.length);
			await yieldToMain();
		}
	}
	onProgress?.(blocks.length, blocks.length);
	return packHtmlParts(htmlParts);
}

function yieldToMain(): Promise<void> {
	return new Promise((resolve) => {
		if (typeof requestIdleCallback !== 'undefined') {
			requestIdleCallback(() => resolve(), { timeout: 48 });
		} else {
			setTimeout(resolve, 0);
		}
	});
}

export function estimateProgressFromScroll(el: HTMLElement): number {
	const max = el.scrollHeight - el.clientHeight;
	if (max <= 0) return 1;
	return Math.min(1, Math.max(0, el.scrollTop / max));
}

export function scrollToFraction(el: HTMLElement, fraction: number) {
	const max = el.scrollHeight - el.clientHeight;
	if (max <= 0) return;
	el.scrollTop = max * Math.min(1, Math.max(0, fraction));
}

/** Rough height estimate before measure — ~0.028px per character at reading sizes */
export function estimateChunkHeight(html: string, fontSize: number): number {
	const chars = html.replace(/<[^>]+>/g, ' ').length;
	const lineHeight = fontSize * 1.7;
	const charsPerLine = Math.max(28, Math.floor(68 * 0.85));
	const lines = Math.max(3, Math.ceil(chars / charsPerLine));
	return Math.ceil(lines * lineHeight + fontSize * 0.6);
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
