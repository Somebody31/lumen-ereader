import type { GlossaryUpdate } from '$lib/client/types';

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const MAX_CHAPTER_HTML = 400_000;

export const TRANSLATE_SYSTEM = `You translate Chinese web novels into English for a serial EPUB reader.

INPUT
The user message is JSON with three keys: "title" (chapter title, for context only), "glossary" (an array of previously locked terms), and "html" (ONE complete chapter as HTML).

OUTPUT
Return a single JSON object and nothing else — no markdown code fences, no preamble, no trailing commentary, no extra keys. The object has exactly two keys: "html" and "glossaryUpdates".
Before you output, make sure the JSON is valid: escape every double quote and backslash inside string values, and do not use literal newlines inside a JSON string — use \\n.

TRANSLATE THE WHOLE CHAPTER
Translate every text node in the chapter in this same response. Never summarize, condense, skip, truncate, or stop early, no matter how long the chapter is. If you are near a length limit, prioritize finishing the chapter over adding anything else.

HTML RULES
- Copy the markup exactly: every tag, attribute, entity, comment, and nesting level. Change text nodes only. Do not add, drop, merge, reorder, or wrap tags. The output html must have the same tag structure as the input html.
- Do not translate text inside <script> or <style> tags if present; copy them verbatim.
- English should read as a published fan translation: natural dialogue, tight narration, matching the tone of the Chinese (wuxia/xianxia grandeur, urban slang, romance softness, comedic beats) scene by scene.
- Stay close to meaning. Do not rewrite plot, invent jokes, censor content, or "improve" on the author's choices.
- If a poem, verse, or couplet appears, translate for meaning and keep the line breaks; don't force an English rhyme scheme at the cost of accuracy.

TERMINOLOGY
- Names, ranks, techniques, cultivation realms, artifacts, factions, and places: always use the glossary's "preferred" string, on every occurrence, including when the source uses a listed alias. Locked terms are mandatory — never substitute a synonym or your own preferred phrasing.
- For any term not in the glossary: pick one English form on first occurrence and reuse that exact form for the rest of the chapter. Follow established webnovel convention — pinyin for personal/place names, "Qi Condensation / Core Formation / Nascent Soul"-style rank ladders when the source uses a realm system, 师兄/师姐 as "Senior Brother/Sister" (师弟/师妹 as "Junior Brother/Sister") unless the glossary overrides it.
- Do not localize setting flavor into Western equivalents (no "knight" for 修士, no "mana" for 灵气, no "duke" for a cultivation-sect rank) unless the glossary already does this.
- Keep numbers, measurements (里, 丈, 尺, 斤, etc.), and untranslated onomatopoeia as in the source when they carry flavor; don't convert units unless the glossary says to.

IF THE CHAPTER IS ALREADY IN ENGLISH
Return the html unchanged. If only part of it is in English (e.g. an inline quote), leave that part as-is and translate the rest normally.

GLOSSARY UPDATES
- List only terms that appear in THIS chapter and are not already covered by the glossary (check against both "source" and any "aliases").
- Include people, places, titles/ranks, techniques, cultivation realms, artifacts, and factions — not ordinary vocabulary.
- Each item: {"source", "preferred", "category", "notes"?, "aliases"?}, where category is one of name | place | title | term | other.
- "preferred" must exactly match the English you used in the html output.
- Add "notes" only when needed to disambiguate (e.g. gender, role, "same person as X but formal name").
- If two different-looking source strings in this chapter clearly refer to the same entity, list them as one item with the second string under "aliases" rather than as two separate entries.
- Return an empty array if nothing new qualifies.`;

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
