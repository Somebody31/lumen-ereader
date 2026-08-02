import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BookRecord, BookmarkRecord, ProgressRecord, ReaderPrefs } from './types';
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
}

const DB_NAME = 'lumen-ereader';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LumenDB>> | null = null;

function getDb() {
	if (!dbPromise) {
		dbPromise = openDB<LumenDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				const books = db.createObjectStore('books', { keyPath: 'id' });
				books.createIndex('by-updated', 'updatedAt');
				books.createIndex('by-title', 'title');
				db.createObjectStore('progress', { keyPath: 'bookId' });
				const bookmarks = db.createObjectStore('bookmarks', { keyPath: 'id' });
				bookmarks.createIndex('by-book', 'bookId');
				db.createObjectStore('prefs', { keyPath: 'id' });
			}
		});
	}
	return dbPromise;
}

export async function listBooks(): Promise<BookRecord[]> {
	const db = await getDb();
	const all = await db.getAllFromIndex('books', 'by-updated');
	return all.reverse();
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
	const tx = db.transaction(['books', 'progress', 'bookmarks'], 'readwrite');
	await tx.objectStore('books').delete(id);
	await tx.objectStore('progress').delete(id);
	const bms = await tx.objectStore('bookmarks').index('by-book').getAllKeys(id);
	await Promise.all(bms.map((k) => tx.objectStore('bookmarks').delete(k)));
	await tx.done;
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

export async function getLastOpened(): Promise<BookRecord | undefined> {
	const db = await getDb();
	const progresses = await db.getAll('progress');
	if (!progresses.length) {
		const books = await listBooks();
		return books[0];
	}
	progresses.sort((a, b) => b.updatedAt - a.updatedAt);
	return getBook(progresses[0].bookId);
}
