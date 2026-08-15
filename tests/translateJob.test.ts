import { describe, expect, test } from 'bun:test';
import {
	applyChapterSelection,
	jobMeta,
	nextPendingChapter,
	selectionError
} from '../src/lib/client/translateJob';
import type { TranslationChapter, TranslationJob } from '../src/lib/client/types';

function ch(
	href: string,
	partial: Partial<TranslationChapter> = {}
): TranslationChapter {
	return {
		href,
		title: href,
		charCount: 100,
		selected: false,
		status: 'skipped',
		...partial
	};
}

describe('chapter selection', () => {
	test('empty selection is rejected', () => {
		expect(selectionError([])).toMatch(/at least one/i);
		expect(selectionError(['a.xhtml'])).toBeNull();
	});

	test('skipped chapters are not queued', () => {
		const next = applyChapterSelection(
			[ch('a.xhtml'), ch('b.xhtml'), ch('c.xhtml')],
			['b.xhtml']
		);
		expect(next.find((c) => c.href === 'a.xhtml')?.status).toBe('skipped');
		expect(next.find((c) => c.href === 'a.xhtml')?.selected).toBe(false);
		expect(next.find((c) => c.href === 'b.xhtml')?.status).toBe('pending');
		expect(next.find((c) => c.href === 'b.xhtml')?.selected).toBe(true);
		expect(nextPendingChapter(next)?.href).toBe('b.xhtml');
		expect(next.filter((c) => c.status === 'pending')).toHaveLength(1);
	});

	test('adding a new selection after pause does not reset done', () => {
		const paused = [
			ch('a.xhtml', { selected: true, status: 'done' }),
			ch('b.xhtml', { selected: false, status: 'skipped' }),
			ch('c.xhtml', { selected: false, status: 'skipped' })
		];
		const next = applyChapterSelection(paused, ['b.xhtml']);
		expect(next.find((c) => c.href === 'a.xhtml')?.status).toBe('done');
		expect(next.find((c) => c.href === 'a.xhtml')?.selected).toBe(true);
		expect(next.find((c) => c.href === 'b.xhtml')?.status).toBe('pending');
		expect(next.find((c) => c.href === 'c.xhtml')?.status).toBe('skipped');
	});

	test('unchecking a done chapter is a no-op', () => {
		const done = [ch('a.xhtml', { selected: true, status: 'done' })];
		const next = applyChapterSelection(done, []);
		expect(next[0].status).toBe('done');
		expect(next[0].selected).toBe(true);
	});

	test('job meta counts selection not whole spine', () => {
		const job: TranslationJob = {
			bookId: 'b',
			updatedAt: 1,
			chapters: [
				ch('a.xhtml', { selected: true, status: 'done' }),
				ch('b.xhtml', { selected: true, status: 'pending' }),
				ch('c.xhtml', { selected: false, status: 'skipped' })
			]
		};
		const meta = jobMeta(job, 'running');
		expect(meta.chaptersSelected).toBe(2);
		expect(meta.chaptersDone).toBe(1);
		expect(meta.status).toBe('running');
	});
});
