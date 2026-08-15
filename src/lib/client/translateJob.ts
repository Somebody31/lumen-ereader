import {
	getBook,
	getTranslationJob,
	listGlossary,
	putBook,
	putGlossaryEntries,
	putTranslationJob
} from './idb';
import { extractTranslatableChapters, extractBodyInner, patchEpubChapters, readEpubChapter, replaceBodyInner, splitHtmlChunks } from './epubTranslate';
import { glossaryForPrompt, mergeGlossaryUpdates } from './glossary';
import type {
	EpubSpineChapter
} from './epubTranslate';
import type {
	GlossaryEntry,
	TranslationChapter,
	TranslationJob,
	TranslationMeta
} from './types';

export function applyChapterSelection(
	chapters: TranslationChapter[],
	selectedHrefs: string[]
): TranslationChapter[] {
	const set = new Set(selectedHrefs);
	return chapters.map((ch) => {
		if (ch.status === 'done') {
			return { ...ch, selected: true };
		}
		if (set.has(ch.href)) {
			return {
				...ch,
				selected: true,
				status: ch.status === 'error' ? 'error' : 'pending',
				error: ch.status === 'error' ? ch.error : undefined
			};
		}
		return { ...ch, selected: false, status: 'skipped', error: undefined };
	});
}

export function selectionError(selectedHrefs: string[]): string | null {
	if (!selectedHrefs.length) return 'Select at least one chapter to translate.';
	return null;
}

export function nextPendingChapter(
	chapters: TranslationChapter[]
): TranslationChapter | undefined {
	return (
		chapters.find((c) => c.selected && c.status === 'pending') ??
		chapters.find((c) => c.selected && c.status === 'error')
	);
}

export function jobMeta(job: TranslationJob, status: TranslationMeta['status']): TranslationMeta {
	const selected = job.chapters.filter((c) => c.selected);
	const done = selected.filter((c) => c.status === 'done').length;
	const finished = selected.length > 0 && done >= selected.length;
	return {
		status: finished ? 'done' : status,
		chaptersSelected: selected.length,
		chaptersDone: done,
		error: status === 'error' ? job.lastError : undefined,
		updatedAt: Date.now()
	};
}

export function chaptersFromExtract(extracted: EpubSpineChapter[]): TranslationChapter[] {
	return extracted.map((c) => ({
		href: c.href,
		title: c.title,
		charCount: c.charCount,
		selected: false,
		status: 'skipped' as const
	}));
}

export function mergeExtractedChapters(
	existing: TranslationChapter[],
	extracted: EpubSpineChapter[]
): TranslationChapter[] {
	const byHref = new Map(existing.map((c) => [c.href, c]));
	const out: TranslationChapter[] = extracted.map((c) => {
		const prev = byHref.get(c.href);
		if (prev) {
			return { ...prev, title: c.title || prev.title, charCount: c.charCount };
		}
		return {
			href: c.href,
			title: c.title,
			charCount: c.charCount,
			selected: false,
			status: 'skipped' as const
		};
	});
	return out;
}

const controllers = new Map<string, AbortController>();
let activeBookId: string | null = null;

export function isTranslating(bookId?: string): boolean {
	if (bookId) return controllers.has(bookId);
	return controllers.size > 0;
}

export function pauseTranslation(bookId: string): void {
	controllers.get(bookId)?.abort();
	controllers.delete(bookId);
	if (activeBookId === bookId) activeBookId = null;
}

function emitProgress(bookId: string, notice?: string) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('lumen:translate-progress', { detail: { bookId } }));
	window.dispatchEvent(
		new CustomEvent('lumen:books-changed', { detail: { notice: notice ?? '' } })
	);
}

async function persistJob(job: TranslationJob, status: TranslationMeta['status']): Promise<void> {
	job.updatedAt = Date.now();
	await putTranslationJob(job);
	const book = await getBook(job.bookId);
	if (book) {
		book.translation = jobMeta(job, status);
		book.updatedAt = Date.now();
		await putBook(book);
	}
	emitProgress(job.bookId);
}

export async function fetchTranslateStatus(): Promise<{ configured: boolean; model: string }> {
	try {
		const res = await fetch('/api/translate/status');
		if (!res.ok) return { configured: false, model: 'deepseek-v4-flash' };
		return (await res.json()) as { configured: boolean; model: string };
	} catch {
		return { configured: false, model: 'deepseek-v4-flash' };
	}
}

export async function reconcileStaleJob(bookId: string): Promise<TranslationJob> {
	const job = await ensureJob(bookId);
	if (!isTranslating(bookId)) {
		const book = await getBook(bookId);
		if (book?.translation?.status === 'running') {
			await persistJob(job, 'paused');
		}
	}
	return (await getTranslationJob(bookId)) ?? job;
}

export async function ensureJob(bookId: string): Promise<TranslationJob> {
	const book = await getBook(bookId);
	if (!book) throw new Error('Book not found');
	if (book.format !== 'epub') throw new Error('Only EPUB files can be translated');
	const extracted = await extractTranslatableChapters(book.blob);
	const existing = await getTranslationJob(bookId);
	const chapters = existing
		? mergeExtractedChapters(existing.chapters, extracted.chapters)
		: chaptersFromExtract(extracted.chapters);
	const job: TranslationJob = {
		bookId,
		chapters,
		startedAt: existing?.startedAt,
		updatedAt: Date.now(),
		lastError: existing?.lastError
	};
	await putTranslationJob(job);
	if (!book.sourceLang) {
		book.sourceLang = 'zh';
		book.updatedAt = Date.now();
		await putBook(book);
	}
	return job;
}

