<script lang="ts">
	import type { BookListItem, ProgressRecord } from '$lib/client/types';
	import { formatDisplayTitle } from '$lib/client/formatTitle';
	import CoverPlate from './CoverPlate.svelte';
	import Trash from 'phosphor-svelte/lib/Trash';

	let {
		book,
		progress,
		ondelete,
		index = 0
	}: {
		book: BookListItem;
		progress?: ProgressRecord;
		ondelete: (id: string) => void;
		index?: number;
	} = $props();

	const fraction = $derived(progress?.fraction ?? 0);
	const pct = $derived(Math.round(fraction * 100));
	const stagger = $derived(`stagger-${Math.min(5, (index % 5) + 1)}`);
	const title = $derived(formatDisplayTitle(book.title));
	const opened = $derived.by(() => {
		const ts = progress?.updatedAt ?? book.updatedAt;
		if (!ts) return '';
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	});
</script>

<article class="group relative animate-plate-in {stagger}">
	<a href="/read/{book.id}" class="block no-underline">
		<div class="cover-object bezel">
			<div class="bezel-inner relative aspect-[2/3]">
				<CoverPlate title={book.title} author={book.author} coverDataUrl={book.coverDataUrl} />
				{#if pct > 0}
					<div
						class="absolute inset-x-0 bottom-0 z-[1] h-[3px] bg-black/30"
						role="progressbar"
						aria-valuenow={pct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Reading progress"
					>
						<div
							class="h-full bg-crimson transition-[width] duration-300 ease-[var(--ease-editorial)]"
							style="width: {pct}%"
						></div>
					</div>
				{/if}
			</div>
		</div>
		<div class="mt-3.5 pt-0.5">
			<h3
				class="type-card-title line-clamp-2 text-[15px] text-ink transition-colors duration-200 group-hover:text-ink-soft"
			>
				{title}
			</h3>
			<p class="type-eyebrow mt-1 truncate text-[12px] text-ink-soft">
				{book.author || 'Unknown author'}
			</p>
			<p class="type-meta mt-1.5 text-[11px] text-ink-mute">
				<span class="uppercase tracking-[0.08em]">{book.format}</span>
				{#if pct > 0}
					<span class="text-ink-mute"> · </span>
					<span class="tabular-nums text-ink-soft">{pct}%</span>
				{/if}
				{#if opened}
					<span class="text-ink-mute"> · </span>
					<span class="text-ink-soft">{opened}</span>
				{/if}
			</p>
		</div>
	</a>
	<button
		type="button"
		class="absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-paper text-ink-soft opacity-100 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-danger hover:text-danger active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
		aria-label="Delete {title}"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			ondelete(book.id);
		}}
	>
		<Trash size={15} weight="light" />
	</button>
</article>
