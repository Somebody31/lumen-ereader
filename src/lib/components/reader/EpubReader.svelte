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
	 * Serialized CSS (not epubjs rule objects) so we can use !important.
	 * Publisher stylesheets otherwise win on margin/width/float and shove
	 * text to one side or break wrapping inside continuous scrolled views.
	 */
	function buildThemeCss(): string {
		const { bg, fg, mute, link, rule } = themeStyles;
		const align = prefs.textAlign ?? 'left';
		const tracking = prefs.letterSpacing ?? 0;
		const para = prefs.paragraphSpacing ?? 1;
		const hyphens = prefs.hyphenate ? 'auto' : 'manual';
		const margin = prefs.margin ?? 24;
		const measure = prefs.measure ?? 68;
		const topPad = Math.max(margin + 28, 48);
		const bottomPad = Math.round(margin * 2.2);
		const family = fontStack(prefs.fontFamily);
		const display =
			'"Newsreader Variable", Newsreader, Georgia, "Times New Roman", serif';

		// Horizontal inset: at least user margin; when the view is wider than
		// measure, center the column with equal side padding (no body max-width —
		// max-width + margin:auto fights epubjs textWidth / iframe expand).
		const sidePad = `max(${margin}px, calc((100% - ${measure}ch) / 2))`;

		return `
/* ——— Lumen reading chrome: layout reset ——— */
html {
	width: 100% !important;
	max-width: 100% !important;
	margin: 0 !important;
	padding: 0 !important;
	overflow-x: hidden !important;
	-webkit-text-size-adjust: 100%;
	text-size-adjust: 100%;
}
body {
	box-sizing: border-box !important;
	width: 100% !important;
	max-width: 100% !important;
	min-width: 0 !important;
	margin: 0 !important;
	padding: ${topPad}px ${sidePad} ${bottomPad}px !important;
	float: none !important;
	position: static !important;
	left: auto !important;
	right: auto !important;
	transform: none !important;
	overflow-x: hidden !important;
	overflow-wrap: break-word !important;
	word-wrap: break-word !important;
	word-break: normal !important;
	column-count: auto !important;
	column-width: auto !important;
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
	orphans: 3;
	widows: 3;
}
/* Kill publisher side-columns / absolute page frames that shove content left */
body > * {
	max-width: 100% !important;
	box-sizing: border-box !important;
}
div, section, article, main, aside, header, footer, nav,
p, li, blockquote, pre, table, h1, h2, h3, h4, h5, h6 {
	max-width: 100% !important;
	box-sizing: border-box !important;
}
img, svg, video, canvas, iframe, object, embed {
	max-width: 100% !important;
	height: auto !important;
	page-break-inside: avoid;
}
table {
	width: 100% !important;
	table-layout: fixed !important;
	border-collapse: collapse;
}
td, th {
	word-wrap: break-word !important;
	overflow-wrap: break-word !important;
}
/* Soften floats that pin half-columns to one side */
.float-left, .float-right,
.alignleft, .alignright,
.left, .right {
	float: none !important;
	margin-left: 0 !important;
	margin-right: 0 !important;
	max-width: 100% !important;
}

/* ——— Type ——— */
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
	-webkit-hyphens: none;
	margin-top: 2em !important;
	margin-bottom: 0.55em !important;
	max-width: 100% !important;
	color: ${fg} !important;
	/* No drop-cap / float first-letter — floats break continuous reflow */
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
/* Neutralize publisher drop caps — primary cause of “broken” first lines */
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
a {
	color: ${link} !important;
	text-underline-offset: 0.2em;
}
blockquote {
	margin: 1.75em 0 !important;
	padding: 0.35em 0 0.35em 1.15em !important;
	border-left: 2px solid ${link} !important;
	color: ${mute} !important;
	font-style: italic;
	font-size: 1.04em;
	max-width: 100% !important;
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
	max-width: 100% !important;
}
li { margin-bottom: 0.35em; }
code {
	font-size: 0.88em;
	padding: 0.12em 0.35em;
	border-radius: 3px;
	background: color-mix(in srgb, ${fg} 8%, transparent);
	overflow-wrap: anywhere;
}
pre {
	max-width: 100% !important;
	overflow-x: auto !important;
	white-space: pre-wrap !important;
	word-break: break-word !important;
}
`;
	}

	function applyTheme() {
		if (!rendition) return;
		const css = buildThemeCss();
		// registerCss replaces the injected sheet when key is "default"
		if (typeof rendition.themes.registerCss === 'function') {
			rendition.themes.registerCss('default', css);
		} else {
			// Fallback: inject via contents if API shape differs
			const contents = rendition.getContents?.() || [];
			for (const c of contents) {
				c.addStylesheetCss?.(css, 'lumen-theme');
			}
		}
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
		await rendition?.display(href);
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

				// ArrayBuffer open: reliable with IDB-restored Blobs.
				// Object URLs often make epubjs request META-INF from the site origin (404).
				const data = await blob.arrayBuffer();
				if (cancelled || !host) return;
				if (data.byteLength < 64) {
					fail('This EPUB looks corrupt or incomplete.');
					return;
				}

				book = ePub(data);
				await book.ready;
				if (cancelled || !host) return;

				rendition = book.renderTo(host, {
					width: '100%',
					height: '100%',
					flow: 'scrolled-doc',
					manager: 'continuous',
					spread: 'none',
					allowScriptedContent: false
				});

				// Re-apply after each spine section mounts so publisher CSS loses.
				rendition.hooks.content.register((contents: {
					addStylesheetCss?: (css: string, key: string) => void;
				}) => {
					contents.addStylesheetCss?.(buildThemeCss(), 'lumen-theme');
				});

				applyTheme();

				const start = initialLocation || undefined;
				await rendition.display(start);

				// After first paint, resize so iframe width matches host (avoids side shift).
				try {
					const rect = host.getBoundingClientRect();
					if (rect.width > 0 && rect.height > 0) {
						rendition.resize(rect.width, rect.height);
					}
				} catch {
					/* */
				}

				rendition.on(
					'relocated',
					(location: { start: { cfi: string; percentage?: number }; atEnd?: boolean }) => {
						const fraction = location.start.percentage ?? (location.atEnd ? 1 : 0);
						onprogress(fraction, location.start.cfi);
					}
				);

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
		};
	});

	$effect(() => {
		if (!rendition) return;
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
		applyTheme();
		// Re-inject into live contents (registerCss updates default sheet;
		// hook-key sheet also needs refresh for already-open views).
		try {
			const contents = rendition.getContents?.() || [];
			const css = buildThemeCss();
			for (const c of contents) {
				c.addStylesheetCss?.(css, 'lumen-theme');
			}
		} catch {
			/* */
		}
	});

	onDestroy(() => {
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
	<div class="epub-host h-full w-full" bind:this={host}></div>
{/if}

<style>
	.epub-host {
		position: relative;
		min-height: 100%;
		height: 100%;
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
		overflow-y: auto;
		/* Isolate continuous manager from parent transforms */
		transform: translateZ(0);
	}
	.epub-host :global(.epub-container) {
		height: 100% !important;
		width: 100% !important;
		max-width: 100% !important;
		overflow-x: hidden !important;
	}
	.epub-host :global(.epub-view) {
		max-width: 100% !important;
	}
	.epub-host :global(iframe) {
		border: 0;
		max-width: 100% !important;
		/* Prevent horizontal drift from subpixel iframe sizing */
		display: block;
	}
</style>
