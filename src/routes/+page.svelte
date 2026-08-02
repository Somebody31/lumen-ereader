<script lang="ts">
	import { onMount } from 'svelte';
	import { listBooks, deleteBook, getProgress, getLastOpened } from '$lib/client/idb';
	import { importFiles } from '$lib/client/importBook';
	import { ensureSampleBook } from '$lib/client/seedSample';
	import type { BookRecord, ProgressRecord } from '$lib/client/types';
	import ImportDropzone from '$lib/components/library/ImportDropzone.svelte';
	import BookCard from '$lib/components/library/BookCard.svelte';
	import CoverPlate from '$lib/components/library/CoverPlate.svelte';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';

	let books = $state<BookRecord[]>([]);
	let progressMap = $state<Record<string, ProgressRecord>>({});
	let last = $state<BookRecord | null>(null);
	let query = $state('');
	let loading = $state(true);
	let error = $state('');
	let importing = $state(false);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return books;
		return books.filter(
			(b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
		);
	});

	async function refresh() {
		books = await listBooks();
		const map: Record<string, ProgressRecord> = {};
		await Promise.all(
			books.map(async (b) => {
				const p = await getProgress(b.id);
				if (p) map[b.id] = p;
			})
		);
		progressMap = map;
		last = (await getLastOpened()) ?? null;
		loading = false;
	}

	onMount(async () => {
		await ensureSampleBook();
		await refresh();
	});

	async function handleFiles(files: FileList | File[]) {
		importing = true;
		error = '';
		try {
			await importFiles(files);
			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Import failed';
		} finally {
			importing = false;
		}
	}

	async function handleDelete(id: string) {
		const book = books.find((b) => b.id === id);
		if (!book) return;
		if (!confirm(`Remove “${book.title}” from this device?`)) return;
		await deleteBook(id);
		await refresh();
	}
</script>

<svelte:head>
	<title>Library · Lumen</title>
</svelte:head>

<div class="space-y-12 sm:space-y-16">
	<!-- Masthead -->
	<section class="animate-plate-in border-b border-rule pb-8">
		<div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
			<div class="max-w-2xl">
				<p class="kicker mb-3">Library</p>
				<h1
					class="font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] text-ink sm:text-[3.5rem]"
					style="font-family: var(--font-display)"
				>
					Your shelf
				</h1>
				<p class="mt-4 max-w-md font-ui text-[15px] leading-relaxed text-ink-soft">
					Books live in this browser first. Open anything you imported — even offline.
				</p>
			</div>
			{#if books.length > 0}
				<label class="relative block w-full sm:w-64">
					<span class="sr-only">Search library</span>
					<MagnifyingGlass
						size={15}
						weight="light"
						class="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-ink-mute"
					/>
					<input
						type="search"
						bind:value={query}
						placeholder="Search titles or authors"
						class="w-full border-0 border-b border-rule bg-transparent py-2.5 pl-7 pr-2 font-ui text-sm text-ink placeholder:text-ink-mute focus:border-ink focus:outline-none"
					/>
				</label>
			{/if}
		</div>
	</section>

	{#if error}
		<div class="border border-danger/40 bg-danger/5 px-4 py-3 font-ui text-sm text-danger" role="alert">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each Array(5) as _, i (i)}
				<div class="space-y-3">
					<div class="aspect-[2/3] animate-pulse border border-rule bg-surface"></div>
					<div class="h-3 w-3/4 animate-pulse bg-surface"></div>
					<div class="h-2 w-1/2 animate-pulse bg-surface"></div>
				</div>
			{/each}
		</div>
	{:else if books.length === 0}
		<div class="animate-plate-in">
			<ImportDropzone onfiles={handleFiles} />
		</div>
		{#if importing}
			<p class="text-center font-ui text-sm text-ink-mute">Importing…</p>
		{/if}
	{:else}
		{#if last}
			{@const p = Math.round((progressMap[last.id]?.fraction || 0) * 100)}
			<!-- Feature / continue — magazine lead story -->
			<a
				href="/read/{last.id}"
				class="group animate-plate-in stagger-1 grid gap-6 border border-rule bg-paper p-0 no-underline transition-colors duration-200 hover:border-ink sm:grid-cols-[auto_1fr] sm:gap-0"
			>
				<div class="border-b border-rule sm:border-b-0 sm:border-r">
					<div class="relative aspect-[2/3] w-full sm:h-[13.5rem] sm:w-[9rem] sm:aspect-auto">
						<CoverPlate
							title={last.title}
							author={last.author}
							coverDataUrl={last.coverDataUrl}
						/>
					</div>
				</div>
				<div class="flex min-w-0 flex-col justify-center px-5 pb-6 pt-1 sm:px-8 sm:py-7">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<p class="kicker text-crimson" style="color: var(--color-crimson)">Continue reading</p>
						<span class="font-ui text-[10px] uppercase tracking-[0.12em] text-ink-mute"
							>{last.format}</span
						>
					</div>
					<p
						class="mt-2 font-display text-[1.65rem] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[2rem]"
						style="font-family: var(--font-display)"
					>
						{last.title}
					</p>
					<p class="mt-2 font-ui text-sm text-ink-soft">{last.author}</p>
					{#if p > 0}
						<div class="mt-5 flex max-w-xs items-center gap-3">
							<div class="h-px flex-1 bg-rule">
								<div class="h-px bg-ink" style="width: {p}%"></div>
							</div>
							<span class="font-ui text-xs tabular-nums text-ink-mute">{p}%</span>
						</div>
					{/if}
					<span
						class="mt-5 inline-flex w-fit items-center gap-2 border-b border-ink pb-0.5 font-ui text-[13px] font-medium text-ink transition-opacity group-hover:opacity-70"
					>
						Resume reading →
					</span>
				</div>
			</a>
		{/if}

		<div class="animate-plate-in stagger-2 space-y-6">
			<div class="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
				<h2
					class="font-display text-2xl font-semibold tracking-tight text-ink"
					style="font-family: var(--font-display)"
				>
					{filtered.length === books.length ? 'All books' : 'Matches'}
				</h2>
				<p class="font-ui text-xs uppercase tracking-[0.1em] text-ink-mute">
					{filtered.length}
					{filtered.length === 1 ? 'title' : 'titles'}
					{#if importing}
						· importing…
					{/if}
				</p>
			</div>
			<div class="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each filtered as book, i (book.id)}
					<div class="relative">
						<BookCard {book} progress={progressMap[book.id]} ondelete={handleDelete} index={i} />
					</div>
				{/each}
			</div>
		</div>

		<section class="animate-plate-in stagger-3 pt-2">
			<div class="mb-4 border-b border-rule pb-3">
				<h2
					class="font-display text-2xl font-semibold tracking-tight text-ink"
					style="font-family: var(--font-display)"
				>
					Add more
				</h2>
			</div>
			<ImportDropzone onfiles={handleFiles} compact />
		</section>
	{/if}
</div>
