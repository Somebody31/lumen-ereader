<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getBook, getPrefs, putPrefs, putProgress, getProgress } from '$lib/client/idb';
	import { pushProgress } from '$lib/client/sync';
	import { formatBytes, LARGE_SIZE_BYTES, WARN_SIZE_BYTES } from '$lib/client/textRender';
	import type { BookRecord, ReaderPrefs, ReadingTheme } from '$lib/client/types';
	import TextReader from '$lib/components/reader/TextReader.svelte';
	import EpubReader from '$lib/components/reader/EpubReader.svelte';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
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
	let sizeBanner = $state('');
	let chromeVisible = $state(true);
	let focusMode = $state(false);
	let tocOpen = $state(false);
	let typeOpen = $state(false);
	let toc = $state<{ label: string; href: string }[]>([]);
	let fraction = $state(0);
	let progressLabel = $state('');
	let epubRef: EpubReader | undefined = $state();

	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let lastLocation = '';

	const id = $derived(page.params.id ?? '');
	const stageClass = $derived(`stage-${prefs?.theme ?? 'night'}`);
	const pct = $derived(Math.round(fraction * 100));

	const themes: {
		id: ReadingTheme;
		label: string;
		bg: string;
		fg: string;
		line: string;
	}[] = [
		{ id: 'night', label: 'Night', bg: '#0c0c0c', fg: '#f3f2ed', line: '#9a9a94' },
		{ id: 'paper', label: 'Paper', bg: '#f7f5f0', fg: '#1a1c22', line: '#5a5a56' },
		{ id: 'sepia', label: 'Sepia', bg: '#e8dcc8', fg: '#3d3428', line: '#6b5e4e' },
		{ id: 'contrast', label: 'Contrast', bg: '#000000', fg: '#ffffff', line: '#c0c0c0' }
	];

	const sampleLine =
		'The booth lights were already low when Mara locked the door. Outside, the lobby still hummed.';

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
			progressLabel = prog.label || '';
		}
		if (b.sizeBytes >= WARN_SIZE_BYTES) {
			sizeBanner =
				b.sizeBytes >= LARGE_SIZE_BYTES
					? `Large file (${formatBytes(b.sizeBytes)}). Text is prepared in chunks; scrolling stays light after load.`
					: `This file is ${formatBytes(b.sizeBytes)}. Rendering in chunks for smoother reading.`;
		} else {
			sizeBanner = '';
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
		if (label) progressLabel = label;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			if (!book) return;
			await putProgress({
				bookId: book.id,
				fraction: frac,
				location,
				label: label || progressLabel || undefined,
				updatedAt: Date.now()
			});
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
			tocOpen = false;
			typeOpen = false;
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

	const subline = $derived.by(() => {
		const parts: string[] = [];
		if (progressLabel) parts.push(progressLabel);
		else if (book?.author) parts.push(book.author);
		parts.push(`${pct}%`);
		return parts.join(' · ');
	});
</script>

<svelte:window onkeydown={onKey} onmousemove={bumpChrome} onclick={bumpChrome} />

<svelte:head>
	<title>{book ? `${book.title} · Lumen` : 'Reading · Lumen'}</title>
</svelte:head>

<div
	class="reader-stage relative h-[100dvh] overflow-hidden {stageClass} {focusMode
		? 'is-focus'
		: ''}"
	style="background: var(--stage-bg); color: var(--stage-fg);"
