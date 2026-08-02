/**
 * TOC / spine helpers for epubjs.
 *
 * Nav hrefs are relative to the nav document; spine keys are OPF/manifest paths.
 * A plain spine.get(tocHref) often returns null — resolve with several candidates.
 */

export type TocItem = {
	label: string;
	href: string;
	subitems?: TocItem[];
};

export type FlatTocItem = {
	label: string;
	href: string;
	/** Nesting depth (0 = top-level). */
	depth: number;
};

/** Humanize a spine href into a short chapter label. */
export function labelFromHref(href: string): string {
	const base = basename(href).replace(/\.(x?html?|xml|htm)$/i, '');
	const decoded = (() => {
		try {
			return decodeURIComponent(base);
		} catch {
			return base;
		}
	})();
	const cleaned = decoded
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return 'Section';
	// Title-case short filenames; leave longer mixed-case alone
	if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
		return cleaned
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}
	return cleaned;
}

/**
 * Flatten nested nav.toc / NCX trees into a clickable list.
 * Defensive: epubjs items may omit fields; some packages put children under `children`.
 */
export function flattenToc(items: TocItem[] | undefined | null, depth = 0): FlatTocItem[] {
	if (!items || !Array.isArray(items) || items.length === 0) return [];
	const out: FlatTocItem[] = [];
	for (const raw of items) {
		if (!raw || typeof raw !== 'object') continue;
		const item = raw as TocItem & { title?: string; children?: TocItem[]; src?: string };
		const label = String(item.label || item.title || '')
			.replace(/\s+/g, ' ')
			.trim();
		const href = String(item.href || item.src || '').trim();
		if (label || href) {
			out.push({
				label: label || labelFromHref(href) || 'Untitled',
				href,
				depth
			});
		}
		const kids = item.subitems || item.children;
		if (kids && Array.isArray(kids) && kids.length) {
			out.push(...flattenToc(kids, depth + 1));
		}
	}
	return out;
}

/**
 * Build a reader TOC from navigation, falling back to linear spine items
 * when the package has no nav/NCX (or nav failed to parse).
 */
export function buildReaderToc(
	navToc: TocItem[] | undefined | null,
	spineItems?: Array<{ href?: string; linear?: string | boolean; index?: number }> | null
): FlatTocItem[] {
	const fromNav = flattenToc(navToc);
	if (fromNav.length > 0) return fromNav;

	if (!spineItems?.length) return [];
	const out: FlatTocItem[] = [];
	for (let i = 0; i < spineItems.length; i++) {
		const s = spineItems[i];
		const href = (s?.href || '').trim();
		if (!href) continue;
		// Skip non-linear (cover spreads etc.) when flagged
		const linear = s.linear;
		if (linear === 'no' || linear === false) continue;
		out.push({
			label: labelFromHref(href),
			href,
			depth: 0
		});
	}
	return out;
}

export function pathOnly(href: string): string {
	return href.split('#')[0].split('?')[0].trim();
}

export function fragmentOf(href: string): string {
	const i = href.indexOf('#');
	return i >= 0 ? href.slice(i) : '';
}

export function basename(path: string): string {
	const clean = pathOnly(path).replace(/\\/g, '/');
	const parts = clean.split('/').filter(Boolean);
	return parts[parts.length - 1] || clean;
}

function tryDecode(s: string): string {
	try {
		return decodeURI(s);
	} catch {
		return s;
	}
}

function tryEncode(s: string): string {
	try {
		return encodeURI(s);
	} catch {
		return s;
	}
}

/** Spine-like object we can query without importing epubjs types. */
export type SpineLike = {
	get?: (target: string | number) => { href?: string; index?: number } | null | undefined;
	spineItems?: Array<{ href?: string; index?: number; url?: string; canonical?: string }>;
	length?: number;
};

export type BookLike = {
	spine?: SpineLike;
	path?: { relative?: (what: string) => string; resolve?: (what: string) => string };
	resolve?: (path: string, absolute?: boolean) => string;
};

