<script lang="ts">
	import { onMount } from 'svelte';
	import {
		estimateProgressFromScroll,
		renderTextContent,
		scrollToFraction
	} from '$lib/client/textRender';
	import { fontStack, type ReaderPrefs } from '$lib/client/types';

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
	let ready = $state(false);
	let scroller: HTMLElement | undefined = $state();
	let restored = false;
	let raf = 0;

	onMount(() => {
		let cancelled = false;
		(async () => {
			const out = await renderTextContent(raw, format);
			if (cancelled) return;
			html = out;
			ready = true;
		})();
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
		};
	});

	$effect(() => {
		if (!scroller || !ready || restored) return;
		requestAnimationFrame(() => {
			if (scroller) {
				scrollToFraction(scroller, initialFraction);
			}
			restored = true;
		});
	});

	function onScroll() {
		if (!scroller) return;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			if (!scroller) return;
			const fraction = estimateProgressFromScroll(scroller);
			onprogress(fraction, `scroll:${fraction.toFixed(4)}`);
		});
	}
</script>

<div
	bind:this={scroller}
	class="reader-scroll h-full overflow-y-auto px-[max(var(--reader-margin,1.5rem),1rem)] pb-36 pt-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] sm:pb-40 sm:pt-28"
	style:--reader-font={fontStack(prefs.fontFamily)}
	style:--reader-size="{prefs.fontSize}px"
	style:--reader-lh={prefs.lineHeight}
	style:--reader-measure="{prefs.measure}ch"
	style:--reader-margin="{prefs.margin}px"
	style:--reader-tracking="{(prefs.letterSpacing ?? 0)}em"
	style:--reader-para="{(prefs.paragraphSpacing ?? 1)}em"
	style:--reader-align={prefs.textAlign ?? 'left'}
	style:--reader-hyphens={prefs.hyphenate ? 'auto' : 'manual'}
	onscroll={onScroll}
>
	{#if !ready}
		<div class="reader-prose relative z-[1] py-12 text-center" style="color: var(--stage-muted)">
			<p class="type-body" style="color: var(--stage-muted)">Preparing text…</p>
		</div>
	{:else}
		<article class="reader-prose relative z-[1]" lang="en">
			{@html html}
			<!-- book end breathing room — three-beat asterism -->
			<div class="reader-end-mark" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</div>
		</article>
	{/if}
</div>
