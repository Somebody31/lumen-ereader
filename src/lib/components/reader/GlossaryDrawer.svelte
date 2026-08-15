<script lang="ts">
	import type { ReaderGlossaryItem } from '$lib/client/types';
	import X from 'phosphor-svelte/lib/X';

	let {
		items,
		onclose,
		onedit
	}: {
		items: ReaderGlossaryItem[];
		onclose: () => void;
		onedit?: () => void;
	} = $props();

	let query = $state('');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return items;
		return items.filter(
			(i) => i.source.toLowerCase().includes(q) || i.preferred.toLowerCase().includes(q)
		);
	});

	const grouped = $derived.by(() => {
		const map = new Map<string, ReaderGlossaryItem[]>();
		for (const item of filtered) {
			const list = map.get(item.category) ?? [];
			list.push(item);
			map.set(item.category, list);
		}
		return [...map.entries()];
	});
</script>

<div
	class="reader-drawer reader-drawer-right"
	style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule)"
	role="dialog"
	aria-modal="true"
	aria-label="Glossary"
	tabindex="-1"
	onclick={(e) => e.stopPropagation()}
	onkeydown={(e) => e.stopPropagation()}
>
	<div class="reader-drawer-head" style="border-color: var(--stage-rule)">
		<div class="min-w-0 flex-1">
			<p class="type-kicker" style="color: var(--stage-chrome-mute)">Glossary</p>
			<p class="type-chrome-title mt-1 text-[1.05rem]" style="color: var(--stage-chrome-fg)">
				Names &amp; terms
			</p>
		</div>
		<button
			type="button"
			class="reader-rail-btn shrink-0 self-start"
			style="color: var(--stage-chrome-mute)"
			aria-label="Close glossary"
			onclick={onclose}
		>
			<X size={16} weight="light" />
		</button>
	</div>

	<div class="px-3 pb-2 pt-3">
		<input
			type="search"
			class="w-full rounded-md border bg-transparent px-3 py-2 font-ui text-[13px] outline-none"
			style="border-color: var(--stage-rule); color: var(--stage-chrome-fg)"
			placeholder="Search Chinese or English"
			bind:value={query}
		/>
	</div>

	<div class="flex-1 overflow-y-auto px-1 pb-4">
		{#if items.length === 0}
			<p class="px-4 py-6 font-ui text-sm" style="color: var(--stage-chrome-mute)">
				Terms appear here as the book is translated.
			</p>
		{:else if filtered.length === 0}
			<p class="px-4 py-6 font-ui text-sm" style="color: var(--stage-chrome-mute)">
				No matches.
			</p>
		{:else}
			{#each grouped as [cat, rows] (cat)}
				<p
					class="type-micro px-4 pb-1 pt-3 uppercase"
					style="color: var(--stage-chrome-mute)"
				>
					{cat}
				</p>
				<ul class="glossary-reader-list" role="list">
					{#each rows as item (`${item.source}:${item.preferred}`)}
						<li class="glossary-reader-row">
							<span class="glossary-reader-en">{item.preferred}</span>
							<span class="glossary-reader-zh">{item.source}</span>
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	</div>

	{#if onedit}
		<div class="border-t px-3 py-3" style="border-color: var(--stage-rule)">
			<button
				type="button"
				class="w-full rounded-md border px-3 py-2 font-ui text-[13px] transition-opacity hover:opacity-80"
				style="border-color: var(--stage-rule); color: var(--stage-chrome-fg)"
				onclick={onedit}
			>
				Edit glossary
			</button>
		</div>
	{/if}
</div>
