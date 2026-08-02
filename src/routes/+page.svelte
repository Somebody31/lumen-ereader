<script lang="ts">
	import { onMount } from 'svelte';
	import { listBooks, deleteBook, getProgress, getLastOpened } from '$lib/client/idb';
	import { importFiles } from '$lib/client/importBook';
	import { ensureSampleBook } from '$lib/client/seedSample';
	import { formatBytes, LARGE_SIZE_BYTES, WARN_SIZE_BYTES } from '$lib/client/textRender';
	import type { BookListItem, ProgressRecord } from '$lib/client/types';
	import ImportDropzone from '$lib/components/library/ImportDropzone.svelte';
	import BookCard from '$lib/components/library/BookCard.svelte';
	import CoverPlate from '$lib/components/library/CoverPlate.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import X from 'phosphor-svelte/lib/X';

	let books = $state<BookListItem[]>([]);
	let progressMap = $state<Record<string, ProgressRecord>>({});
	let last = $state<BookListItem | null>(null);
	let query = $state('');
	let loading = $state(true);
	let error = $state('');
	let notice = $state('');
	let importing = $state(false);
	let pendingDelete = $state<BookListItem | null>(null);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return books;
		return books.filter(
			(b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
		);
	});

	const inProgress = $derived(
		filtered.filter((b) => (progressMap[b.id]?.fraction ?? 0) > 0.01 && (progressMap[b.id]?.fraction ?? 0) < 0.99)
	);
	const restShelf = $derived.by(() => {
		const ids = new Set(inProgress.map((b) => b.id));
		// when sparse, avoid double-listing last in both continue + shelf if only 1 book
		return filtered.filter((b) => !ids.has(b.id));
	});

	const sparse = $derived(books.length > 0 && books.length <= 3 && !query.trim());

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
		notice = '';
		try {
			const list = Array.from(files);
			const large = list.filter((f) => f.size >= WARN_SIZE_BYTES);
			await importFiles(list);
			if (large.length) {
				const biggest = large.reduce((a, b) => (a.size > b.size ? a : b));
				notice =
					biggest.size >= LARGE_SIZE_BYTES
						? `Imported large file (${formatBytes(biggest.size)}). Opening uses chunked rendering; first open may still take a moment.`
						: `Imported ${formatBytes(biggest.size)} file. Large text is rendered in chunks for smoother scrolling.`;
			}
			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Import failed';
		} finally {
			importing = false;
		}
	}

	function requestDelete(id: string) {
		pendingDelete = books.find((b) => b.id === id) ?? null;
	}

	async function confirmDelete() {
		const book = pendingDelete;
		if (!book) return;
		pendingDelete = null;
		await deleteBook(book.id);
		await refresh();
	}

	function formatOpened(ts?: number) {
		if (!ts) return '';
		const d = new Date(ts);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>Library · Lumen</title>
</svelte:head>

<div class="space-y-12 sm:space-y-14">
	<!-- Masthead: no redundant kicker when library is the page -->
	<section class="animate-plate-in">
		<div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
			<div class="max-w-2xl">
				<h1
					class="font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] text-ink sm:text-[3.5rem]"
					style="font-family: var(--font-display); font-variation-settings: 'opsz' 72"
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
						class="w-full border-0 border-b border-rule bg-transparent py-2.5 pl-7 pr-8 font-ui text-sm text-ink placeholder:text-ink-mute focus:border-ink focus:outline-none"
					/>
					{#if query}
						<button
							type="button"
							class="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-ink-mute hover:text-ink"
							aria-label="Clear search"
							onclick={() => (query = '')}
						>
							<X size={14} weight="light" />
						</button>
					{/if}
				</label>
			{/if}
		</div>
		<div class="mt-8 h-px bg-rule"></div>
	</section>

	{#if error}
		<div
			class="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 font-ui text-sm text-danger"
			role="alert"
		>
			{error}
		</div>
	{/if}
	{#if notice}
		<div
			class="flex items-start justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3 font-ui text-sm text-ink-soft"
			role="status"
		>
			<p>{notice}</p>
			<button
				type="button"
				class="shrink-0 text-ink-soft hover:text-ink"
				aria-label="Dismiss"
				onclick={() => (notice = '')}
			>
				<X size={16} weight="light" />
			</button>
		</div>
	{/if}

	{#if loading}
		<div class="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each Array(5) as _, i (i)}
				<div class="space-y-3">
					<div class="cover-object bezel">
						<div class="bezel-inner aspect-[2/3] skeleton"></div>
					</div>
					<div class="h-3 w-3/4 skeleton"></div>
					<div class="h-2 w-1/2 skeleton"></div>
				</div>
			{/each}
		</div>
	{:else if books.length === 0}
		<div class="animate-plate-in">
			<ImportDropzone onfiles={handleFiles} featured />
		</div>
		{#if importing}
			<p class="text-center font-ui text-sm text-ink-mute">Importing…</p>
		{/if}
	{:else}
		{#if last && !query.trim()}
			{@const p = Math.round((progressMap[last.id]?.fraction || 0) * 100)}
			{@const opened = formatOpened(progressMap[last.id]?.updatedAt ?? last.updatedAt)}
			<!-- Feature / continue — magazine lead -->
			<a
				href="/read/{last.id}"
				class="group animate-plate-in stagger-1 grid gap-0 overflow-hidden rounded-lg border border-rule bg-paper no-underline transition-[border-color,box-shadow] duration-300 ease-[var(--ease-editorial)] hover:border-ink-mute hover:shadow-[var(--shadow-plate-hover)] sm:grid-cols-[minmax(10rem,38%)_1fr]"
			>
				<div
					class="flex items-center justify-center border-b border-rule bg-surface/60 p-6 sm:border-b-0 sm:border-r sm:p-8 md:p-10"
				>
					<div class="cover-object cover-object-hero bezel w-full max-w-[11rem] sm:max-w-[13.5rem]">
						<div class="bezel-inner relative aspect-[2/3]">
							<CoverPlate
								title={last.title}
								author={last.author}
								coverDataUrl={last.coverDataUrl}
							/>
						</div>
					</div>
				</div>
				<div class="flex min-w-0 flex-col justify-center px-6 py-8 sm:px-10 sm:py-12">
					<p class="font-ui text-[11px] font-medium uppercase tracking-[0.14em] text-crimson">
						Continue reading
					</p>
					<p
						class="mt-3 font-display text-[1.85rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[2.35rem] md:text-[2.65rem]"
						style="font-family: var(--font-display); font-variation-settings: 'opsz' 56"
					>
						{last.title}
					</p>
					<p class="mt-3 font-ui text-[15px] text-ink-soft">
						{last.author}
						{#if opened}
							<span class="text-ink-mute"> · {opened}</span>
						{/if}
					</p>
					{#if p > 0}
						<div class="mt-7 flex max-w-sm items-center gap-3">
							<div class="h-[3px] flex-1 bg-rule">
								<div
									class="h-[3px] bg-ink transition-[width] duration-500 ease-[var(--ease-editorial)]"
									style="width: {p}%"
								></div>
							</div>
							<span class="font-ui text-xs tabular-nums text-ink-mute">{p}%</span>
						</div>
					{/if}
					<span
						class="mt-7 inline-flex w-fit items-center gap-2 border-b border-ink pb-0.5 font-ui text-[13px] font-medium text-ink transition-opacity duration-200 group-hover:opacity-70"
					>
						Resume reading
						<span aria-hidden="true">→</span>
					</span>
				</div>
			</a>
		{/if}

		{@const shelfBooks = sparse && last && !query.trim()
			? restShelf.filter((b) => b.id !== last!.id)
			: query.trim()
				? filtered
				: restShelf.length
					? restShelf
					: filtered.filter((b) => !last || b.id !== last.id || filtered.length > 1)}

		{#if shelfBooks.length > 0 || query.trim()}
			<div class="animate-plate-in stagger-2 space-y-6">
				<div class="flex items-baseline justify-between gap-4">
					<h2
						class="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]"
						style="font-family: var(--font-display)"
					>
						{query.trim()
							? 'Matches'
							: inProgress.length && !sparse
								? 'Also on the shelf'
								: sparse
									? 'On the shelf'
									: 'All books'}
					</h2>
					{#if !sparse || query.trim()}
						<p class="font-ui text-xs tabular-nums text-ink-mute">
							{query.trim() ? filtered.length : shelfBooks.length}
							{(query.trim() ? filtered.length : shelfBooks.length) === 1 ? 'title' : 'titles'}
							{#if importing}
								<span class="text-ink-mute"> · importing…</span>
							{/if}
						</p>
					{/if}
				</div>
				<div class="h-px bg-rule"></div>

				{#if query.trim() && filtered.length === 0}
					<p class="font-ui text-sm text-ink-mute">No titles match “{query}”.</p>
				{:else}
					<div
						class="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 {sparse
							? 'lg:grid-cols-4'
							: 'lg:grid-cols-5'}"
					>
						{#each query.trim() ? filtered : shelfBooks as book, i (book.id)}
							<BookCard {book} progress={progressMap[book.id]} ondelete={requestDelete} index={i} />
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<section class="animate-plate-in stagger-3 pt-2">
			{#if !sparse}
				<div class="mb-4">
					<h2
						class="font-display text-2xl font-semibold tracking-tight text-ink"
						style="font-family: var(--font-display)"
					>
						Add more
					</h2>
					<div class="mt-3 h-px bg-rule"></div>
				</div>
			{/if}
			<ImportDropzone onfiles={handleFiles} compact />
		</section>
	{/if}
</div>

<ConfirmDialog
	open={!!pendingDelete}
	title="Remove book"
	message={pendingDelete
		? `Remove “${pendingDelete.title}” from this device? Progress and bookmarks for it will be deleted.`
		: ''}
	confirmLabel="Remove"
	cancelLabel="Keep"
	danger
	onconfirm={confirmDelete}
	oncancel={() => (pendingDelete = null)}
/>
