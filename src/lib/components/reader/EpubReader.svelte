<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { buildReaderToc, resolveTocTarget } from '$lib/client/epubNav';
	import { fontStack, type ReaderPrefs } from '$lib/client/types';
	/* Absolute URLs so @font-face works inside epubjs iframes (parent page fonts do not) */
	import literataWoff2 from '@fontsource-variable/literata/files/literata-latin-opsz-normal.woff2?url';
	import literataItalicWoff2 from '@fontsource-variable/literata/files/literata-latin-opsz-italic.woff2?url';
	import newsreaderWoff2 from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url';
	import newsreaderItalicWoff2 from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2?url';
	import sourceSansWoff2 from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url';
	import sourceSansItalicWoff2 from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-italic.woff2?url';

	let {
		blob,
		prefs,
		initialLocation = '',
		onprogress,
		ontoc,
		onerror
	}: {
		blob: Blob;
		prefs: ReaderPrefs;
		initialLocation?: string;
		onprogress: (fraction: number, location: string, label?: string) => void;
		ontoc?: (items: { label: string; href: string; depth?: number }[]) => void;
		onerror?: (message: string) => void;
	} = $props();

	let host: HTMLDivElement | undefined = $state();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let book: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let rendition: any = null;
	let loadError = $state('');
	/**
	 * Must be $state so the prefs $effect re-runs when the book finishes opening.
	 * Plain let + early return meant prefs were never tracked → sliders did nothing.
	 */
	let displayReady = $state(false);
	let resizeObserver: ResizeObserver | null = null;
	let lastResizeW = 0;
	let lastResizeH = 0;
	let resizeTimer: ReturnType<typeof setTimeout> | null = null;
	let wheelCleanup: (() => void) | null = null;
	let prefsApplyTimer: ReturnType<typeof setTimeout> | null = null;
	let restampTimer: ReturnType<typeof setTimeout> | null = null;
	let expandTimer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Mutable snapshot always read by content/layout hooks.
	 * epubjs content hooks close over this ref (not a stale Svelte prop snapshot).
	 */
	let activePrefs: ReaderPrefs = prefs;
	/** True once we wrap layout.format to re-stamp after size() wipes body styles. */
	let layoutPatched = false;
	/** Skip redundant inject/expand work that causes continuous-mode flicker. */
	let lastThemeCss = '';
	let lastLayoutKey = '';
	let lastAppliedKey = '';
	let lastLockedW = 0;
	let themeBusy = false;
	/** Ignore ResizeObserver callbacks we caused ourselves via lockStageWidth. */
	let ignoreResizeUntil = 0;
	/** False after onMount cleanup — ignore late async TOC/theme work. */
	let sessionAlive = false;

	const THEME_MAP: Record<
		string,
		{ bg: string; fg: string; mute: string; link: string; rule: string }
	> = {
		night: {
			bg: '#0c0c0c',
			fg: '#f3f2ed',
			mute: '#9a9a94',
			link: '#d0544c',
			rule: 'rgba(243,242,237,0.14)'
		},
		paper: {
			bg: '#f7f5f0',
			fg: '#1a1c22',
			mute: '#5a5a56',
			link: '#a33a34',
			rule: 'rgba(26,28,34,0.14)'
		},
		sepia: {
			bg: '#e8dcc8',
			fg: '#3d3428',
			mute: '#6b5e4e',
			link: '#8b3a2a',
			rule: 'rgba(61,52,40,0.18)'
		},
		contrast: {
			bg: '#000000',
			fg: '#ffffff',
			mute: '#c0c0c0',
			link: '#ff8a80',
			rule: 'rgba(255,255,255,0.2)'
		}
	};

	function themeFor(p: ReaderPrefs) {
		return THEME_MAP[p.theme] || THEME_MAP.night;
	}

	/** @font-face for iframe documents — parent-loaded fontsource faces are not inherited. */
	function buildFontFaceCss(): string {
		return `
@font-face {
	font-family: 'Literata Variable';
	font-style: normal;
	font-display: swap;
	font-weight: 200 900;
	src: url('${literataWoff2}') format('woff2-variations');
}
@font-face {
	font-family: 'Literata Variable';
	font-style: italic;
	font-display: swap;
	font-weight: 200 900;
	src: url('${literataItalicWoff2}') format('woff2-variations');
}
@font-face {
	font-family: 'Newsreader Variable';
	font-style: normal;
	font-display: swap;
	font-weight: 200 800;
	src: url('${newsreaderWoff2}') format('woff2-variations');
}
@font-face {
	font-family: 'Newsreader Variable';
	font-style: italic;
	font-display: swap;
	font-weight: 200 800;
	src: url('${newsreaderItalicWoff2}') format('woff2-variations');
}
@font-face {
	font-family: 'Source Sans 3 Variable';
	font-style: normal;
	font-display: swap;
	font-weight: 200 900;
	src: url('${sourceSansWoff2}') format('woff2-variations');
}
@font-face {
	font-family: 'Source Sans 3 Variable';
	font-style: italic;
	font-display: swap;
	font-weight: 200 900;
	src: url('${sourceSansItalicWoff2}') format('woff2-variations');
}
`;
	}

	/**
	 * Serialized CSS with !important so publisher sheets cannot win.
	 * Accepts explicit prefs so parent can apply a snapshot before prop flush.
	 */
	function buildThemeCss(p: ReaderPrefs = prefs): string {
		const { bg, fg, mute, link, rule } = themeFor(p);
		const align = p.textAlign ?? 'left';
		const tracking = p.letterSpacing ?? 0;
		const para = p.paragraphSpacing ?? 1;
		const hyphens = p.hyphenate ? 'auto' : 'manual';
		const margin = Math.max(0, p.margin ?? 24);
		const measure = Math.max(20, Math.min(120, p.measure ?? 68));
		/* Left rail (~3.5rem) must clear chrome; TextReader uses max(margin, 3.75rem) */
		const leftPad = Math.max(margin, 56);
		const rightPad = Math.max(margin, 16);
		/* Continuous spine stacks: generous vertical air so chapters do not abut */
		const topPad = Math.max(margin, 36);
		const bottomPad = Math.max(Math.round(margin * 3.2), 88);
		const sectionPadTop = Math.max(Math.round(margin * 1.4), 28);
		const sectionPadBottom = Math.max(Math.round(margin * 2.4), 56);
		const family = fontStack(p.fontFamily);
		const display =
			'"Newsreader Variable", Newsreader, Georgia, "Times New Roman", serif';

		return `
${buildFontFaceCss()}
*, *::before, *::after {
	box-sizing: border-box !important;
}
html {
	margin: 0 !important;
	padding: 0 !important;
	width: 100% !important;
	max-width: 100% !important;
	min-width: 0 !important;
	height: auto !important;
	/* x clip: large cover art must not widen the stage; y open for textHeight */
	overflow-x: hidden !important;
	overflow-y: visible !important;
	background: ${bg} !important;
	-webkit-text-size-adjust: 100%;
	text-size-adjust: 100%;
}
/*
 * Reading column — same model as .reader-prose:
 * max-width: measure (ch), centered, padding = margin + rail on the left.
 * Extra block padding separates stacked continuous chapters.
 */
body {
	box-sizing: border-box !important;
	display: block !important;
	width: 100% !important;
	max-width: ${measure}ch !important;
	min-width: 0 !important;
	min-height: 0 !important;
	margin-top: ${topPad}px !important;
	margin-bottom: ${bottomPad}px !important;
	margin-left: auto !important;
	margin-right: auto !important;
	padding: ${sectionPadTop}px ${rightPad}px ${sectionPadBottom}px ${leftPad}px !important;
	float: none !important;
	position: static !important;
	left: auto !important;
	right: auto !important;
	transform: none !important;
	overflow-x: hidden !important;
	overflow-y: visible !important;
	overflow-wrap: anywhere !important;
	word-wrap: break-word !important;
	word-break: break-word !important;
	column-count: auto !important;
	columns: auto !important;
	background: ${bg} !important;
	color: ${fg} !important;
	font-family: ${family} !important;
	font-size: ${p.fontSize}px !important;
	line-height: ${p.lineHeight} !important;
	letter-spacing: ${tracking}em !important;
	text-align: ${align} !important;
	hyphens: ${hyphens};
	-webkit-hyphens: ${hyphens};
	font-optical-sizing: auto;
	font-feature-settings: "liga" 1, "kern" 1, "calt" 1;
	text-rendering: optimizeLegibility;
}
/*
 * Chapter close plate at the foot of every spine section so the next
 * continuous view (next chapter open) does not feel welded to prior prose.
 * Asterism: hairline · crimson bead · hairline.
 */
body::after {
	content: '' !important;
	display: block !important;
	clear: both !important;
	width: 7.5rem !important;
	height: 8px !important;
	margin: 3.25em auto 0.35em !important;
	border: 0 !important;
	opacity: 1 !important;
	pointer-events: none !important;
	background:
		linear-gradient(${rule}, ${rule}) left center / calc(50% - 10px) 1px no-repeat,
		linear-gradient(${rule}, ${rule}) right center / calc(50% - 10px) 1px no-repeat,
		radial-gradient(circle, ${link} 0 3px, transparent 3.5px) center / 8px 8px no-repeat !important;
}
/* Block wrappers stay inside the measure column (not image scrollWidth) */
div, section, article, main, header, footer, aside, nav,
figure, p, table, ul, ol, li, blockquote, pre,
h1, h2, h3, h4, h5, h6 {
	max-width: 100% !important;
	min-width: 0 !important;
}
/*
 * Publisher sheets often pin font-size/family on p/div — body-only rules never show.
 * Prose inherits type-panel size/face/leading; heads keep their em scale below.
 */
p, li, td, th, dd, dt, blockquote, pre, code, span, a, em, i, strong, b, small, sub, sup {
	font-family: inherit !important;
	font-size: inherit !important;
	line-height: inherit !important;
	letter-spacing: inherit !important;
	color: inherit !important;
}
img, svg, video, canvas, object, embed, picture, image {
	max-width: 100% !important;
	width: auto !important;
	height: auto !important;
	object-fit: contain !important;
	box-sizing: border-box !important;
	display: block !important;
}
img[width], img[height], svg[width], svg[height] {
	width: auto !important;
	height: auto !important;
	max-width: 100% !important;
}
figure, picture, .cover, .cover-image, [class*="cover"], [class*="image"] {
	max-width: 100% !important;
	width: 100% !important;
	margin-left: 0 !important;
	margin-right: 0 !important;
}
table {
	max-width: 100% !important;
	width: 100% !important;
	border-collapse: collapse;
	display: block;
	overflow-x: auto;
}
td, th {
	word-wrap: break-word !important;
	overflow-wrap: break-word !important;
}
.float-left, .float-right, .alignleft, .alignright {
	float: none !important;
	max-width: 100% !important;
}
p {
	margin-top: 0 !important;
	margin-bottom: ${para}em !important;
	text-align: ${align} !important;
	hyphens: ${hyphens};
	-webkit-hyphens: ${hyphens};
	overflow-wrap: break-word !important;
}
h1, h2, h3, h4, h5, h6 {
	font-family: ${display} !important;
	font-weight: 600 !important;
	letter-spacing: -0.025em;
	line-height: 1.12;
	text-align: left !important;
	hyphens: none;
	margin-top: 2em !important;
	margin-bottom: 0.55em !important;
	color: ${fg} !important;
	float: none !important;
	clear: both !important;
}
/*
 * Title / chapter plate — broadsheet display.
 * Mid-stream h1 (same file): heavy top air + hairline so chapters do not run on.
 */
h1 {
	font-size: 2.55em !important;
	letter-spacing: -0.032em;
	line-height: 0.94;
	margin-top: 3.5em !important;
	margin-bottom: 0.55em !important;
	padding-top: 1.35em !important;
	padding-bottom: 0 !important;
	max-width: 18ch !important;
	border-top: 1px solid ${rule} !important;
	border-bottom: none !important;
}
/* Crimson underline rule under the title */
h1::after {
	content: '' !important;
	display: block !important;
	width: 4.5rem !important;
	height: 2px !important;
	margin-top: 0.95em !important;
	background: ${link} !important;
	border-radius: 1px !important;
}
/* Chapter-II style heads — magazine open with air + top rule */
h2 {
	font-size: 1.65em !important;
	letter-spacing: -0.03em;
	line-height: 1.08;
	margin-top: 3.35em !important;
	margin-bottom: 0.65em !important;
	padding-top: 1.15em !important;
	border-top: 1px solid ${rule} !important;
}
h3 { font-size: 1.32em !important; margin-top: 2.65em !important; padding-top: 0.35em !important; }
h4 { font-size: 1.1em !important; }
/*
 * First head of a spine section = chapter open for continuous stack.
 * Drop the double hairline (section already has end-mark above); keep crimson plate.
 */
body > h1:first-child,
body > h2:first-child,
body > header:first-child > h1:first-child,
body > header:first-child > h2:first-child,
body > section:first-child > h1:first-child,
body > section:first-child > h2:first-child,
body > div:first-child > h1:first-child,
body > div:first-child > h2:first-child,
body > .chapter:first-child > h1:first-child,
body > .chapter:first-child > h2:first-child {
	margin-top: 0.15em !important;
	padding-top: 0.35em !important;
	border-top: none !important;
}
/* Crimson bead above the chapter title (section opener) */
body > h1:first-child::before,
body > h2:first-child::before,
body > header:first-child > h1:first-child::before,
body > header:first-child > h2:first-child::before,
body > section:first-child > h1:first-child::before,
body > section:first-child > h2:first-child::before,
body > div:first-child > h1:first-child::before,
body > div:first-child > h2:first-child::before {
	content: '' !important;
	display: block !important;
	width: 5px !important;
	height: 5px !important;
	border-radius: 50% !important;
	background: ${link} !important;
	margin: 0.15em 0 1.25em 0 !important;
	box-shadow: 0 0 0 4px ${bg}, 0 0 0 5px ${rule} !important;
	pointer-events: none !important;
}
/* Drop cap after chapter — display initial (no float: epubjs continuous height) */
h1 + p::first-letter,
h2 + p::first-letter {
	font-family: ${display} !important;
	font-weight: 600 !important;
	font-size: 1.75em !important;
	line-height: 1 !important;
	color: ${fg} !important;
	float: none !important;
	padding: 0 !important;
	margin: 0 !important;
}
.dropcap, .drop-cap, span.dropcap {
	float: none !important;
	font-family: ${display} !important;
	font-weight: 600 !important;
	font-size: 1.65em !important;
}
/* Deck / first graf under chapter title — italic plate then hard break into body */
h1 + p,
h2 + p {
	font-family: ${display} !important;
	font-style: italic !important;
	font-size: 1.06em !important;
	color: ${mute} !important;
	margin-top: 0.65em !important;
	margin-bottom: 2.65em !important;
	padding-bottom: 1.65em !important;
	border-bottom: 1px solid ${rule} !important;
	max-width: 36ch !important;
	line-height: 1.42 !important;
}
/* If the book uses a bare chapter class wrapper, give it the same open air */
.chapter, section.chapter, div.chapter, [class*="Chapter"] {
	margin-top: 1.5em !important;
	padding-top: 0.5em !important;
}
a { color: ${link} !important; text-underline-offset: 0.22em; }
blockquote {
	margin: 2.15em 0 !important;
	padding: 0.55em 0 0.55em 1.35em !important;
	border-left: 2px solid ${link} !important;
	color: ${mute} !important;
	font-family: ${display} !important;
	font-style: italic;
	font-size: 1.12em;
	line-height: 1.45;
}
/* In-chapter scene break — asterism-lite (rule + bead space via box-shadow) */
hr {
	border: 0 !important;
	height: 0 !important;
	margin: 3.75em auto !important;
	max-width: 8.5rem !important;
	position: relative !important;
	background: transparent !important;
	overflow: visible !important;
}
hr::before {
	content: '' !important;
	display: block !important;
	height: 1px !important;
	background: ${rule} !important;
}
hr::after {
	content: '' !important;
	position: absolute !important;
	left: 50% !important;
	top: 50% !important;
	width: 6px !important;
	height: 6px !important;
	border-radius: 50% !important;
	background: ${link} !important;
	transform: translate(-50%, -50%) !important;
	box-shadow: 0 0 0 5px ${bg} !important;
}
ul, ol {
	margin-bottom: ${para}em !important;
	padding-left: 1.4em !important;
}
li { margin-bottom: 0.45em; }
li::marker { color: ${link}; }
code {
	font-size: 0.88em;
	padding: 0.12em 0.35em;
	border-radius: 3px;
	background: color-mix(in srgb, ${fg} 8%, transparent);
}
pre {
	max-width: 100% !important;
	overflow-x: auto !important;
	white-space: pre-wrap !important;
}
`;
	}

	/**
	 * Stamp inline styles on html/body — highest priority, survives publisher CSS.
	 * Used for real-time type-panel updates (size, measure, margin, face, theme…).
	 */
	function stampBodyInline(doc: Document, p: ReaderPrefs) {
		const { bg, fg } = themeFor(p);
		const margin = Math.max(0, p.margin ?? 24);
		const measure = Math.max(20, Math.min(120, p.measure ?? 68));
		const leftPad = Math.max(margin, 56);
		const rightPad = Math.max(margin, 16);
		/* Match buildThemeCss — continuous chapters need this air; zero padding
		 * made stacked spine sections feel welded (inline !important beats theme). */
		const topPad = Math.max(margin, 36);
		const bottomPad = Math.max(Math.round(margin * 3.2), 88);
		const sectionPadTop = Math.max(Math.round(margin * 1.4), 28);
		const sectionPadBottom = Math.max(Math.round(margin * 2.4), 56);
		const align = p.textAlign ?? 'left';
		const tracking = p.letterSpacing ?? 0;
		const hyphens = p.hyphenate ? 'auto' : 'manual';
		const family = fontStack(p.fontFamily);

		const root = doc.documentElement;
		const body = doc.body;
		if (!body) return;

		root.style.setProperty('background', bg, 'important');
		root.style.setProperty('max-width', '100%', 'important');
		root.style.setProperty('overflow-x', 'hidden', 'important');
		root.style.setProperty('overflow-y', 'visible', 'important');

		// Clear epubjs contentWidth stamps
		body.style.removeProperty('width');
		body.style.setProperty('box-sizing', 'border-box', 'important');
		body.style.setProperty('background', bg, 'important');
		body.style.setProperty('color', fg, 'important');
		body.style.setProperty('font-family', family, 'important');
		body.style.setProperty('font-size', `${p.fontSize}px`, 'important');
		body.style.setProperty('line-height', String(p.lineHeight), 'important');
		body.style.setProperty('letter-spacing', `${tracking}em`, 'important');
		body.style.setProperty('text-align', align, 'important');
		body.style.setProperty('hyphens', hyphens, 'important');
		body.style.setProperty('max-width', `${measure}ch`, 'important');
		body.style.setProperty('width', '100%', 'important');
		body.style.setProperty('min-width', '0', 'important');
		body.style.setProperty('margin-left', 'auto', 'important');
		body.style.setProperty('margin-right', 'auto', 'important');
		body.style.setProperty('margin-top', `${topPad}px`, 'important');
		body.style.setProperty('margin-bottom', `${bottomPad}px`, 'important');
		body.style.setProperty('padding-left', `${leftPad}px`, 'important');
		body.style.setProperty('padding-right', `${rightPad}px`, 'important');
		body.style.setProperty('padding-top', `${sectionPadTop}px`, 'important');
		body.style.setProperty('padding-bottom', `${sectionPadBottom}px`, 'important');
		body.style.setProperty('overflow-x', 'hidden', 'important');
		body.style.setProperty('overflow-y', 'visible', 'important');

		// Paragraph spacing + force type inheritance (publisher p { font-size: 14px } etc.)
		const para = p.paragraphSpacing ?? 1;
		for (const el of body.querySelectorAll('p, li, td, th, blockquote')) {
			const node = el as HTMLElement;
			node.style.setProperty('font-family', 'inherit', 'important');
			node.style.setProperty('font-size', 'inherit', 'important');
			node.style.setProperty('line-height', 'inherit', 'important');
			node.style.setProperty('letter-spacing', 'inherit', 'important');
			node.style.setProperty('color', 'inherit', 'important');
			if (el.tagName === 'P') {
				node.style.setProperty('margin-bottom', `${para}em`, 'important');
				node.style.setProperty('text-align', align, 'important');
			}
		}

		const media = doc.querySelectorAll(
			'img, svg, video, canvas, object, embed, picture, figure, image'
		);
		for (const node of media) {
			const el = node as HTMLElement;
			el.style.setProperty('max-width', '100%', 'important');
			el.style.setProperty('width', 'auto', 'important');
			el.style.setProperty('height', 'auto', 'important');
			el.style.setProperty('object-fit', 'contain', 'important');
			if (el instanceof HTMLImageElement) {
				el.removeAttribute('width');
				el.removeAttribute('height');
			}
		}
	}

	function writeStyleTag(doc: Document, css: string, id = 'lumen-theme') {
		let el = doc.getElementById(id) as HTMLStyleElement | null;
		if (!el) {
			el = doc.createElement('style');
			el.id = id;
			(doc.head || doc.documentElement).appendChild(el);
			el.textContent = css;
			return;
		}
		// Avoid style recalc/flicker when CSS is identical
		if (el.textContent === css) return;
		el.textContent = css;
	}

	/**
	 * Strip publisher fixed widths / image attrs so the measure column stays stable.
	 */
	function clampMediaInContents(
		contents: { document?: Document; window?: Window },
		p: ReaderPrefs = prefs
	) {
		try {
			const doc = contents.document;
			if (!doc) return;
			stampBodyInline(doc, p);
		} catch {
			/* */
		}
	}

	function layoutKeyOf(p: ReaderPrefs): string {
		return [
			p.fontFamily,
			p.fontSize,
			p.lineHeight,
			p.letterSpacing ?? 0,
			p.paragraphSpacing ?? 1,
			p.measure,
			p.margin,
			p.textAlign ?? 'left',
			p.hyphenate ? 1 : 0
		].join('|');
	}

	function prefsKeyOf(p: ReaderPrefs): string {
		return [
			p.theme,
			layoutKeyOf(p),
			p.brightness ?? 1,
			p.keepAwake ? 1 : 0
		].join('|');
	}

	/** Keep every continuous view/iframe at host width — never image scrollWidth. */
	function lockStageWidth() {
		if (!host) return;
		const w = host.clientWidth;
		if (w < 8) return;
		// Avoid style writes that re-trigger ResizeObserver when nothing changed
		if (lastLockedW === w) {
			const sample = host.querySelector('.epub-view') as HTMLElement | null;
			if (sample && sample.style.width === `${w}px`) return;
		}
		lastLockedW = w;
		ignoreResizeUntil = performance.now() + 120;
		try {
			const views = host.querySelectorAll('.epub-view');
			for (const view of views) {
				const el = view as HTMLElement;
				if (el.style.width !== `${w}px`) {
					el.style.setProperty('width', `${w}px`, 'important');
					el.style.setProperty('max-width', '100%', 'important');
					el.style.setProperty('min-width', '0', 'important');
				}
				const iframe = el.querySelector('iframe') as HTMLIFrameElement | null;
				if (iframe && iframe.style.width !== `${w}px`) {
					iframe.style.setProperty('width', `${w}px`, 'important');
					iframe.style.setProperty('max-width', '100%', 'important');
					iframe.style.setProperty('min-width', '0', 'important');
				}
			}
			const container = host.querySelector('.epub-container') as HTMLElement | null;
			if (container && container.style.width !== `${w}px`) {
				container.style.setProperty('width', `${w}px`, 'important');
				container.style.setProperty('max-width', '100%', 'important');
			}
		} catch {
			/* */
		}
	}

	/** Collect every reachable content document (epubjs + raw iframes). */
	function eachContentDoc(fn: (doc: Document, contents?: { document?: Document; addStylesheetCss?: (css: string, key: string) => void }) => void) {
		const seen = new Set<Document>();
		try {
			const contents = rendition?.getContents?.() || [];
			for (const c of contents) {
				const doc = c.document as Document | undefined;
				if (doc && !seen.has(doc)) {
					seen.add(doc);
					fn(doc, c);
				}
			}
		} catch {
			/* */
		}
		// Fallback: continuous views may not all be in getContents during transitions
		try {
			const iframes = host?.querySelectorAll('iframe') || [];
			for (const iframe of iframes) {
				try {
					const doc = (iframe as HTMLIFrameElement).contentDocument;
					if (doc && !seen.has(doc)) {
						seen.add(doc);
						fn(doc);
					}
				} catch {
					/* cross-origin */
				}
			}
		} catch {
			/* */
		}
	}

	/**
	 * Write theme CSS + inline prefs into every open iframe.
	 * Soft mode skips stylesheet rewrites when CSS is unchanged (still re-stamps body
	 * after format wipe). Never nested: concurrent injects re-enter and thrash continuous.
	 */
	function injectThemeIntoContents(p: ReaderPrefs = activePrefs, soft = false) {
		if (themeBusy) return;
		themeBusy = true;
		try {
			const css = buildThemeCss(p);
			const cssChanged = css !== lastThemeCss;
			if (cssChanged || !soft) {
				try {
					if (rendition && typeof rendition.themes?.registerCss === 'function') {
						rendition.themes.registerCss('default', css);
					}
				} catch {
					/* */
				}
				try {
					const t = rendition?.themes;
					if (t && typeof t.override === 'function') {
						const { bg, fg } = themeFor(p);
						t.override('font-size', `${p.fontSize}px`, true);
						t.override('font-family', fontStack(p.fontFamily), true);
						t.override('line-height', String(p.lineHeight), true);
						t.override('color', fg, true);
						t.override('background', bg, true);
						t.override('background-color', bg, true);
						t.override('letter-spacing', `${p.letterSpacing ?? 0}em`, true);
						t.override('text-align', p.textAlign ?? 'left', true);
					}
				} catch {
					/* */
				}
			}
			eachContentDoc((doc, contents) => {
				try {
					if (cssChanged || !soft) {
						contents?.addStylesheetCss?.(css, 'lumen-theme');
						writeStyleTag(doc, css, 'lumen-theme');
						writeStyleTag(doc, css, 'epubjs-inserted-css-lumen-theme');
						writeStyleTag(doc, css, 'epubjs-inserted-css-default');
					}
					// Always stamp body: layout.format → size() wipes measure/margin
					stampBodyInline(doc, p);
				} catch {
					/* */
				}
			});
			lastThemeCss = css;
			lockStageWidth();
		} finally {
			themeBusy = false;
		}
	}

	/** Debounced body re-stamp after epubjs expand/format — coalesces storms. */
	function scheduleRestamp(ms = 64) {
		if (restampTimer) clearTimeout(restampTimer);
		restampTimer = setTimeout(() => {
			restampTimer = null;
			if (!rendition && !host) return;
			injectThemeIntoContents(activePrefs, true);
		}, ms);
	}

	/**
	 * epubjs layout.format → contents.size() assigns body width/margin/padding without
	 * !important and *replaces* any prior style.setProperty(..., 'important') via CSSOM.
	 * That runs on every expand/resize (font-size changes trigger resize listeners).
	 * Patch format so we always re-stamp measure/margin/type after size() runs.
	 */
	function patchLayoutFormat() {
		if (!rendition?.layout || layoutPatched) return;
		const layout = rendition.layout;
		const original = layout.format?.bind(layout);
		if (typeof original !== 'function') return;
		layout.format = (contents: { document?: Document; addStylesheetCss?: (css: string, key: string) => void }, section?: unknown, axis?: unknown) => {
			const result = original(contents, section, axis);
			// Only re-stamp this document — full inject on every format() flickers continuous
			try {
				const p = activePrefs;
				const doc = contents?.document;
				if (doc) {
					stampBodyInline(doc, p);
				}
			} catch {
				/* */
			}
			return result;
		};
		layoutPatched = true;
	}

	/** One soft restamp after layout settles (no multi-rAF inject storm). */
	function restampAfterLayout() {
		scheduleRestamp(48);
	}

	/**
	 * Apply type-panel prefs immediately.
	 * Exported so the read page can call this on every slider tick (not rely on $effect alone).
	 */
	export function applyPrefs(next?: ReaderPrefs) {
		const p = next ?? prefs;
		activePrefs = p;
		if (!rendition && !host) return;
		const key = prefsKeyOf(p);
		const layoutChanged = layoutKeyOf(p) !== lastLayoutKey;
		// Paint type/colors now (soft when only re-entering with same CSS)
		injectThemeIntoContents(p, key === lastAppliedKey);
		lastAppliedKey = key;
		// Expand only when metrics that change iframe height change — not every color tick
		if (!layoutChanged && displayReady) return;
		if (prefsApplyTimer) clearTimeout(prefsApplyTimer);
		prefsApplyTimer = setTimeout(() => {
			prefsApplyTimer = null;
			if (!rendition) {
				injectThemeIntoContents(activePrefs, true);
				return;
			}
			lastLayoutKey = layoutKeyOf(activePrefs);
			reexpandViews();
			injectThemeIntoContents(activePrefs, true);
			// fillContinuous only on real layout changes (measure/size) — not every restamp
			if (layoutChanged) {
				void fillContinuous().then(() => {
					injectThemeIntoContents(activePrefs, true);
				});
			}
		}, 80);
	}

	/** Internal alias — tests and older call sites. */
	function applyLivePrefs(p?: ReaderPrefs) {
		applyPrefs(p);
	}

	function resizeToHost(force = false) {
		if (!rendition || !host) return;
		const w = host.clientWidth;
		const h = host.clientHeight;
		if (w < 8 || h < 8) return;
		// Continuous trims/destroys views when resize races with 0 or noisy sub-pixel changes.
		if (!force && Math.abs(w - lastResizeW) < 2 && Math.abs(h - lastResizeH) < 2) {
			lockStageWidth();
			return;
		}
		lastResizeW = w;
		lastResizeH = h;
		try {
			rendition.resize(w, h);
		} catch {
			/* */
		}
		lockStageWidth();
	}

	function scheduleResize() {
		if (performance.now() < ignoreResizeUntil) return;
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			resizeTimer = null;
			if (performance.now() < ignoreResizeUntil) return;
			resizeToHost();
		}, 120);
	}

	/** Force iframe expand after CSS/theme so continuous keeps non-zero view heights. */
	function reexpandViews() {
		try {
			const views = rendition?.manager?.views?.all?.() || [];
			for (const v of views) {
				try {
					// Vertical lock: width is stage, height follows text — never image scrollWidth
					if (typeof v.lock === 'function' && host) {
						v.lock('width', host.clientWidth, host.clientHeight);
					} else {
						v.expand?.();
					}
				} catch {
					try {
						v.expand?.();
					} catch {
						/* */
					}
				}
			}
		} catch {
			/* */
		}
		lockStageWidth();
	}

	/** Continuous fill appends following spine sections under the current view. */
	async function fillContinuous() {
		try {
			const fill = rendition?.manager?.fill;
			if (typeof fill === 'function') {
				await fill.call(rendition.manager);
			}
		} catch {
			/* */
		}
	}

	/** Wait until the host has a real box — continuous manager destroys views if bounds are 0. */
	function waitForHostSize(el: HTMLElement, ms = 4000): Promise<boolean> {
		return new Promise((resolve) => {
			if (el.clientWidth > 8 && el.clientHeight > 8) {
				resolve(true);
				return;
			}
			const t0 = performance.now();
			const tick = () => {
				if (el.clientWidth > 8 && el.clientHeight > 8) {
					resolve(true);
					return;
				}
				if (performance.now() - t0 > ms) {
					resolve(false);
					return;
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
	}

	/** Cover images often finish after first expand — remeasure once they load. */
	function waitForIframeImages(ms = 2500): Promise<void> {
		return new Promise((resolve) => {
			try {
				const contents = rendition?.getContents?.() || [];
				const pending: HTMLImageElement[] = [];
				for (const c of contents) {
					const imgs = c.document?.images;
					if (!imgs) continue;
					for (const img of Array.from(imgs) as HTMLImageElement[]) {
						if (!img.complete) pending.push(img);
					}
				}
				if (!pending.length) {
					resolve();
					return;
				}
				let left = pending.length;
				const finish = () => {
					if (--left <= 0) {
						clearTimeout(timer);
						resolve();
					}
				};
				const timer = setTimeout(resolve, ms);
				for (const img of pending) {
					img.addEventListener('load', finish, { once: true });
					img.addEventListener('error', finish, { once: true });
				}
			} catch {
				resolve();
			}
		});
	}

	function hasDisplayedContent(): boolean {
		try {
			const contents = rendition?.getContents?.() || [];
			if (!contents.length) return false;
			// At least one iframe with non-trivial document height
			for (const c of contents) {
				const h = c.textHeight?.() ?? c.scrollHeight?.() ?? 0;
				if (h > 24) return true;
			}
			// Fallback: any view element with height
			const views = host?.querySelectorAll?.('.epub-view, iframe');
			if (views) {
				for (const v of views) {
					const el = v as HTMLElement;
					if ((el.clientHeight || el.offsetHeight) > 24) return true;
				}
			}
			return false;
		} catch {
			return false;
		}
	}

	/** True when the open section is basically a cover plate (image, almost no prose). */
	function isMostlyImageSection(): boolean {
		try {
			const contents = rendition?.getContents?.() || [];
			if (!contents.length) return false;
			for (const c of contents) {
				const doc = c.document as Document | undefined;
				if (!doc?.body) continue;
				const text = (doc.body.innerText || '').replace(/\s+/g, ' ').trim();
				const media = doc.querySelectorAll('img, svg, image, video').length;
				if (media > 0 && text.length < 80) return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	async function safeDisplay(target?: string) {
		if (!rendition) return;
		// Bad CFIs (stale progress) flash then blank — always fall back to start.
		if (target) {
			try {
				await rendition.display(target);
				// Give continuous manager a frame to expand + fill
				await new Promise((r) => requestAnimationFrame(() => r(undefined)));
				await fillContinuous();
				if (hasDisplayedContent()) return;
				console.warn('[EpubReader] restored location produced empty view, opening start');
			} catch (e) {
				console.warn('[EpubReader] display(location) failed, opening start', e);
			}
		}
		await rendition.display();
		await fillContinuous();
	}

	/**
	 * When a spine section is shorter than the viewport (typical cover), wheel past
	 * the end advances to the next section so the book never feels stuck on page 1.
	 */
	function attachWheelChain() {
		wheelCleanup?.();
		wheelCleanup = null;
		const container = host?.querySelector?.('.epub-container') as HTMLElement | null;
		if (!container || !rendition) return;

		let chaining = false;
		const onWheel = async (e: Event) => {
			const we = e as WheelEvent;
			if (!displayReady || chaining || !rendition) return;
			const { scrollTop, scrollHeight, clientHeight } = container;
			const canDown = scrollTop + clientHeight < scrollHeight - 4;
			const canUp = scrollTop > 4;

			if (we.deltaY > 8 && !canDown) {
				we.preventDefault();
				chaining = true;
				try {
					await rendition.next();
					await fillContinuous();
				} catch {
					/* */
				} finally {
					setTimeout(() => {
						chaining = false;
					}, 280);
				}
			} else if (we.deltaY < -8 && !canUp) {
				we.preventDefault();
				chaining = true;
				try {
					await rendition.prev();
					// Land near the end of the previous section
					requestAnimationFrame(() => {
						const c = host?.querySelector?.('.epub-container') as HTMLElement | null;
						if (c) c.scrollTop = Math.max(0, c.scrollHeight - c.clientHeight);
					});
				} catch {
					/* */
				} finally {
					setTimeout(() => {
						chaining = false;
					}, 280);
				}
			}
		};

		container.addEventListener('wheel', onWheel, { passive: false });
		wheelCleanup = () => container.removeEventListener('wheel', onWheel);
	}

	/** epubjs CJS/ESM interop: default may be nested one level. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function resolveEpub(mod: any): (input: ArrayBuffer | string, options?: object) => any {
		const candidates = [mod?.default?.default, mod?.default, mod];
		for (const c of candidates) {
			if (typeof c === 'function') return c;
		}
		throw new Error('EPUB engine failed to load (epubjs export missing).');
	}

	function fail(message: string) {
		loadError = message;
		onerror?.(message);
	}

	/** Push nav (or spine fallback) into the parent contents drawer. */
	async function emitToc(b: { loaded?: { navigation?: Promise<{ toc?: unknown[] }> }; navigation?: { toc?: unknown[] }; spine?: { spineItems?: unknown[] } } | null) {
		if (!b || !ontoc) return;
		try {
			let navToc: unknown[] | undefined;
			try {
				const nav = (await b.loaded?.navigation) || b.navigation;
				navToc = (nav as { toc?: unknown[] } | undefined)?.toc;
			} catch {
				navToc = undefined;
			}
			const spineItems =
				(b.spine as { spineItems?: Array<{ href?: string; linear?: string | boolean }> } | undefined)
					?.spineItems || [];
			const items = buildReaderToc(
				navToc as Parameters<typeof buildReaderToc>[0],
				spineItems
			).map(({ label, href, depth }) => ({ label, href, depth }));
			if (sessionAlive) ontoc(items);
		} catch (e) {
			console.warn('[EpubReader] toc emit failed', e);
			// Last resort: spine-only list so the drawer is never blank for multi-section books
			try {
				const spineItems =
					(b.spine as { spineItems?: Array<{ href?: string; linear?: string | boolean }> } | undefined)
						?.spineItems || [];
				const items = buildReaderToc(null, spineItems).map(({ label, href, depth }) => ({
					label,
					href,
					depth
				}));
				if (sessionAlive) ontoc(items);
			} catch {
				/* */
			}
		}
	}

	export async function next() {
		await rendition?.next();
	}
	export async function prev() {
		await rendition?.prev();
	}

	/**
	 * After display, pin the continuous scroller to the target section.
	 * epubjs continuous moveTo only scrolls when distY > 0 (relative scrollBy),
	 * so returning to an earlier chapter or a section already in the stack often no-ops.
	 */
	function forceScrollToResolved(resolved: { href?: string; index?: number; target: string | number }) {
		try {
			const manager = rendition?.manager;
			if (!manager) return;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const views: any[] = manager.views?.all?.() || [];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let view: any = null;
			// views.find(section) matches section.index — prefer a real spine section
			if (typeof resolved.index === 'number' && book?.spine?.get) {
				const section = book.spine.get(resolved.index);
				if (section) view = manager.views?.find?.(section) || null;
			}
			if (!view && typeof resolved.index === 'number') {
				view = views.find((v) => v?.section?.index === resolved.index) || null;
			}
			if (!view && resolved.href) {
				view =
					views.find(
						(v) =>
							v?.section?.href === resolved.href ||
							pathMatches(v?.section?.href, resolved.href)
					) || null;
			}
			if (!view && views.length === 1) {
				// Fresh clear+add leaves only the target section
				view = views[0];
			}
			if (!view) return;

			const base = view.offset?.() || { top: 0, left: 0 };
			let top = base.top || 0;
			let left = base.left || 0;
			const targetStr = typeof resolved.target === 'string' ? resolved.target : '';
			if (targetStr.includes('#')) {
				try {
					const loc = view.locationOf?.(targetStr);
					if (loc && typeof loc.top === 'number') {
						// locationOf is relative to the view
						top = (base.top || 0) + (loc.top || 0);
						left = (base.left || 0) + (loc.left || 0);
					}
				} catch {
					/* */
				}
			}
			// Absolute scroll — continuous.moveTo uses relative scrollBy and ignores ≤0
			if (typeof manager.scrollTo === 'function') {
				manager.scrollTo(left, top, true);
			}
			const c = host?.querySelector?.('.epub-container') as HTMLElement | null;
			if (c) {
				c.scrollTop = Math.max(0, top);
				if (left) c.scrollLeft = Math.max(0, left);
			}
		} catch {
			/* */
		}
	}

	function pathMatches(a?: string, b?: string): boolean {
		if (!a || !b) return false;
		const na = a.split('#')[0].replace(/^\//, '');
		const nb = b.split('#')[0].replace(/^\//, '');
		return na === nb || na.endsWith(nb) || nb.endsWith(na);
	}

	/** Navigate to a TOC href, CFI, or spine path. Resolves nav↔spine path mismatches. */
	export async function goTo(href: string) {
		if (!rendition || !book) return;
		const raw = (href || '').trim();
		if (!raw) return;

		const resolved = resolveTocTarget(raw, book);
		const attempts: Array<string | number> = [];
		if (resolved) attempts.push(resolved.target);
		if (resolved && typeof resolved.index === 'number') attempts.push(resolved.index);
		if (resolved?.href && resolved.href !== resolved.target) attempts.push(resolved.href);
		attempts.push(raw);
		// de-dupe while preserving order
		const seen = new Set<string>();
		const unique = attempts.filter((t) => {
			const k = String(t);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});

		let displayed = false;
		let used: string | number = raw;
		for (const target of unique) {
			try {
				await rendition.display(target);
				displayed = true;
				used = target;
				break;
			} catch (e) {
				console.warn('[EpubReader] goTo attempt failed', target, e);
			}
		}

		if (!displayed) {
			console.warn('[EpubReader] goTo failed for all candidates', raw, unique);
			return;
		}

		await new Promise((r) => requestAnimationFrame(() => r(undefined)));
		await fillContinuous();
		forceScrollToResolved({
			target: used,
			href: resolved?.href,
			index: resolved?.index
		});
		// Continuous may append views and shift layout — restamp + re-pin once more
		requestAnimationFrame(() => {
			reexpandViews();
			resizeToHost();
			injectThemeIntoContents(activePrefs, true);
			forceScrollToResolved({
				target: used,
				href: resolved?.href,
				index: resolved?.index
			});
		});
	}

	onMount(() => {
		let cancelled = false;
		sessionAlive = true;

		(async () => {
			try {
				if (!blob || blob.size === 0) {
					fail('This EPUB file is empty or missing from storage.');
					return;
				}

				const mod = await import('epubjs');
				if (cancelled || !host) return;

				const ePub = resolveEpub(mod);

				const data = await blob.arrayBuffer();
				if (cancelled || !host) return;
				if (data.byteLength < 64) {
					fail('This EPUB looks corrupt or incomplete.');
					return;
				}

				// Continuous manager trims every view when stage bounds are 0×0.
				const sized = await waitForHostSize(host);
				if (cancelled || !host) return;
				if (!sized) {
					fail('Reader layout was not ready. Try reopening the book.');
					return;
				}

				book = ePub(data);
				await book.ready;
				if (cancelled || !host) return;

				// Emit TOC as soon as the package is ready — do not wait for first paint
				// (heavy continuous fill used to race past this and leave the drawer empty).
				void emitToc(book);

				const w = host.clientWidth;
				const h = host.clientHeight;
				lastResizeW = w;
				lastResizeH = h;

				// continuous + scrolled: stack spine sections so the whole book scrolls.
				// default only ever paints the first spine item (usually the cover image).
				// Stability: waitForHostSize above, debounced resize, fill after display,
				// theme via content hook (before expand), displayReady gate on $effect.
				rendition = book.renderTo(host, {
					width: w,
					height: h,
					flow: 'scrolled',
					manager: 'continuous',
					spread: 'none',
					allowScriptedContent: false
				});

				// layout.format → size() wipes body styles after expand/resize — always re-stamp.
				patchLayoutFormat();

				// Theme once per section load. format() re-stamps body via patchLayoutFormat.
				// Do NOT attach expand/resize restamp listeners — they re-enter continuous
				// measure → format → restamp → expand and flicker the whole stage.
				rendition.hooks.content.register((contents: {
					addStylesheetCss?: (css: string, key: string) => void;
					document?: Document;
					window?: Window;
				}) => {
					const p = activePrefs;
					const css = buildThemeCss(p);
					contents.addStylesheetCss?.(css, 'lumen-theme');
					try {
						if (contents.document) {
							writeStyleTag(contents.document, css, 'lumen-theme');
							writeStyleTag(contents.document, css, 'epubjs-inserted-css-default');
							stampBodyInline(contents.document, p);
							clampMediaInContents(contents, p);
						}
					} catch {
						/* */
					}
					// Single debounced remeasure after late image decode (not per-image expand)
					try {
						const imgs = contents.document?.images;
						if (imgs) {
							for (const img of Array.from(imgs)) {
								if (!img.complete) {
									img.addEventListener(
										'load',
										() => {
											scheduleRestamp(80);
											if (expandTimer) clearTimeout(expandTimer);
											expandTimer = setTimeout(() => {
												expandTimer = null;
												reexpandViews();
											}, 120);
										},
										{ once: true }
									);
								}
							}
						}
					} catch {
						/* */
					}
				});

				// Seed default theme for first paint
				if (typeof rendition.themes?.registerCss === 'function') {
					rendition.themes.registerCss('default', buildThemeCss(activePrefs));
				}

				const start = initialLocation?.trim() || undefined;
				await safeDisplay(start);
				if (cancelled) return;

				// One settle pass: expand → fill → soft theme. Avoid multi-inject thrash.
				await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
				if (cancelled || !host) return;
				reexpandViews();
				await fillContinuous();
				injectThemeIntoContents(activePrefs, true);
				lockStageWidth();

				await waitForIframeImages(1800);
				if (cancelled || !host) return;
				// Late cover decode: one remeasure, not inject×3
				reexpandViews();
				injectThemeIntoContents(activePrefs, true);

				// If still empty after restore + resize, force first spine item.
				if (!hasDisplayedContent()) {
					await rendition.display();
					await fillContinuous();
					await new Promise((r) => requestAnimationFrame(() => r(undefined)));
					reexpandViews();
					injectThemeIntoContents(activePrefs, true);
				}

				// Fresh open landed on a cover plate only: step into the first prose section.
				// Saved CFIs are left alone so resume stays accurate.
				if (!start && isMostlyImageSection()) {
					for (let i = 0; i < 4; i++) {
						if (!isMostlyImageSection()) break;
						try {
							await rendition.next();
							await fillContinuous();
						} catch {
							break;
						}
					}
					reexpandViews();
					injectThemeIntoContents(activePrefs, true);
				}

				// TOC again in case navigation resolved late
				void emitToc(book);

				lastLayoutKey = layoutKeyOf(activePrefs);
				lastAppliedKey = prefsKeyOf(activePrefs);
				displayReady = true;
				attachWheelChain();

				// Debounce progress so continuous scroll doesn't thrash parent state every frame
				let relocateTimer: ReturnType<typeof setTimeout> | null = null;
				rendition.on(
					'relocated',
					(location: { start: { cfi: string; percentage?: number }; atEnd?: boolean }) => {
						const fraction = location.start.percentage ?? (location.atEnd ? 1 : 0);
						const cfi = location.start.cfi;
						if (relocateTimer) clearTimeout(relocateTimer);
						relocateTimer = setTimeout(() => {
							relocateTimer = null;
							onprogress(fraction, cfi);
						}, 120);
					}
				);

				// Keep stage size in sync (rail chrome, window resize, mobile keyboard).
				resizeObserver = new ResizeObserver(() => {
					if (!displayReady || cancelled) return;
					scheduleResize();
				});
				resizeObserver.observe(host);
			} catch (e) {
				if (cancelled) return;
				const msg =
					e instanceof Error
						? e.message
						: 'Could not open this EPUB. The file may be DRM-protected or corrupt.';
				console.error('[EpubReader]', e);
				fail(msg);
			}
		})();

		return () => {
			cancelled = true;
			sessionAlive = false;
			displayReady = false;
			wheelCleanup?.();
			wheelCleanup = null;
			if (resizeTimer) clearTimeout(resizeTimer);
			resizeTimer = null;
			if (prefsApplyTimer) clearTimeout(prefsApplyTimer);
			prefsApplyTimer = null;
			if (restampTimer) clearTimeout(restampTimer);
			restampTimer = null;
			if (expandTimer) clearTimeout(expandTimer);
			expandTimer = null;
			resizeObserver?.disconnect();
			resizeObserver = null;
		};
	});

	/**
	 * Backup reactive path. Primary path is parent calling applyPrefs() on every
	 * slider tick — that does not depend on Svelte effect timing.
	 * Always track every visual field before any early return so Svelte re-runs.
	 */
	$effect(() => {
		const snapshot: ReaderPrefs = {
			theme: prefs.theme,
			fontFamily: prefs.fontFamily,
			fontSize: prefs.fontSize,
			lineHeight: prefs.lineHeight,
			letterSpacing: prefs.letterSpacing ?? 0,
			paragraphSpacing: prefs.paragraphSpacing ?? 1,
			measure: prefs.measure,
			margin: prefs.margin,
			textAlign: prefs.textAlign ?? 'left',
			hyphenate: !!prefs.hyphenate,
			brightness: prefs.brightness ?? 1,
			keepAwake: !!prefs.keepAwake
		};
		activePrefs = snapshot;
		const ready = displayReady;
		if (!ready) return;
		// Skip no-op re-applies — parent re-renders on progress ticks must not re-expand
		const key = prefsKeyOf(snapshot);
		if (key === lastAppliedKey) return;
		applyPrefs(snapshot);
	});

	onDestroy(() => {
		sessionAlive = false;
		displayReady = false;
		wheelCleanup?.();
		wheelCleanup = null;
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = null;
		if (prefsApplyTimer) clearTimeout(prefsApplyTimer);
		if (restampTimer) clearTimeout(restampTimer);
		if (expandTimer) clearTimeout(expandTimer);
		prefsApplyTimer = null;
		resizeObserver?.disconnect();
		resizeObserver = null;
		try {
			rendition?.destroy?.();
		} catch {
			/* */
		}
		try {
			book?.destroy?.();
		} catch {
			/* */
		}
		rendition = null;
		book = null;
	});
</script>

{#if loadError}
	<div
		class="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-3 px-6 text-center"
		role="alert"
	>
		<p class="font-ui text-sm font-medium" style="color: var(--stage-fg)">Couldn’t open this book</p>
		<p class="max-w-sm font-ui text-[13px] leading-relaxed" style="color: var(--stage-muted)">
			{loadError}
		</p>
	</div>
{:else}
	<div class="epub-host" bind:this={host}></div>
{/if}

<style>
	/*
	  Host must fill the reader stage with a stable non-zero box.
	  epubjs owns scrolling inside .epub-container — do not scroll the host
	  or force overflow on the container (that collapsed continuous views).
	*/
	.epub-host {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		/* Avoid transform here — it can make getBoundingClientRect / expand wrong */
	}
	.epub-host :global(.epub-container) {
		width: 100% !important;
		max-width: 100% !important;
		height: 100% !important;
		/* Continuous stacks .epub-view blocks; container scrolls them */
		overflow-y: auto !important;
		/* Never let a wide cover image create a horizontal stage */
		overflow-x: hidden !important;
		-webkit-overflow-scrolling: touch;
	}
	.epub-host :global(.epub-view) {
		/* Height from expand(); width always = host (lockStageWidth also sets px) */
		min-height: 0;
		width: 100% !important;
		max-width: 100% !important;
		min-width: 0 !important;
		box-sizing: border-box !important;
		overflow: hidden;
	}
	.epub-host :global(iframe) {
		border: 0;
		width: 100% !important;
		max-width: 100% !important;
		min-width: 0 !important;
		/* Height left to expand() px values */
		max-height: none;
		box-sizing: border-box !important;
	}
</style>
