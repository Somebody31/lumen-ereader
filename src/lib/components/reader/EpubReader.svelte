<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { ReaderPrefs } from '$lib/client/types';

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
			night: { bg: '#0B0E14', fg: '#E8E6E1' },
			paper: { bg: '#F2EFE8', fg: '#1A1C22' },
			sepia: { bg: '#E8DCC8', fg: '#3D3428' },
			contrast: { bg: '#000000', fg: '#FFFFFF' }
		};
		return map[prefs.theme] || map.night;
	});

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

			const { bg, fg } = themeStyles;
			rendition.themes.default({
				body: {
					background: bg,
					color: fg,
					'font-family': '"Literata Variable", Literata, Georgia, serif',
					'font-size': `${prefs.fontSize}px !important`,
					'line-height': `${prefs.lineHeight} !important`,
					'max-width': `${prefs.measure}ch`,
					margin: '0 auto',
					padding: `${prefs.margin}px !important`,
					'font-optical-sizing': 'auto'
				},
				a: { color: '#7A1C1C' }
			});

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
		const { bg, fg } = themeStyles;
		rendition.themes.default({
			body: {
				background: bg,
				color: fg,
				'font-family': '"Literata Variable", Literata, Georgia, serif',
				'font-size': `${prefs.fontSize}px !important`,
				'line-height': `${prefs.lineHeight} !important`,
				'max-width': `${prefs.measure}ch`,
				margin: '0 auto',
				padding: `${prefs.margin}px !important`,
				'font-optical-sizing': 'auto'
			},
			a: { color: '#7A1C1C' }
		});
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
