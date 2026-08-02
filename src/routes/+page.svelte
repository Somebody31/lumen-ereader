<script lang="ts">
	import { onMount } from 'svelte';
	import { listBooks, deleteBook, getProgress, getLastOpened } from '$lib/client/idb';
	import { importFiles } from '$lib/client/importBook';
	import { ensureSampleBook } from '$lib/client/seedSample';
	import { formatBytes, LARGE_SIZE_BYTES, WARN_SIZE_BYTES } from '$lib/client/textRender';
	import { formatDisplayTitle } from '$lib/client/formatTitle';
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
	let pageDragging = $state(false);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return books;
		return books.filter(
			(b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
		);
	});

	const inProgress = $derived(
		filtered.filter(
			(b) =>
				(progressMap[b.id]?.fraction ?? 0) > 0.01 && (progressMap[b.id]?.fraction ?? 0) < 0.99
		)
	);
	const restShelf = $derived.by(() => {
		const ids = new Set(inProgress.map((b) => b.id));
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

	onMount(() => {
		const onChanged = (e: Event) => {
			const d = (e as CustomEvent<{ notice?: string; error?: string }>).detail;
			if (d?.error) error = d.error;
			if (d?.notice) notice = d.notice;
			refresh();
		};
		window.addEventListener('lumen:books-changed', onChanged);
		(async () => {
			await ensureSampleBook();
			await refresh();
		})();
		return () => window.removeEventListener('lumen:books-changed', onChanged);
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
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function formatSize(n: number) {
		return formatBytes(n);
	}

	function onPageDrag(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer?.types?.includes('Files')) pageDragging = true;
	}
	function onPageDragLeave(e: DragEvent) {
		// only clear when leaving the page root
		if (e.currentTarget === e.target) pageDragging = false;
	}
	function onPageDrop(e: DragEvent) {
		e.preventDefault();
		pageDragging = false;
		if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
	}
</script>

<svelte:head>
	<title>Library · Lumen</title>
</svelte:head>

<div
	class="relative space-y-12 sm:space-y-16"
	ondragenter={onPageDrag}
	ondragover={onPageDrag}
	ondragleave={onPageDragLeave}
	ondrop={onPageDrop}
	role="presentation"
>
	{#if pageDragging && books.length > 0}
		<div
			class="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-newsprint/70 backdrop-blur-[2px]"
			aria-hidden="true"
		>
			<div
				class="rounded-lg border-2 border-dashed border-crimson bg-paper/90 px-10 py-8 font-ui text-sm text-ink"
			>
				Release to import
			</div>
		</div>
	{/if}

	<section class="animate-plate-in">
		<div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
			<div class="max-w-xl">
				<p class="kicker text-crimson">Library</p>
				<h1
					class="mt-2 font-display text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.03em] text-ink sm:text-[3.25rem]"
					style="font-family: var(--font-display); font-variation-settings: 'opsz' 72"
				>
					Your shelf
				</h1>
				<p class="mt-3 max-w-md font-ui text-[15px] leading-relaxed text-ink-soft">
					Books live in this browser first. Open anything you imported — even offline.
				</p>
			</div>
			{#if books.length > 0}
				<label class="relative block w-full sm:w-72">
					<span class="sr-only">Search library</span>
					<MagnifyingGlass
						size={15}
						weight="light"
						class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
					/>
					<input
						type="search"
						bind:value={query}
						placeholder="Search titles or authors"
						class="w-full rounded-md border border-rule bg-paper py-2.5 pl-9 pr-9 font-ui text-sm text-ink placeholder:text-ink-mute focus:border-ink-mute focus:outline-none"
					/>
					{#if query}
						<button
							type="button"
							class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-soft hover:text-ink"
							aria-label="Clear search"
							onclick={() => (query = '')}
						>
							<X size={14} weight="light" />
						</button>
					{/if}
				</label>
			{/if}
		</div>
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
			<p class="font-ui text-sm text-ink-soft">Importing…</p>
		{/if}
	{:else}
		{#if last && !query.trim()}
			{@const p = Math.round((progressMap[last.id]?.fraction || 0) * 100)}
			{@const opened = formatOpened(progressMap[last.id]?.updatedAt ?? last.updatedAt)}
			{@const displayTitle = formatDisplayTitle(last.title)}
			{@const authorLine = last.author?.trim() || 'Unknown'}
			{@const continueMeta = [authorLine, opened].filter(Boolean).join(', ')}
			<!-- Unboxed magazine spread — cover + broadsheet type -->
			<a
				href="/read/{last.id}"
				class="group continue-lead animate-plate-in stagger-1 no-underline"
			>
				<div class="continue-lead-cover">
					<div class="cover-object cover-object-hero bezel w-full">
						<div class="bezel-inner relative aspect-[2/3]">
							<CoverPlate
								title={last.title}
								author={last.author}
								coverDataUrl={last.coverDataUrl}
							/>
						</div>
					</div>
				</div>
				<div class="continue-lead-spine" aria-hidden="true"></div>
				<div class="continue-lead-copy">
					<p class="continue-lead-eyebrow">
						Continuing{#if continueMeta}{' '}– {continueMeta}{/if}
					</p>
					<p class="continue-lead-title">{displayTitle}</p>
					<div
						class="continue-lead-progress"
						role="progressbar"
						aria-valuenow={p}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Reading progress"
					>
						<div class="continue-lead-track">
							<div
								class="continue-lead-fill"
								style="width: {Math.max(p, p > 0 ? 1.5 : 0)}%"
							></div>
						</div>
						<span class="continue-lead-pct">{p}%</span>
					</div>
					<span class="continue-lead-cta">
						Resume reading
						<span class="cta-chevron" aria-hidden="true">→</span>
					</span>
				</div>
			</a>
			<div class="mt-2 h-px bg-rule sm:mt-6" aria-hidden="true"></div>
		{/if}

		{@const shelfBooks =
			sparse && last && !query.trim()
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
						<p class="font-ui text-xs tabular-nums text-ink-soft">
							{query.trim() ? filtered.length : shelfBooks.length}
							{(query.trim() ? filtered.length : shelfBooks.length) === 1 ? 'title' : 'titles'}
							{#if importing}
								<span> · importing…</span>
							{/if}
						</p>
					{/if}
				</div>

				{#if query.trim() && filtered.length === 0}
					<p class="font-ui text-sm text-ink-soft">No titles match “{query}”.</p>
				{:else}
					<div
						class="grid grid-cols-2 gap-x-6 gap-y-11 sm:grid-cols-3 md:grid-cols-4 {sparse
							? 'lg:grid-cols-3 lg:gap-x-10'
							: 'lg:grid-cols-5'}"
					>
						{#each query.trim() ? filtered : shelfBooks as book, i (book.id)}
							<BookCard {book} progress={progressMap[book.id]} ondelete={requestDelete} index={i} />
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Quiet drop hint — Import lives in the toolbar -->
		<p class="animate-plate-in stagger-3 pt-4 text-center font-ui text-[12px] text-ink-mute">
			Drop a file anywhere to import · or use <span class="text-ink-soft">Import</span> in the bar
		</p>
	{/if}
</div>

<ConfirmDialog
	open={!!pendingDelete}
	title="Remove book"
	message={pendingDelete
		? `Remove “${formatDisplayTitle(pendingDelete.title)}” from this device? Progress and bookmarks for it will be deleted.`
		: ''}
	confirmLabel="Remove"
	cancelLabel="Keep"
	danger
	onconfirm={confirmDelete}
	oncancel={() => (pendingDelete = null)}
/>
