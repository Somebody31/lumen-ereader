<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
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
		ontoc?: (items: { label: string; href: string }[]) => void;
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

	const themeStyles = $derived.by(() => {
		const map: Record<
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
		return map[prefs.theme] || map.night;
	});

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
	 * Matches TextReader: measure (ch) column, margin padding, rail clearance.
	 * Stage width is the host — never the intrinsic size of the largest image.
	 */
	function buildThemeCss(): string {
		const { bg, fg, mute, link, rule } = themeStyles;
		const align = prefs.textAlign ?? 'left';
		const tracking = prefs.letterSpacing ?? 0;
		const para = prefs.paragraphSpacing ?? 1;
		const hyphens = prefs.hyphenate ? 'auto' : 'manual';
		const margin = Math.max(0, prefs.margin ?? 24);
		const measure = Math.max(20, Math.min(120, prefs.measure ?? 68));
		/* Left rail (~3.25rem) must clear chrome; TextReader uses max(margin, 3.75rem) */
		const leftPad = Math.max(margin, 52);
		const rightPad = Math.max(margin, 16);
		const topPad = Math.max(margin, 20);
		const bottomPad = Math.max(Math.round(margin * 2.2), 48);
		const family = fontStack(prefs.fontFamily);
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
	padding: 0 ${rightPad}px 0 ${leftPad}px !important;
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
	font-size: ${prefs.fontSize}px !important;
	line-height: ${prefs.lineHeight} !important;
	letter-spacing: ${tracking}em !important;
	text-align: ${align} !important;
	hyphens: ${hyphens};
	-webkit-hyphens: ${hyphens};
	font-optical-sizing: auto;
	font-feature-settings: "liga" 1, "kern" 1, "calt" 1;
	text-rendering: optimizeLegibility;
}
/* Block wrappers stay inside the measure column (not image scrollWidth) */
div, section, article, main, header, footer, aside, nav,
figure, p, table, ul, ol, li, blockquote, pre,
h1, h2, h3, h4, h5, h6 {
	max-width: 100% !important;
	min-width: 0 !important;
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
}
h1 {
	font-size: 2.05em !important;
	letter-spacing: -0.03em;
	line-height: 0.98;
	margin-top: 0.25em !important;
	padding-bottom: 0.55em !important;
	border-bottom: 2px solid ${link} !important;
}
h2 { font-size: 1.5em !important; margin-top: 2.2em !important; }
h3 { font-size: 1.28em !important; }
h4 { font-size: 1.08em !important; }
p::first-letter,
h2 + p::first-letter,
.dropcap, .drop-cap, span.dropcap {
	float: none !important;
	font-size: inherit !important;
	line-height: inherit !important;
	padding: 0 !important;
	margin: 0 !important;
	width: auto !important;
	height: auto !important;
}
h1 + p {
	font-family: ${display} !important;
	font-style: italic !important;
	font-size: 1.02em !important;
	color: ${mute} !important;
	margin-bottom: 1.75em !important;
	padding-bottom: 1.15em !important;
	border-bottom: 1px solid ${rule} !important;
}
a { color: ${link} !important; text-underline-offset: 0.2em; }
blockquote {
	margin: 1.75em 0 !important;
	padding: 0.35em 0 0.35em 1.15em !important;
	border-left: 2px solid ${link} !important;
	color: ${mute} !important;
	font-style: italic;
	font-size: 1.04em;
}
hr {
	border: 0 !important;
	height: 1px !important;
	margin: 2.5em auto !important;
	max-width: 5.5rem !important;
	background: ${rule} !important;
}
ul, ol {
	margin-bottom: ${para}em !important;
	padding-left: 1.35em !important;
}
li { margin-bottom: 0.35em; }
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
	 * Strip publisher fixed widths / image attrs so the measure column stays stable.
	 * Do NOT call contentWidth(px) — that forces body to full stage width and kills measure.
	 */
	function clampMediaInContents(contents: {
		document?: Document;
		window?: Window;
		addStylesheetCss?: (css: string, key: string) => void;
	}) {
		try {
			const doc = contents.document;
			if (!doc) return;

			const measure = Math.max(20, Math.min(120, prefs.measure ?? 68));
			const margin = Math.max(0, prefs.margin ?? 24);
			const leftPad = Math.max(margin, 52);
			const rightPad = Math.max(margin, 16);
			const topPad = Math.max(margin, 20);
			const bottomPad = Math.max(Math.round(margin * 2.2), 48);

			const root = doc.documentElement;
			const body = doc.body;
			// Clear any inline width epubjs may have stamped (kills measure)
			body?.style.removeProperty('width');
			root?.style.setProperty('max-width', '100%', 'important');
			root?.style.setProperty('min-width', '0', 'important');
			root?.style.setProperty('overflow-x', 'hidden', 'important');
			// Mirror theme column — inline !important beats late publisher rules
			body?.style.setProperty('max-width', `${measure}ch`, 'important');
			body?.style.setProperty('width', '100%', 'important');
			body?.style.setProperty('min-width', '0', 'important');
			body?.style.setProperty('margin-left', 'auto', 'important');
			body?.style.setProperty('margin-right', 'auto', 'important');
			body?.style.setProperty('margin-top', `${topPad}px`, 'important');
			body?.style.setProperty('margin-bottom', `${bottomPad}px`, 'important');
			body?.style.setProperty('padding-left', `${leftPad}px`, 'important');
			body?.style.setProperty('padding-right', `${rightPad}px`, 'important');
			body?.style.setProperty('overflow-x', 'hidden', 'important');
			body?.style.setProperty('box-sizing', 'border-box', 'important');

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

			// Publisher fixed-px wrappers (common on cover XHTML)
			const wide = doc.querySelectorAll('[style*="width"], [width]');
			for (const node of wide) {
				const el = node as HTMLElement;
				if (el.tagName === 'BODY' || el.tagName === 'HTML') continue;
				el.removeAttribute('width');
				const sw = el.style?.width;
				if (sw && /px$/i.test(sw)) {
					el.style.setProperty('max-width', '100%', 'important');
					el.style.setProperty('width', '100%', 'important');
				}
			}
		} catch {
			/* */
		}
	}

	/** Keep every continuous view/iframe at host width — never image scrollWidth. */
	function lockStageWidth() {
		if (!host) return;
		const w = host.clientWidth;
		if (w < 8) return;
		try {
			const views = host.querySelectorAll('.epub-view');
			for (const view of views) {
				const el = view as HTMLElement;
				el.style.setProperty('width', `${w}px`, 'important');
				el.style.setProperty('max-width', '100%', 'important');
				el.style.setProperty('min-width', '0', 'important');
				const iframe = el.querySelector('iframe') as HTMLIFrameElement | null;
				if (iframe) {
					iframe.style.setProperty('width', `${w}px`, 'important');
					iframe.style.setProperty('max-width', '100%', 'important');
					iframe.style.setProperty('min-width', '0', 'important');
				}
			}
			const container = host.querySelector('.epub-container') as HTMLElement | null;
			if (container) {
				container.style.setProperty('width', `${w}px`, 'important');
				container.style.setProperty('max-width', '100%', 'important');
			}
		} catch {
			/* */
		}
	}

	/** Write theme CSS into every open iframe (and seed epubjs themes for new sections). */
	function injectThemeIntoContents() {
		if (!rendition) return;
		const css = buildThemeCss();
		try {
			if (typeof rendition.themes?.registerCss === 'function') {
				rendition.themes.registerCss('default', css);
			}
		} catch {
			/* */
		}
		try {
			const contents = rendition.getContents?.() || [];
			for (const c of contents) {
				// Prefer epubjs API; also stamp style#lumen-theme so updates always stick
				c.addStylesheetCss?.(css, 'lumen-theme');
				try {
					const doc = c.document as Document | undefined;
					if (doc?.head) {
						let el = doc.getElementById('lumen-theme') as HTMLStyleElement | null;
						if (!el) {
							el = doc.createElement('style');
							el.id = 'lumen-theme';
							doc.head.appendChild(el);
						}
						if (el.textContent !== css) {
							el.textContent = css;
						}
					}
				} catch {
					/* */
				}
				clampMediaInContents(c);
			}
		} catch {
			/* */
		}
		lockStageWidth();
	}

	/** Apply type panel prefs immediately (theme, size, measure, margin, …). */
	function applyLivePrefs() {
		if (!rendition || !displayReady) return;
		injectThemeIntoContents();
		// Debounce expand slightly so range sliders stay smooth while still live
		if (prefsApplyTimer) clearTimeout(prefsApplyTimer);
		prefsApplyTimer = setTimeout(() => {
			prefsApplyTimer = null;
			if (!rendition || !displayReady) return;
			reexpandViews();
			lockStageWidth();
			void fillContinuous();
		}, 40);
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
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			resizeTimer = null;
			resizeToHost();
		}, 80);
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

	export async function next() {
		await rendition?.next();
	}
	export async function prev() {
		await rendition?.prev();
	}
	export async function goTo(href: string) {
		if (!rendition) return;
		try {
			await rendition.display(href);
			await fillContinuous();
			// Keep iframe expanded after manual nav
			requestAnimationFrame(() => {
				reexpandViews();
				resizeToHost();
			});
		} catch (e) {
			console.warn('[EpubReader] goTo failed', href, e);
		}
	}

	onMount(() => {
		let cancelled = false;

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

				// Theme + clamp media before expand measures textHeight/width.
				// Large cover images must not become the column width.
				rendition.hooks.content.register((contents: {
					addStylesheetCss?: (css: string, key: string) => void;
					document?: Document;
					window?: Window;
					contentWidth?: (w?: number) => number;
				}) => {
					contents.addStylesheetCss?.(buildThemeCss(), 'lumen-theme');
					clampMediaInContents(contents);
					// After late image decode, clamp again so expand keeps stage width
					try {
						const imgs = contents.document?.images;
						if (imgs) {
							for (const img of Array.from(imgs)) {
								const run = () => {
									clampMediaInContents(contents);
									reexpandViews();
								};
								if (!img.complete) {
									img.addEventListener('load', run, { once: true });
								}
							}
						}
					} catch {
						/* */
					}
				});

				// Seed default theme for first paint
				if (typeof rendition.themes?.registerCss === 'function') {
					rendition.themes.registerCss('default', buildThemeCss());
				}

				const start = initialLocation?.trim() || undefined;
				await safeDisplay(start);
				if (cancelled) return;

				// Two frames: let iframe expand after CSS injection, then remeasure + fill.
				await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
				if (cancelled || !host) return;
				reexpandViews();
				await fillContinuous();

				// Cover art often loads late — re-apply measure/margin, re-expand, fill.
				await waitForIframeImages();
				if (cancelled || !host) return;
				injectThemeIntoContents();
				reexpandViews();
				await fillContinuous();
				resizeToHost(true);
				lockStageWidth();

				// If still empty after restore + resize, force first spine item.
				if (!hasDisplayedContent()) {
					await rendition.display();
					await fillContinuous();
					await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
					reexpandViews();
					resizeToHost(true);
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
				}

				displayReady = true;
				attachWheelChain();

				rendition.on(
					'relocated',
					(location: { start: { cfi: string; percentage?: number }; atEnd?: boolean }) => {
						const fraction = location.start.percentage ?? (location.atEnd ? 1 : 0);
						onprogress(fraction, location.start.cfi);
					}
				);

				// Keep stage size in sync (rail chrome, window resize, mobile keyboard).
				// Debounced — continuous destroys zero-height views if resize storms.
				resizeObserver = new ResizeObserver(() => {
					if (!displayReady || cancelled) return;
					scheduleResize();
				});
				resizeObserver.observe(host);

				try {
					const nav = await book.loaded.navigation;
					const toc = (nav.toc || []).map((t: { label: string; href: string }) => ({
						label: t.label,
						href: t.href
					}));
					ontoc?.(toc);
				} catch {
					/* no toc */
				}
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
			displayReady = false;
			wheelCleanup?.();
			wheelCleanup = null;
			if (resizeTimer) clearTimeout(resizeTimer);
			resizeTimer = null;
			if (prefsApplyTimer) clearTimeout(prefsApplyTimer);
			prefsApplyTimer = null;
			resizeObserver?.disconnect();
			resizeObserver = null;
		};
	});

	/**
	 * Live type-panel prefs. Dependencies MUST be read before any early return —
	 * otherwise Svelte never subscribes and sliders appear broken.
	 */
	$effect(() => {
		// Track every visual preference (do not early-return before these reads)
		const snapshot = {
			theme: prefs.theme,
			fontFamily: prefs.fontFamily,
			fontSize: prefs.fontSize,
			lineHeight: prefs.lineHeight,
			letterSpacing: prefs.letterSpacing,
			paragraphSpacing: prefs.paragraphSpacing,
			measure: prefs.measure,
			margin: prefs.margin,
			textAlign: prefs.textAlign,
			hyphenate: prefs.hyphenate
		};
		const ready = displayReady;
		// Keep snapshot referenced so nothing strips the reads
		void snapshot;

		if (!ready || !rendition) return;
		applyLivePrefs();
	});

	onDestroy(() => {
		displayReady = false;
		wheelCleanup?.();
		wheelCleanup = null;
		if (resizeTimer) clearTimeout(resizeTimer);
		resizeTimer = null;
		if (prefsApplyTimer) clearTimeout(prefsApplyTimer);
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
