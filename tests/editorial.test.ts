import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	EDITORIAL,
	hasAtelierPrimaryIdentity,
	isEditorialPalette
} from '../src/lib/design/editorial';

const root = join(import.meta.dir, '..');
const appCss = readFileSync(join(root, 'src/app.css'), 'utf8');
const readerPage = readFileSync(join(root, 'src/routes/read/[id]/+page.svelte'), 'utf8');
const shell = readFileSync(join(root, 'src/lib/components/shell/AppShell.svelte'), 'utf8');
const seed = readFileSync(join(root, 'src/lib/client/seedSample.ts'), 'utf8');
const layout = readFileSync(join(root, 'src/routes/+layout.svelte'), 'utf8');
const library = readFileSync(join(root, 'src/routes/+page.svelte'), 'utf8');
const button = readFileSync(join(root, 'src/lib/components/ui/Button.svelte'), 'utf8');

describe('editorial design system', () => {
	test('EDITORIAL tokens declare broadsheet identity', () => {
		expect(EDITORIAL.world).toBe('broadsheet');
		expect(EDITORIAL.palette.newsprint.toLowerCase()).toBe('#f0efe9');
		expect(EDITORIAL.palette.ink).toBe('#0B0B0B');
		expect(EDITORIAL.palette.crimson).toBe('#7A1C1C');
		expect(EDITORIAL.typography.display).toContain('Newsreader');
		expect(EDITORIAL.typography.ui).toContain('Source Sans 3');
		expect(EDITORIAL.typography.reading).toContain('Literata');
		expect(EDITORIAL.not).toContain('atelier');
	});

	test('shipped app.css matches editorial palette and type faces', () => {
		expect(isEditorialPalette(appCss)).toBe(true);
		expect(hasAtelierPrimaryIdentity(appCss)).toBe(false);
		expect(appCss).toContain('--color-newsprint:');
		expect(appCss).toContain('--font-display:');
		expect(appCss).toContain('--font-ui:');
		expect(appCss).toContain('--font-reading:');
		expect(appCss).toContain('Newsreader');
		expect(appCss).toContain('Source Sans 3');
		expect(appCss).toContain('Literata');
		expect(appCss).toContain('font-optical-sizing');
		// Reject old atelier primary hexes as system identity
		expect(appCss).not.toMatch(/--color-indigo:\s*#1f3a68/i);
		expect(appCss).not.toMatch(/--color-seal:\s*#e03c2b/i);
		// Stage theme classes still defined for reader
		expect(appCss).toContain('.stage-night');
		expect(appCss).toContain('.stage-paper');
		expect(appCss).toContain('.reader-prose');
	});

	test('reader chrome uses hairline editorial language, not pill islands', () => {
		expect(readerPage).toContain('ease-editorial');
		expect(readerPage).toContain('border-color: var(--stage-rule)');
		expect(readerPage).toContain('font-display');
		// Stage themes wired via stageClass + theme list
		expect(readerPage).toContain("stage-${prefs?.theme ?? 'night'}");
		expect(readerPage).toContain("id: 'night'");
		expect(readerPage).toContain("id: 'paper'");
		expect(readerPage).toContain("id: 'sepia'");
		expect(readerPage).toContain("id: 'contrast'");
		expect(readerPage).toContain('chromeVisible');
		expect(readerPage).toContain('focusMode');
		expect(readerPage).toContain('scheduleSave');
		// No residual atelier pill island chrome
		expect(readerPage).not.toContain('rounded-full');
		expect(readerPage).not.toContain('shadow-island');
		expect(readerPage).not.toContain('bg-indigo');
		expect(readerPage).not.toContain('accent-indigo');
		expect(readerPage).not.toContain('ease-atelier');
	});

	test('shell masthead is editorial (display wordmark + hairline)', () => {
		expect(shell).toContain('display');
		expect(shell).toContain('bg-newsprint');
		expect(shell).toContain('border-rule');
		expect(shell).toContain('Lumen');
	});

	test('library page uses editorial masthead composition', () => {
		expect(library).toContain('kicker');
		expect(library).toContain('font-display');
		expect(library).toContain('border-rule');
		expect(library).toContain('ImportDropzone');
		expect(library).toContain('BookCard');
	});

	test('buttons are square ink/crimson, not pill seals', () => {
		expect(button).toContain('rounded-none');
		expect(button).toContain('bg-ink');
		expect(button).toContain('bg-crimson');
		expect(button).not.toContain('rounded-full');
	});

	test('sample cover is broadsheet plate (not atelier indigo seal)', () => {
		expect(seed).toContain('lumen-sample-v4');
		expect(seed).toContain('#0B0B0B');
		expect(seed).toContain('#7A1C1C');
		expect(seed).not.toContain('#1F3A68');
		expect(seed).not.toContain('#E03C2B');
	});

	test('theme-color is newsprint', () => {
		expect(layout).toContain('#F0EFE9');
	});

	test('cover materiality classes ship in app.css', () => {
		expect(appCss).toContain('.cover-object');
		expect(appCss).toContain('.grain');
		expect(appCss).toContain('--shadow-cover');
		expect(appCss).toContain('.reader-stage');
		expect(appCss).toContain('.theme-swatch');
		expect(appCss).toContain('.import-frame');
	});

	test('library and settings use craft patterns', () => {
		expect(library).toContain('cover-object-hero');
		expect(library).toContain('Continue reading');
		expect(shell).toContain('grain');
		const settings = readFileSync(join(root, 'src/routes/settings/+page.svelte'), 'utf8');
		expect(settings).toContain('theme-swatch');
		expect(settings).toContain('Preview');
		expect(readerPage).toContain('subline');
		expect(readerPage).toContain('reader-stage');
		expect(readerPage).toContain('sampleLine');
	});
});
