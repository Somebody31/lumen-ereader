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
		const map: Record<string, { bg: string; fg: string }> = {
			night: { bg: '#0c0c0c', fg: '#f3f2ed' },
			paper: { bg: '#f7f5f0', fg: '#1a1c22' },
			sepia: { bg: '#e8dcc8', fg: '#3d3428' },
			contrast: { bg: '#000000', fg: '#ffffff' }
		};
		return map[prefs.theme] || map.night;
	});

	function bodyTheme() {
		const { bg, fg } = themeStyles;
		const align = prefs.textAlign ?? 'left';
		const tracking = prefs.letterSpacing ?? 0;
		const para = prefs.paragraphSpacing ?? 1;
		const hyphens = prefs.hyphenate ? 'auto' : 'manual';
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
				padding: `${prefs.margin}px !important`,
				'text-align': align,
				hyphens,
				'-webkit-hyphens': hyphens,
				'font-optical-sizing': 'auto'
			},
			p: {
				'margin-bottom': `${para}em`,
				'text-align': align,
				hyphens,
				'-webkit-hyphens': hyphens
			},
			a: { color: '#7A1C1C' }
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

			rendition.on('relocated', (location: {
				start: { cfi: string; percentage?: number };
				atEnd?: boolean;
			}) => {
				const fraction = location.start.percentage ?? (location.atEnd ? 1 : 0);
				onprogress(fraction, location.start.cfi);
			});

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
		// Re-apply when any visual pref changes
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
