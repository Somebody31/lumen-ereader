<script lang="ts">
	import type { BookRecord, ProgressRecord } from '$lib/client/types';
	import CoverPlate from './CoverPlate.svelte';
	import Trash from 'phosphor-svelte/lib/Trash';

	let {
		book,
		progress,
		ondelete,
		index = 0
	}: {
		book: BookRecord;
		progress?: ProgressRecord;
		ondelete: (id: string) => void;
		index?: number;
	} = $props();

	const fraction = $derived(progress?.fraction ?? 0);
	const pct = $derived(Math.round(fraction * 100));
	const stagger = $derived(`stagger-${Math.min(5, (index % 5) + 1)}`);
</script>

<article class="group relative animate-plate-in {stagger}">
	<a href="/read/{book.id}" class="block no-underline">
		<div class="bezel plate-hover">
			<div class="bezel-inner relative aspect-[2/3]">
				<CoverPlate title={book.title} author={book.author} coverDataUrl={book.coverDataUrl} />
				{#if pct > 0}
					<div
						class="absolute inset-x-0 bottom-0 h-px bg-black/20"
						role="progressbar"
						aria-valuenow={pct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Reading progress"
					>
						<div
							class="h-full bg-ink transition-[width] duration-300 ease-[var(--ease-editorial)]"
							style="width: {pct}%"
						></div>
					</div>
				{/if}
			</div>
		</div>
		<div class="mt-3 border-t border-rule pt-2.5">
			<h3
				class="line-clamp-2 font-display text-[15px] font-semibold leading-snug tracking-tight text-ink"
				style="font-family: var(--font-display)"
			>
				{book.title}
			</h3>
			<p class="mt-1 truncate font-ui text-[12px] text-ink-mute">
				{book.author || 'Unknown author'}
			</p>
			<p class="mt-1.5 font-ui text-[10px] uppercase tracking-[0.1em] text-ink-mute">
				{book.format}
				{#if pct > 0}
					<span class="mx-1">·</span>
					<span class="tabular-nums normal-case tracking-normal">{pct}%</span>
				{/if}
			</p>
		</div>
	</a>
	<button
		type="button"
		class="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center border border-rule bg-paper text-ink-mute opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:border-ink hover:text-danger focus-visible:opacity-100"
		aria-label="Delete {book.title}"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			ondelete(book.id);
		}}
	>
		<Trash size={15} weight="light" />
	</button>
</article>
