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
	class="reader-scroll h-full overflow-y-auto pb-28 pt-[max(1.75rem,calc(env(safe-area-inset-top)+1.25rem))] sm:pb-32 sm:pt-10"
	style:padding-left="max({prefs.margin}px, 3.75rem)"
	style:padding-right="max({prefs.margin}px, 1rem)"
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
		<article
			class="reader-prose relative z-[1]"
			lang="en"
			style:font-family={fontStack(prefs.fontFamily)}
			style:font-size="{prefs.fontSize}px"
			style:line-height={prefs.lineHeight}
			style:letter-spacing="{(prefs.letterSpacing ?? 0)}em"
			style:max-width="{prefs.measure}ch"
			style:text-align={prefs.textAlign ?? 'left'}
			style:hyphens={prefs.hyphenate ? 'auto' : 'manual'}
		>
			{@html html}
			<!-- book end breathing room — quiet rule, no bead ornament -->
			<div class="reader-end-mark" aria-hidden="true"></div>
		</article>
	{/if}
</div>
