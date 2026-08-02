<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSession } from '$lib/client/sync';
	import type { SessionInfo } from '$lib/client/types';
	import Button from '$lib/components/ui/Button.svelte';

	const ONBOARD_KEY = 'lumen:onboarded';

	let session = $state<SessionInfo | null>(null);
	let welcomeEl = $state<HTMLElement | null>(null);
	/** Live product stage theme — linked to theme swatches below */
	let stageTheme = $state<'night' | 'paper' | 'sepia' | 'contrast'>('night');

	const themes = [
		{ id: 'night' as const, label: 'Night', bg: '#0c0c0c', fg: '#f3f2ed', progress: '#d4d0c8' },
		{ id: 'paper' as const, label: 'Paper', bg: '#f7f5f0', fg: '#1a1c22', progress: '#5a5a56' },
		{ id: 'sepia' as const, label: 'Sepia', bg: '#e8dcc8', fg: '#3d3428', progress: '#6b5e4e' },
		{ id: 'contrast' as const, label: 'Hi-con', bg: '#000000', fg: '#ffffff', progress: '#ffffff' }
	];

	const activeStage = $derived(themes.find((t) => t.id === stageTheme) ?? themes[0]);

	onMount(() => {
		void fetchSession().then((s) => {
			session = s;
		});

		const root = welcomeEl;
		if (!root || typeof IntersectionObserver === 'undefined') return;

		const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!motionOk) return;

		/* Gate CSS pre-hide so content stays visible without JS */
		root.classList.add('welcome-scroll');
		/* Scroll-timeline extras when supported (CSS does the rest) */
		if (CSS.supports?.('animation-timeline', 'scroll()')) {
			root.classList.add('welcome-scroll-drive');
		}

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.classList.add('is-in-view');
					io.unobserve(entry.target);
				}
			},
			{ root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.14 }
		);

		for (const node of root.querySelectorAll('[data-welcome-scroll]')) {
			io.observe(node);
		}

		return () => io.disconnect();
	});

	function markOnboarded() {
		try {
			localStorage.setItem(ONBOARD_KEY, '1');
		} catch {
			/* private mode */
		}
	}
</script>

<svelte:head>
	<title>Welcome · Lumen</title>
	<meta
		name="description"
		content="Lumen is a private e-reader for your own EPUB, Markdown, and text files. Read offline, pick up where you left off. Account optional."
	/>
</svelte:head>

