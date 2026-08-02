<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fontStack, type ReaderPrefs } from '$lib/client/types';

	let {
		blob,
		prefs,
		initialLocation = '',
		onprogress,
		ontoc
	}: {
		blob: Blob;
		prefs: ReaderPrefs;
		initialLocation?: string;
		onprogress: (fraction: number, location: string, label?: string) => void;
		ontoc?: (items: { label: string; href: string }[]) => void;
	} = $props();

	let host: HTMLDivElement | undefined = $state();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let book: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let rendition: any = null;
	let objectUrl = '';

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

	/** Full theme object shared with CSS prose so EPUB tracks text books */
	function bodyTheme() {
		const { bg, fg, mute, link, rule } = themeStyles;
		const align = prefs.textAlign ?? 'left';
		const tracking = prefs.letterSpacing ?? 0;
		const para = prefs.paragraphSpacing ?? 1;
		const hyphens = prefs.hyphenate ? 'auto' : 'manual';
		const margin = prefs.margin ?? 24;
		const topPad = Math.max(margin + 28, 48);
		return {
			body: {
				background: bg,
				color: fg,
				'font-family': fontStack(prefs.fontFamily),
				'font-size': `${prefs.fontSize}px !important`,
				'line-height': `${prefs.lineHeight} !important`,
				'letter-spacing': `${tracking}em`,
				'max-width': `${prefs.measure}ch`,
				margin: '0 auto',
				padding: `${topPad}px ${margin}px ${margin * 2.2}px !important`,
				'text-align': align,
				hyphens,
				'-webkit-hyphens': hyphens,
				'font-optical-sizing': 'auto',
				'font-feature-settings': '"liga" 1, "kern" 1, "calt" 1',
				'text-rendering': 'optimizeLegibility',
				'orphans': '3',
				'widows': '3'
			},
			p: {
				'margin-top': '0',
				'margin-bottom': `${para}em`,
				'text-align': align,
				hyphens,
				'-webkit-hyphens': hyphens
			},
			'h1, h2, h3, h4': {
				'font-family':
					'"Newsreader Variable", Newsreader, Georgia, "Times New Roman", serif',
				'font-weight': '600',
				'letter-spacing': '-0.025em',
				'line-height': '1.12',
				'text-align': 'left',
				hyphens: 'none',
				'margin-top': '2em',
				'margin-bottom': '0.55em',
				'font-optical-sizing': 'auto',
				color: fg
			},
			h1: {
				'font-size': '2.15em',
				'letter-spacing': '-0.03em',
				'line-height': '0.98',
				'margin-top': '0.25em',
				'margin-bottom': '0.55em',
				'padding-bottom': '0.55em',
				'border-bottom': `2px solid ${link}`,
				'max-width': '18ch'
			},
			h2: {
				'font-size': '1.55em',
				'letter-spacing': '-0.028em',
				'margin-top': '2.2em'
			},
			h3: { 'font-size': '1.28em' },
			h4: { 'font-size': '1.08em' },
			'h1 + p': {
				'font-family':
					'"Newsreader Variable", Newsreader, Georgia, "Times New Roman", serif',
				'font-style': 'italic',
				'font-size': '1.02em',
				color: mute,
				'margin-bottom': '1.75em',
				'padding-bottom': '1.15em',
				'border-bottom': `1px solid ${rule}`
			},
			'h2 + p::first-letter': {
				'font-family':
					'"Newsreader Variable", Newsreader, Georgia, "Times New Roman", serif',
				'font-weight': '500',
				'font-size': '3.2em',
				'line-height': '0.82',
				float: 'left',
				'padding-right': '0.1em',
				'padding-top': '0.06em'
			},
			a: {
				color: link,
				'text-underline-offset': '0.2em'
			},
			blockquote: {
				margin: '1.75em 0',
				padding: '0.35em 0 0.35em 1.15em',
				'border-left': `2px solid ${link}`,
				color: mute,
				'font-style': 'italic',
				'font-size': '1.04em'
			},
			hr: {
				border: '0',
				height: '1px',
				margin: '2.5em auto',
				'max-width': '5.5rem',
				background: rule
			},
			'ul, ol': {
				'margin-bottom': `${para}em`,
				'padding-left': '1.35em'
			},
			li: {
				'margin-bottom': '0.35em'
			},
			img: {
				'max-width': '100%',
				height: 'auto',
				margin: '1.25em auto',
				display: 'block'
			},
			code: {
				'font-size': '0.88em',
				padding: '0.12em 0.35em',
				'border-radius': '3px',
				background: `color-mix(in srgb, ${fg} 8%, transparent)`
			}
		};
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
			const ePub = (await import('epubjs')).default;
			if (cancelled || !host) return;

			objectUrl = URL.createObjectURL(blob);
			book = ePub(objectUrl);
			rendition = book.renderTo(host, {
				width: '100%',
				height: '100%',
				flow: 'scrolled-doc',
				manager: 'continuous'
			});

			rendition.themes.default(bodyTheme());

			const start = initialLocation || undefined;
			await rendition.display(start);

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
		rendition.themes.default(bodyTheme());
	});

	onDestroy(() => {
		try {
			book?.destroy?.();
		} catch {
			/* */
		}
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	});
</script>

<div class="epub-host h-full w-full" bind:this={host}></div>

<style>
	.epub-host {
		min-height: 100%;
	}
	.epub-host :global(.epub-container) {
		height: 100% !important;
	}
</style>
