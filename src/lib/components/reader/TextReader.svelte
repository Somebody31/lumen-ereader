<script lang="ts">
	import { onMount } from 'svelte';
	import { estimateProgressFromScroll, renderTextContent, scrollToFraction } from '$lib/client/textRender';
	import type { ReaderPrefs } from '$lib/client/types';

	let {
		raw,
		format,
		prefs,
		initialFraction = 0,
		onprogress
	}: {
		raw: string;
		format: 'text' | 'markdown';
		prefs: ReaderPrefs;
		initialFraction?: number;
		onprogress: (fraction: number, location: string) => void;
	} = $props();

	let html = $state('');
	let scroller: HTMLElement | undefined = $state();
	let restored = false;

	onMount(() => {
		let cancelled = false;
		renderTextContent(raw, format).then((h) => {
			if (!cancelled) html = h;
		});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!scroller || !html || restored) return;
		requestAnimationFrame(() => {
			if (scroller) scrollToFraction(scroller, initialFraction);
			restored = true;
		});
	});

	function onScroll() {
		if (!scroller) return;
		const fraction = estimateProgressFromScroll(scroller);
		onprogress(fraction, `scroll:${fraction.toFixed(4)}`);
	}
</script>

<div
	bind:this={scroller}
	class="reader-scroll h-full overflow-y-auto px-[var(--reader-margin,1.5rem)] py-20 sm:py-24"
	style:--reader-size="{prefs.fontSize}px"
	style:--reader-lh={prefs.lineHeight}
	style:--reader-measure="{prefs.measure}ch"
	style:--reader-margin="{prefs.margin}px"
	onscroll={onScroll}
>
	<article class="reader-prose relative z-[1]">
		{@html html}
	</article>
</div>
