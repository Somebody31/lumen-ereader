<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getBook, getPrefs, putPrefs, putProgress, getProgress } from '$lib/client/idb';
	import { pushProgress } from '$lib/client/sync';
	import type { BookRecord, ReaderPrefs, ReadingTheme } from '$lib/client/types';
	import TextReader from '$lib/components/reader/TextReader.svelte';
	import EpubReader from '$lib/components/reader/EpubReader.svelte';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import List from 'phosphor-svelte/lib/List';
	import TextAa from 'phosphor-svelte/lib/TextAa';
	import X from 'phosphor-svelte/lib/X';

	let book = $state<BookRecord | null>(null);
	let prefs = $state<ReaderPrefs | null>(null);
	let initialFraction = $state(0);
	let initialLocation = $state('');
	let error = $state('');
	let loading = $state(true);
	let textRaw = $state('');
	let chromeVisible = $state(true);
	let focusMode = $state(false);
	let tocOpen = $state(false);
	let typeOpen = $state(false);
	let toc = $state<{ label: string; href: string }[]>([]);
	let fraction = $state(0);
	let epubRef: EpubReader | undefined = $state();

	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let lastLocation = '';

	const id = $derived(page.params.id ?? '');
	const stageClass = $derived(`stage-${prefs?.theme ?? 'night'}`);

	function bumpChrome() {
		if (focusMode) return;
		chromeVisible = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			chromeVisible = false;
		}, 2800);
	}

	async function load() {
		loading = true;
		error = '';
		if (!id) {
			error = 'Missing book id.';
			loading = false;
			return;
		}
		const b = await getBook(id);
		if (!b) {
			error = 'Book not found on this device.';
			loading = false;
			return;
		}
		book = b;
		prefs = await getPrefs();
		const prog = await getProgress(id);
		if (prog) {
			initialFraction = prog.fraction;
			initialLocation = prog.location;
			fraction = prog.fraction;
			lastLocation = prog.location;
		}
		if (b.format === 'text' || b.format === 'markdown') {
			textRaw = await b.blob.text();
		}
		loading = false;
		bumpChrome();
	}

	onMount(() => {
		load();
		return () => {
			clearTimeout(hideTimer);
			clearTimeout(saveTimer);
		};
	});

	function scheduleSave(frac: number, location: string, label?: string) {
		fraction = frac;
		lastLocation = location;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			if (!book) return;
			await putProgress({
				bookId: book.id,
				fraction: frac,
				location,
				label,
				updatedAt: Date.now()
			});
			// Fire-and-forget cloud sync if session exists
			pushProgress(book.id).catch(() => {});
		}, 400);
	}

	async function updatePrefs(partial: Partial<ReaderPrefs>) {
		if (!prefs) return;
		prefs = { ...prefs, ...partial };
		await putPrefs(prefs);
	}

	function onKey(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;

		if (e.key === 'Escape') {
			if (tocOpen || typeOpen) {
				tocOpen = false;
				typeOpen = false;
				return;
			}
			goto('/');
			return;
		}
		if (e.key === 'f' || e.key === 'F') {
			focusMode = !focusMode;
			chromeVisible = !focusMode;
			if (!focusMode) bumpChrome();
			return;
		}
		if (e.key === 't' || e.key === 'T') {
			tocOpen = !tocOpen;
			typeOpen = false;
			return;
		}
		if (e.key === '+' || e.key === '=') {
			if (prefs) updatePrefs({ fontSize: Math.min(32, prefs.fontSize + 1) });
			return;
		}
		if (e.key === '-' || e.key === '_') {
			if (prefs) updatePrefs({ fontSize: Math.max(14, prefs.fontSize - 1) });
			return;
		}
		if (e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') {
			epubRef?.next();
			return;
		}
		if (e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') {
			epubRef?.prev();
		}
	}

	const themes: { id: ReadingTheme; label: string }[] = [
		{ id: 'night', label: 'Night' },
		{ id: 'paper', label: 'Paper' },
		{ id: 'sepia', label: 'Sepia' },
		{ id: 'contrast', label: 'Contrast' }
	];
</script>

<svelte:window onkeydown={onKey} onmousemove={bumpChrome} onclick={bumpChrome} />

<svelte:head>
	<title>{book ? `${book.title} · Lumen` : 'Reading · Lumen'}</title>
</svelte:head>