>
	<!-- progress hairline -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 z-50 h-px"
		style="background: color-mix(in srgb, var(--stage-fg) 12%, transparent)"
		role="progressbar"
		aria-valuenow={pct}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Reading progress"
	>
		<div
			class="h-full transition-[width] duration-300 ease-[var(--ease-editorial)]"
			style="width: {fraction * 100}%; background: var(--stage-progress)"
		></div>
	</div>

	{#if sizeBanner && !loading && !error && chromeVisible && !focusMode}
		<div
			class="absolute inset-x-0 top-[3.75rem] z-30 mx-3 flex items-start justify-between gap-3 rounded-md border px-3 py-2 font-ui text-[12px] backdrop-blur-md sm:mx-4 sm:top-16"
			style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule)"
			role="status"
		>
			<p class="min-w-0 leading-snug" style="color: var(--stage-chrome-mute)">{sizeBanner}</p>
			<button
				type="button"
				class="shrink-0 p-0.5 transition-opacity hover:opacity-70"
				aria-label="Dismiss size notice"
				onclick={() => (sizeBanner = '')}
			>
				<X size={14} weight="light" />
			</button>
		</div>
	{/if}

	{#if loading}
		<div class="flex h-full items-center justify-center font-ui text-sm" style="color: var(--stage-muted)">
			Opening…
		</div>
	{:else if error}
		<div class="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
			<p class="font-ui text-sm" style="color: var(--stage-muted)">{error}</p>
			<a
				href="/"
				class="inline-flex items-center justify-center border border-current bg-transparent px-5 py-2.5 font-ui text-[13px] font-medium tracking-tight no-underline transition-opacity hover:opacity-80 active:scale-[0.98]"
				style="color: var(--stage-fg)"
				>Back to library</a
			>
		</div>
	{:else if book && prefs}
		<header
			class="absolute inset-x-0 top-0 z-40 px-0 pt-[max(0.5rem,env(safe-area-inset-top))] transition-all duration-300 ease-[var(--ease-editorial)] {chromeVisible &&
			!focusMode
				? 'translate-y-0 opacity-100'
				: 'pointer-events-none -translate-y-1 opacity-0'}"
		>
			<div
				class="mx-3 flex min-w-0 items-center gap-1 rounded-lg border px-2 py-1.5 backdrop-blur-md sm:mx-4"
				style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule)"
			>
				<a
					href="/"
					class="flex h-9 w-9 shrink-0 items-center justify-center no-underline transition-opacity hover:opacity-70 active:scale-95"
					style="color: var(--stage-chrome-mute)"
					aria-label="Back to library"
				>
					<ArrowLeft size={18} weight="light" />
				</a>
				<div class="min-w-0 flex-1 px-1">
					<p
						class="truncate font-display text-[15px] font-semibold tracking-tight sm:text-base"
						style="color: var(--stage-chrome-fg); font-family: var(--font-display)"
					>
						{book.title}
					</p>
					<p
						class="truncate font-ui text-[11px] tracking-wide"
						style="color: var(--stage-chrome-mute)"
					>
						{subline}
					</p>
				</div>
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 items-center justify-center transition-opacity hover:opacity-70 active:scale-95"
					style="color: var(--stage-chrome-mute)"
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
					class="flex h-9 w-9 shrink-0 items-center justify-center transition-opacity hover:opacity-70 active:scale-95"
					style="color: var(--stage-chrome-mute)"
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

		<div class="relative z-[1] h-full w-full">
			{#if book.format === 'epub'}
				<EpubReader
					bind:this={epubRef}
					blob={book.blob}
					{prefs}
					{initialLocation}
					onprogress={(f, loc, label) => scheduleSave(f, loc, label)}
					ontoc={(items) => (toc = items)}
				/>
				<!-- Edge hit zones -->
				{#if !focusMode}
					<button
						type="button"
						class="absolute bottom-16 left-0 top-16 z-20 w-12 opacity-0 transition-opacity duration-200 hover:opacity-100 sm:w-16"
						style="color: var(--stage-muted)"
						aria-label="Previous page"
						onclick={(e) => {
							e.stopPropagation();
							epubRef?.prev();
							bumpChrome();
						}}
					>
						<span
							class="ml-2 flex h-10 w-10 items-center justify-center border backdrop-blur-sm"
							style="border-color: var(--stage-rule); background: var(--stage-chrome)"
						>
							<CaretLeft size={18} weight="light" />
						</span>
					</button>
					<button
						type="button"
						class="absolute bottom-16 right-0 top-16 z-20 flex w-12 justify-end opacity-0 transition-opacity duration-200 hover:opacity-100 sm:w-16"
						style="color: var(--stage-muted)"
						aria-label="Next page"
						onclick={(e) => {
							e.stopPropagation();
							epubRef?.next();
							bumpChrome();
						}}
					>
						<span
							class="mr-2 flex h-10 w-10 items-center justify-center border backdrop-blur-sm"
							style="border-color: var(--stage-rule); background: var(--stage-chrome)"
						>
							<CaretRight size={18} weight="light" />
						</span>
					</button>
				{/if}
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

		<!-- Bottom progress chip when chrome visible -->
		{#if chromeVisible && !focusMode && !typeOpen && !tocOpen}
			<div
				class="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border px-3 py-1 font-ui text-[11px] tabular-nums backdrop-blur-md transition-opacity duration-300"
				style="background: var(--stage-chrome); color: var(--stage-chrome-mute); border-color: var(--stage-rule)"
			>
				{pct}%
			</div>
		{/if}

		{#if typeOpen}
			<div
				class="absolute bottom-4 left-1/2 z-40 w-[min(100%-1.5rem,24rem)] -translate-x-1/2 overflow-hidden rounded-lg border backdrop-blur-md"
				style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule)"
				role="dialog"
				aria-label="Reading settings"
			>
				<div
					class="flex items-center justify-between border-b px-4 py-3"
					style="border-color: var(--stage-rule)"
				>
					<p class="font-ui text-[11px] font-medium uppercase tracking-[0.12em]">Type & theme</p>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-70"
						aria-label="Close"
						onclick={() => (typeOpen = false)}
					>
						<X size={16} weight="light" />
					</button>
				</div>

				<!-- Live sample line -->
				<div
					class="border-b px-4 py-3"
					style="border-color: var(--stage-rule); background: color-mix(in srgb, var(--stage-fg) 4%, transparent)"
				>
					<p
						class="font-reading"
						style="font-family: var(--font-reading); font-size: {prefs.fontSize}px; line-height: {prefs.lineHeight}; max-width: {prefs.measure}ch; color: var(--stage-chrome-fg)"
					>
						{sampleLine}
					</p>
				</div>

				<div class="space-y-4 p-4">
					<div class="flex flex-wrap gap-1.5">
						{#each themes as t (t.id)}
							<button
								type="button"
								class="theme-swatch"
								style="width: 3.75rem; border-color: var(--stage-rule)"
								aria-pressed={prefs.theme === t.id}
								onclick={() => updatePrefs({ theme: t.id })}
							>
								<span class="theme-swatch-face" style="background: {t.bg}; height: 2.25rem">
									<span
										class="mx-auto mt-1.5 block h-0.5 w-6"
										style="background: {t.fg}"
									></span>
								</span>
								<span
									class="theme-swatch-label"
									style="color: var(--stage-chrome-mute)">{t.label}</span
								>
							</button>
						{/each}
					</div>
					<label class="block font-ui text-xs" style="color: var(--stage-chrome-mute)">
						Size · <span class="tabular-nums">{prefs.fontSize}px</span>
						<input
							type="range"
							min="14"
							max="32"
							step="1"
							value={prefs.fontSize}
							class="mt-1.5 w-full"
							style="accent-color: var(--stage-chrome-fg)"
							oninput={(e) =>
								updatePrefs({ fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
						/>
					</label>
					<label class="block font-ui text-xs" style="color: var(--stage-chrome-mute)">
						Line height · <span class="tabular-nums">{prefs.lineHeight.toFixed(2)}</span>
						<input
							type="range"
							min="1.4"
							max="2.2"
							step="0.05"
							value={prefs.lineHeight}
							class="mt-1.5 w-full"
							style="accent-color: var(--stage-chrome-fg)"
							oninput={(e) =>
								updatePrefs({
									lineHeight: Number((e.currentTarget as HTMLInputElement).value)
								})}
						/>
					</label>
					<label class="block font-ui text-xs" style="color: var(--stage-chrome-mute)">
						Measure · <span class="tabular-nums">{prefs.measure}ch</span>
						<input
							type="range"
							min="45"
							max="90"
							step="1"
							value={prefs.measure}
							class="mt-1.5 w-full"
							style="accent-color: var(--stage-chrome-fg)"
							oninput={(e) =>
								updatePrefs({ measure: Number((e.currentTarget as HTMLInputElement).value) })}
						/>
					</label>
					<p
						class="border-t pt-2 font-ui text-[10px] uppercase tracking-[0.08em]"
						style="color: var(--stage-chrome-mute); border-color: var(--stage-rule)"
					>
						F focus · T contents · +/− size · Esc library
					</p>
				</div>
			</div>
		{/if}

		{#if tocOpen}
			<div
				class="absolute bottom-0 right-0 top-0 z-40 flex w-[min(100%,20rem)] flex-col border-l backdrop-blur-md"
				style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule)"
				role="dialog"
				aria-modal="true"
				aria-label="Contents"
			>
				<div
					class="flex items-center justify-between px-4 py-3"
					style="border-bottom: 1px solid var(--stage-rule)"
				>
					<p class="font-ui text-[11px] font-medium uppercase tracking-[0.12em]">Contents</p>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-70"
						aria-label="Close contents"
						onclick={() => (tocOpen = false)}
					>
						<X size={16} weight="light" />
					</button>
				</div>
				<div class="flex-1 overflow-y-auto p-2">
					{#if toc.length === 0}
						<p class="px-2 py-4 font-ui text-sm" style="color: var(--stage-chrome-mute)">
							{book.format === 'epub'
								? 'No table of contents in this file.'
								: 'Scroll the text document freely.'}
						</p>
					{:else}
						<ul class="space-y-0">
							{#each toc as item, i (i)}
								<li>
									<button
										type="button"
										class="w-full border-b px-3 py-2.5 text-left font-ui text-sm transition-opacity hover:opacity-70"
										style="color: var(--stage-chrome-mute); border-color: color-mix(in srgb, var(--stage-rule) 70%, transparent)"
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
