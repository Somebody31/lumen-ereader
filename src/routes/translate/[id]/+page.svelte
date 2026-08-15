<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getBook, listGlossary, replaceGlossary } from '$lib/client/idb';
	import { formatDisplayTitle } from '$lib/client/formatTitle';
	import { warnIfNotChinese, extractTranslatableChapters } from '$lib/client/epubTranslate';
	import {
		fetchTranslateStatus,
		isTranslating,
		pauseTranslation,
		reconcileStaleJob,
		resumeTranslation,
		retryTranslation,
		startTranslation,
		updateSelection
	} from '$lib/client/translateJob';
	import type { BookRecord, GlossaryEntry, TranslationJob } from '$lib/client/types';
	import Button from '$lib/components/ui/Button.svelte';
	import CoverPlate from '$lib/components/library/CoverPlate.svelte';
	import GlossaryEditor from '$lib/components/translate/GlossaryEditor.svelte';

	const id = $derived(page.params.id ?? '');

	let book = $state<BookRecord | null>(null);
	let job = $state<TranslationJob | null>(null);
	let glossary = $state<GlossaryEntry[]>([]);
	let configured = $state(false);
	let error = $state('');
	let notice = $state('');
	let loading = $state(true);
	let busy = $state(false);
	let rangeFrom = $state(1);
	let rangeTo = $state(1);
	let lastClick = $state<number | null>(null);
	let notChinese = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	const chapters = $derived(job?.chapters ?? []);
	const selectedCount = $derived(chapters.filter((c) => c.selected).length);
	const doneCount = $derived(chapters.filter((c) => c.selected && c.status === 'done').length);
	const running = $derived(book?.translation?.status === 'running' || isTranslating(id));
	const canStart = $derived(selectedCount > 0 && configured && !running && !busy);
	const progressPct = $derived(
		selectedCount > 0 ? Math.round((doneCount / selectedCount) * 100) : 0
	);

	async function refresh() {
		if (!id) return;
		book = (await getBook(id)) ?? null;
		if (!book) {
			error = 'Book not found.';
			loading = false;
			return;
		}
		job = await reconcileStaleJob(id);
		glossary = await listGlossary(id);
		rangeTo = Math.max(1, job.chapters.length);
		const extracted = await extractTranslatableChapters(book.blob);
		notChinese = warnIfNotChinese(extracted.chapters);
		loading = false;
	}

	onMount(() => {
		const onProg = (e: Event) => {
			const d = (e as CustomEvent<{ bookId?: string }>).detail;
			if (d?.bookId && d.bookId !== id) return;
			refresh();
		};
		window.addEventListener('lumen:translate-progress', onProg);
		(async () => {
			const status = await fetchTranslateStatus();
			configured = status.configured;
			await refresh();
		})();
		return () => {
			window.removeEventListener('lumen:translate-progress', onProg);
			clearTimeout(saveTimer);
		};
	});

	function selectedHrefs(): string[] {
		return chapters.filter((c) => c.selected).map((c) => c.href);
	}

	async function applyHrefs(hrefs: string[]) {
		if (!id) return;
		error = '';
		notice = '';
		try {
			job = await updateSelection(id, hrefs);
			book = (await getBook(id)) ?? book;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not update selection';
		}
	}

	function toggleAt(index: number, shiftKey: boolean) {
		const ch = chapters[index];
		if (!ch) return;
		if (ch.status === 'done' && ch.selected) {
			notice = 'Finished chapters stay selected — they will not be translated again.';
			return;
		}
		let next = new Set(selectedHrefs());
		if (shiftKey && lastClick !== null) {
			const a = Math.min(lastClick, index);
			const b = Math.max(lastClick, index);
			for (let i = a; i <= b; i++) {
				const row = chapters[i];
				if (row) next.add(row.href);
			}
		} else if (next.has(ch.href) && ch.status !== 'done') {
			next.delete(ch.href);
		} else {
			next.add(ch.href);
		}
		lastClick = index;
		if (next.size === 0) {
			error = 'Select at least one chapter to translate.';
			return;
		}
		void applyHrefs([...next]);
	}

	function selectAll() {
		void applyHrefs(chapters.map((c) => c.href));
	}

	function selectNone() {
		const keep = chapters.filter((c) => c.status === 'done').map((c) => c.href);
		if (!keep.length) {
			error = 'Select at least one chapter to translate.';
			notice = 'Finished chapters cannot be cleared.';
			return;
		}
		void applyHrefs(keep);
	}

	function applyRange() {
		const from = Math.max(1, Math.min(rangeFrom, chapters.length));
		const to = Math.max(from, Math.min(rangeTo, chapters.length));
		const hrefs = new Set(chapters.filter((c) => c.status === 'done').map((c) => c.href));
		for (let i = from - 1; i < to; i++) hrefs.add(chapters[i].href);
		void applyHrefs([...hrefs]);
	}

	async function onStart() {
		if (!id) return;
		busy = true;
		error = '';
		try {
			await startTranslation(id, selectedHrefs());
		} catch (e) {
			error = e instanceof Error ? e.message : 'Translation failed';
		} finally {
			busy = false;
			await refresh();
		}
	}

	async function onPause() {
		pauseTranslation(id);
		await refresh();
	}

	async function onResume() {
		busy = true;
		error = '';
		try {
			await resumeTranslation(id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Resume failed';
		} finally {
			busy = false;
			await refresh();
		}
	}

	async function onRetry() {
		busy = true;
		error = '';
		try {
			await retryTranslation(id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Retry failed';
		} finally {
			busy = false;
			await refresh();
		}
	}

	function onGlossaryChange(next: GlossaryEntry[]) {
		glossary = next;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			replaceGlossary(id, next.filter((e) => e.source.trim() && e.preferred.trim())).catch(() => {});
		}, 250);
	}

	function statusLabel(status: string) {
		if (status === 'done') return 'done';
		if (status === 'pending') return 'queued';
		if (status === 'error') return 'error';
		return 'skipped';
	}
