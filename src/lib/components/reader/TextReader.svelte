<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CHUNK_WINDOW,
		estimateChunkHeight,
		estimateProgressFromScroll,
		renderTextChunks,
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

	let chunks = $state<string[]>([]);
	let heights = $state<number[]>([]);
	let ready = $state(false);
	let parsePct = $state(0);
	let scroller: HTMLElement | undefined = $state();
	let restored = false;
	let first = $state(0);
	let last = $state(0);
	let raf = 0;

	const topSpacer = $derived(heights.slice(0, first).reduce((a, b) => a + b, 0));
	const bottomSpacer = $derived(heights.slice(last + 1).reduce((a, b) => a + b, 0));

	function measureAction(node: HTMLElement, index: number) {
		const apply = () => {
			const h = node.offsetHeight;
			if (h > 0 && Math.abs(h - (heights[index] ?? 0)) > 4) {
				const next = heights.slice();
				next[index] = h;
				heights = next;
			}
		};
		apply();
		const ro = new ResizeObserver(apply);
		ro.observe(node);
		return {
			update(newIndex: number) {
				index = newIndex;
				apply();
			},
			destroy() {
				ro.disconnect();
			}
		};
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			const htmlChunks = await renderTextChunks(raw, format, (done, total) => {
				if (!cancelled && total > 0) parsePct = Math.round((done / total) * 100);
			});
			if (cancelled) return;
			chunks = htmlChunks;
			heights = htmlChunks.map((h) => estimateChunkHeight(h, prefs.fontSize));
			last = Math.min(htmlChunks.length - 1, CHUNK_WINDOW * 2);
			first = 0;
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
				updateWindow();
			}
			restored = true;
		});
	});

	function updateWindow() {
		if (!scroller || !chunks.length) return;
		const scrollTop = scroller.scrollTop;
		const viewH = scroller.clientHeight;
		let acc = 0;
		let start = 0;
		let end = chunks.length - 1;

		for (let i = 0; i < heights.length; i++) {
			const next = acc + heights[i];
			if (next >= scrollTop - viewH) {
				start = i;
				break;
			}
			acc = next;
		}
		acc = 0;
		for (let i = 0; i < heights.length; i++) {
			acc += heights[i];
			if (acc >= scrollTop + viewH * 2) {
				end = i;
				break;
			}
		}

		const pad = CHUNK_WINDOW;
		first = Math.max(0, start - pad);
		last = Math.min(chunks.length - 1, end + pad);
	}

	function onScroll() {
		if (!scroller) return;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			if (!scroller) return;
			updateWindow();
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
			<p class="type-body" style="color: var(--stage-muted)">Preparing text… {parsePct}%</p>
		</div>
	{:else}
		<article class="reader-prose relative z-[1]" lang="en">
			{#if topSpacer > 0}
				<div style="height: {topSpacer}px" aria-hidden="true"></div>
			{/if}
			{#each { length: last - first + 1 } as _, j (first + j)}
				{@const i = first + j}
				<section class="text-chunk" data-chunk={i} use:measureAction={i}>
					{@html chunks[i]}
				</section>
			{/each}
			{#if bottomSpacer > 0}
				<div style="height: {bottomSpacer}px" aria-hidden="true"></div>
			{/if}
			<!-- book end breathing room — three-beat asterism -->
			<div class="reader-end-mark" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</div>
		</article>
	{/if}
</div>