<div class="relative h-[100dvh] overflow-hidden {stageClass}" style="background: var(--stage-bg); color: var(--stage-fg);">
	<!-- progress edge -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5 bg-black/10"
		role="progressbar"
		aria-valuenow={Math.round(fraction * 100)}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Reading progress"
	>
		<div class="h-full bg-star transition-[width] duration-300" style="width: {fraction * 100}%"></div>
	</div>

	{#if loading}
		<div class="flex h-full items-center justify-center text-sm" style="color: var(--stage-muted)">
			Opening…
		</div>
	{:else if error}
		<div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
			<p class="text-sm" style="color: var(--stage-muted)">{error}</p>
			<a href="/" class="rounded-full bg-star px-5 py-2.5 text-sm font-medium text-void no-underline"
				>Back to library</a
			>
		</div>
	{:else if book && prefs}
		<!-- chrome top -->
		<header
			class="absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-all duration-300 ease-[var(--ease-out-expo)] {chromeVisible &&
			!focusMode
				? 'translate-y-0 opacity-100'
				: 'pointer-events-none -translate-y-2 opacity-0'}"
		>
			<div
				class="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-void-panel/95 px-2 py-1.5 ring-1 ring-hairline backdrop-blur-md"
			>
				<a
					href="/"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-dim no-underline hover:bg-void-elevated hover:text-ink"
					aria-label="Back to library"
				>
					<ArrowLeft size={18} weight="light" />
				</a>
				<div class="min-w-0 flex-1">
					<p class="truncate font-ui text-sm font-medium tracking-tight text-ink">{book.title}</p>
					<p class="truncate text-xs text-ink-dim">{book.author}</p>
				</div>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-dim hover:bg-void-elevated hover:text-ink"
					aria-label="Table of contents"
					onclick={() => {
						tocOpen = !tocOpen;
						typeOpen = false;
					}}
				>
					<List size={18} weight="light" />
				</button>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-dim hover:bg-void-elevated hover:text-ink"
					aria-label="Typography and theme"
					onclick={() => {
						typeOpen = !typeOpen;
						tocOpen = false;
					}}
				>
					<TextAa size={18} weight="light" />
				</button>
			</div>
		</header>

		<!-- reader body -->
		<div class="h-full w-full">
			{#if book.format === 'epub'}
				<EpubReader
					bind:this={epubRef}
					blob={book.blob}
					{prefs}
					{initialLocation}
					onprogress={(f, loc, label) => scheduleSave(f, loc, label)}
					ontoc={(items) => (toc = items)}
				/>
			{:else}
				<TextReader
					raw={textRaw}
					format={book.format === 'markdown' ? 'markdown' : 'text'}
					{prefs}
					{initialFraction}
					onprogress={(f, loc) => scheduleSave(f, loc)}
				/>
			{/if}
		</div>

		<!-- type panel -->
		{#if typeOpen}
			<div
				class="absolute bottom-4 left-1/2 z-40 w-[min(100%-1.5rem,22rem)] -translate-x-1/2 rounded-[var(--radius-lg)] bg-void-panel/95 p-4 text-ink ring-1 ring-hairline backdrop-blur-md"
				role="dialog"
				aria-label="Reading settings"
			>
				<div class="mb-3 flex items-center justify-between">
					<p class="text-sm font-medium">Type & theme</p>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-void-elevated"
						aria-label="Close"
						onclick={() => (typeOpen = false)}
					>
						<X size={16} weight="light" />
					</button>
				</div>
				<div class="mb-4 flex flex-wrap gap-2">
					{#each themes as t (t.id)}
						<button
							type="button"
							class="rounded-full px-3 py-1.5 text-xs ring-1 transition-colors {prefs.theme === t.id
								? 'bg-star text-void ring-star'
								: 'bg-void-elevated text-ink-dim ring-hairline hover:text-ink'}"
							onclick={() => updatePrefs({ theme: t.id })}
						>
							{t.label}
						</button>
					{/each}
				</div>
				<label class="mb-3 block text-xs text-ink-dim">
					Size · {prefs.fontSize}px
					<input
						type="range"
						min="14"
						max="32"
						step="1"
						value={prefs.fontSize}
						class="mt-1 w-full accent-star"
						oninput={(e) => updatePrefs({ fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>
				<label class="mb-3 block text-xs text-ink-dim">
					Line height · {prefs.lineHeight.toFixed(2)}
					<input
						type="range"
						min="1.4"
						max="2.2"
						step="0.05"
						value={prefs.lineHeight}
						class="mt-1 w-full accent-star"
						oninput={(e) =>
							updatePrefs({ lineHeight: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>
				<label class="block text-xs text-ink-dim">
					Measure · {prefs.measure}ch
					<input
						type="range"
						min="45"
						max="90"
						step="1"
						value={prefs.measure}
						class="mt-1 w-full accent-star"
						oninput={(e) => updatePrefs({ measure: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>
				<p class="mt-3 text-xs text-ink-faint">
					F focus · T contents · +/− size · Esc library
				</p>
			</div>
		{/if}

		<!-- toc -->
		{#if tocOpen}
			<div
				class="absolute bottom-0 right-0 top-0 z-40 flex w-[min(100%,20rem)] flex-col bg-void-panel/98 text-ink ring-1 ring-hairline backdrop-blur-md"
				role="dialog"
				aria-modal="true"
				aria-label="Contents"
			>
				<div class="flex items-center justify-between border-b border-hairline px-4 py-3">
					<p class="text-sm font-medium">Contents</p>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-void-elevated"
						aria-label="Close contents"
						onclick={() => (tocOpen = false)}
					>
						<X size={16} weight="light" />
					</button>
				</div>
				<div class="flex-1 overflow-y-auto p-2">
					{#if toc.length === 0}
						<p class="px-2 py-4 text-sm text-ink-dim">
							{book.format === 'epub' ? 'No table of contents in this file.' : 'Scroll the text document freely.'}
						</p>
					{:else}
						<ul class="space-y-0.5">
							{#each toc as item, i (i)}
								<li>
									<button
										type="button"
										class="w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-ink-dim hover:bg-void-elevated hover:text-ink"
										onclick={() => {
											epubRef?.goTo(item.href);
											tocOpen = false;
										}}
									>
										{item.label}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
