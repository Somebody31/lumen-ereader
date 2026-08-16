<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listBooks, putBook, getBook } from '$lib/client/idb';
	import { importFile } from '$lib/client/importBook';
	import { fetchTranslateStatus } from '$lib/client/translateJob';
	import { formatDisplayTitle } from '$lib/client/formatTitle';
	import { translationBadge, type BookListItem } from '$lib/client/types';
	import ImportDropzone from '$lib/components/library/ImportDropzone.svelte';
	import CoverPlate from '$lib/components/library/CoverPlate.svelte';

	let books = $state<BookListItem[]>([]);
	let configured = $state<boolean | null>(null);
	let model = $state('deepseek-v4-flash');
	let error = $state('');
	let importing = $state(false);

	const epubs = $derived(books.filter((b) => b.format === 'epub'));

	async function refresh() {
		books = await listBooks();
	}

	onMount(async () => {
		await refresh();
		const status = await fetchTranslateStatus();
		configured = status.configured;
		model = status.model;
	});

	async function handleFiles(files: FileList | File[]) {
		const file = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.epub'));
		if (!file) {
			error = 'Drop a Chinese EPUB to translate.';
			return;
		}
		importing = true;
		error = '';
		try {
			const book = await importFile(file);
			book.sourceLang = 'zh';
			book.updatedAt = Date.now();
			await putBook(book);
			await goto(`/translate/${book.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Import failed';
		} finally {
			importing = false;
		}
	}

	async function openExisting(id: string) {
		const book = await getBook(id);
		if (!book) return;
		if (!book.sourceLang) {
			book.sourceLang = 'zh';
			await putBook(book);
		}
		await goto(`/translate/${id}`);
	}
</script>

<svelte:head>
	<title>Translate · Lumen</title>
</svelte:head>

<div class="space-y-10">
	<header class="animate-plate-in max-w-2xl">
		<p class="type-kicker text-crimson">Webnovel</p>
		<h1 class="type-masthead mt-2 text-[2.75rem] text-ink">Translate</h1>
		<p class="type-body mt-4 text-ink-soft">
			Import a Chinese EPUB, pick the chapters you want, and DeepSeek V4 Flash writes an English copy
			onto the same library card. One glossary drives the model and the reader panel.
		</p>
		<div class="mt-8 h-px bg-rule"></div>
	</header>

	{#if configured === false}
		<p class="animate-plate-in rounded-[1.25rem] border border-white/10 bg-paper px-5 py-3.5 font-ui text-sm text-ink-soft">
			Translation is not configured. Set
			<code class="text-ink">DEEPSEEK_API_KEY</code>
			on the server, then check
			<a href="/settings" class="text-ink underline decoration-rule underline-offset-4">Settings</a>.
		</p>
	{:else if configured}
		<p class="type-meta text-ink-mute">Using {model} · key stays on the server</p>
	{/if}

	{#if error}
		<p class="font-ui text-sm text-danger" role="alert">{error}</p>
	{/if}

	<section class="animate-plate-in stagger-1">
		<ImportDropzone
			onfiles={handleFiles}
			accept=".epub,application/epub+zip"
			multiple={false}
			heading={importing ? 'Importing…' : 'Drop a Chinese EPUB'}
			detail="Choose which chapters to translate on the next screen. The original stays on the book."
		/>
	</section>

	{#if epubs.length}
		<section class="animate-plate-in stagger-2 space-y-4">
			<h2 class="type-section text-xl text-ink">From your shelf</h2>
			<ul class="grid gap-3 sm:grid-cols-2">
				{#each epubs as book (book.id)}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-4 rounded-[1.25rem] border border-white/10 bg-paper p-3 text-left transition-[border-color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/20 active:scale-[0.99]"
							onclick={() => openExisting(book.id)}
						>
							<div class="h-20 w-14 shrink-0 overflow-hidden rounded-sm">
								<CoverPlate
									title={book.title}
									author={book.author}
									coverDataUrl={book.coverDataUrl}
								/>
							</div>
							<div class="min-w-0">
								<p class="type-card-title truncate text-[15px] text-ink">
									{formatDisplayTitle(book.title)}
								</p>
								<p class="type-meta mt-1 text-ink-soft">{book.author || 'Unknown author'}</p>
								{#if translationBadge(book.translation)}
									<p class="type-micro mt-1.5 text-crimson">{translationBadge(book.translation)}</p>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
