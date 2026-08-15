import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
	BookListItem,
	BookRecord,
	BookmarkRecord,
	GlossaryEntry,
	ProgressRecord,
	ReaderPrefs,
	TranslationJob
} from './types';
import { DEFAULT_PREFS } from './types';

interface LumenDB extends DBSchema {
	books: {
		key: string;
		value: BookRecord;
		indexes: { 'by-updated': number; 'by-title': string };
	};
	progress: {
		key: string;
		value: ProgressRecord;
	};
	bookmarks: {
		key: string;
		value: BookmarkRecord;
		indexes: { 'by-book': string };
	};
	prefs: {
		key: string;
		value: ReaderPrefs & { id: string };
	};
	glossary: {
		key: string;
		value: GlossaryEntry;
		indexes: { 'by-book': string };
	};
	translationJobs: {
		key: string;
		value: TranslationJob;
	};
}

const DB_NAME = 'lumen-ereader';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<LumenDB>> | null = null;

function getDb() {
	if (!dbPromise) {
		dbPromise = openDB<LumenDB>(DB_NAME, DB_VERSION, {
			upgrade(db, oldVersion) {
				if (oldVersion < 1) {
					const books = db.createObjectStore('books', { keyPath: 'id' });
					books.createIndex('by-updated', 'updatedAt');
					books.createIndex('by-title', 'title');
					db.createObjectStore('progress', { keyPath: 'bookId' });
					const bookmarks = db.createObjectStore('bookmarks', { keyPath: 'id' });
					bookmarks.createIndex('by-book', 'bookId');
					db.createObjectStore('prefs', { keyPath: 'id' });
				}
				if (oldVersion < 2) {
					if (!db.objectStoreNames.contains('glossary')) {
						const glossary = db.createObjectStore('glossary', { keyPath: 'id' });
						glossary.createIndex('by-book', 'bookId');
					}
					if (!db.objectStoreNames.contains('translationJobs')) {
						db.createObjectStore('translationJobs', { keyPath: 'bookId' });
					}
				}
			}
		});
	}
	return dbPromise;
}

function stripBlob(book: BookRecord): BookListItem {
	const { blob: _blob, translatedBlob: _translated, ...meta } = book;
	return meta;
}

/** Shelf listing without file blobs (keeps library scroll light). */
export async function listBooks(): Promise<BookListItem[]> {
	const db = await getDb();
	const all = await db.getAllFromIndex('books', 'by-updated');
	return all.reverse().map(stripBlob);
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
	const db = await getDb();
	return db.get('books', id);
}

export async function putBook(book: BookRecord): Promise<void> {
	const db = await getDb();
	await db.put('books', book);
}

export async function deleteBook(id: string): Promise<void> {
	const db = await getDb();
	const tx = db.transaction(
		['books', 'progress', 'bookmarks', 'glossary', 'translationJobs'],
		'readwrite'
	);
	await tx.objectStore('books').delete(id);
	await tx.objectStore('progress').delete(id);
	await tx.objectStore('translationJobs').delete(id);
	const bms = await tx.objectStore('bookmarks').index('by-book').getAllKeys(id);
	await Promise.all(bms.map((k) => tx.objectStore('bookmarks').delete(k)));
	const gloss = await tx.objectStore('glossary').index('by-book').getAllKeys(id);
	await Promise.all(gloss.map((k) => tx.objectStore('glossary').delete(k)));
	await tx.done;
}

export async function listGlossary(bookId: string): Promise<GlossaryEntry[]> {
	const db = await getDb();
	const rows = await db.getAllFromIndex('glossary', 'by-book', bookId);
	return rows.sort((a, b) => a.source.localeCompare(b.source, 'zh'));
}

export async function putGlossaryEntry(entry: GlossaryEntry): Promise<void> {
	const db = await getDb();
	await db.put('glossary', entry);
}

export async function putGlossaryEntries(entries: GlossaryEntry[]): Promise<void> {
	if (!entries.length) return;
	const db = await getDb();
	const tx = db.transaction('glossary', 'readwrite');
	await Promise.all(entries.map((e) => tx.store.put(e)));
	await tx.done;
}

export async function deleteGlossaryEntry(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('glossary', id);
}

export async function replaceGlossary(bookId: string, entries: GlossaryEntry[]): Promise<void> {
	const db = await getDb();
	const tx = db.transaction('glossary', 'readwrite');
	const existing = await tx.store.index('by-book').getAllKeys(bookId);
	await Promise.all(existing.map((k) => tx.store.delete(k)));
	await Promise.all(entries.map((e) => tx.store.put(e)));
	await tx.done;
}

export async function getTranslationJob(bookId: string): Promise<TranslationJob | undefined> {
	const db = await getDb();
	return db.get('translationJobs', bookId);
}

export async function putTranslationJob(job: TranslationJob): Promise<void> {
	const db = await getDb();
	await db.put('translationJobs', job);
}

export async function deleteTranslationJob(bookId: string): Promise<void> {
	const db = await getDb();
	await db.delete('translationJobs', bookId);
}

export async function getProgress(bookId: string): Promise<ProgressRecord | undefined> {
	const db = await getDb();
	return db.get('progress', bookId);
}

export async function putProgress(progress: ProgressRecord): Promise<void> {
	const db = await getDb();
	await db.put('progress', progress);
}

export async function listBookmarks(bookId: string): Promise<BookmarkRecord[]> {
	const db = await getDb();
	return db.getAllFromIndex('bookmarks', 'by-book', bookId);
}

export async function putBookmark(bm: BookmarkRecord): Promise<void> {
	const db = await getDb();
	await db.put('bookmarks', bm);
}

export async function deleteBookmark(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('bookmarks', id);
}

export async function getPrefs(): Promise<ReaderPrefs> {
	const db = await getDb();
	const row = await db.get('prefs', 'default');
	if (!row) return { ...DEFAULT_PREFS };
	const { id: _id, ...prefs } = row;
	return { ...DEFAULT_PREFS, ...prefs };
}

export async function putPrefs(prefs: ReaderPrefs): Promise<void> {
	const db = await getDb();
	await db.put('prefs', { id: 'default', ...prefs });
}

export async function getLastOpened(): Promise<BookListItem | undefined> {
	const db = await getDb();
	const progresses = await db.getAll('progress');
	if (!progresses.length) {
		const books = await listBooks();
		return books[0];
	}
	progresses.sort((a, b) => b.updatedAt - a.updatedAt);
	const full = await getBook(progresses[0].bookId);
	return full ? stripBlob(full) : undefined;
}
