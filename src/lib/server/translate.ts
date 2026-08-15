import type { GlossaryUpdate } from '$lib/client/types';

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const MAX_CHAPTER_HTML = 400_000;

export const TRANSLATE_SYSTEM = `You translate Chinese webnovels into English for a serial EPUB reader. The user JSON has title, glossary, and html. The html is ONE complete chapter. Translate every text node of that chapter in this response. Do not summarize, skip, or stop early.

Output JSON only, keys "html" and "glossaryUpdates". No markdown fences, no extra keys, no translator notes.

html:
- Copy the markup exactly: every tag, attribute, entity, comment, and nesting. Change text nodes only. Do not add, drop, merge, or wrap tags.
- English should read as a published fan translation: natural dialogue, tight narration, same tone as the Chinese (wuxia/xianxia grandeur, urban slang, romance softness).
- Stay close to meaning. Do not rewrite plot, add jokes, or "improve" the author.
- Names, ranks, techniques, realms, artifacts, places: use the glossary preferred string on every occurrence (including aliases). Locked terms are mandatory — never substitute a synonym.
- Unlisted terms: pick one English form and reuse it for the rest of the chapter. Prefer established webnovel conventions (pinyin for unique names; "Qi", "Core Formation", "Nascent Soul" style ranks when that is what the text is; keep 师兄/师姐 as Senior Brother/Sister unless the glossary says otherwise).
- Do not localize setting flavor into Western equivalents (no "knight" for 修士, no "mana" for 灵气) unless the glossary already does.
- Keep numbers, measurements, and untranslated onomatopoeia as in the source when they carry flavor.
- If the chapter is already English, return the html unchanged.

glossaryUpdates:
- Only terms that appear in THIS chapter and are not already in the glossary (match source or alias).
- Propose people, places, titles/ranks, techniques, realms, artifacts, factions — not ordinary vocabulary.
- Each item: {"source","preferred","category","notes"?,"aliases"?}. category is name|place|title|term|other.
- preferred must be the same English you used in html. notes only if needed to disambiguate (gender, who they are).
- Empty array if nothing new.`;

export function packTranslateUser(input: {
	title?: string;
	html: string;
	glossary: Array<{
		source: string;
		preferred: string;
		aliases?: string[];
		category: string;
		locked: boolean;
		notes?: string;
	}>;
}): string {
	return JSON.stringify({
		title: input.title || '',
		glossary: input.glossary,
		html: input.html
	});
}

export function unpackTranslateResponse(raw: string): {
	html: string;
	glossaryUpdates: GlossaryUpdate[];
} {
	const cleaned = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();
	let data: unknown;
	try {
		data = JSON.parse(cleaned);
	} catch {
		throw new Error('Model returned non-JSON');
	}
	if (!data || typeof data !== 'object') throw new Error('Model returned invalid JSON');
	const rec = data as Record<string, unknown>;
	const html = typeof rec.html === 'string' ? rec.html : '';
	if (!html.trim()) throw new Error('Model returned empty HTML');
	const rawUpdates = Array.isArray(rec.glossaryUpdates) ? rec.glossaryUpdates : [];
	const glossaryUpdates: GlossaryUpdate[] = [];
	for (const item of rawUpdates) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const source = typeof row.source === 'string' ? row.source.trim() : '';
		const preferred = typeof row.preferred === 'string' ? row.preferred.trim() : '';
		if (!source || !preferred) continue;
		glossaryUpdates.push({
			source,
			preferred,
			category: typeof row.category === 'string' ? row.category : undefined,
			notes: typeof row.notes === 'string' ? row.notes : undefined,
			aliases: Array.isArray(row.aliases)
				? row.aliases.map((a) => String(a)).filter(Boolean)
				: undefined
		});
	}
	return { html, glossaryUpdates };
}

export function unpackTitleResponse(raw: string): string {
	const cleaned = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();
	try {
		const data = JSON.parse(cleaned) as { title?: string };
		if (typeof data.title === 'string' && data.title.trim()) return data.title.trim();
	} catch {
		if (cleaned && !cleaned.startsWith('{')) return cleaned.slice(0, 200);
	}
	throw new Error('Model returned empty title');
}

type ChatMessage = { role: 'system' | 'user'; content: string };

async function chatJson(
	apiKey: string,
	messages: ChatMessage[],
	attempt = 0
): Promise<string> {
	const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: DEEPSEEK_MODEL,
			thinking: { type: 'disabled' },
			response_format: { type: 'json_object' },
			temperature: 0.3,
			messages
		})
	});

	if ((res.status === 429 || res.status >= 500) && attempt < 1) {
		await new Promise((r) => setTimeout(r, 800 + attempt * 400));
		return chatJson(apiKey, messages, attempt + 1);
	}

	const body = (await res.json().catch(() => ({}))) as {
		error?: { message?: string };
		choices?: Array<{ message?: { content?: string } }>;
	};

	if (!res.ok) {
		const msg = body.error?.message || `DeepSeek error ${res.status}`;
		const err = new Error(msg) as Error & { status: number };
		err.status = res.status === 429 ? 429 : 502;
		throw err;
	}

	const content = body.choices?.[0]?.message?.content;
	if (!content) throw new Error('DeepSeek returned an empty response');
	return content;
}

export async function translateChapterWithDeepSeek(
	apiKey: string,
	input: {
		title?: string;
		html: string;
		glossary: Array<{
			source: string;
			preferred: string;
			aliases?: string[];
			category: string;
			locked: boolean;
			notes?: string;
		}>;
	}
): Promise<{ html: string; glossaryUpdates: GlossaryUpdate[] }> {
	const content = await chatJson(apiKey, [
		{ role: 'system', content: TRANSLATE_SYSTEM },
		{ role: 'user', content: packTranslateUser(input) }
	]);
	return unpackTranslateResponse(content);
}

export async function translateTitleWithDeepSeek(
	apiKey: string,
	title: string,
	glossary: Array<{ source: string; preferred: string }>
): Promise<string> {
	const content = await chatJson(apiKey, [
		{
			role: 'system',
			content:
				'Translate this Chinese book title to English. Return JSON {"title":"..."}. Honor glossary preferred terms. Do not add a subtitle.'
		},
		{ role: 'user', content: JSON.stringify({ title, glossary }) }
	]);
	return unpackTitleResponse(content);
}
