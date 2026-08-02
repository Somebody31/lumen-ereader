import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');

function read(rel: string) {
	return readFileSync(join(root, rel), 'utf8');
}

describe('landing and extra pages (shipped routes)', () => {
	test('root landing is the default entry with headline and CTAs', () => {
		const path = 'src/routes/+page.svelte';
		expect(existsSync(join(root, path))).toBe(true);
		const src = read(path);
		expect(src).toContain('Welcome · Lumen');
		expect(src).toContain('Read without the storefront');
		expect(src).toContain('Open library');
		expect(src).toContain('href="/library"');
		expect(src).toContain('href="/about"');
		expect(src).toContain('type-masthead');
		expect(src).toContain('landing');
	});

	test('legacy /welcome redirects to root landing', () => {
		const path = 'src/routes/welcome/+page.ts';
		expect(existsSync(join(root, path))).toBe(true);
		const src = read(path);
		expect(src).toContain("redirect(308, '/')");
	});

	test('about page exists with keys and type system copy', () => {
		const path = 'src/routes/about/+page.svelte';
		expect(existsSync(join(root, path))).toBe(true);
		const src = read(path);
		expect(src).toContain('About · Lumen');
		expect(src).toContain('Keyboard');
		expect(src).toContain('Focus mode');
		expect(src).toContain('Newsreader');
		expect(src).toContain('Source Sans 3');
		expect(src).toContain('Literata');
		expect(src).toContain('type-masthead');
		expect(src).toContain('href="/library"');
	});

	test('shell wires Library at /library, logo to home landing', () => {
		const shell = read('src/lib/components/shell/AppShell.svelte');
		expect(shell).toContain('href="/library"');
		expect(shell).toContain('href="/settings"');
		expect(shell).toContain('href="/about"');
		expect(shell).toContain('href="/"');
		expect(shell).toContain('Library');
		expect(shell).toContain('Settings');
		expect(shell).toContain('About');
		expect(shell).toContain('aria-current');
		expect(shell).toContain("path === '/library'");
		// reader still chrome-free
		expect(shell).toContain("path.startsWith('/read/')");
	});

	test('library lives on /library (root is landing)', () => {
		const library = read('src/routes/library/+page.svelte');
		expect(library).toContain('Your shelf');
		expect(library).toContain('Library · Lumen');
		expect(library).toContain('continue-lead');
		const landing = read('src/routes/+page.svelte');
		expect(landing).toContain('landing');
		expect(landing).toContain('href="/library"');
		// shelf continue-lead block is library-only, not root marketing page structure
		expect(landing).not.toContain('continue-lead-title');
	});
});

describe('book rendering surfaces', () => {
	test('TextReader applies prefs CSS vars and end mark', () => {
		const src = read('src/lib/components/reader/TextReader.svelte');
		expect(src).toContain('style:--reader-font');
		expect(src).toContain('style:--reader-size');
		expect(src).toContain('style:--reader-lh');
		expect(src).toContain('reader-prose');
		expect(src).toContain('reader-end-mark');
		expect(src).toContain('fontStack(prefs.fontFamily)');
	});

	test('EpubReader themes heads, links, blockquotes with prefs', () => {
		const src = read('src/lib/components/reader/EpubReader.svelte');
		expect(src).toContain('bodyTheme');
		expect(src).toContain('fontStack(prefs.fontFamily)');
		expect(src).toContain("'h1, h2, h3, h4'");
		expect(src).toContain('blockquote');
		expect(src).toContain('letter-spacing');
		expect(src).toContain('hyphens');
		expect(src).toContain('Newsreader');
		// Bolder parity with text prose
		expect(src).toContain("'h2 + p::first-letter'");
		expect(src).toContain("'h1 + p'");
		expect(src).toMatch(/border-left.*link|border-left.*\$\{link\}/);
	});
});
