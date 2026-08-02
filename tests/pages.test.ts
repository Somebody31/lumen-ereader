import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');

function read(rel: string) {
	return readFileSync(join(root, rel), 'utf8');
}

describe('natural e-reader IA (shipped routes)', () => {
	test('library is day-to-day home at /', () => {
		const path = 'src/routes/+page.svelte';
		expect(existsSync(join(root, path))).toBe(true);
		const src = read(path);
		expect(src).toContain('Library · Lumen');
		expect(src).toContain('Your shelf');
		expect(src).toContain('continue-lead');
		expect(src).toContain('continue-lead-title');
		expect(src).toContain('ImportDropzone');
		// sync door, not marketing landing
		expect(src).toContain('/auth?next=/&intent=sync');
		expect(src).not.toContain('Read without the storefront');
		expect(src).not.toContain('class="landing');
	});

	test('legacy /library redirects to home shelf', () => {
		const path = 'src/routes/library/+page.ts';
		expect(existsSync(join(root, path))).toBe(true);
		const src = read(path);
		expect(src).toContain("redirect(308, '/')");
	});

	test('welcome is a product showcase with stage, features, and CTAs', () => {
		const path = 'src/routes/welcome/+page.svelte';
		expect(existsSync(join(root, path))).toBe(true);
		const src = read(path);
		expect(src).toContain('Welcome · Lumen');
		expect(src).toContain('welcome-hero');
		expect(src).toContain('welcome-stage-reader');
		expect(src).toContain('Open your library');
		expect(src).toContain('href="/"');
		expect(src).toContain('/auth?next=/&intent=sync');
		// Shows what the product is, not empty slogans only
		expect(src).toContain('EPUB');
		expect(src).toContain('local-first');
		expect(src).toContain('CoverPlate');
		expect(src).toContain('The Star Room');
		expect(src).toContain('Literata');
		expect(src).toContain('Newsreader');
		expect(src).toContain('welcome-path');
		// no forced redirect file
		expect(existsSync(join(root, 'src/routes/welcome/+page.ts'))).toBe(false);
		const css = read('src/app.css');
		expect(css).toContain('.welcome-hero');
		expect(css).toContain('.welcome-stage-reader');
	});

	test('auth page is dedicated sign-in for sync', () => {
		const path = 'src/routes/auth/+page.svelte';
		expect(existsSync(join(root, path))).toBe(true);
		const src = read(path);
		expect(src).toContain('Sign in · Lumen');
		expect(src).toContain('fetchSession');
		expect(src).toContain('login');
		expect(src).toContain('Continue offline');
		expect(src).toContain('safeNext');
		expect(src).toContain('passphrase');
	});

	test('about page links to library home and auth', () => {
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
		expect(src).toContain('href="/"');
		expect(src).toContain('href="/auth"');
		expect(src).not.toContain('href="/library"');
	});

	test('shell: Library at /, primary nav Library|Settings, slim auth/welcome', () => {
		const shell = read('src/lib/components/shell/AppShell.svelte');
		expect(shell).toContain('href="/"');
		expect(shell).toContain('href="/settings"');
		expect(shell).toContain('Library');
		expect(shell).toContain('Settings');
		expect(shell).toContain('isAuth');
		expect(shell).toContain('isWelcome');
		expect(shell).toContain('isSlim');
		expect(shell).toContain("path === '/'");
		expect(shell).toContain("path.startsWith('/read/')");
		// Primary chip nav is Library + Settings only (About is footer)
		const primaryNav = shell.match(
			/aria-label="Primary"[\s\S]*?<\/nav>/
		)?.[0];
		expect(primaryNav).toBeTruthy();
		expect(primaryNav).toContain('Library');
		expect(primaryNav).toContain('/settings');
		expect(primaryNav).not.toContain('/about');
	});

	test('settings delegates passphrase to /auth', () => {
		const src = read('src/routes/settings/+page.svelte');
		expect(src).toContain('/auth?next=/settings');
		expect(src).toContain('Sign in to sync');
		expect(src).not.toContain('handleLogin');
		expect(src).not.toContain('bind:value={passphrase}');
	});

	test('reader back target is library home /', () => {
		const src = read('src/routes/read/[id]/+page.svelte');
		expect(src).toContain("goto('/')");
		expect(src).toContain('href="/"');
		expect(src).not.toContain("goto('/library')");
		expect(src).not.toContain('href="/library"');
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
		expect(src).toContain("'h2 + p::first-letter'");
		expect(src).toContain("'h1 + p'");
		expect(src).toMatch(/border-left.*link|border-left.*\$\{link\}/);
	});
});
