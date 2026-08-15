<script lang="ts">
	import type { ReaderGlossaryItem } from '$lib/client/types';
	import X from 'phosphor-svelte/lib/X';

	let {
		items,
		onclose,
		onedit,
		onsave
	}: {
		items: ReaderGlossaryItem[];
		onclose: () => void;
		onedit?: () => void;
		onsave?: (id: string, patch: { preferred?: string; source?: string }) => void;
	} = $props();

	let query = $state('');
	let draft = $state<Record<string, { preferred: string; source: string }>>({});

	function rowDraft(item: ReaderGlossaryItem) {
		return draft[item.id] ?? { preferred: item.preferred, source: item.source };
	}

	function commit(item: ReaderGlossaryItem) {
		const next = rowDraft(item);
		const preferred = next.preferred.trim();
		const source = next.source.trim();
		if (!preferred || !source) return;
		if (preferred === item.preferred && source === item.source) return;
		onsave?.(item.id, { preferred, source });
	}

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
			<p class="type-meta mt-1" style="color: var(--stage-chrome-mute)">
				Edits save to the translator list for later chapters.
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
					{#each rows as item (item.id)}
						<li class="glossary-reader-row">
							<label class="sr-only" for="gloss-en-{item.id}">English</label>
							<input
								id="gloss-en-{item.id}"
								class="glossary-reader-en glossary-reader-input"
								value={rowDraft(item).preferred}
								oninput={(e) => {
									const preferred = (e.currentTarget as HTMLInputElement).value;
									draft = { ...draft, [item.id]: { ...rowDraft(item), preferred } };
								}}
								onchange={() => commit(item)}
								onblur={() => commit(item)}
							/>
							<label class="sr-only" for="gloss-zh-{item.id}">Chinese</label>
							<input
								id="gloss-zh-{item.id}"
								class="glossary-reader-zh glossary-reader-input"
								value={rowDraft(item).source}
								oninput={(e) => {
									const source = (e.currentTarget as HTMLInputElement).value;
									draft = { ...draft, [item.id]: { ...rowDraft(item), source } };
								}}
								onchange={() => commit(item)}
								onblur={() => commit(item)}
							/>
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
