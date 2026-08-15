import JSZip from 'jszip';

export const MAX_CHAPTER_TEXT = 8000;

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;
const XHTML_TYPES = new Set([
	'application/xhtml+xml',
	'application/xml',
	'text/html',
	'text/xml'
]);

export interface EpubSpineChapter {
	href: string;
	title: string;
	mediaType: string;
	charCount: number;
	cjkRatio: number;
}

export function resolvePath(base: string, rel: string): string {
	if (!rel) return base.replace(/\/+$/, '');
	const cleaned = rel.replace(/\\/g, '/').split('#')[0].split('?')[0];
	if (cleaned.startsWith('/')) return cleaned.replace(/^\/+/, '');
	const parts = (base + cleaned).split('/');
	const out: string[] = [];
	for (const p of parts) {
		if (p === '' || p === '.') continue;
		if (p === '..') out.pop();
		else out.push(p);
	}
	return out.join('/');
}

export function stripTags(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

export function cjkRatio(text: string): number {
	const compact = text.replace(/\s+/g, '');
	if (!compact.length) return 0;
	const cjk = compact.match(CJK_RE)?.length ?? 0;
	return cjk / compact.length;
}

export function warnIfNotChinese(chapters: EpubSpineChapter[]): boolean {
	const sample = chapters.slice(0, 2);
	if (!sample.length) return false;
	const avg = sample.reduce((s, c) => s + c.cjkRatio, 0) / sample.length;
	return avg < 0.05;
}

export function extractBodyInner(doc: string): { inner: string; hasBody: boolean } {
	const m = doc.match(/<body(\s[^>]*)?>([\s\S]*)<\/body>/i);
	if (!m) return { inner: doc, hasBody: false };
	return { inner: m[2], hasBody: true };
}

export function replaceBodyInner(doc: string, inner: string): string {
	if (!/<body(\s[^>]*)?>/i.test(doc)) return inner;
	return doc.replace(/(<body(?:\s[^>]*)?>)[\s\S]*?(<\/body>)/i, `$1${inner}$2`);
}

export function splitHtmlChunks(html: string, maxText = MAX_CHAPTER_TEXT): string[] {
	const textLen = stripTags(html).length;
	if (textLen <= maxText) return [html];
	const parts = html.split(/(?<=<\/p>)/i);
	if (parts.length < 2) {
		// Fall back to heading / hard split
		const byHead = html.split(/(?=<h[1-6]\b)/i);
		if (byHead.length > 1) {
			return packChunks(byHead, maxText);
		}
		return [html];
	}
	return packChunks(parts, maxText);
}

function packChunks(parts: string[], maxText: number): string[] {
	const chunks: string[] = [];
	let buf = '';
	let bufLen = 0;
	for (const part of parts) {
		const n = stripTags(part).length;
		if (buf && bufLen + n > maxText) {
			chunks.push(buf);
			buf = part;
			bufLen = n;
		} else {
			buf += part;
			bufLen += n;
		}
	}
	if (buf) chunks.push(buf);
	return chunks.length ? chunks : parts;
}

interface ManifestItem {
	id: string;
	href: string;
	mediaType: string;
	properties: string;
}

function attr(tag: string, name: string): string | undefined {
	return (
		tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ||
		tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i'))?.[1]
	);
}

function parseManifest(opf: string): Map<string, ManifestItem> {
	const map = new Map<string, ManifestItem>();
	const itemRe = /<item\b[^>]*>/gi;
	let m: RegExpExecArray | null;
	while ((m = itemRe.exec(opf))) {
		const tag = m[0];
		const id = attr(tag, 'id');
		const href = attr(tag, 'href');
		if (!id || !href) continue;
		map.set(id, {
			id,
			href,
			mediaType: (attr(tag, 'media-type') || '').toLowerCase(),
			properties: (attr(tag, 'properties') || '').toLowerCase()
		});
	}
	return map;
}

function parseSpineIds(opf: string): string[] {
	const ids: string[] = [];
	const re = /<itemref\b[^>]*>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(opf))) {
		const idref = attr(m[0], 'idref');
		if (idref) ids.push(idref);
	}
	return ids;
}

export async function readOpf(
	zip: JSZip
): Promise<{ opfPath: string; opfDir: string; opf: string } | null> {
	const container = await zip.file('META-INF/container.xml')?.async('text');
	if (!container) return null;
	const rootMatch = container.match(/full-path="([^"]+)"/);
	const opfPath = rootMatch?.[1];
	if (!opfPath) return null;
	const opf = await zip.file(opfPath)?.async('text');
	if (!opf) return null;
	const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
	return { opfPath, opfDir, opf };
}

