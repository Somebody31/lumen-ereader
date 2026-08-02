<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fontStack, type ReaderPrefs } from '$lib/client/types';

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
	/** Theme/resize effects must not run until first successful display. */
	let displayReady = false;
	let resizeObserver: ResizeObserver | null = null;

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

	/**
	 * Serialized CSS with !important so publisher sheets cannot win.
	 * Keep layout simple: fixed padding (no max-width on body) so epubjs
	 * textHeight / continuous expand stay stable.
	 */
	function buildThemeCss(): string {
		const { bg, fg, mute, link, rule } = themeStyles;
		const align = prefs.textAlign ?? 'left';
		const tracking = prefs.letterSpacing ?? 0;
		const para = prefs.paragraphSpacing ?? 1;
		const hyphens = prefs.hyphenate ? 'auto' : 'manual';
		const margin = prefs.margin ?? 24;
		/* Clear the left control rail (~52px) plus user margin */
		const leftPad = margin + 52;
		const topPad = Math.max(margin, 20);
		const bottomPad = Math.round(margin * 2.2);
		const family = fontStack(prefs.fontFamily);
		const display =
			'"Newsreader Variable", Newsreader, Georgia, "Times New Roman", serif';

		return `
html {
	margin: 0 !important;
	padding: 0 !important;
	width: 100% !important;
	height: auto !important;
	/* overflow:visible — overflow:hidden makes continuous textHeight collapse */
	overflow: visible !important;
	-webkit-text-size-adjust: 100%;
	text-size-adjust: 100%;
}
body {
	box-sizing: border-box !important;
	width: 100% !important;
	max-width: none !important;
	min-height: 0 !important;
	margin: 0 !important;
	padding: ${topPad}px ${margin}px ${bottomPad}px ${leftPad}px !important;
	float: none !important;
	position: static !important;
	left: auto !important;
	right: auto !important;
	transform: none !important;
	overflow: visible !important;
	overflow-wrap: break-word !important;
	word-wrap: break-word !important;
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
img, svg, video, canvas, object, embed {
	max-width: 100% !important;
	height: auto !important;
}
table {
	max-width: 100% !important;
	border-collapse: collapse;
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
				c.addStylesheetCss?.(css, 'lumen-theme');
			}
		} catch {
			/* */
		}
	}

	function resizeToHost() {
		if (!rendition || !host) return;
		const w = host.clientWidth;
		const h = host.clientHeight;
		if (w < 8 || h < 8) return;
		try {
			rendition.resize(w, h);
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

	async function safeDisplay(target?: string) {
		if (!rendition) return;
		// Bad CFIs (stale progress) flash then blank — always fall back to start.
		if (target) {
			try {
				await rendition.display(target);
				// Give continuous manager a frame to expand
				await new Promise((r) => requestAnimationFrame(() => r(undefined)));
				if (hasDisplayedContent()) return;
				console.warn('[EpubReader] restored location produced empty view, opening start');
			} catch (e) {
				console.warn('[EpubReader] display(location) failed, opening start', e);
			}
		}
		await rendition.display();
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
			// Keep iframe expanded after manual nav
			requestAnimationFrame(() => resizeToHost());
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

				// default manager + scrolled: one spine section at a time, stable height.
				// continuous was destroying views when bounds/theme races zeroed height.
				rendition = book.renderTo(host, {
					width: w,
					height: h,
					flow: 'scrolled',
					manager: 'default',
					spread: 'none',
					allowScriptedContent: false
				});

				// Theme once per section, before expand measures textHeight.
				rendition.hooks.content.register((contents: {
					addStylesheetCss?: (css: string, key: string) => void;
				}) => {
					contents.addStylesheetCss?.(buildThemeCss(), 'lumen-theme');
				});

				// Seed default theme for first paint
				if (typeof rendition.themes?.registerCss === 'function') {
					rendition.themes.registerCss('default', buildThemeCss());
				}

				const start = initialLocation?.trim() || undefined;
				await safeDisplay(start);
				if (cancelled) return;

				// Two frames: let iframe expand after CSS injection, then remeasure.
				await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
				if (cancelled || !host) return;
				resizeToHost();

				// If still empty after restore + resize, force first spine item.
				if (!hasDisplayedContent()) {
					await rendition.display();
					await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
					resizeToHost();
				}

				displayReady = true;

				rendition.on(
					'relocated',
					(location: { start: { cfi: string; percentage?: number }; atEnd?: boolean }) => {
						const fraction = location.start.percentage ?? (location.atEnd ? 1 : 0);
						onprogress(fraction, location.start.cfi);
					}
				);

				// Keep stage size in sync (rail chrome, window resize, mobile keyboard).
				resizeObserver = new ResizeObserver(() => {
					if (!displayReady || cancelled) return;
					resizeToHost();
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
			resizeObserver?.disconnect();
			resizeObserver = null;
		};
	});

	$effect(() => {
		if (!rendition || !displayReady) return;
		void prefs.theme;
		void prefs.fontFamily;
		void prefs.fontSize;
		void prefs.lineHeight;
		void prefs.letterSpacing;
		void prefs.paragraphSpacing;
		void prefs.measure;
		void prefs.margin;
		void prefs.textAlign;
		void prefs.hyphenate;
		injectThemeIntoContents();
		// Theme changes reflow text — remeasure after paint
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resizeToHost());
		});
	});

	onDestroy(() => {
		displayReady = false;
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
		height: 100% !important;
	}
	.epub-host :global(iframe) {
		border: 0;
		/* Never clamp iframe height — expand sets explicit px heights */
		max-width: none;
	}
</style>
