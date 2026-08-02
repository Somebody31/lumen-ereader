import { marked } from 'marked';

marked.setOptions({
	gfm: true,
	breaks: true
});

function escapeHtml(raw: string): string {
	return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function paragraphsFromPlain(raw: string): string[] {
	const escaped = escapeHtml(raw);
	const parts = escaped.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
	if (!parts.length) return [`<p>${escaped}</p>`];
	return parts.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
}

/** Render plain text or markdown to a single HTML string (full document, no virtualization). */
export async function renderTextContent(raw: string, format: 'text' | 'markdown'): Promise<string> {
	if (format === 'text') {
		return paragraphsFromPlain(raw).join('\n');
	}
	return (await marked.parse(raw, { async: true })) as string;
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

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
