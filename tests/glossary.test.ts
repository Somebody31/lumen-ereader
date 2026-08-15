import { describe, expect, test } from 'bun:test';
import {
	applyReaderEdit,
	exportGlossaryJson,
	findGlossaryMatch,
	glossaryForPrompt,
	mergeGlossaryUpdates,
	parseGlossaryImport,
	readerGlossary
} from '../src/lib/client/glossary';
import type { GlossaryEntry } from '../src/lib/client/types';

function entry(partial: Partial<GlossaryEntry> & Pick<GlossaryEntry, 'source' | 'preferred'>): GlossaryEntry {
	return {
		id: partial.id ?? crypto.randomUUID(),
		bookId: partial.bookId ?? 'b1',
		source: partial.source,
		preferred: partial.preferred,
		aliases: partial.aliases,
		category: partial.category ?? 'name',
		locked: partial.locked ?? false,
		notes: partial.notes,
		showInReader: partial.showInReader ?? true,
		createdAt: partial.createdAt ?? 1,
		updatedAt: partial.updatedAt ?? 1
	};
}

describe('glossary merge', () => {
	test('adds brand-new terms', () => {
		const next = mergeGlossaryUpdates(
			[],
			[{ source: '林动', preferred: 'Lin Dong', category: 'name' }],
			'b1',
			10
		);
		expect(next).toHaveLength(1);
		expect(next[0].preferred).toBe('Lin Dong');
		expect(next[0].showInReader).toBe(true);
		expect(next[0].locked).toBe(false);
	});

	test('lock wins — existing locked entry is not overwritten', () => {
		const existing = [entry({ source: '林动', preferred: 'Lin Dong', locked: true })];
		const next = mergeGlossaryUpdates(
			existing,
			[{ source: '林动', preferred: 'Forest Motion', category: 'name' }],
			'b1'
		);
		expect(next).toHaveLength(1);
		expect(next[0].preferred).toBe('Lin Dong');
	});

	test('does not overwrite an unlocked existing preferred', () => {
		const existing = [entry({ source: '林动', preferred: 'Lin Dong', locked: false })];
		const next = mergeGlossaryUpdates(
			existing,
			[{ source: '林动', preferred: 'Lin Donger' }],
			'b1'
		);
		expect(next[0].preferred).toBe('Lin Dong');
	});

	test('alias match counts as existing', () => {
		const existing = [entry({ source: '林动', preferred: 'Lin Dong', aliases: ['小动'] })];
		const next = mergeGlossaryUpdates(existing, [{ source: '小动', preferred: 'Xiao Dong' }], 'b1');
		expect(next).toHaveLength(1);
		expect(findGlossaryMatch(next, '小动')?.preferred).toBe('Lin Dong');
	});

	test('reader view hides translator-only fields and showInReader=false', () => {
		const items = readerGlossary([
			entry({ source: '林动', preferred: 'Lin Dong', notes: 'MC', locked: true }),
			entry({ source: '内力', preferred: 'internal force', category: 'term', showInReader: false })
		]);
		expect(items).toHaveLength(1);
		expect(items[0].source).toBe('林动');
		expect(items[0].preferred).toBe('Lin Dong');
		expect(items[0].category).toBe('name');
		expect(items[0].id).toBeTruthy();
		expect(JSON.stringify(items)).not.toContain('MC');
		expect(JSON.stringify(items)).not.toContain('locked');
	});

	test('reader edit updates preferred and locks for later chapters', () => {
		const existing = [entry({ id: 'n1', source: '林动', preferred: 'Lin Dong', locked: false })];
		const next = applyReaderEdit(existing, 'n1', { preferred: 'Lin Tung' }, 99);
		expect(next[0].preferred).toBe('Lin Tung');
		expect(next[0].locked).toBe(true);
		expect(next[0].updatedAt).toBe(99);
		const afterModel = mergeGlossaryUpdates(next, [
			{ source: '林动', preferred: 'Forest Motion' }
		], 'b1');
		expect(afterModel[0].preferred).toBe('Lin Tung');
	});

	test('import/export round-trips source and preferred', () => {
		const src = [
			entry({ source: '青鸾', preferred: 'Qingluan', category: 'name', locked: true, notes: 'sect' })
		];
		const json = exportGlossaryJson(src);
		const back = parseGlossaryImport(json, 'b2');
		expect(back).toHaveLength(1);
		expect(back[0].source).toBe('青鸾');
		expect(back[0].preferred).toBe('Qingluan');
		expect(back[0].locked).toBe(true);
		expect(back[0].bookId).toBe('b2');
	});

	test('prompt glossary is oldest-first so new terms append', () => {
		const rows = glossaryForPrompt([
			entry({ id: 'b', source: '乙', preferred: 'Yi', createdAt: 20 }),
			entry({ id: 'a', source: '甲', preferred: 'Jia', createdAt: 10 })
		]);
		expect(rows.map((r) => r.source)).toEqual(['甲', '乙']);
	});
});
