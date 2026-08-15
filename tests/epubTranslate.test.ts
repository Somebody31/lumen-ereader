import { describe, expect, test } from 'bun:test';
import JSZip from 'jszip';
import {
	cjkRatio,
	extractBodyInner,
	extractTranslatableChapters,
	listZipPaths,
	patchEpubChapters,
	readEpubChapter,
	replaceBodyInner,
	resolvePath,
	splitHtmlChunks,
	stripTags,
	warnIfNotChinese
} from '../src/lib/client/epubTranslate';

async function fixtureEpub(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
	zip.file(
		'META-INF/container.xml',
		`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
	);
	zip.file(
		'OEBPS/content.opf',
		`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>试读</dc:title>
    <dc:language>zh</dc:language>
  </metadata>
  <manifest>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="coverimg" href="images/cover.jpg" media-type="image/jpeg"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c3" href="Text/ch3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="nav"/>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
    <itemref idref="c3"/>
  </spine>
</package>`
	);
	zip.file('OEBPS/styles.css', 'body { font-family: serif; }');
	zip.file('OEBPS/images/cover.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
	zip.file(
		'OEBPS/nav.xhtml',
		`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><nav><ol><li>目录</li></ol></nav></body></html>`
	);
	zip.file(
		'OEBPS/Text/ch1.xhtml',
		`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一章</title><link rel="stylesheet" href="../styles.css"/></head>
<body><h1>第一章</h1><p>林动站在青石上，望着远方的山峰，心中涌起一股说不清的情绪。风从谷口灌进来，吹乱了他额前的碎发。</p></body>
</html>`
	);
	zip.file(
		'OEBPS/Text/ch2.xhtml',
		`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第二章</title></head>
<body><h1>第二章</h1><p>夜色渐深，篝火旁的人影晃动，像是要讲述一段被遗忘的往事。谁也不愿意先开口。</p></body>
</html>`
	);
	zip.file(
		'OEBPS/Text/ch3.xhtml',
		`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第三章</title></head>
<body><h1>第三章</h1><p>第三段尚未翻译的中文段落，用来确认未选中章节保持原样。石阶上还留着昨夜的霜。</p></body>
</html>`
	);
	return zip.generateAsync({ type: 'arraybuffer' });
}

describe('epub path + text helpers', () => {
	test('resolvePath joins relative to OPF dir', () => {
		expect(resolvePath('OEBPS/', 'Text/ch1.xhtml')).toBe('OEBPS/Text/ch1.xhtml');
		expect(resolvePath('OEBPS/', '../other.xhtml')).toBe('other.xhtml');
		expect(resolvePath('OEBPS/', '/abs.xhtml')).toBe('abs.xhtml');
		expect(resolvePath('OEBPS/', 'Text/ch1.xhtml#frag')).toBe('OEBPS/Text/ch1.xhtml');
	});

	test('cjk heuristic flags latin-heavy samples', () => {
		expect(cjkRatio('林动站在青石上望着远方')).toBeGreaterThan(0.8);
		expect(cjkRatio('The booth lights were already low')).toBeLessThan(0.05);
		expect(
			warnIfNotChinese([
				{
					href: 'a',
					title: 'A',
					mediaType: 'application/xhtml+xml',
					charCount: 20,
					cjkRatio: 0.01
				}
			])
		).toBe(true);
	});

	test('body extract/replace keeps the shell', () => {
		const doc = '<html><head><title>T</title></head><body id="c"><p>甲</p></body></html>';
		const { inner, hasBody } = extractBodyInner(doc);
		expect(hasBody).toBe(true);
		expect(inner).toContain('<p>甲</p>');
		const next = replaceBodyInner(doc, '<p>Jia</p>');
		expect(next).toContain('id="c"');
		expect(next).toContain('<title>T</title>');
		expect(next).toContain('<p>Jia</p>');
		expect(next).not.toContain('甲');
	});

	test('splitHtmlChunks breaks on </p> past the cap', () => {
		const p = (n: number) => `<p>${'字'.repeat(n)}</p>`;
		const html = p(5000) + p(5000);
		const chunks = splitHtmlChunks(html, 8000);
		expect(chunks.length).toBe(2);
		expect(stripTags(chunks[0]).length).toBe(5000);
	});
});

describe('epub extract + rebuild', () => {
	test('extracts spine XHTML and skips nav/css/images', async () => {
		const buf = await fixtureEpub();
		const { chapters, opfPath } = await extractTranslatableChapters(buf);
		expect(opfPath).toBe('OEBPS/content.opf');
		expect(chapters.map((c) => c.href)).toEqual([
			'OEBPS/Text/ch1.xhtml',
			'OEBPS/Text/ch2.xhtml',
			'OEBPS/Text/ch3.xhtml'
		]);
		expect(chapters[0].title).toBe('第一章');
		expect(chapters[0].cjkRatio).toBeGreaterThan(0.3);
	});

	test('rebuild replaces only selected hrefs and keeps media/css', async () => {
		const buf = await fixtureEpub();
		const translated = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>Lin Dong stood on the bluestone.</p></body></html>`;
		const blob = await patchEpubChapters(
			buf,
			{ 'OEBPS/Text/ch1.xhtml': translated },
			{ language: 'en' }
		);
		const ch1 = await readEpubChapter(blob, 'OEBPS/Text/ch1.xhtml');
		const ch3 = await readEpubChapter(blob, 'OEBPS/Text/ch3.xhtml');
		expect(ch1).toContain('Lin Dong');
		expect(ch3).toContain('尚未翻译');
		const paths = await listZipPaths(blob);
		expect(paths).toContain('OEBPS/styles.css');
		expect(paths).toContain('OEBPS/images/cover.jpg');
		const zip = await JSZip.loadAsync(await blob.arrayBuffer());
		const opf = await zip.file('OEBPS/content.opf')?.async('text');
		expect(opf).toContain('<dc:language>en</dc:language>');
		const css = await zip.file('OEBPS/styles.css')?.async('text');
		expect(css).toContain('serif');
	});
});
