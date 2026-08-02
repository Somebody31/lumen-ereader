<script lang="ts">
	import { onMount } from 'svelte';
	import { listBooks, deleteBook, getProgress, getLastOpened } from '$lib/client/idb';
	import { importFiles } from '$lib/client/importBook';
	import { ensureSampleBook } from '$lib/client/seedSample';
	import type { BookRecord, ProgressRecord } from '$lib/client/types';
	import ImportDropzone from '$lib/components/library/ImportDropzone.svelte';
	import BookCard from '$lib/components/library/BookCard.svelte';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';

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

<div class="space-y-10">
	<section class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="mb-2 text-xs font-medium tracking-wide text-star-muted">Library</p>
			<h1 class="font-ui text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
				Your shelf
			</h1>
			<p class="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
				Books live in this browser first. Open anything you imported — even offline.
			</p>
		</div>
		{#if books.length > 0}
			<label class="relative block w-full sm:w-64">
				<span class="sr-only">Search library</span>
				<MagnifyingGlass
					size={16}
					weight="light"
					class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
				/>
				<input
					type="search"
					bind:value={query}
					placeholder="Search titles"
					class="w-full rounded-full border-0 bg-void-panel py-2.5 pl-9 pr-4 text-sm text-ink ring-1 ring-hairline placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-star"
				/>
			</label>
		{/if}
	</section>

	{#if error}
		<div
			class="rounded-[var(--radius-md)] bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/25"
			role="alert"
		>
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each Array(4) as _, i (i)}
				<div class="aspect-[2/3] animate-pulse rounded-[var(--radius-lg)] bg-void-panel"></div>
			{/each}
		</div>
	{:else if books.length === 0}
		<ImportDropzone onfiles={handleFiles} />
		{#if importing}
			<p class="text-center text-sm text-ink-dim">Importing…</p>
		{/if}
	{:else}
		{#if last}
			<a
				href="/read/{last.id}"
				class="group flex items-center gap-4 rounded-[var(--radius-lg)] bg-void-elevated p-4 no-underline ring-1 ring-hairline transition-colors hover:bg-void-panel sm:p-5"
			>
				{#if last.coverDataUrl}
					<img
						src={last.coverDataUrl}
						alt=""
						class="h-20 w-14 shrink-0 rounded-md object-cover ring-1 ring-hairline"
					/>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="text-xs font-medium text-star-muted">Continue reading</p>
					<p class="mt-1 truncate font-ui text-lg font-semibold tracking-tight text-ink">
						{last.title}
					</p>
					<p class="truncate text-sm text-ink-dim">{last.author}</p>
					{#if progressMap[last.id]}
						<div class="mt-3 h-1 max-w-xs overflow-hidden rounded-full bg-hairline">
							<div
								class="h-full bg-star"
								style="width: {Math.round((progressMap[last.id].fraction || 0) * 100)}%"
							></div>
						</div>
					{/if}
				</div>
				<CaretRight
					size={20}
					weight="light"
					class="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-star"
				/>
			</a>
		{/if}

		<div class="space-y-4">
			<div class="flex items-center justify-between gap-4">
				<h2 class="font-ui text-sm font-medium text-ink-dim">
					{filtered.length}
					{filtered.length === 1 ? 'book' : 'books'}
				</h2>
				{#if importing}
					<span class="text-xs text-ink-faint">Importing…</span>
				{/if}
			</div>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each filtered as book (book.id)}
					<BookCard {book} progress={progressMap[book.id]} ondelete={handleDelete} />
				{/each}
			</div>
		</div>

		<section class="pt-4">
			<h2 class="mb-3 font-ui text-sm font-medium text-ink-dim">Import more</h2>
			<ImportDropzone onfiles={handleFiles} compact />
		</section>
	{/if}
</div>
