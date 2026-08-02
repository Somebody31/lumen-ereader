<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		deleteBookmark,
		getBook,
		getPrefs,
		listBookmarks,
		putBookmark,
		putPrefs,
		putProgress,
		getProgress
	} from '$lib/client/idb';
	import { pushProgress } from '$lib/client/sync';
	import { formatDisplayTitle } from '$lib/client/formatTitle';
	import {
		fontStack,
		READING_FONTS,
		type BookmarkRecord,
		type BookRecord,
		type ReaderPrefs,
		type ReadingFont,
		type ReadingTheme
	} from '$lib/client/types';
	import TextReader from '$lib/components/reader/TextReader.svelte';
	import EpubReader from '$lib/components/reader/EpubReader.svelte';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import BookmarkSimple from 'phosphor-svelte/lib/BookmarkSimple';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import List from 'phosphor-svelte/lib/List';
	import TextAa from 'phosphor-svelte/lib/TextAa';
	import Trash from 'phosphor-svelte/lib/Trash';
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
	let tocTab = $state<'contents' | 'bookmarks'>('contents');
	let toc = $state<{ label: string; href: string }[]>([]);
	let bookmarks = $state<BookmarkRecord[]>([]);
	let fraction = $state(0);
	let progressLabel = $state('');
	let epubRef: EpubReader | undefined = $state();
	let bookmarkFlash = $state('');

	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let lastLocation = '';
	let wakeLock: WakeLockSentinel | null = null;

	const id = $derived(page.params.id ?? '');
	const stageClass = $derived(`stage-${prefs?.theme ?? 'night'}`);
	const pct = $derived(Math.round(fraction * 100));
	const dimOpacity = $derived(Math.max(0, 1 - (prefs?.brightness ?? 1)));

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

	async function refreshBookmarks() {
		if (!id) return;
		const list = await listBookmarks(id);
		bookmarks = list.sort((a, b) => b.createdAt - a.createdAt);
	}

	async function applyWakeLock(on: boolean) {
		try {
			if (on && 'wakeLock' in navigator) {
				if (wakeLock) return;
				wakeLock = await navigator.wakeLock.request('screen');
				wakeLock.addEventListener('release', () => {
					wakeLock = null;
				});
			} else if (wakeLock) {
				await wakeLock.release();
				wakeLock = null;
			}
		} catch {
			/* denied or unsupported */
		}
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
		if (b.format === 'text' || b.format === 'markdown') {
			textRaw = await b.blob.text();
		}
		await refreshBookmarks();
		if (prefs.keepAwake) await applyWakeLock(true);
		loading = false;
		bumpChrome();
	}

	onMount(() => {
		load();

		const onVis = () => {
			if (document.visibilityState === 'visible' && prefs?.keepAwake) {
				applyWakeLock(true);
			}
		};
		document.addEventListener('visibilitychange', onVis);

		return () => {
			clearTimeout(hideTimer);
			clearTimeout(saveTimer);
			document.removeEventListener('visibilitychange', onVis);
			applyWakeLock(false);
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
		if ('keepAwake' in partial) {
			await applyWakeLock(!!prefs.keepAwake);
		}
	}

	async function addBookmarkHere() {
		if (!book) return;
		const location =
			lastLocation ||
			(book.format === 'epub' ? '' : `scroll:${fraction.toFixed(4)}`);
		if (!location && book.format === 'epub') {
			// EPUB not relocated yet — still allow a start mark
		}
		const bm: BookmarkRecord = {
			id: crypto.randomUUID(),
			bookId: book.id,
			location: location || 'start',
			label: progressLabel || `${Math.round(fraction * 100)}%`,
			createdAt: Date.now()
		};
		await putBookmark(bm);
		await refreshBookmarks();
		bookmarkFlash = 'Saved bookmark';
		setTimeout(() => (bookmarkFlash = ''), 1600);
	}

	async function removeBookmark(bmId: string) {
		await deleteBookmark(bmId);
		await refreshBookmarks();
	}

	function goBookmark(bm: BookmarkRecord) {
		if (book?.format === 'epub') {
			epubRef?.goTo(bm.location);
		} else {
			// Text: location is scroll:fraction
			const m = /^scroll:([\d.]+)$/.exec(bm.location);
			if (m) {
				const f = Number(m[1]);
				scheduleSave(f, bm.location, bm.label);
				// Reload path: TextReader only restores initialFraction once —
				// soft jump via re-key would need component API; for now set hash-style by full navigation
				const scroller = document.querySelector('.reader-scroll') as HTMLElement | null;
				if (scroller) {
					const max = scroller.scrollHeight - scroller.clientHeight;
					scroller.scrollTop = Math.max(0, Math.min(max, f * max));
				}
			}
		}
		tocOpen = false;
		bumpChrome();
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
			if (tocOpen) tocTab = 'contents';
			return;
		}
		if (e.key === 'b' || e.key === 'B') {
			if (e.shiftKey) {
				tocOpen = true;
				typeOpen = false;
				tocTab = 'bookmarks';
			} else {
				addBookmarkHere();
			}
			return;
		}
		if (e.key === ',' || e.key === '<') {
			typeOpen = !typeOpen;
			tocOpen = false;
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

	function sampleStyle(p: ReaderPrefs) {
		return [
			`font-family: ${fontStack(p.fontFamily)}`,
			`font-size: ${p.fontSize}px`,
			`line-height: ${p.lineHeight}`,
			`letter-spacing: ${p.letterSpacing ?? 0}em`,
			`max-width: ${p.measure}ch`,
			`text-align: ${p.textAlign ?? 'left'}`,
			`hyphens: ${p.hyphenate ? 'auto' : 'manual'}`,
			`color: var(--stage-chrome-fg)`
		].join('; ');
	}
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
	<!-- progress hairline + crimson bead (broadsheet meter) -->
	<div
		class="reader-progress"
		role="progressbar"
		aria-valuenow={pct}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Reading progress"
		data-progress={pct}
		style="--reader-progress: {pct > 0 ? Math.max(fraction, 0.012) : 0}"
	>
		<div class="reader-progress-fill"></div>
		<div class="reader-progress-bead" aria-hidden="true"></div>
	</div>

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
		<!-- Left rail: replaces top floating chrome -->
		<aside
			class="reader-rail {chromeVisible && !focusMode
				? 'is-visible'
				: 'is-hidden'}"
			aria-label="Reading controls"
			style="color: var(--stage-chrome-fg)"
		>
			<a
				href="/"
				class="reader-rail-btn"
				style="color: var(--stage-chrome-mute)"
				aria-label="Back to library"
				title="Library (Esc)"
			>
				<ArrowLeft size={18} weight="light" />
			</a>

			<div class="reader-rail-mid">
				<button
					type="button"
					class="reader-rail-btn"
					style="color: {tocOpen ? 'var(--stage-chrome-fg)' : 'var(--stage-chrome-mute)'}"
					aria-label="Table of contents and bookmarks"
					aria-pressed={tocOpen}
					title="Contents (T)"
					onclick={(e) => {
						e.stopPropagation();
						tocOpen = !tocOpen;
						typeOpen = false;
						if (tocOpen) tocTab = 'contents';
						bumpChrome();
					}}
				>
					<List size={18} weight="light" />
				</button>
				<button
					type="button"
					class="reader-rail-btn"
					style="color: {typeOpen ? 'var(--stage-chrome-fg)' : 'var(--stage-chrome-mute)'}"
					aria-label="Typography and theme"
					aria-pressed={typeOpen}
					title="Type (,)"
					onclick={(e) => {
						e.stopPropagation();
						typeOpen = !typeOpen;
						tocOpen = false;
						bumpChrome();
					}}
				>
					<TextAa size={18} weight="light" />
				</button>
				<button
					type="button"
					class="reader-rail-btn"
					style="color: var(--stage-chrome-mute)"
					aria-label="Save bookmark"
					title="Bookmark (B)"
					onclick={(e) => {
						e.stopPropagation();
						addBookmarkHere();
						bumpChrome();
					}}
				>
					<BookmarkSimple size={18} weight="light" />
				</button>
			</div>

			<div class="reader-rail-foot" aria-hidden="true">
				<span class="reader-rail-pct" style="color: var(--stage-chrome-mute)">{pct}%</span>
				<span class="reader-rail-meter" style="background: color-mix(in srgb, var(--stage-fg) 12%, transparent)">
					<span
						class="reader-rail-meter-fill"
						style="height: {Math.max(pct, 0)}%; background: var(--color-crimson)"
					></span>
				</span>
			</div>
		</aside>

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
				{#if !focusMode}
					<button
						type="button"
						class="absolute bottom-16 left-12 top-16 z-20 w-12 opacity-0 transition-opacity duration-200 hover:opacity-100 sm:left-14 sm:w-16"
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

		<!-- Brightness dim (under chrome, over text) -->
		{#if dimOpacity > 0.01}
			<div
				class="pointer-events-none absolute inset-0 z-[15]"
				style="background: rgba(0,0,0,{dimOpacity})"
				aria-hidden="true"
			></div>
		{/if}

		{#if bookmarkFlash}
			<div
				class="pointer-events-none absolute bottom-8 left-1/2 z-50 -translate-x-1/2 border px-3 py-1.5 font-ui text-[11px] backdrop-blur-md"
				style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule); border-radius: var(--radius-sm)"
				role="status"
			>
				{bookmarkFlash}
			</div>
		{/if}

		<!-- Scrim when a drawer is open -->
		{#if typeOpen || tocOpen}
			<button
				type="button"
				class="reader-drawer-scrim"
				aria-label="Close panel"
				onclick={() => {
					typeOpen = false;
					tocOpen = false;
				}}
			></button>
		{/if}

		{#if typeOpen}
			<div
				class="reader-drawer reader-drawer-left"
				style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule)"
				role="dialog"
				aria-modal="true"
				aria-label="Reading settings"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="reader-drawer-head" style="border-color: var(--stage-rule)">
					<div class="min-w-0 flex-1 pr-2">
						<p class="type-kicker" style="color: var(--stage-chrome-mute)">Reading</p>
						<p class="type-chrome-title mt-1 truncate text-[1.05rem]" style="color: var(--stage-chrome-fg)">
							{formatDisplayTitle(book.title)}
						</p>
						<p class="type-meta mt-0.5 truncate" style="color: var(--stage-chrome-mute)">{subline}</p>
					</div>
					<button
						type="button"
						class="reader-rail-btn shrink-0"
						style="color: var(--stage-chrome-mute)"
						aria-label="Close"
						onclick={() => (typeOpen = false)}
					>
						<X size={16} weight="light" />
					</button>
				</div>

				<div
					class="shrink-0 border-b px-4 py-3.5"
					style="border-color: var(--stage-rule); background: color-mix(in srgb, var(--stage-fg) 4%, transparent)"
				>
					<p class="type-reading" lang="en" style={sampleStyle(prefs)}>
						{sampleLine}
					</p>
				</div>

				<div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
					<div>
						<p
							class="mb-2 font-ui text-[10px] font-medium uppercase tracking-[0.1em]"
							style="color: var(--stage-chrome-mute)"
						>
							Theme
						</p>
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
					</div>

					<div>
						<p
							class="mb-2 font-ui text-[10px] font-medium uppercase tracking-[0.1em]"
							style="color: var(--stage-chrome-mute)"
						>
							Typeface
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each READING_FONTS as f (f.id)}
								<button
									type="button"
									class="rounded-md border px-2.5 py-1.5 font-ui text-[12px] transition-opacity hover:opacity-80"
									style="border-color: var(--stage-rule); color: var(--stage-chrome-fg); background: {prefs.fontFamily ===
									f.id
										? 'color-mix(in srgb, var(--stage-fg) 10%, transparent)'
										: 'transparent'}; font-family: {f.stack}"
									aria-pressed={prefs.fontFamily === f.id}
									onclick={() => updatePrefs({ fontFamily: f.id as ReadingFont })}
								>
									{f.label}
								</button>
							{/each}
						</div>
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
						Letter spacing · <span class="tabular-nums"
							>{(prefs.letterSpacing ?? 0).toFixed(3)}em</span
						>
						<input
							type="range"
							min="0"
							max="0.08"
							step="0.005"
							value={prefs.letterSpacing ?? 0}
							class="mt-1.5 w-full"
							style="accent-color: var(--stage-chrome-fg)"
							oninput={(e) =>
								updatePrefs({
									letterSpacing: Number((e.currentTarget as HTMLInputElement).value)
								})}
						/>
					</label>
					<label class="block font-ui text-xs" style="color: var(--stage-chrome-mute)">
						Paragraph space · <span class="tabular-nums"
							>{(prefs.paragraphSpacing ?? 1).toFixed(2)}em</span
						>
						<input
							type="range"
							min="0.4"
							max="2"
							step="0.1"
							value={prefs.paragraphSpacing ?? 1}
							class="mt-1.5 w-full"
							style="accent-color: var(--stage-chrome-fg)"
							oninput={(e) =>
								updatePrefs({
									paragraphSpacing: Number((e.currentTarget as HTMLInputElement).value)
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
					<label class="block font-ui text-xs" style="color: var(--stage-chrome-mute)">
						Margin · <span class="tabular-nums">{prefs.margin}px</span>
						<input
							type="range"
							min="12"
							max="48"
							step="2"
							value={prefs.margin}
							class="mt-1.5 w-full"
							style="accent-color: var(--stage-chrome-fg)"
							oninput={(e) =>
								updatePrefs({ margin: Number((e.currentTarget as HTMLInputElement).value) })}
						/>
					</label>

					<div class="flex flex-wrap items-center gap-2">
						<p
							class="w-full font-ui text-[10px] font-medium uppercase tracking-[0.1em]"
							style="color: var(--stage-chrome-mute)"
						>
							Composition
						</p>
						<button
							type="button"
							class="rounded-md border px-2.5 py-1.5 font-ui text-[12px]"
							style="border-color: var(--stage-rule); background: {(prefs.textAlign ?? 'left') ===
							'left'
								? 'color-mix(in srgb, var(--stage-fg) 10%, transparent)'
								: 'transparent'}; color: var(--stage-chrome-fg)"
							aria-pressed={(prefs.textAlign ?? 'left') === 'left'}
							onclick={() => updatePrefs({ textAlign: 'left' })}
						>
							Left
						</button>
						<button
							type="button"
							class="rounded-md border px-2.5 py-1.5 font-ui text-[12px]"
							style="border-color: var(--stage-rule); background: {prefs.textAlign === 'justify'
								? 'color-mix(in srgb, var(--stage-fg) 10%, transparent)'
								: 'transparent'}; color: var(--stage-chrome-fg)"
							aria-pressed={prefs.textAlign === 'justify'}
							onclick={() => updatePrefs({ textAlign: 'justify' })}
						>
							Justify
						</button>
						<button
							type="button"
							class="rounded-md border px-2.5 py-1.5 font-ui text-[12px]"
							style="border-color: var(--stage-rule); background: {prefs.hyphenate
								? 'color-mix(in srgb, var(--stage-fg) 10%, transparent)'
								: 'transparent'}; color: var(--stage-chrome-fg)"
							aria-pressed={!!prefs.hyphenate}
							onclick={() => updatePrefs({ hyphenate: !prefs!.hyphenate })}
						>
							Hyphenate
						</button>
					</div>

					<label class="block font-ui text-xs" style="color: var(--stage-chrome-mute)">
						Brightness · <span class="tabular-nums"
							>{Math.round((prefs.brightness ?? 1) * 100)}%</span
						>
						<input
							type="range"
							min="0.55"
							max="1"
							step="0.05"
							value={prefs.brightness ?? 1}
							class="mt-1.5 w-full"
							style="accent-color: var(--stage-chrome-fg)"
							oninput={(e) =>
								updatePrefs({
									brightness: Number((e.currentTarget as HTMLInputElement).value)
								})}
						/>
					</label>

					<label
						class="flex cursor-pointer items-center justify-between gap-3 font-ui text-xs"
						style="color: var(--stage-chrome-mute)"
					>
						<span>
							Keep screen awake
							<span class="mt-0.5 block text-[10px] opacity-80"
								>Uses the Wake Lock API when available</span
							>
						</span>
						<input
							type="checkbox"
							class="h-4 w-4 shrink-0"
							style="accent-color: var(--stage-chrome-fg)"
							checked={!!prefs.keepAwake}
							onchange={(e) =>
								updatePrefs({ keepAwake: (e.currentTarget as HTMLInputElement).checked })}
						/>
					</label>

					<p
						class="border-t pt-2 font-ui text-[10px] uppercase tracking-[0.08em]"
						style="color: var(--stage-chrome-mute); border-color: var(--stage-rule)"
					>
						F focus · T contents · B bookmark · Shift+B marks · , type · +/− size · Esc library
					</p>
				</div>
			</div>
		{/if}

		{#if tocOpen}
			<div
				class="reader-drawer reader-drawer-right"
				style="background: var(--stage-chrome); color: var(--stage-chrome-fg); border-color: var(--stage-rule)"
				role="dialog"
				aria-modal="true"
				aria-label="Contents and bookmarks"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="reader-drawer-head" style="border-color: var(--stage-rule)">
					<div class="min-w-0 flex-1">
						<p class="type-kicker" style="color: var(--stage-chrome-mute)">Navigate</p>
						<p class="type-chrome-title mt-1 truncate text-[1.05rem]" style="color: var(--stage-chrome-fg)">
							{formatDisplayTitle(book.title)}
						</p>
						<div class="mt-3 flex gap-4">
							<button
								type="button"
								class="font-ui text-[11px] font-medium uppercase tracking-[0.12em] transition-opacity"
								style="color: {tocTab === 'contents'
									? 'var(--stage-chrome-fg)'
									: 'var(--stage-chrome-mute)'}; border-bottom: 1.5px solid {tocTab === 'contents'
									? 'var(--color-crimson)'
									: 'transparent'}; padding-bottom: 0.2rem"
								onclick={() => (tocTab = 'contents')}
							>
								Contents
							</button>
							<button
								type="button"
								class="font-ui text-[11px] font-medium uppercase tracking-[0.12em] transition-opacity"
								style="color: {tocTab === 'bookmarks'
									? 'var(--stage-chrome-fg)'
									: 'var(--stage-chrome-mute)'}; border-bottom: 1.5px solid {tocTab === 'bookmarks'
									? 'var(--color-crimson)'
									: 'transparent'}; padding-bottom: 0.2rem"
								onclick={() => (tocTab = 'bookmarks')}
							>
								Marks · {bookmarks.length}
							</button>
						</div>
					</div>
					<button
						type="button"
						class="reader-rail-btn shrink-0 self-start"
						style="color: var(--stage-chrome-mute)"
						aria-label="Close contents"
						onclick={() => (tocOpen = false)}
					>
						<X size={16} weight="light" />
					</button>
				</div>
				<div class="flex-1 overflow-y-auto p-2">
					{#if tocTab === 'contents'}
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
					{:else}
						<div class="mb-2 px-2">
							<button
								type="button"
								class="w-full rounded-md border px-3 py-2 font-ui text-[13px] transition-opacity hover:opacity-80"
								style="border-color: var(--stage-rule); color: var(--stage-chrome-fg)"
								onclick={() => addBookmarkHere()}
							>
								Bookmark this place
							</button>
						</div>
						{#if bookmarks.length === 0}
							<p class="px-2 py-4 font-ui text-sm" style="color: var(--stage-chrome-mute)">
								No bookmarks yet. Press B while reading.
							</p>
						{:else}
							<ul class="space-y-0">
								{#each bookmarks as bm (bm.id)}
									<li
										class="flex items-stretch border-b"
										style="border-color: color-mix(in srgb, var(--stage-rule) 70%, transparent)"
									>
										<button
											type="button"
											class="min-w-0 flex-1 px-3 py-2.5 text-left transition-opacity hover:opacity-70"
											onclick={() => goBookmark(bm)}
										>
											<span
												class="block font-ui text-sm"
												style="color: var(--stage-chrome-fg)">{bm.label}</span
											>
											<span
												class="mt-0.5 block font-ui text-[11px]"
												style="color: var(--stage-chrome-mute)"
											>
												{new Date(bm.createdAt).toLocaleString(undefined, {
													month: 'short',
													day: 'numeric',
													hour: '2-digit',
													minute: '2-digit'
												})}
											</span>
										</button>
										<button
											type="button"
											class="flex w-10 shrink-0 items-center justify-center transition-opacity hover:opacity-70"
											style="color: var(--stage-chrome-mute)"
											aria-label="Delete bookmark"
											onclick={() => removeBookmark(bm.id)}
										>
											<Trash size={15} weight="light" />
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
