import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv, BookMetaDto, ProgressDto } from './types';
import {
	checkPassphrase,
	clearSessionCookie,
	createSessionToken,
	isAuthenticated,
	setSessionCookie,
	syncConfigured
} from './auth';
import {
	DEEPSEEK_MODEL,
	MAX_CHAPTER_HTML,
	translateChapterWithDeepSeek,
	translateTitleWithDeepSeek
} from './translate';

const app = new Hono<AppEnv>().basePath('/api');

app.get('/health', (c) => c.json({ ok: true, app: c.env.APP_NAME || 'Lumen' }));

app.get('/session', async (c) => {
	const configured = syncConfigured(c.env);
	if (!configured) {
		return c.json({
			authenticated: false,
			syncAvailable: false,
			message:
				'Cloud sync is not configured. Set SESSION_SECRET, READER_PASSPHRASE, R2 BOOKS, and KV META to enable.'
		});
	}
	const authenticated = await isAuthenticated(c);
	return c.json({
		authenticated,
		syncAvailable: true,
		message: authenticated ? 'Signed in' : 'Sign in to sync library across devices'
	});
});

app.post('/auth/login', async (c) => {
	if (!syncConfigured(c.env)) {
		return c.json({ error: 'Sync is not configured on this deployment' }, 503);
	}
	const body = (await c.req.json().catch(() => null)) as { passphrase?: string } | null;
	const passphrase = body?.passphrase?.trim() || '';
	if (!passphrase) return c.json({ error: 'Passphrase required' }, 400);
	const ok = await checkPassphrase(c.env, passphrase);
	if (!ok) return c.json({ error: 'Invalid passphrase' }, 401);
	const token = await createSessionToken(c.env.SESSION_SECRET!);
	c.header('Set-Cookie', setSessionCookie(token));
	return c.json({ ok: true });
});

app.post('/auth/logout', (c) => {
	c.header('Set-Cookie', clearSessionCookie());
	return c.json({ ok: true });
});

app.use('/books/*', async (c, next) => {
	if (!(await isAuthenticated(c))) return c.json({ error: 'Unauthorized' }, 401);
	await next();
});

app.use('/books', async (c, next) => {
	if (c.req.method === 'GET' || c.req.method === 'POST') {
		if (!(await isAuthenticated(c))) return c.json({ error: 'Unauthorized' }, 401);
	}
	await next();
});

app.use('/progress/*', async (c, next) => {
	if (!(await isAuthenticated(c))) return c.json({ error: 'Unauthorized' }, 401);
	await next();
});

app.get('/books', async (c) => {
	const list = await c.env.META.list({ prefix: 'book:' });
	const books: BookMetaDto[] = [];
	for (const key of list.keys) {
		const raw = await c.env.META.get(key.name);
		if (!raw) continue;
		try {
			books.push(JSON.parse(raw) as BookMetaDto);
		} catch {
			/* skip */
		}
	}
	books.sort((a, b) => b.updatedAt - a.updatedAt);
	return c.json(books);
});

app.post('/books', async (c) => {
	const form = await c.req.formData();
	const metaRaw = form.get('meta');
	const file = form.get('file');
	if (typeof metaRaw !== 'string' || !(file instanceof File)) {
		return c.json({ error: 'Expected meta JSON and file' }, 400);
	}
	let meta: BookMetaDto;
	try {
		meta = JSON.parse(metaRaw) as BookMetaDto;
	} catch {
		return c.json({ error: 'Invalid meta JSON' }, 400);
	}
	if (!meta.id) return c.json({ error: 'meta.id required' }, 400);

	await c.env.BOOKS.put(`books/${meta.id}`, file.stream(), {
		httpMetadata: { contentType: meta.mimeType || file.type || 'application/octet-stream' },
		customMetadata: { fileName: meta.fileName || file.name }
	});
	const fileEn = form.get('fileEn');
	if (fileEn instanceof File && fileEn.size > 0) {
		await c.env.BOOKS.put(`books/${meta.id}.en`, fileEn.stream(), {
			httpMetadata: { contentType: meta.mimeType || 'application/epub+zip' },
			customMetadata: { fileName: `${meta.fileName || file.name}.en.epub` }
		});
	}
	const glossaryRaw = form.get('glossary');
	if (typeof glossaryRaw === 'string' && glossaryRaw.trim()) {
		await c.env.META.put(`glossary:${meta.id}`, glossaryRaw);
	}
	meta.sizeBytes = file.size;
	meta.updatedAt = Date.now();
	await c.env.META.put(`book:${meta.id}`, JSON.stringify(meta));
	return c.json({ ok: true, id: meta.id });
});

app.get('/books/:id/file', async (c) => {
	const id = c.req.param('id');
	const obj = await c.env.BOOKS.get(`books/${id}`);
	if (!obj) return c.json({ error: 'Not found' }, 404);
	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	headers.set('etag', obj.httpEtag);
	return new Response(obj.body, { headers });
});

