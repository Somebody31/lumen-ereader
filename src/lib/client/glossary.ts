import type { GlossaryEntry, GlossaryUpdate, ReaderGlossaryItem } from './types';
import { isGlossaryCategory } from './types';

function norm(s: string): string {
	return s.trim().toLowerCase();
}

function sourcesOf(entry: { source: string; aliases?: string[] }): string[] {
	return [entry.source, ...(entry.aliases ?? [])].map(norm).filter(Boolean);
}

export function findGlossaryMatch(
	entries: GlossaryEntry[],
	term: string
): GlossaryEntry | undefined {
	const n = norm(term);
	if (!n) return undefined;
	return entries.find((e) => sourcesOf(e).includes(n));
}

/** Merge model proposals. Never overwrite an existing preferred (locked or not). */
export function mergeGlossaryUpdates(
	existing: GlossaryEntry[],
	updates: GlossaryUpdate[],
	bookId: string,
	now = Date.now()
): GlossaryEntry[] {
	const out = existing.map((e) => ({ ...e }));
	for (const raw of updates) {
		const source = raw.source?.trim();
		const preferred = raw.preferred?.trim();
		if (!source || !preferred) continue;

		const hit =
			findGlossaryMatch(out, source) ||
			(raw.aliases ?? []).map((a) => findGlossaryMatch(out, a)).find(Boolean);
		if (hit) continue;

		out.push({
			id: crypto.randomUUID(),
			bookId,
			source,
			preferred,
			aliases: (raw.aliases ?? []).map((a) => a.trim()).filter(Boolean),
			category: isGlossaryCategory(raw.category) ? raw.category : 'term',
			locked: false,
			notes: raw.notes?.trim() || undefined,
			showInReader: true,
			createdAt: now,
			updatedAt: now
		});
	}
	return out;
}

export function readerGlossary(entries: GlossaryEntry[]): ReaderGlossaryItem[] {
	return entries
		.filter((e) => e.showInReader !== false)
		.map((e) => ({
			id: e.id,
			source: e.source,
			preferred: e.preferred,
			category: e.category
		}))
		.sort((a, b) => a.preferred.localeCompare(b.preferred));
}

/** Reader edit writes the same store the translator uses, and locks the term for later chapters. */
export function applyReaderEdit(
	entries: GlossaryEntry[],
	id: string,
	patch: { preferred?: string; source?: string },
	now = Date.now()
): GlossaryEntry[] {
	return entries.map((e) => {
		if (e.id !== id) return e;
		const preferred = patch.preferred !== undefined ? patch.preferred.trim() : e.preferred;
		const source = patch.source !== undefined ? patch.source.trim() : e.source;
		if (!preferred || !source) return e;
		return { ...e, preferred, source, locked: true, updatedAt: now };
	});
}

/** Oldest first so new terms append and earlier JSON stays a cacheable prefix. */
export function glossaryForPrompt(entries: GlossaryEntry[]): Array<{
	source: string;
	preferred: string;
	aliases?: string[];
	category: string;
	locked: boolean;
	notes?: string;
}> {
	return [...entries]
		.sort((a, b) => a.createdAt - b.createdAt || a.source.localeCompare(b.source) || a.id.localeCompare(b.id))
		.map((e) => ({
			source: e.source,
			preferred: e.preferred,
			aliases: e.aliases?.length ? [...e.aliases].sort((x, y) => x.localeCompare(y)) : undefined,
			category: e.category,
			locked: e.locked,
			notes: e.notes
		}));
}

export function parseGlossaryImport(raw: string, bookId: string, now = Date.now()): GlossaryEntry[] {
	const data = JSON.parse(raw) as unknown;
	const list = Array.isArray(data) ? data : (data as { entries?: unknown }).entries;
	if (!Array.isArray(list)) throw new Error('Glossary JSON must be an array of entries');
	const out: GlossaryEntry[] = [];
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const source = String(row.source ?? '').trim();
		const preferred = String(row.preferred ?? '').trim();
		if (!source || !preferred) continue;
		const aliases = Array.isArray(row.aliases)
			? row.aliases.map((a) => String(a).trim()).filter(Boolean)
			: undefined;
		out.push({
			id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
			bookId,
			source,
			preferred,
			aliases,
			category: isGlossaryCategory(String(row.category ?? ''))
				? (row.category as GlossaryEntry['category'])
				: 'term',
			locked: Boolean(row.locked),
			notes: typeof row.notes === 'string' ? row.notes : undefined,
			showInReader: row.showInReader !== false,
			createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
			updatedAt: now
		});
	}
	return out;
}

export function exportGlossaryJson(entries: GlossaryEntry[]): string {
	return JSON.stringify(
		entries.map((e) => ({
			source: e.source,
			preferred: e.preferred,
			aliases: e.aliases,
			category: e.category,
			locked: e.locked,
			notes: e.notes,
			showInReader: e.showInReader
		})),
		null,
		2
	);
}