export type ResolvedTarget = {
	/** String to pass to rendition.display (href, href#frag, or spine index). */
	target: string | number;
	/** Resolved section href without fragment, if known. */
	href?: string;
	index?: number;
};

/**
 * Build lookup candidates for a TOC/nav href.
 * Order: raw path, decode/encode, book-relative, basename, trailing-segment variants.
 */
export function hrefCandidates(raw: string, book?: BookLike | null): string[] {
	const href = (raw || '').trim();
	if (!href) return [];

	const path = pathOnly(href);
	const seen = new Set<string>();
	const add = (v: string | undefined | null) => {
		if (!v) return;
		const t = v.trim();
		if (!t || seen.has(t)) return;
		seen.add(t);
	};

	add(href);
	add(path);
	add(tryDecode(href));
	add(tryDecode(path));
	add(tryEncode(path));

	// Strip leading ./ and resolve ../ noise for matching
	const normalized = path.replace(/^\.\//, '');
	add(normalized);

	if (book?.path?.relative) {
		try {
			add(book.path.relative(href));
			add(book.path.relative(path));
			add(pathOnly(book.path.relative(href)));
		} catch {
			/* */
		}
	}
	if (book?.path?.resolve) {
		try {
			const resolved = book.path.resolve(path);
			add(resolved);
			add(pathOnly(resolved));
		} catch {
			/* */
		}
	}
	if (typeof book?.resolve === 'function') {
		try {
			const r = book.resolve(path, false);
			add(r);
			add(pathOnly(r || ''));
		} catch {
			/* */
		}
	}

	// Leading-slash variants (some spines store /Text/ch.xhtml)
	if (path && !path.startsWith('/')) add('/' + path);
	if (path.startsWith('/')) add(path.slice(1));

	return [...seen];
}

/**
 * Match a path against spine item hrefs by exact, endsWith, or basename.
 */
export function matchSpineHref(
	candidates: string[],
	spineItems: Array<{ href?: string; index?: number; url?: string; canonical?: string }>
): { href: string; index: number } | null {
	if (!spineItems?.length || !candidates.length) return null;

	const entries = spineItems
		.map((s, i) => ({
			href: s.href || '',
			index: typeof s.index === 'number' ? s.index : i,
			url: s.url || '',
			canonical: s.canonical || ''
		}))
		.filter((e) => e.href || e.url);

	// 1) Exact path match (any candidate vs href / basename of url)
	for (const c of candidates) {
		const cp = pathOnly(c);
		for (const e of entries) {
			if (!cp) continue;
			if (e.href === c || e.href === cp) return { href: e.href, index: e.index };
			if (pathOnly(e.href) === cp) return { href: e.href, index: e.index };
		}
	}

	// 2) endsWith: nav "Text/ch.xhtml" vs spine "OEBPS/Text/ch.xhtml" (and reverse)
	for (const c of candidates) {
		const cp = pathOnly(c).replace(/^\//, '');
		if (!cp || cp.length < 3) continue;
		for (const e of entries) {
			const eh = pathOnly(e.href).replace(/^\//, '');
			if (!eh) continue;
			if (eh.endsWith(cp) || cp.endsWith(eh)) {
				return { href: e.href, index: e.index };
			}
			// URL path often contains the full archive path
			const eu = e.url.replace(/^\//, '');
			if (eu && (eu.endsWith(cp) || eu.includes('/' + cp))) {
				return { href: e.href, index: e.index };
			}
		}
	}

	// 3) Basename-only (last resort — ambiguous if duplicate filenames)
	for (const c of candidates) {
		const base = basename(c);
		if (!base || base.length < 2) continue;
		const hits = entries.filter((e) => basename(e.href) === base || basename(e.url) === base);
		if (hits.length === 1) return { href: hits[0].href, index: hits[0].index };
	}

	return null;
}

/**
 * Whether two resource paths refer to the same spine document
 * (nav vs OPF path prefixes, basename fallback).
 */
export function pathMatches(a: string, b: string): boolean {
	const pa = pathOnly(a).replace(/^\//, '');
	const pb = pathOnly(b).replace(/^\//, '');
	if (!pa || !pb) return false;
	if (pa === pb) return true;
	if (pa.endsWith(pb) || pb.endsWith(pa)) return true;
	const ba = basename(pa);
	const bb = basename(pb);
	return Boolean(ba && bb && ba === bb && ba.length >= 3);
}

export type LocationHint = {
	/** Current spine document href from epubjs location.start.href */
	href?: string;
	/** Current spine index from location.start.index */
	index?: number;
};

/**
 * Index of the TOC entry that represents the current reading position.
 * Prefer last entry whose resolved spine index is ≤ current index
 * (standard “current chapter” walk). Fallback: last path match on href.
 * Returns -1 when nothing matches.
 */
export function activeTocIndex(
	toc: Array<{ href: string }>,
	loc: LocationHint | null | undefined,
	book?: BookLike | null
): number {
	if (!toc?.length || !loc) return -1;

	const hasIndex = typeof loc.index === 'number' && loc.index >= 0;
	const curHref = (loc.href || '').trim();

	// 1) Spine-order walk: last TOC item at or before current spine position
	if (hasIndex) {
		let best = -1;
		let bestIdx = -1;
		for (let i = 0; i < toc.length; i++) {
			const resolved = resolveTocTarget(toc[i].href, book);
			const ti =
				typeof resolved?.index === 'number'
					? resolved.index
					: // Fallback: match path against current for same-document entries
						curHref && pathMatches(toc[i].href, curHref)
						? loc.index!
						: undefined;
			if (typeof ti !== 'number') continue;
			if (ti <= loc.index! && ti >= bestIdx) {
				bestIdx = ti;
				best = i;
			}
		}
		if (best >= 0) return best;
	}

	// 2) Path-only: last TOC entry whose document matches the current href
	if (curHref) {
		let best = -1;
		for (let i = 0; i < toc.length; i++) {
			if (pathMatches(toc[i].href, curHref)) best = i;
		}
		if (best >= 0) return best;
	}

	return -1;
}

/**
 * Resolve a TOC href (or CFI / spine index string) to a rendition.display target.
 */
export function resolveTocTarget(raw: string, book?: BookLike | null): ResolvedTarget | null {
	const href = (raw || '').trim();
	if (!href) return null;

	// CFI passes through
	if (href.startsWith('epubcfi(') || (href.includes('/6/') && href.startsWith('epubcfi'))) {
		return { target: href };
	}
	// Some saved locations are bare CFIs without checking — still let epubjs try
	if (/^epubcfi/i.test(href)) return { target: href };

	const spine = book?.spine;
	const frag = fragmentOf(href);
	const candidates = hrefCandidates(href, book);

	// Prefer spine.get for each candidate (handles encodeURI table inside epubjs)
	if (spine?.get) {
		for (const c of candidates) {
			try {
				const section = spine.get(c);
				if (section && (section.href != null || typeof section.index === 'number')) {
					const sh = section.href || '';
					const display = frag ? `${pathOnly(sh || c)}${frag}` : sh || c;
					return {
						target: display,
						href: sh || pathOnly(c),
						index: section.index
					};
				}
			} catch {
				/* */
			}
		}
		// Numeric index
		const asNum = Number(href);
		if (Number.isInteger(asNum) && asNum >= 0) {
			const section = spine.get(asNum);
			if (section) {
				return {
					target: typeof section.index === 'number' ? section.index : asNum,
					href: section.href,
					index: section.index ?? asNum
				};
			}
		}
	}

	// Manual spine walk
	const items = spine?.spineItems;
	if (items?.length) {
		const hit = matchSpineHref(candidates, items);
		if (hit) {
			const display = frag ? `${pathOnly(hit.href)}${frag}` : hit.href;
			return { target: display || hit.index, href: hit.href, index: hit.index };
		}
	}

	// Last resort: try raw path (may still work if spine table was incomplete)
	if (candidates[0]) {
		return { target: frag ? `${pathOnly(candidates[0])}${frag}` : candidates[0] };
	}
	return null;
}
