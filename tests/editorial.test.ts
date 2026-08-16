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
	test('EDITORIAL tokens declare nocturne identity', () => {
		expect(EDITORIAL.world).toBe('nocturne');
		expect(EDITORIAL.palette.newsprint.toLowerCase()).toBe('#0a0a0a');
		expect(EDITORIAL.palette.ink.toLowerCase()).toBe('#f0efe9');
		expect(EDITORIAL.palette.crimson.toLowerCase()).toBe('#d0544c');
		expect(EDITORIAL.palette.inkMute.toLowerCase()).toBe('#9c9b94');
		expect(EDITORIAL.palette.rule.toLowerCase()).toBe('#3f3f3c');
		expect(EDITORIAL.radius.md).toBe('10px');
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
		expect(appCss).toContain('color-scheme: dark');
		expect(appCss).toContain('--radius-md: 10px');
		// Reject old atelier primary hexes as system identity
		expect(appCss).not.toMatch(/--color-indigo:\s*#1f3a68/i);
		expect(appCss).not.toMatch(/--color-seal:\s*#e03c2b/i);
		// Stage theme classes still defined for reader
		expect(appCss).toContain('.stage-night');
		expect(appCss).toContain('.stage-paper');
		expect(appCss).toContain('.reader-prose');
	});

	test('paper stage chrome uses dark paper ink, not shell ivory', () => {
		// Shell --color-ink is light (#F0EFE9); paper chrome must use --color-stage-paper-ink
		const paperBlock = appCss.match(/\.stage-paper\s*\{[^}]+\}/)?.[0] ?? '';
		expect(paperBlock).toContain('--stage-chrome-fg: var(--color-stage-paper-ink)');
		expect(paperBlock).toContain('--stage-progress: var(--color-stage-paper-ink)');
		expect(paperBlock).not.toMatch(/--stage-chrome-fg:\s*var\(--color-ink\)/);
		expect(paperBlock).not.toMatch(/--stage-progress:\s*var\(--color-ink\)/);
		// Sepia already pairs light chrome with dark stage-sepia-ink
		const sepiaBlock = appCss.match(/\.stage-sepia\s*\{[^}]+\}/)?.[0] ?? '';
		expect(sepiaBlock).toContain('--stage-chrome-fg: var(--color-stage-sepia-ink)');
	});

	test('reader chrome uses hairline editorial language, not pill islands', () => {
		expect(appCss).toContain('ease-editorial');
		expect(readerPage).toContain('border-color: var(--stage-rule)');
		expect(readerPage).toContain('type-chrome-title');
		// Side rail + drawers replace floating top chrome bar
		expect(readerPage).toContain('reader-rail');
		expect(readerPage).toContain('reader-drawer');
		expect(appCss).toContain('.reader-rail');
		expect(appCss).toContain('.reader-drawer');
		expect(readerPage).not.toContain('reader-chrome-bar');
		// Stage themes wired via stageClass + theme list
		expect(readerPage).toContain("stage-${prefs?.theme ?? 'night'}");
		expect(readerPage).toContain("id: 'night'");
		expect(readerPage).toContain("id: 'paper'");
		expect(readerPage).toContain("id: 'sepia'");
		expect(readerPage).toContain("id: 'contrast'");
		expect(readerPage).toContain('chromeVisible');
		expect(readerPage).toContain('focusMode');
		expect(readerPage).toContain('scheduleSave');
		// Soft radius OK; reject full SaaS pill chrome on main chrome bars
		expect(readerPage).not.toContain('shadow-island');
		expect(readerPage).not.toContain('bg-indigo');
		expect(readerPage).not.toContain('accent-indigo');
	});

	test('reader prose is bolder broadsheet: title plate, drop cap, crimson motifs', () => {
		// Title plate — continue-lead scale + short crimson rule (system accent)
		expect(appCss).toMatch(/\.reader-prose h1::after/);
		expect(appCss).toMatch(/\.reader-prose h1[\s\S]*?clamp\(2\.45rem/);
		expect(appCss).toContain('--color-crimson');
		// Chapter open: top hairline + drop cap
		expect(appCss).toMatch(/\.reader-prose h2[\s\S]*?border-top:/);
		expect(appCss).toMatch(/\.reader-prose h2 \+ p::first-letter/);
		// Progress is plain percent on the rail — no hairline/bead meters
		expect(readerPage).not.toContain('reader-progress-bead');
		expect(appCss).not.toContain('.reader-progress-bead');
		expect(readerPage).not.toContain('reader-rail-meter-bead');
		expect(appCss).not.toContain('.reader-rail-meter-bead');
		expect(readerPage).not.toContain('reader-toc-break-bead');
		// Rail as magazine spine: vertical title stamp + pct only
		expect(appCss).toContain('.reader-rail-spine');
		expect(readerPage).toContain('reader-rail-spine');
		expect(readerPage).toContain('reader-rail-pct');
		// Type sample plate in drawer
		expect(appCss).toContain('.reader-type-sample');
		expect(readerPage).toContain('reader-type-sample');
		// End mark is a quiet hairline (no bead asterism)
		expect(appCss).toContain('.reader-end-mark');
		expect(appCss).toMatch(/\.reader-end-mark::before[\s\S]*?content:\s*none/);
		// Blockquotes use display italic + crimson rail
		expect(appCss).toMatch(
			/\.reader-prose blockquote[\s\S]*?border-left:\s*2px solid var\(--color-crimson\)/
		);
		expect(appCss).toMatch(/\.reader-prose blockquote[\s\S]*?font-family:\s*var\(--font-display\)/);
		// Reduced-motion quietens drop cap float
		expect(appCss).toMatch(
			/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.reader-prose h2 \+ p::first-letter/
		);
	});

	test('shell is a toolbar stamp + import CTA', () => {
		expect(shell).toContain('type-chrome-title');
		expect(shell).toContain('bg-newsprint');
		expect(shell).toContain('border-rule');
		expect(shell).toContain('Lumen');
		expect(shell).toContain('Import');
		expect(shell).toContain('importFiles');
		expect(shell).toContain('aria-current');
		expect(shell).toContain('type-nav');
		expect(shell).toContain('bg-paper');
		expect(shell).toContain('/settings');
		expect(shell).toContain('href="/"');
		expect(shell).toContain('Library');
		expect(shell).toContain('/welcome');
		expect(shell).toContain('/auth');
		expect(shell).toContain('island-nav');
		expect(shell).toContain('rounded-full');
	});

	test('library page uses editorial masthead composition', () => {
		expect(library).toContain('type-kicker');
		expect(library).toContain('type-masthead');
		expect(library).toContain('ImportDropzone');
		expect(library).toContain('BookCard');
		expect(library).toContain('formatDisplayTitle');
		// paper search field, not naked underline input
		expect(library).toContain('bg-paper');
		expect(library).toContain('Search titles or authors');
	});

	test('continue lead is unboxed magazine spread with underline CTA', () => {
		expect(library).toContain('continue-lead');
		expect(library).toContain('continue-lead-title');
		expect(library).toContain('continue-lead-eyebrow');
		expect(library).toContain('continue-lead-cta');
		expect(library).toContain('cover-object-hero');
		expect(library).toContain('Continuing');
		expect(library).toContain('Resume reading');
		expect(library).toContain('cta-chevron');
		// text CTA with crimson rule — not a filled pill chip on the lead
		expect(library).not.toMatch(/continue-lead-cta[^>]*bg-crimson/);
		expect(appCss).toContain('.continue-lead-title');
		expect(appCss).toContain('.continue-lead-fill');
		// bead only when progress > 0 (magazine hairline, not always-on crimson)
		expect(library).toContain('data-progress={p}');
		expect(appCss).toContain("data-progress='0'");
		// not a bordered dashboard card
		expect(library).not.toMatch(/continue-lead[^>]*(border border-rule|bg-paper)/);
	});

	test('library motion: broadsheet lead + shelf stagger, reduced-motion safe', () => {
		expect(library).toContain('lib-lead');
		expect(library).toContain('lib-lead-title');
		expect(library).toContain('lib-masthead');
		expect(library).toContain('lib-rule');
		expect(appCss).toContain('lib-lead-cover-in');
		expect(appCss).toContain('lib-lead-title-in');
		expect(appCss).toContain('lib-lead-progress-draw');
		expect(appCss).toContain('lib-shelf-card-in');
		expect(appCss).toContain('prefers-reduced-motion');
		const card = readFileSync(join(root, 'src/lib/components/library/BookCard.svelte'), 'utf8');
		expect(card).toContain('lib-shelf-card');
		expect(card).toContain('--i:');
		// Overdrive: view transitions + empty poster + drop press
		expect(layout).toContain('onNavigate');
		expect(layout).toContain('startViewTransition');
		expect(appCss).toContain('::view-transition-old(root)');
		expect(appCss).toContain('lumen-vt-in');
		expect(appCss).toContain('lib-empty-title');
		expect(appCss).toContain('lib-drop-press');
		expect(card).toContain('view-transition-name');
	});

	test('buttons use island pills with ink/crimson', () => {
		expect(button).toContain('rounded-full');
		expect(button).toContain('bg-ink');
		expect(button).toContain('bg-crimson');
		expect(button).toContain('bg-surface');
		expect(button).toContain('cubic-bezier(0.32,0.72,0,1)');
	});

	test('contrast ladder is lifted for dark shell', () => {
		expect(appCss).toContain('--color-ink-mute: #9c9b94');
		expect(appCss).toContain('--color-ink-soft: #c8c7c0');
		expect(appCss).toContain('--color-rule: #3f3f3c');
		expect(shell).toContain('text-ink-soft');
	});

	test('sample cover is broadsheet plate (not atelier indigo seal)', () => {
		expect(seed).toContain('lumen-sample-v4');
		expect(seed).toContain('#0B0B0B');
		expect(seed).toContain('#7A1C1C');
		expect(seed).not.toContain('#1F3A68');
		expect(seed).not.toContain('#E03C2B');
	});

	test('theme-color is nocturne black', () => {
		expect(layout).toContain('#0A0A0A');
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
		expect(library).toContain('Continuing');
		expect(shell).toContain('grain');
		const settings = readFileSync(join(root, 'src/routes/settings/+page.svelte'), 'utf8');
		expect(settings).toContain('theme-swatch');
		expect(settings).toContain('Preview');
		expect(readerPage).toContain('subline');
		expect(readerPage).toContain('reader-stage');
		expect(readerPage).toContain('sampleLine');
	});

	test('cover craft exaggerates object edges', () => {
		expect(appCss).toContain('.cover-object::before');
		expect(appCss).toContain('.cover-object::after');
		expect(appCss).toContain('.cta-chevron');
	});
});
