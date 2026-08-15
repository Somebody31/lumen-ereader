<script lang="ts">
	import { translationBadge, type BookListItem, type ProgressRecord } from '$lib/client/types';
	import { formatDisplayTitle } from '$lib/client/formatTitle';
	import CoverPlate from './CoverPlate.svelte';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Translate from 'phosphor-svelte/lib/Translate';

	let {
		book,
		progress,
		ondelete,
		index = 0,
		transitionName
	}: {
		book: BookListItem;
		progress?: ProgressRecord;
		ondelete: (id: string) => void;
		index?: number;
		/** Omit when this cover already has the name on the continue-lead */
		transitionName?: string | null;
	} = $props();

	const coverTransition = $derived(
		transitionName === null ? undefined : (transitionName ?? `lumen-book-${book.id}`)
	);

	const fraction = $derived(progress?.fraction ?? 0);
	const pct = $derived(Math.round(fraction * 100));
	/** Cap stagger so long shelves don’t wait forever */
	const staggerI = $derived(Math.min(index, 8));
	const title = $derived(formatDisplayTitle(book.title));
	const badge = $derived(translationBadge(book.translation));
	const opened = $derived.by(() => {
		const ts = progress?.updatedAt ?? book.updatedAt;
		if (!ts) return '';
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	});
</script>

<article class="lib-shelf-card group relative" style="--i: {staggerI}">
	<a href="/read/{book.id}" class="block no-underline">
		<div
			class="cover-object bezel lumen-vt-cover"
			style={coverTransition ? `view-transition-name: ${coverTransition}` : undefined}
		>
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
							class="lib-shelf-progress h-full origin-left bg-crimson"
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
				{#if badge}
					<span class="text-ink-mute"> · </span>
					<span class="tabular-nums text-crimson">{badge}</span>
				{/if}
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
	{#if book.format === 'epub'}
		<a
			href="/translate/{book.id}"
			class="absolute right-11 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-paper text-ink-soft opacity-100 shadow-sm backdrop-blur-sm no-underline transition-all duration-200 hover:border-ink hover:text-ink active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
			aria-label="Translate {title}"
			onclick={(e) => e.stopPropagation()}
		>
			<Translate size={15} weight="light" />
		</a>
	{/if}
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