</script>

<svelte:head>
	<title>{book ? `${formatDisplayTitle(book.title)} · Translate` : 'Translate · Lumen'}</title>
</svelte:head>

{#if loading}
	<p class="type-body text-ink-soft">Opening…</p>
{:else if !book}
	<p class="type-body text-danger">{error || 'Book not found.'}</p>
{:else}
	<div class="space-y-10">
		<header class="animate-plate-in flex flex-col gap-6 sm:flex-row sm:items-start">
			<div class="h-40 w-28 shrink-0 overflow-hidden rounded-md border border-rule">
				<CoverPlate title={book.title} author={book.author} coverDataUrl={book.coverDataUrl} />
			</div>
			<div class="min-w-0 flex-1">
				<p class="type-kicker text-crimson">Translate</p>
				<h1 class="type-masthead mt-2 text-[2.25rem] text-ink sm:text-[2.75rem]">
					{formatDisplayTitle(book.title)}
				</h1>
				<p class="type-eyebrow mt-2 text-ink-soft">{book.author || 'Unknown author'}</p>
				<p class="type-meta mt-4 text-ink-mute">
					<span class="tabular-nums">{selectedCount} selected</span>
					<span> · </span>
					<span class="tabular-nums">{doneCount} done</span>
					<span> · </span>
					<span class="tabular-nums">{chapters.length} in book</span>
				</p>
				{#if notChinese}
					<p class="mt-3 font-ui text-sm text-ink-soft">
						The first chapters look light on Chinese. You can still translate if this is the right file.
					</p>
				{/if}
				{#if !configured}
					<p class="mt-3 font-ui text-sm text-ink-soft">
						Set <code class="text-ink">DEEPSEEK_API_KEY</code> and confirm in
						<a href="/settings" class="underline decoration-rule underline-offset-4">Settings</a>.
					</p>
				{/if}
				<div class="mt-5 flex flex-wrap gap-2">
					{#if running}
						<Button type="button" variant="ghost" onclick={onPause}>Pause</Button>
					{:else if book.translation?.status === 'error'}
						<Button type="button" onclick={onRetry} disabled={busy || !configured}>Retry</Button>
						<Button type="button" variant="ghost" onclick={onResume} disabled={busy || !canStart}
							>Resume</Button
						>
					{:else if book.translation?.status === 'paused' || doneCount > 0}
						<Button type="button" onclick={onResume} disabled={!canStart}>Resume</Button>
						<Button type="button" variant="secondary" onclick={onStart} disabled={!canStart}
							>Start selection</Button
						>
					{:else}
						<Button type="button" onclick={onStart} disabled={!canStart}>Start translation</Button>
					{/if}
					<a href="/read/{book.id}" class="no-underline">
						<Button type="button" variant="ghost">Open in reader</Button>
					</a>
				</div>
			</div>
		</header>

		{#if error}
			<p class="font-ui text-sm text-danger" role="alert">{error}</p>
		{/if}
		{#if notice}
			<p class="font-ui text-sm text-ink-soft" role="status">{notice}</p>
		{/if}
		{#if book.translation?.error}
			<p class="font-ui text-sm text-danger" role="alert">{book.translation.error}</p>
		{/if}

		<section class="animate-plate-in stagger-1 space-y-4">
			<div class="h-1.5 overflow-hidden rounded-full bg-rule">
				<div class="h-full bg-crimson transition-[width] duration-300" style="width: {progressPct}%"></div>
			</div>
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 class="type-section text-xl text-ink">Chapters</h2>
					<p class="type-meta mt-1 text-ink-soft">
						Only checked chapters are sent to DeepSeek. Unchecked stay Chinese in the English file.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<Button type="button" variant="ghost" onclick={selectAll} disabled={running}>Select all</Button>
					<Button type="button" variant="ghost" onclick={selectNone} disabled={running}>Select none</Button>
					<label class="font-ui text-xs text-ink-soft">
						From
						<input
							type="number"
							min="1"
							max={chapters.length || 1}
							bind:value={rangeFrom}
							class="ml-1 w-16 rounded-md border border-rule bg-paper px-2 py-1 text-ink"
						/>
					</label>
					<label class="font-ui text-xs text-ink-soft">
						to
						<input
							type="number"
							min="1"
							max={chapters.length || 1}
							bind:value={rangeTo}
							class="ml-1 w-16 rounded-md border border-rule bg-paper px-2 py-1 text-ink"
						/>
					</label>
					<Button type="button" variant="ghost" onclick={applyRange} disabled={running}>Apply range</Button>
				</div>
			</div>

			{#if chapters.length === 0}
				<p class="type-body text-sm text-ink-mute">No translatable chapters found in this EPUB.</p>
			{:else}
				<ul class="chapter-picker divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-paper">
					{#each chapters as ch, i (ch.href)}
						<li>
							<button
								type="button"
								class="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-newsprint/70"
								disabled={running}
								onclick={(e) => toggleAt(i, e.shiftKey)}
							>
								<input
									type="checkbox"
									class="mt-1 accent-ink"
									checked={ch.selected}
									tabindex={-1}
									onclick={(e) => e.stopPropagation()}
									onchange={() => toggleAt(i, false)}
									disabled={running}
								/>
								<span class="w-8 shrink-0 font-ui text-[11px] tabular-nums text-ink-mute">
									{String(i + 1).padStart(2, '0')}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block font-ui text-[14px] text-ink">{ch.title}</span>
									<span class="type-meta text-[11px] text-ink-mute">
										<span class="tabular-nums">{ch.charCount}</span> chars
										<span> · </span>
										<span class="uppercase tracking-[0.06em]">{statusLabel(ch.status)}</span>
										{#if ch.error}
											<span class="text-danger"> · {ch.error}</span>
										{/if}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="animate-plate-in stagger-2 rounded-lg border border-rule bg-paper p-6 sm:p-8">
			<GlossaryEditor bookId={book.id} entries={glossary} onchange={onGlossaryChange} />
		</section>
	</div>
{/if}
