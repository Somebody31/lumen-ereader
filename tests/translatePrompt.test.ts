import { describe, expect, test } from 'bun:test';
import {
	packTranslateUser,
	TRANSLATE_SYSTEM,
	unpackTitleResponse,
	unpackTranslateResponse
} from '../src/lib/server/translate';

describe('translate prompt contract', () => {
	test('system prompt requires JSON keys and tag preservation', () => {
		expect(TRANSLATE_SYSTEM).toContain('html');
		expect(TRANSLATE_SYSTEM).toContain('glossaryUpdates');
		expect(TRANSLATE_SYSTEM).toContain('Preserve every HTML');
		expect(TRANSLATE_SYSTEM).toContain('Locked terms');
	});

	test('packs title, glossary, and html', () => {
		const packed = packTranslateUser({
			title: 'Chapter 1',
			html: '<p>林动</p>',
			glossary: [
				{
					source: '林动',
					preferred: 'Lin Dong',
					category: 'name',
					locked: true
				}
			]
		});
		const obj = JSON.parse(packed) as { title: string; html: string; glossary: unknown[] };
		expect(obj.title).toBe('Chapter 1');
		expect(obj.html).toBe('<p>林动</p>');
		expect(obj.glossary).toHaveLength(1);
	});

	test('unpacks JSON and strips markdown fences', () => {
		const raw = '```json\n{"html":"<p>Lin Dong</p>","glossaryUpdates":[{"source":"青鸾","preferred":"Qingluan","category":"name"}]}\n```';
		const out = unpackTranslateResponse(raw);
		expect(out.html).toBe('<p>Lin Dong</p>');
		expect(out.glossaryUpdates).toEqual([
			{ source: '青鸾', preferred: 'Qingluan', category: 'name', notes: undefined, aliases: undefined }
		]);
	});

	test('rejects empty html', () => {
		expect(() => unpackTranslateResponse('{"html":"","glossaryUpdates":[]}')).toThrow(
			/empty HTML/
		);
	});

	test('rejects non-JSON', () => {
		expect(() => unpackTranslateResponse('not json')).toThrow(/non-JSON/);
	});

	test('title unpack reads JSON title', () => {
		expect(unpackTitleResponse('{"title":"Battle Through the Heavens"}')).toBe(
			'Battle Through the Heavens'
		);
	});
});