<div class="welcome" bind:this={welcomeEl}>
	<!-- Scroll-linked ink hairline (CSS scroll-timeline when available) -->
	<div class="welcome-scroll-meter" aria-hidden="true">
		<div class="welcome-scroll-meter-fill"></div>
	</div>

	<!-- ——— Hero: focal “page opens” sequence (load) ——— -->
	<section class="welcome-hero">
		<div class="welcome-hero-copy">
			<p class="type-kicker text-crimson welcome-hero-kicker">Private e-reader</p>
			<h1 class="type-masthead welcome-hero-title text-ink">
				Read your own books offline
			</h1>
			<p class="type-body welcome-hero-lede text-ink-soft">
				Lumen is an e-reader for files you already have — EPUB, Markdown, or plain text. Import a
				book from your device, read in a calm full-page view, and come back later at the same place.
				Nothing requires an account. Everything works without a network.
			</p>
			<div class="welcome-cta-row">
				<a href="/" class="no-underline" onclick={markOnboarded}>
					<Button variant="secondary" type="button" class="!px-6 !py-3">Open the library</Button>
				</a>
				{#if session?.syncAvailable}
					<a href="/auth?next=/&intent=sync" class="no-underline" onclick={markOnboarded}>
						<Button variant="ghost" type="button" class="!px-6 !py-3">Sign in to sync</Button>
					</a>
				{:else}
					<a href="/about" class="no-underline" onclick={markOnboarded}>
						<Button variant="ghost" type="button" class="!px-6 !py-3">How it works</Button>
					</a>
				{/if}
			</div>
			<ul class="welcome-proof type-meta text-ink-mute" aria-label="At a glance">
				<li>EPUB · Markdown · TXT</li>
				<li>Works offline</li>
				<li>No account required</li>
			</ul>
		</div>

		<figure class="welcome-stage">
			<div
				class="welcome-stage-reader stage-{stageTheme}"
				aria-hidden="true"
				style:--stage-bg={activeStage.bg}
				style:--stage-fg={activeStage.fg}
				style:--stage-progress={activeStage.progress}
			>
				<div class="welcome-stage-progress">
					<div class="welcome-stage-progress-fill" style="width: 34%"></div>
					<span class="welcome-stage-progress-bead"></span>
				</div>
				<article class="welcome-stage-prose">
					<p class="welcome-stage-kicker">Sample · The Star Room</p>
					<h2 class="welcome-stage-h1">The Star Room</h2>
					<p class="welcome-stage-byline">By Lumen Samples · Demo fiction</p>
					<p class="welcome-stage-h2">Opening</p>
					<p class="welcome-stage-drop">
						<span class="welcome-drop-cap">T</span>he booth lights were already low when Mara locked
						the door. Outside, the lobby still hummed with late visitors asking which constellation
						was which.
					</p>
					<p class="welcome-stage-body">
						She preferred it that way. Reading weather tables under full house lights felt wrong, as
						if the sky itself had been asked to wait in a queue.
					</p>
				</article>
				<div class="welcome-stage-pct">34%</div>
			</div>
			<figcaption class="welcome-stage-caption type-meta text-ink-mute">
				Live preview — try a theme below. Your book fills the page; progress and type stay adjustable.
			</figcaption>
		</figure>
	</section>

	<!-- ——— What you can do (scroll) ——— -->
	<section class="welcome-section" aria-labelledby="welcome-get">
		<div class="welcome-section-head" data-welcome-scroll="head">
			<p class="type-kicker text-crimson">What it does</p>
			<h2 id="welcome-get" class="type-section mt-2 text-[1.75rem] text-ink sm:text-[2.1rem]">
				Built for reading your files
			</h2>
			<p class="type-body mt-3 max-w-xl text-ink-soft">
				Not a store, catalog, or social feed. You bring the books; Lumen keeps them ready to open.
			</p>
		</div>

		<div class="welcome-features">
			<article class="welcome-feature" data-welcome-scroll="feature" style="--i: 0">
				<div class="welcome-feature-visual welcome-feature-formats">
					<span class="welcome-format-chip">.epub</span>
					<span class="welcome-format-chip">.md</span>
					<span class="welcome-format-chip">.txt</span>
				</div>
				<div>
					<h3 class="type-card-title text-lg text-ink">Import from your device</h3>
					<p class="type-body mt-2 text-ink-soft">
						Drag a file onto the library, or use Import. Books are stored in this browser so you can
						open them again anytime. New libraries include a short sample story so you can try the
						reader before adding your own files.
					</p>
				</div>
			</article>

			<article
				class="welcome-feature welcome-feature-reverse"
				data-welcome-scroll="feature"
				style="--i: 0"
			>
				<div
					class="welcome-feature-visual welcome-feature-themes"
					role="group"
					aria-label="Preview reading themes"
				>
					{#each themes as t (t.id)}
						<button
							type="button"
							class="welcome-theme-swatch"
							class:is-active={stageTheme === t.id}
							style="background: {t.bg}; color: {t.fg}; border-color: color-mix(in srgb, {t.fg} 18%, transparent)"
							aria-pressed={stageTheme === t.id}
							aria-label="Preview {t.label} theme"
							onclick={() => (stageTheme = t.id)}
						>
							<span class="welcome-theme-line" style="background: {t.fg}"></span>
							<span class="type-micro" style="color: {t.fg}">{t.label}</span>
						</button>
					{/each}
				</div>
				<div>
					<h3 class="type-card-title text-lg text-ink">Comfortable for long sessions</h3>
					<p class="type-body mt-2 text-ink-soft">
						Choose Night, Paper, Sepia, or high contrast — the stage above updates live. Adjust font,
						size, spacing, and margins. Hide the controls when you want a full page, keep your place
						with progress and bookmarks, and use the table of contents in EPUBs.
					</p>
				</div>
			</article>

			<article class="welcome-feature" data-welcome-scroll="feature" style="--i: 0">
				<div class="welcome-feature-visual welcome-feature-local">
					<div class="welcome-local-stack">
						<div class="welcome-local-layer">
							<span class="type-micro">This device</span>
							<span class="type-meta">Books stay in your browser</span>
						</div>
						<div class="welcome-local-layer welcome-local-cloud">
							<span class="type-micro">Optional cloud</span>
							<span class="type-meta">
								{session?.syncAvailable
									? 'Sync when you sign in'
									: 'Same library on other devices when enabled'}
							</span>
						</div>
					</div>
				</div>
				<div>
					<h3 class="type-card-title text-lg text-ink">Private by default</h3>
					<p class="type-body mt-2 text-ink-soft">
						Reading never depends on a login or a live connection. If cloud sync is available on this
						site, you can sign in with a passphrase later to copy your library between devices — still
						optional, never required to open a book.
					</p>
				</div>
			</article>
		</div>
	</section>

	<!-- ——— How to start (scroll + list stagger) ——— -->
	<section class="welcome-section" aria-labelledby="welcome-flow">
		<div class="welcome-section-head" data-welcome-scroll="head">
			<p class="type-kicker text-crimson">Getting started</p>
			<h2 id="welcome-flow" class="type-section mt-2 text-[1.75rem] text-ink sm:text-[2.1rem]">
				How a typical visit goes
			</h2>
			<p class="type-body mt-3 max-w-xl text-ink-soft">
				Library for your books, full page when you open one, back when you are done.
			</p>
		</div>

		<ol class="welcome-path">
			<li class="welcome-path-step" data-welcome-scroll="path" style="--i: 0">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">01</span>
				<div>
					<p class="type-card-title text-ink">Open the library</p>
					<p class="type-meta mt-1 text-ink-soft">
						Your home screen: continue where you left off, search, or import a file.
					</p>
				</div>
			</li>
			<li class="welcome-path-step" data-welcome-scroll="path" style="--i: 1">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">02</span>
				<div>
					<p class="type-card-title text-ink">Open a book</p>
					<p class="type-meta mt-1 text-ink-soft">
						The reading page takes over. Esc (or the back control) returns you to the library.
					</p>
				</div>
			</li>
			<li class="welcome-path-step" data-welcome-scroll="path" style="--i: 2">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">03</span>
				<div>
					<p class="type-card-title text-ink">Adjust the page</p>
					<p class="type-meta mt-1 text-ink-soft">
						Theme and type from the reader toolbar, or set defaults in Settings for next time.
					</p>
				</div>
			</li>
			<li class="welcome-path-step" data-welcome-scroll="path" style="--i: 3">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">04</span>
				<div>
					<p class="type-card-title text-ink">Sync only if you want it</p>
					<p class="type-meta mt-1 text-ink-soft">
						Sign in later to keep the same library on another device. You can ignore this forever.
					</p>
				</div>
			</li>
		</ol>
	</section>

	<!-- ——— Type specimen (scroll) ——— -->
	<section class="welcome-specimen" aria-labelledby="welcome-type" data-welcome-scroll="plate">
		<div class="welcome-specimen-grid">
			<div>
				<p class="type-kicker text-crimson">Typography</p>
				<h2 id="welcome-type" class="type-section mt-2 text-[1.75rem] text-ink sm:text-[2rem]">
					Type meant for long reading
				</h2>
				<p class="type-body mt-3 text-ink-soft">
					Titles use Newsreader, the page uses Literata, and menus use Source Sans — chosen so
					chapter heads and body text stay comfortable for hours, not just a quick skim.
				</p>
			</div>
			<div class="welcome-specimen-faces">
				<div class="welcome-specimen-row" data-welcome-scroll="face" style="--i: 0">
					<span class="type-micro text-ink-mute">Titles</span>
					<p class="type-masthead text-[1.85rem] text-ink sm:text-[2.25rem]">The Star Room</p>
					<span class="type-meta text-ink-mute">Newsreader</span>
				</div>
				<div class="welcome-specimen-rule" data-welcome-scroll="rule" style="--i: 0"></div>
				<div class="welcome-specimen-row" data-welcome-scroll="face" style="--i: 1">
					<span class="type-micro text-ink-mute">Reading</span>
					<p class="type-reading text-[1.05rem] leading-relaxed text-ink-soft">
						The booth lights were already low when Mara locked the door.
					</p>
					<span class="type-meta text-ink-mute">Literata</span>
				</div>
				<div class="welcome-specimen-rule" data-welcome-scroll="rule" style="--i: 1"></div>
				<div class="welcome-specimen-row" data-welcome-scroll="face" style="--i: 2">
					<span class="type-micro text-ink-mute">Menus</span>
					<p class="type-nav text-ink">Library · Settings · Import</p>
					<span class="type-meta text-ink-mute">Source Sans 3</span>
				</div>
			</div>
		</div>
	</section>

	<!-- ——— Close (scroll) ——— -->
	<section class="welcome-close" data-welcome-scroll="close">
		<p class="type-eyebrow text-ink-mute">No catalog. No feed. Just your books.</p>
		<h2 class="type-section mt-3 text-[1.85rem] text-ink sm:text-[2.25rem]">
			Ready when you are
		</h2>
		<p class="type-body mx-auto mt-3 max-w-md text-ink-soft">
			Open the library to try the sample story or import a file from your computer. You can sign in
			later if you want the same books on another device.
		</p>
		<div class="welcome-cta-row welcome-cta-row-center mt-8">
			<a href="/" class="no-underline" onclick={markOnboarded}>
				<Button variant="secondary" type="button" class="!px-7 !py-3">Open the library</Button>
			</a>
			<a
				href="/about"
				class="type-meta text-ink-soft no-underline underline decoration-rule underline-offset-4 hover:text-ink"
			>
				About & keyboard shortcuts
			</a>
		</div>
		{#if session && !session.syncAvailable}
			<p class="type-meta mx-auto mt-6 max-w-sm text-ink-mute">
				Cloud sync is not enabled on this site — everything stays on your device.
			</p>
		{/if}
	</section>
</div>
