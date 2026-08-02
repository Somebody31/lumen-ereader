import type { BookMeta, ProgressRecord, SessionInfo } from './types';
import { getBook, listBooks, putBook, putProgress, getProgress } from './idb';

export async function fetchSession(): Promise<SessionInfo> {
	try {
		const res = await fetch('/api/session');
		if (!res.ok) {
			return { authenticated: false, syncAvailable: false, message: 'Sync API unavailable' };
		}
		return (await res.json()) as SessionInfo;
	} catch {
		return { authenticated: false, syncAvailable: false, message: 'Offline' };
	}
}

export async function login(passphrase: string): Promise<{ ok: boolean; error?: string }> {
	const res = await fetch('/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ passphrase })
	});
	if (!res.ok) {
		const data = (await res.json().catch(() => ({}))) as { error?: string };
		return { ok: false, error: data.error || 'Login failed' };
	}
	return { ok: true };
}

export async function logout(): Promise<void> {
	await fetch('/api/auth/logout', { method: 'POST' });
}

export async function pushBook(bookId: string): Promise<{ ok: boolean; error?: string }> {
	const book = await getBook(bookId);
	if (!book) return { ok: false, error: 'Book not found' };

	const meta: BookMeta = {
		id: book.id,
		title: book.title,
		author: book.author,
		format: book.format,
		mimeType: book.mimeType,
		fileName: book.fileName,
		coverDataUrl: book.coverDataUrl,
		addedAt: book.addedAt,
		updatedAt: book.updatedAt,
		sizeBytes: book.sizeBytes,
		lengthHint: book.lengthHint
	};

	const form = new FormData();
	form.set('meta', JSON.stringify(meta));
	form.set('file', book.blob, book.fileName);

	const res = await fetch('/api/books', { method: 'POST', body: form });
	if (!res.ok) {
		const data = (await res.json().catch(() => ({}))) as { error?: string };
		return { ok: false, error: data.error || 'Upload failed' };
	}
	return { ok: true };
}

export async function pushProgress(bookId: string): Promise<void> {
	const progress = await getProgress(bookId);
	if (!progress) return;
	await fetch(`/api/progress/${bookId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(progress)
	});
}

export async function pullLibrary(): Promise<{ ok: boolean; count: number; error?: string }> {
	const res = await fetch('/api/books');
	if (!res.ok) {
		const data = (await res.json().catch(() => ({}))) as { error?: string };
		return { ok: false, count: 0, error: data.error || 'Pull failed' };
	}
	const remote = (await res.json()) as BookMeta[];
	let count = 0;
	for (const meta of remote) {
		const existing = await getBook(meta.id);
		if (existing && existing.updatedAt >= meta.updatedAt) continue;
		const fileRes = await fetch(`/api/books/${meta.id}/file`);
		if (!fileRes.ok) continue;
		const blob = await fileRes.blob();
		await putBook({ ...meta, blob });
		count++;
		const progRes = await fetch(`/api/progress/${meta.id}`);
		if (progRes.ok) {
			const prog = (await progRes.json()) as ProgressRecord | null;
			if (prog) {
				const local = await getProgress(meta.id);
				if (!local || prog.updatedAt > local.updatedAt) {
					await putProgress(prog);
				}
			}
		}
	}
	return { ok: true, count };
}

export async function pushAll(): Promise<{ ok: boolean; error?: string }> {
	const books = await listBooks();
	for (const b of books) {
		const r = await pushBook(b.id);
		if (!r.ok) return r;
		await pushProgress(b.id);
	}
	return { ok: true };
}
