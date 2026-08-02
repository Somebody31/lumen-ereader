import { describe, expect, test } from 'bun:test';
import {
	basename,
	buildReaderToc,
	flattenToc,
	fragmentOf,
	hrefCandidates,
	labelFromHref,
	matchSpineHref,
	pathOnly,
	resolveTocTarget,
	type BookLike
} from '../src/lib/client/epubNav';

describe('flattenToc', () => {
	test('flattens nested subitems', () => {
		const flat = flattenToc([
			{
				label: 'Part I',
				href: 'part1.xhtml',
				subitems: [
					{ label: 'Ch 1', href: 'ch1.xhtml' },
					{ label: 'Ch 2', href: 'Text/ch2.xhtml', subitems: [{ label: '§1', href: 'ch2.xhtml#s1' }] }
				]
			},
			{ label: 'Part II', href: 'part2.xhtml' }
		]);
		expect(flat.map((t) => t.label)).toEqual(['Part I', 'Ch 1', 'Ch 2', '§1', 'Part II']);
		expect(flat.map((t) => t.depth)).toEqual([0, 1, 1, 2, 0]);
		expect(flat[3].href).toBe('ch2.xhtml#s1');
	});

	test('skips empty nodes but keeps href-only', () => {
		const flat = flattenToc([
			{ label: '', href: '' },
			{ label: '', href: 'orphan.xhtml' }
		]);
		expect(flat).toHaveLength(1);
		expect(flat[0].href).toBe('orphan.xhtml');
	});

	test('accepts children alias and title alias', () => {
		const flat = flattenToc([
			// @ts-expect-error intentional alternate shape from some packages
			{ title: 'Intro', href: 'i.xhtml', children: [{ label: 'A', href: 'a.xhtml' }] }
		]);
		expect(flat.map((t) => t.label)).toEqual(['Intro', 'A']);
	});
});

describe('buildReaderToc', () => {
	test('prefers nav over spine', () => {
		const toc = buildReaderToc(
			[{ label: 'Chapter 1', href: 'c1.xhtml' }],
			[{ href: 'spine-only.xhtml', linear: 'yes' }]
		);
		expect(toc).toHaveLength(1);
		expect(toc[0].label).toBe('Chapter 1');
	});

	test('falls back to linear spine when nav empty', () => {
		const toc = buildReaderToc([], [
			{ href: 'cover.xhtml', linear: 'no' },
			{ href: 'Text/chapter_01.xhtml', linear: 'yes' },
			{ href: 'Text/chapter_02.xhtml', linear: 'yes' }
		]);
		expect(toc.map((t) => t.href)).toEqual([
			'Text/chapter_01.xhtml',
			'Text/chapter_02.xhtml'
		]);
		expect(toc[0].label.length).toBeGreaterThan(0);
	});

	test('labelFromHref humanizes filenames', () => {
		expect(labelFromHref('Text/chapter_01.xhtml')).toMatch(/Chapter/i);
	});
});

describe('path helpers', () => {
	test('pathOnly and fragmentOf', () => {
		expect(pathOnly('Text/ch.xhtml#foo')).toBe('Text/ch.xhtml');
		expect(fragmentOf('Text/ch.xhtml#foo')).toBe('#foo');
		expect(fragmentOf('Text/ch.xhtml')).toBe('');
		expect(basename('OEBPS/Text/Chapter%201.xhtml')).toBe('Chapter%201.xhtml');
	});
});

describe('matchSpineHref', () => {
	const spine = [
		{ href: 'cover.xhtml', index: 0 },
		{ href: 'Text/chapter01.xhtml', index: 1 },
		{ href: 'Text/chapter02.xhtml', index: 2 },
		{ href: 'nav.xhtml', index: 3 }
	];

	test('exact match', () => {
		expect(matchSpineHref(['Text/chapter01.xhtml'], spine)).toEqual({
			href: 'Text/chapter01.xhtml',
			index: 1
		});
	});

	test('endsWith when nav path is shorter or longer', () => {
		expect(matchSpineHref(['chapter01.xhtml'], spine)?.index).toBe(1);
		expect(matchSpineHref(['OEBPS/Text/chapter02.xhtml'], spine)?.index).toBe(2);
	});

	test('basename unique', () => {
		expect(matchSpineHref(['../chapter01.xhtml'], spine)?.href).toBe('Text/chapter01.xhtml');
	});
});

describe('resolveTocTarget', () => {
	function mockBook(hrefs: string[]): BookLike {
		const spineItems = hrefs.map((href, index) => ({ href, index }));
		const byHref: Record<string, number> = {};
		hrefs.forEach((h, i) => {
			byHref[h] = i;
			byHref[h.split('#')[0]] = i;
		});
		return {
			spine: {
				spineItems,
				get(target: string | number) {
					if (typeof target === 'number') return spineItems[target] || null;
					const path = String(target).split('#')[0];
					const idx = byHref[path] ?? byHref[String(target)];
					if (idx == null) return null;
					return spineItems[idx];
				}
			},
			path: {
				relative(what: string) {
					// Simulate nav in Text/ resolving ../Text/x → Text/x
					if (what.startsWith('../')) return what.replace(/^\.\.\//, '');
					return what;
				}
			}
		};
	}

	test('resolves exact spine path', () => {
		const book = mockBook(['cover.xhtml', 'Text/ch1.xhtml', 'Text/ch2.xhtml']);
		const r = resolveTocTarget('Text/ch2.xhtml', book);
		expect(r?.index).toBe(2);
		expect(r?.target).toBe('Text/ch2.xhtml');
	});

	test('resolves basename-only nav href', () => {
		const book = mockBook(['cover.xhtml', 'Text/ch1.xhtml']);
		const r = resolveTocTarget('ch1.xhtml', book);
		expect(r?.href).toBe('Text/ch1.xhtml');
		expect(r?.index).toBe(1);
	});

	test('preserves fragment on resolved href', () => {
		const book = mockBook(['Text/ch1.xhtml']);
		const r = resolveTocTarget('ch1.xhtml#section-2', book);
		expect(r?.target).toBe('Text/ch1.xhtml#section-2');
	});

	test('uses path.relative for ../ nav links', () => {
		const book = mockBook(['Text/ch1.xhtml']);
		// relative mock strips ../
		const r = resolveTocTarget('../Text/ch1.xhtml', book);
		expect(r?.href).toBe('Text/ch1.xhtml');
	});

	test('passes CFI through', () => {
		const cfi = 'epubcfi(/6/4!/4/2/2[chap]/1:0)';
		expect(resolveTocTarget(cfi, mockBook(['a.xhtml']))?.target).toBe(cfi);
	});

	test('hrefCandidates includes decode variants', () => {
		const c = hrefCandidates('Text/Chapter%201.xhtml');
		expect(c.some((x) => x.includes('Chapter'))).toBe(true);
	});
});
