import type { GlossaryUpdate } from '$lib/client/types';

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const MAX_CHAPTER_HTML = 400_000;

export const TRANSLATE_SYSTEM = `You are a literary translator for Chinese webnovels (xianxia, xuanhuan, urban, romance).
The user message is ONE complete chapter. Translate all of it in this single response.

Rules:
- Return a JSON object with keys "html" and "glossaryUpdates" only.
- "html" is the translated markup for the whole chapter. Preserve every HTML/XML tag, attribute, entity, and structure. Translate text nodes only. Do not add or remove tags. Do not wrap the result in markdown fences. Do not omit later paragraphs.
- Honor the glossary exactly: use each entry's "preferred" English for that source term and its aliases. Locked terms are mandatory.
- "glossaryUpdates" is new terms found in THIS chapter only that are not already in the glossary: proper nouns, place names, titles, cultivation/setting terms. Do not restate existing entries. Each item: { "source", "preferred", "category", "notes"?, "aliases"? } where category is name|place|title|term|other.
- Keep honorifics and register consistent. Do not localize setting names unless the glossary says to.
- If the input is already English, return it unchanged with an empty glossaryUpdates array.`;

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
