import { marked } from 'marked';

marked.setOptions({
	gfm: true,
	breaks: true
});

export async function renderTextContent(raw: string, format: 'text' | 'markdown'): Promise<string> {
	if (format === 'markdown') {
		return marked.parse(raw, { async: true }) as Promise<string>;
	}
	// Plain text: preserve paragraphs
	const escaped = raw
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
	const paragraphs = escaped
		.split(/\n{2,}/)
		.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
		.join('\n');
	return paragraphs || `<p>${escaped}</p>`;
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
