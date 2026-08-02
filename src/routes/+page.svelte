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
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';

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

<div class="space-y-12">
	<section class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
		<div class="animate-plate-in max-w-xl">
			<h1 class="font-ui text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[2.75rem]">
				Your shelf
			</h1>
			<p class="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
				Books live in this browser first. Open anything you imported — even offline.
			</p>
		</div>
		{#if books.length > 0}
			<label class="relative block w-full animate-plate-in stagger-2 sm:w-72">
				<span class="sr-only">Search library</span>
				<MagnifyingGlass
					size={16}
					weight="light"
					class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute"
				/>
				<input
					type="search"
					bind:value={query}
					placeholder="Search titles or authors"
					class="w-full rounded-full border-0 bg-paper py-3 pl-10 pr-4 text-sm text-ink shadow-[var(--shadow-plate)] ring-1 ring-black/[0.04] placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-indigo"
				/>
			</label>
		{/if}
	</section>

	{#if error}
		<div
			class="rounded-[var(--radius-md)] bg-danger/10 px-4 py-3 text-sm text-danger"
			role="alert"
		>
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each Array(5) as _, i (i)}
				<div class="space-y-3">
					<div class="bezel">
						<div class="bezel-inner aspect-[2/3] animate-pulse bg-ash-deep"></div>
					</div>
					<div class="h-3 w-3/4 animate-pulse rounded bg-ash-deep"></div>
					<div class="h-2.5 w-1/2 animate-pulse rounded bg-ash-deep"></div>
				</div>
			{/each}
		</div>
	{:else if books.length === 0}
		<div class="animate-plate-in">
			<ImportDropzone onfiles={handleFiles} />
		</div>
		{#if importing}
			<p class="text-center text-sm text-ink-mute">Importing…</p>
		{/if}
	{:else}
		{#if last}
			{@const p = Math.round((progressMap[last.id]?.fraction || 0) * 100)}
			<div class="grid animate-plate-in stagger-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
				<a
					href="/read/{last.id}"
					class="group relative flex overflow-hidden rounded-[var(--radius-xl)] bg-paper no-underline shadow-[var(--shadow-plate)] ring-1 ring-black/[0.04] transition-all duration-300 ease-[var(--ease-atelier)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-plate-hover)]"
				>
					<div
						class="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-indigo"
						aria-hidden="true"
					></div>
					<div
						class="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-indigo/[0.04]"
						aria-hidden="true"
					></div>
					<div class="flex w-full flex-row items-stretch">
						<div class="shrink-0 p-3.5 sm:p-5">
							<div class="bezel">
								<div
									class="bezel-inner relative h-[7.5rem] w-[5rem] sm:h-[10rem] sm:w-[6.6rem]"
								>
									<CoverPlate
										title={last.title}
										author={last.author}
										coverDataUrl={last.coverDataUrl}
									/>
								</div>
							</div>
						</div>
						<div class="flex min-w-0 flex-1 flex-col justify-center py-4 pr-4 sm:py-5 sm:pr-7">
							<div class="flex items-center gap-2">
								<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo">
									Continue reading
								</p>
								<span
									class="rounded-full bg-ash px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-mute"
									>{last.format}</span
								>
							</div>
							<p
								class="mt-2 line-clamp-2 font-ui text-xl font-semibold tracking-tight text-ink sm:text-[1.7rem] sm:leading-[1.15]"
							>
								{last.title}
							</p>
							<p class="mt-1.5 truncate text-sm text-ink-soft">{last.author}</p>
							{#if p > 0}
								<div class="mt-5 flex max-w-xs items-center gap-2.5">
									<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-ash-deep">
										<div
											class="h-full rounded-full bg-indigo transition-[width] duration-300"
											style="width: {p}%"
										></div>
									</div>
									<span class="text-xs tabular-nums text-ink-mute">{p}%</span>
								</div>
							{/if}
							<span
								class="mt-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-seal transition-transform duration-200 ease-[var(--ease-atelier)] group-hover:translate-x-0.5"
							>
								Resume
								<span
									class="flex h-7 w-7 items-center justify-center rounded-full bg-seal text-white shadow-[0_4px_14px_rgba(224,60,43,0.32)] transition-transform duration-200 group-hover:scale-105"
								>
									<ArrowRight size={14} weight="bold" />
								</span>
							</span>
						</div>
					</div>
				</a>
				<div class="hidden min-h-[11rem] lg:block">
					<ImportDropzone onfiles={handleFiles} compact />
				</div>
			</div>
		{/if}

		<div class="animate-plate-in stagger-2 space-y-5">
			<div class="flex items-end justify-between gap-4">
				<div>
					<h2 class="font-ui text-lg font-semibold tracking-tight text-ink">
						{filtered.length === books.length ? 'All books' : 'Matches'}
					</h2>
					<p class="mt-0.5 text-sm text-ink-mute">
						{filtered.length}
						{filtered.length === 1 ? 'title' : 'titles'}
						{#if importing}
							· importing…
						{/if}
					</p>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each filtered as book, i (book.id)}
					<div class="relative">
						<BookCard {book} progress={progressMap[book.id]} ondelete={handleDelete} index={i} />
					</div>
				{/each}
			</div>
		</div>

		{#if last}
			<section class="animate-plate-in stagger-3 pt-2 lg:hidden">
				<h2 class="mb-4 font-ui text-lg font-semibold tracking-tight text-ink">Add more</h2>
				<ImportDropzone onfiles={handleFiles} compact />
			</section>
		{:else}
			<section class="animate-plate-in stagger-3 pt-2">
				<h2 class="mb-4 font-ui text-lg font-semibold tracking-tight text-ink">Add more</h2>
				<ImportDropzone onfiles={handleFiles} compact />
			</section>
		{/if}
	{/if}
</div>