function chapterTitle(html: string, href: string): string {
	const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
	if (title && !/^untitled$/i.test(title)) return title;
	const heading = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1];
	if (heading) {
		const t = stripTags(heading);
		if (t) return t.slice(0, 80);
	}
	const file = href.split('/').pop() || href;
	return file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
}

function isNavOrMeta(item: ManifestItem, href: string): boolean {
	if (item.properties.includes('nav')) return true;
	if (item.mediaType.includes('dtbncx') || href.toLowerCase().endsWith('.ncx')) return true;
	const name = href.toLowerCase();
	if (/(^|\/)(nav|toc|cover|copyright|colophon)[^/]*\.(xhtml|html)$/i.test(name)) return true;
	if (item.properties.includes('cover-image')) return true;
	return false;
}

export async function extractTranslatableChapters(data: ArrayBuffer | Blob): Promise<{
	chapters: EpubSpineChapter[];
	opfPath: string;
	language?: string;
}> {
	const buf = data instanceof Blob ? await data.arrayBuffer() : data;
	const zip = await JSZip.loadAsync(buf);
	const pack = await readOpf(zip);
	if (!pack) return { chapters: [], opfPath: '' };

	const manifest = parseManifest(pack.opf);
	const spine = parseSpineIds(pack.opf);
	const language = pack.opf.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i)?.[1]?.trim();
	const chapters: EpubSpineChapter[] = [];

	for (const id of spine) {
		const item = manifest.get(id);
		if (!item) continue;
		const href = resolvePath(pack.opfDir, item.href);
		if (!XHTML_TYPES.has(item.mediaType) && !/\.(xhtml|html|htm)$/i.test(href)) continue;
		if (isNavOrMeta(item, href)) continue;
		const file = zip.file(href);
		if (!file) continue;
		const html = await file.async('text');
		const text = stripTags(html);
		if (text.length < 20) continue;
		chapters.push({
			href,
			title: chapterTitle(html, href),
			mediaType: item.mediaType || 'application/xhtml+xml',
			charCount: text.length,
			cjkRatio: cjkRatio(text)
		});
	}

	return { chapters, opfPath: pack.opfPath, language };
}

export async function readEpubChapter(
	data: ArrayBuffer | Blob,
	href: string
): Promise<string | null> {
	const buf = data instanceof Blob ? await data.arrayBuffer() : data;
	const zip = await JSZip.loadAsync(buf);
	return (await zip.file(href)?.async('text')) ?? null;
}

async function setOpfLanguage(zip: JSZip, lang: string): Promise<void> {
	const pack = await readOpf(zip);
	if (!pack) return;
	let next = pack.opf;
	if (/<dc:language[^>]*>[\s\S]*?<\/dc:language>/i.test(next)) {
		next = next.replace(
			/<dc:language([^>]*)>[\s\S]*?<\/dc:language>/i,
			`<dc:language$1>${lang}</dc:language>`
		);
	} else {
		next = next.replace(
			/(<dc:title[\s\S]*?<\/dc:title>)/i,
			`$1\n    <dc:language>${lang}</dc:language>`
		);
	}
	zip.file(pack.opfPath, next);
}

export async function setOpfTitle(data: ArrayBuffer | Blob, title: string): Promise<Blob> {
	const buf = data instanceof Blob ? await data.arrayBuffer() : data;
	const zip = await JSZip.loadAsync(buf);
	const pack = await readOpf(zip);
	if (!pack) {
		return data instanceof Blob ? data : new Blob([buf], { type: 'application/epub+zip' });
	}
	const safe = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	let next = pack.opf;
	if (/<dc:title[^>]*>[\s\S]*?<\/dc:title>/i.test(next)) {
		next = next.replace(/<dc:title([^>]*)>[\s\S]*?<\/dc:title>/i, `<dc:title$1>${safe}</dc:title>`);
	}
	zip.file(pack.opfPath, next);
	return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

/** Replace only the given XHTML paths. Other files (images, CSS, unselected chapters) stay intact. */
export async function patchEpubChapters(
	epub: Blob | ArrayBuffer,
	replacements: Record<string, string>,
	opts?: { language?: string }
): Promise<Blob> {
	const buf = epub instanceof Blob ? await epub.arrayBuffer() : epub;
	const zip = await JSZip.loadAsync(buf);
	for (const [path, html] of Object.entries(replacements)) {
		if (!path || typeof html !== 'string') continue;
		zip.file(path, html);
	}
	if (opts?.language) await setOpfLanguage(zip, opts.language);
	return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

export async function listZipPaths(data: ArrayBuffer | Blob): Promise<string[]> {
	const buf = data instanceof Blob ? await data.arrayBuffer() : data;
	const zip = await JSZip.loadAsync(buf);
	return Object.keys(zip.files).filter((k) => !zip.files[k].dir);
}
