import { describe, expect, test } from 'bun:test';
import {
	DEFAULT_PREFS,
	fontStack,
	READING_FONTS,
	type ReaderPrefs
} from '../src/lib/client/types';

describe('ReaderPrefs defaults', () => {
	test('includes expanded reading options', () => {
		expect(DEFAULT_PREFS.theme).toBe('night');
		expect(DEFAULT_PREFS.fontFamily).toBe('literata');
		expect(DEFAULT_PREFS.fontSize).toBe(18);
		expect(DEFAULT_PREFS.lineHeight).toBe(1.7);
		expect(DEFAULT_PREFS.letterSpacing).toBe(0);
		expect(DEFAULT_PREFS.paragraphSpacing).toBe(1);
		expect(DEFAULT_PREFS.measure).toBe(68);
		expect(DEFAULT_PREFS.margin).toBe(24);
		expect(DEFAULT_PREFS.textAlign).toBe('left');
		expect(DEFAULT_PREFS.hyphenate).toBe(false);
		expect(DEFAULT_PREFS.brightness).toBe(1);
		expect(DEFAULT_PREFS.keepAwake).toBe(false);
	});

	test('merge migration fills missing keys from defaults', () => {
		const legacy = { theme: 'sepia' as const, fontSize: 20, lineHeight: 1.6, measure: 60, margin: 20 };
		const merged: ReaderPrefs = { ...DEFAULT_PREFS, ...legacy };
		expect(merged.theme).toBe('sepia');
		expect(merged.fontSize).toBe(20);
		expect(merged.fontFamily).toBe('literata');
		expect(merged.letterSpacing).toBe(0);
		expect(merged.textAlign).toBe('left');
		expect(merged.brightness).toBe(1);
		expect(merged.keepAwake).toBe(false);
	});
});

describe('fontStack', () => {
	test('resolves each reading font', () => {
		for (const f of READING_FONTS) {
			const stack = fontStack(f.id);
			expect(stack.length).toBeGreaterThan(4);
			expect(stack).toBe(f.stack);
		}
	});

	test('falls back for unknown family', () => {
		expect(fontStack('unknown')).toBe(READING_FONTS[0].stack);
		expect(fontStack(undefined)).toBe(READING_FONTS[0].stack);
	});
});
