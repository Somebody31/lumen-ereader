<script lang="ts">
	import type { BookRecord, ProgressRecord } from '$lib/client/types';
	import Trash from 'phosphor-svelte/lib/Trash';

	let {
		book,
		progress,
		ondelete
	}: {
		book: BookRecord;
		progress?: ProgressRecord;
		ondelete: (id: string) => void;
	} = $props();

	const fraction = $derived(progress?.fraction ?? 0);
	const pct = $derived(Math.round(fraction * 100));
</script>

<article
	class="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] bg-void-panel ring-1 ring-hairline transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5"
>
	<a href="/read/{book.id}" class="flex flex-1 flex-col no-underline">
		<div class="relative aspect-[2/3] overflow-hidden bg-void-elevated">
			{#if book.coverDataUrl}
				<img
					src={book.coverDataUrl}
					alt=""
					class="h-full w-full object-cover"
					loading="lazy"
				/>
			{/if}
			<div
				class="absolute inset-x-0 bottom-0 h-1 bg-hairline"
				role="progressbar"
				aria-valuenow={pct}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Reading progress"
			>
				<div class="h-full bg-star transition-[width] duration-300" style="width: {pct}%"></div>
			</div>
		</div>
		<div class="flex flex-1 flex-col gap-1 p-3.5">
			<h3 class="line-clamp-2 font-ui text-sm font-semibold leading-snug tracking-tight text-ink">
				{book.title}
			</h3>
			<p class="truncate text-xs text-ink-dim">{book.author}</p>
			<p class="mt-auto pt-2 text-xs uppercase tracking-wide text-ink-faint">
				{book.format}
				{#if pct > 0}
					· {pct}%
				{/if}
			</p>
		</div>
	</a>
	<button
		type="button"
		class="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-void/70 text-ink-dim opacity-0 ring-1 ring-hairline backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
		aria-label="Delete {book.title}"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			ondelete(book.id);
		}}
	>
		<Trash size={16} weight="light" />
	</button>
</article>
