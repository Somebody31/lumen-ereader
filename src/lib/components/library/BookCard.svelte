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
		<div
			class="bezel plate-hover transition-transform duration-280 ease-[var(--ease-atelier)] group-hover:-translate-y-1"
		>
			<div class="bezel-inner relative aspect-[2/3] shadow-[var(--shadow-plate)]">
				<CoverPlate title={book.title} author={book.author} coverDataUrl={book.coverDataUrl} />
				{#if pct > 0}
					<div
						class="absolute inset-x-0 bottom-0 h-[3px] bg-black/15"
						role="progressbar"
						aria-valuenow={pct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Reading progress"
					>
						<div
							class="h-full bg-indigo transition-[width] duration-300 ease-[var(--ease-atelier)]"
							style="width: {pct}%"
						></div>
					</div>
				{/if}
			</div>
		</div>
		<div class="mt-3 px-0.5">
			<h3
				class="line-clamp-2 font-ui text-[13.5px] font-semibold leading-snug tracking-tight text-ink"
			>
				{book.title}
			</h3>
			<p class="mt-0.5 truncate text-[12px] text-ink-mute">{book.author || 'Unknown author'}</p>
			<p class="mt-1.5 text-[11px] tabular-nums text-ink-mute/90">
				<span class="uppercase tracking-[0.06em]">{book.format}</span>
				{#if pct > 0}
					<span class="mx-1 text-rule">·</span>
					<span>{pct}%</span>
				{/if}
			</p>
		</div>
	</a>
	<button
		type="button"
		class="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-paper/95 text-ink-mute opacity-0 shadow-[var(--shadow-island)] ring-1 ring-black/[0.05] backdrop-blur-sm transition-all duration-200 ease-[var(--ease-atelier)] group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
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
