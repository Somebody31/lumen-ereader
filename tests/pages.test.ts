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
		expect(src).toContain('Open the library');
		expect(src).toContain('href="/"');
		expect(src).toContain('/auth?next=/&intent=sync');
		// External-visitor clarity: what it is, how to start, no internal jargon
		expect(src).toContain('EPUB');
		expect(src).toContain('No account required');
		expect(src).toContain('welcome-stage-caption');
		expect(src).toContain('The Star Room');
		expect(src).toContain('Literata');
		expect(src).toContain('Newsreader');
		expect(src).toContain('welcome-path');
		expect(src).toContain('Getting started');
		expect(src).not.toContain('IndexedDB');
		expect(src).not.toContain('R2');
		expect(src).not.toContain('deployment');
		// Not a confusing dual mock (reader + fake shelf column)
		expect(src).not.toContain('welcome-stage-shelf');
		expect(src).not.toContain('CoverPlate');
		// no forced redirect file
		expect(existsSync(join(root, 'src/routes/welcome/+page.ts'))).toBe(false);
		const css = read('src/app.css');
		expect(css).toContain('.welcome-hero');
		expect(css).toContain('.welcome-stage-reader');
		// Authored welcome motion (load focal + scroll reveals)
		expect(css).toContain('welcome-title-unmask');
		expect(css).toContain('welcome-stage-seat');
		expect(css).toContain('welcome-progress-draw');
		expect(css).toContain('welcome-path-step-in');
		expect(css).toContain('welcome-scroll');
		expect(css).toContain('data-welcome-scroll');
		expect(css).toContain('is-in-view');
		expect(src).toContain('welcome-hero-kicker');
		expect(src).toContain('data-welcome-scroll');
		expect(src).toContain('IntersectionObserver');
		expect(src).not.toContain('animate-plate-in');
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

	test('contents list differentiates chapters (index + hierarchy)', () => {
		const src = read('src/routes/read/[id]/+page.svelte');
		const css = read('src/app.css');
		expect(src).toContain('reader-toc-list');
		expect(src).toContain('reader-toc-index');
		expect(src).toContain('reader-toc-item-top');
		expect(src).toContain('reader-toc-item-nested');
		expect(src).toContain('reader-toc-break');
		expect(css).toContain('.reader-toc-item-top');
		expect(css).toContain('.reader-toc-index');
		expect(css).toContain('.reader-toc-break');
		expect(css).toContain('reader-toc-break-bead');
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
		// Serialized CSS with !important so publisher styles cannot shove layout
		expect(src).toContain('buildThemeCss');
		expect(src).toContain('registerCss');
		expect(src).toMatch(/fontStack\((?:p|prefs)\.fontFamily\)/);
		expect(src).toContain('blockquote');
		expect(src).toContain('letter-spacing');
		expect(src).toContain('hyphens');
		expect(src).toContain('Newsreader');
		expect(src).toContain('h1 + p');
		expect(src).toMatch(/border-left.*\$\{link\}/);
		// Chapter separation in continuous scroll (air + end-mark + open bead)
		expect(src).toContain('body::after');
		expect(src).toContain('body > h1:first-child');
		expect(src).toMatch(/margin-top:\s*3\.5em/);
		expect(src).toContain('radial-gradient'); // chapter-close asterism
		// Continuous + scrolled stacks spine sections (default only paints cover)
		expect(src).toContain("manager: 'continuous'");
		expect(src).toContain("flow: 'scrolled'");
		expect(src).toContain('safeDisplay');
		expect(src).toContain('waitForHostSize');
		expect(src).toContain('fillContinuous');
		expect(src).toContain('attachWheelChain');
		// Stage width host-bound; measure (ch) + margin prefs applied to body column
		expect(src).toContain('clampMediaInContents');
		expect(src).toContain('lockStageWidth');
		expect(src).toMatch(/max-width:\s*\$\{measure\}ch/);
		// Vertical section air (not zero) so stacked chapters do not abut
		expect(src).toMatch(
			/padding:\s*\$\{sectionPadTop\}px \$\{rightPad\}px \$\{sectionPadBottom\}px \$\{leftPad\}px/
		);
		expect(src).toContain('sectionPadBottom');
		expect(src).toContain("padding-top', `${sectionPadTop}px`");
		expect(src).toContain("padding-bottom', `${sectionPadBottom}px`");
		expect(src).toMatch(/img[\s\S]*?max-width:\s*100%/);
		expect(src).not.toContain('contentWidth(frameW)');
		// Live type panel: displayReady is $state; activePrefs + format patch after size() wipe
		expect(src).toContain('let displayReady = $state(false)');
		expect(src).toContain('applyLivePrefs');
		expect(src).toContain('applyPrefs');
		// Contents-tab chapter nav: resolve nav↔spine paths + force scroll in continuous
		expect(src).toContain('resolveTocTarget');
		expect(src).toContain('buildReaderToc');
		expect(src).toContain('emitToc');
		expect(src).toContain('forceScrollToResolved');
		expect(src).toContain('export async function goTo');
		// Flicker guard: no expand/resize restamp storm
		expect(src).not.toContain("contents.on?.('expand'");
		expect(src).toContain('themeBusy');
		expect(src).toContain('stampBodyInline');
		expect(src).toContain('activePrefs');
		expect(src).toContain('patchLayoutFormat');
		expect(src).toContain('buildFontFaceCss');
		// Drop caps float-none — floats break reflow
		expect(src).toMatch(/p::first-letter[\s\S]*?float:\s*none/);
		expect(src).toContain("spread: 'none'");
		// Open zip via ArrayBuffer (object URLs request META-INF from site origin)
		expect(src).toContain('arrayBuffer');
		expect(src).toContain('resolveEpub');
		expect(src).toContain('book.ready');
		expect(src).not.toContain('createObjectURL');
	});
});