app.delete('/books/:id', async (c) => {
	const id = c.req.param('id');
	await c.env.BOOKS.delete(`books/${id}`);
	await c.env.BOOKS.delete(`books/${id}.en`);
	await c.env.META.delete(`book:${id}`);
	await c.env.META.delete(`progress:${id}`);
	await c.env.META.delete(`glossary:${id}`);
	return c.json({ ok: true });
});

app.get('/progress/:id', async (c) => {
	const id = c.req.param('id');
	const raw = await c.env.META.get(`progress:${id}`);
	if (!raw) return c.json(null);
	return c.json(JSON.parse(raw) as ProgressDto);
});

app.put('/progress/:id', async (c) => {
	const id = c.req.param('id');
	const body = (await c.req.json()) as ProgressDto;
	body.bookId = id;
	body.updatedAt = body.updatedAt || Date.now();
	await c.env.META.put(`progress:${id}`, JSON.stringify(body));
	return c.json({ ok: true });
});

async function requireTranslateAccess(c: Parameters<typeof isAuthenticated>[0]) {
	if (syncConfigured(c.env) && !(await isAuthenticated(c))) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	return null;
}

function deepseekKey(env: AppEnv['Bindings']): string | undefined {
	return env.DEEPSEEK_API_KEY?.trim() || undefined;
}

app.get('/translate/status', (c) => {
	return c.json({
		configured: Boolean(deepseekKey(c.env)),
		model: DEEPSEEK_MODEL
	});
});

app.post('/translate/chapter', async (c) => {
	const denied = await requireTranslateAccess(c);
	if (denied) return denied;
	const key = deepseekKey(c.env);
	if (!key) {
		return c.json(
			{ error: 'Translation is not configured. Set DEEPSEEK_API_KEY on the server.' },
			503
		);
	}
	const body = (await c.req.json().catch(() => null)) as {
		title?: string;
		html?: string;
		glossary?: Array<{
			source: string;
			preferred: string;
			aliases?: string[];
			category: string;
			locked: boolean;
			notes?: string;
		}>;
	} | null;
	const html = body?.html;
	if (!html || typeof html !== 'string') return c.json({ error: 'html required' }, 400);
	if (html.length > MAX_CHAPTER_HTML) return c.json({ error: 'Chapter is too large' }, 413);

	try {
		const result = await translateChapterWithDeepSeek(key, {
			title: body?.title,
			html,
			glossary: Array.isArray(body?.glossary) ? body.glossary : []
		});
		return c.json(result);
	} catch (e) {
		const status = (e as { status?: number }).status;
		const message = e instanceof Error ? e.message : 'Translation failed';
		return c.json({ error: message }, status === 429 ? 429 : 502);
	}
});

app.post('/translate/title', async (c) => {
	const denied = await requireTranslateAccess(c);
	if (denied) return denied;
	const key = deepseekKey(c.env);
	if (!key) {
		return c.json(
			{ error: 'Translation is not configured. Set DEEPSEEK_API_KEY on the server.' },
			503
		);
	}
	const body = (await c.req.json().catch(() => null)) as {
		title?: string;
		glossary?: Array<{ source: string; preferred: string }>;
	} | null;
	const title = body?.title?.trim();
	if (!title) return c.json({ error: 'title required' }, 400);
	try {
		const next = await translateTitleWithDeepSeek(key, title, body?.glossary ?? []);
		return c.json({ title: next });
	} catch (e) {
		const status = (e as { status?: number }).status;
		const message = e instanceof Error ? e.message : 'Title translation failed';
		return c.json({ error: message }, status === 429 ? 429 : 502);
	}
});

app.get('/books/:id/file-en', async (c) => {
	if (!(await isAuthenticated(c))) return c.json({ error: 'Unauthorized' }, 401);
	const id = c.req.param('id');
	const obj = await c.env.BOOKS.get(`books/${id}.en`);
	if (!obj) return c.json({ error: 'Not found' }, 404);
	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	headers.set('etag', obj.httpEtag);
	return new Response(obj.body, { headers });
});

app.get('/books/:id/glossary', async (c) => {
	if (!(await isAuthenticated(c))) return c.json({ error: 'Unauthorized' }, 401);
	const id = c.req.param('id');
	const raw = await c.env.META.get(`glossary:${id}`);
	if (!raw) return c.json([]);
	try {
		return c.json(JSON.parse(raw));
	} catch {
		return c.json([]);
	}
});

app.put('/books/:id/glossary', async (c) => {
	if (!(await isAuthenticated(c))) return c.json({ error: 'Unauthorized' }, 401);
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => null);
	if (!Array.isArray(body)) return c.json({ error: 'Expected glossary array' }, 400);
	await c.env.META.put(`glossary:${id}`, JSON.stringify(body));
	return c.json({ ok: true });
});

// Silence unused import if tree shakes oddly
void getCookie;

export default app;