export async function updateSelection(bookId: string, selectedHrefs: string[]): Promise<TranslationJob> {
	const err = selectionError(selectedHrefs);
	if (err) throw new Error(err);
	const job = await ensureJob(bookId);
	job.chapters = applyChapterSelection(job.chapters, selectedHrefs);
	const status = job.chapters.some((c) => c.selected && c.status === 'done')
		? job.chapters.filter((c) => c.selected).every((c) => c.status === 'done')
			? 'done'
			: 'paused'
		: 'idle';
	await persistJob(job, status);
	return job;
}

async function translateHtml(
	html: string,
	title: string,
	glossary: GlossaryEntry[]
): Promise<{ html: string; glossaryUpdates: Parameters<typeof mergeGlossaryUpdates>[1] }> {
	const { inner, hasBody } = extractBodyInner(html);
	const chunks = splitHtmlChunks(inner);
	const out: string[] = [];
	let updates: Parameters<typeof mergeGlossaryUpdates>[1] = [];
	for (const chunk of chunks) {
		const res = await fetch('/api/translate/chapter', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title,
				html: chunk,
				glossary: glossaryForPrompt(glossary)
			})
		});
		const data = (await res.json().catch(() => ({}))) as {
			html?: string;
			glossaryUpdates?: Parameters<typeof mergeGlossaryUpdates>[1];
			error?: string;
		};
		if (!res.ok || !data.html) {
			throw new Error(data.error || `Translation failed (${res.status})`);
		}
		out.push(data.html);
		if (data.glossaryUpdates?.length) updates = updates.concat(data.glossaryUpdates);
	}
	const stitched = out.join('');
	return { html: hasBody ? replaceBodyInner(html, stitched) : stitched, glossaryUpdates: updates };
}

async function runLoop(bookId: string, signal: AbortSignal): Promise<void> {
	while (!signal.aborted) {
		const job = await getTranslationJob(bookId);
		if (!job) return;
		const next = nextPendingChapter(job.chapters);
		if (!next) {
			await persistJob(job, 'done');
			return;
		}

		const book = await getBook(bookId);
		if (!book) throw new Error('Book not found');

		const sourceHtml = await readEpubChapter(book.blob, next.href);
		if (!sourceHtml) {
			next.status = 'error';
			next.error = 'Chapter missing from EPUB';
			job.lastError = next.error;
			await persistJob(job, 'error');
			return;
		}

		let glossary = await listGlossary(bookId);
		try {
			const result = await translateHtml(sourceHtml, next.title, glossary);
			if (signal.aborted) return;
			glossary = mergeGlossaryUpdates(glossary, result.glossaryUpdates, bookId);
			await putGlossaryEntries(glossary);

			const base = book.translatedBlob ?? book.blob;
			const patched = await patchEpubChapters(base, { [next.href]: result.html }, { language: 'en' });
			next.status = 'done';
			next.error = undefined;
			job.lastError = undefined;
			book.translatedBlob = patched;
			book.sourceLang = book.sourceLang ?? 'zh';
			book.translation = jobMeta(job, 'running');
			book.updatedAt = Date.now();
			await putBook(book);
			await persistJob(job, 'running');
		} catch (e) {
			if (signal.aborted) return;
			next.status = 'error';
			next.error = e instanceof Error ? e.message : 'Translation failed';
			job.lastError = next.error;
			await persistJob(job, 'error');
			return;
		}
	}
}

export async function startTranslation(bookId: string, selectedHrefs: string[]): Promise<void> {
	const err = selectionError(selectedHrefs);
	if (err) throw new Error(err);
	if (controllers.has(bookId)) return;

	const job = await updateSelection(bookId, selectedHrefs);
	job.startedAt = job.startedAt ?? Date.now();
	await persistJob(job, 'running');

	const ac = new AbortController();
	controllers.set(bookId, ac);
	activeBookId = bookId;
	try {
		await runLoop(bookId, ac.signal);
		if (ac.signal.aborted) {
			const paused = await getTranslationJob(bookId);
			if (paused) await persistJob(paused, 'paused');
		}
	} finally {
		controllers.delete(bookId);
		if (activeBookId === bookId) activeBookId = null;
	}
}

export async function resumeTranslation(bookId: string): Promise<void> {
	const job = await ensureJob(bookId);
	const hrefs = job.chapters.filter((c) => c.selected).map((c) => c.href);
	await startTranslation(bookId, hrefs);
}

export async function retryTranslation(bookId: string): Promise<void> {
	const job = await ensureJob(bookId);
	for (const ch of job.chapters) {
		if (ch.selected && ch.status === 'error') {
			ch.status = 'pending';
			ch.error = undefined;
		}
	}
	job.lastError = undefined;
	await persistJob(job, 'running');
	const hrefs = job.chapters.filter((c) => c.selected).map((c) => c.href);
	await startTranslation(bookId, hrefs);
}

if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		if (activeBookId) pauseTranslation(activeBookId);
	});
}
