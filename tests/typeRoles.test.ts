import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	faceToCssVar,
	fontVarForRole,
	roleAllowsItalic,
	TYPE_ROLES,
	typeRoleClassNames,
	type TypeRole
} from '../src/lib/design/editorial';

const root = join(import.meta.dir, '..');
const appCss = readFileSync(join(root, 'src/app.css'), 'utf8');

describe('TYPE_ROLES map (shipped design rules)', () => {
	test('every role has a face, weight, and utility class', () => {
		const roles = Object.keys(TYPE_ROLES) as TypeRole[];
		expect(roles.length).toBeGreaterThanOrEqual(10);
		for (const role of roles) {
			const spec = TYPE_ROLES[role];
			expect(['display', 'ui', 'reading']).toContain(spec.face);
			expect(spec.weight).toBeGreaterThanOrEqual(400);
			expect(spec.weight).toBeLessThanOrEqual(700);
			expect(spec.className.startsWith('type-')).toBe(true);
			expect(spec.cssVar).toMatch(/^--font-(display|ui|reading)$/);
		}
	});

	test('titles use display; chrome labels use ui; body long-form uses reading', () => {
		expect(TYPE_ROLES.masthead.face).toBe('display');
		expect(TYPE_ROLES.section.face).toBe('display');
		expect(TYPE_ROLES.cardTitle.face).toBe('display');
		expect(TYPE_ROLES.chromeTitle.face).toBe('display');
		expect(TYPE_ROLES.kicker.face).toBe('ui');
		expect(TYPE_ROLES.nav.face).toBe('ui');
		expect(TYPE_ROLES.body.face).toBe('ui');
		expect(TYPE_ROLES.meta.face).toBe('ui');
		expect(TYPE_ROLES.readingBody.face).toBe('reading');
		expect(TYPE_ROLES.readingHead.face).toBe('display');
	});

	test('italics only on editorial eyebrow role (not chrome)', () => {
		expect(roleAllowsItalic('eyebrow')).toBe(true);
		expect(roleAllowsItalic('masthead')).toBe(false);
		expect(roleAllowsItalic('nav')).toBe(false);
		expect(roleAllowsItalic('kicker')).toBe(false);
		expect(roleAllowsItalic('readingBody')).toBe(false);
		// Eyebrow is display italic 400 — not heavy UI
		expect(TYPE_ROLES.eyebrow.weight).toBe(400);
		expect(TYPE_ROLES.eyebrow.italic).toBe(true);
	});

	test('mastheads are semibold, not black/heavy', () => {
		expect(TYPE_ROLES.masthead.weight).toBe(600);
		expect(TYPE_ROLES.section.weight).toBe(600);
		expect(TYPE_ROLES.nav.weight).toBe(500);
		expect(TYPE_ROLES.body.weight).toBe(400);
	});

	test('fontVarForRole and faceToCssVar resolve real token names', () => {
		expect(fontVarForRole('masthead')).toBe('--font-display');
		expect(fontVarForRole('nav')).toBe('--font-ui');
		expect(fontVarForRole('readingBody')).toBe('--font-reading');
		expect(faceToCssVar('display')).toBe('--font-display');
		expect(faceToCssVar('ui')).toBe('--font-ui');
		expect(faceToCssVar('reading')).toBe('--font-reading');
	});

	test('app.css ships a utility class for every type role', () => {
		for (const className of typeRoleClassNames()) {
			expect(appCss).toContain(`.${className}`);
		}
		// Critical role CSS properties
		expect(appCss).toMatch(/\.type-masthead\s*\{[^}]*font-family:\s*var\(--font-display\)/s);
		expect(appCss).toMatch(/\.type-nav\s*\{[^}]*font-family:\s*var\(--font-ui\)/s);
		expect(appCss).toMatch(/\.type-reading\s*\{[^}]*font-family:\s*var\(--font-reading\)/s);
		expect(appCss).toMatch(/\.type-eyebrow\s*\{[^}]*font-style:\s*italic/s);
	});

	test('reader prose uses reading face by default and display for heads', () => {
		expect(appCss).toMatch(/\.reader-prose\s*\{[^}]*font-family:\s*var\(--reader-font,\s*var\(--font-reading\)\)/s);
		expect(appCss).toMatch(/\.reader-prose h1[\s\S]*?font-family:\s*var\(--font-display\)/);
		expect(appCss).toContain('orphans: 3');
		expect(appCss).toContain('widows: 3');
		expect(appCss).toContain('text-wrap: pretty');
	});
});
