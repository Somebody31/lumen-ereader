<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSession } from '$lib/client/sync';
	import type { SessionInfo } from '$lib/client/types';
	import CoverPlate from '$lib/components/library/CoverPlate.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	const ONBOARD_KEY = 'lumen:onboarded';

	let session = $state<SessionInfo | null>(null);

	const shelfPreview = [
		{ title: 'The Star Room', author: 'Lumen Samples' },
		{ title: 'Night notes', author: 'Field log' },
		{ title: 'False dawns', author: 'Archive' }
	];

	const themes = [
		{ id: 'night', label: 'Night', bg: '#0c0c0c', fg: '#f3f2ed' },
		{ id: 'paper', label: 'Paper', bg: '#f7f5f0', fg: '#1a1c22' },
		{ id: 'sepia', label: 'Sepia', bg: '#e8dcc8', fg: '#3d3428' },
		{ id: 'contrast', label: 'Hi-con', bg: '#000000', fg: '#ffffff' }
	];

	onMount(async () => {
		session = await fetchSession();
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
		content="Lumen is a private e-reader: import EPUB and text, read offline with beautiful type, resume where you left off. Optional cloud sync."
	/>
</svelte:head>

<div class="welcome">
	<!-- ——— Hero: what it is + product stage ——— -->
	<section class="welcome-hero animate-plate-in">
		<div class="welcome-hero-copy">
			<p class="type-kicker text-crimson">Private e-reader</p>
			<h1 class="type-masthead welcome-hero-title text-ink">
				Read your own files offline, beautifully
			</h1>
			<p class="type-body welcome-hero-lede text-ink-soft">
				Lumen is a local-first reader for EPUB, Markdown, and plain text. Drop a book onto your
				shelf, open it in a calm stage with Night, Paper, Sepia, or high-contrast themes, and pick
				up at the same crease tomorrow — even with no network. Cloud sync is optional, not a gate.
			</p>
			<div class="welcome-cta-row">
				<a href="/" class="no-underline" onclick={markOnboarded}>
					<Button variant="secondary" type="button" class="!px-6 !py-3">Open your library</Button>
				</a>
				<a href="/auth?next=/&intent=sync" class="no-underline" onclick={markOnboarded}>
					<Button variant="ghost" type="button" class="!px-6 !py-3">
						{session?.syncAvailable ? 'Sign in to sync' : 'About cloud sync'}
					</Button>
				</a>
			</div>
			<ul class="welcome-proof type-meta text-ink-mute" aria-label="At a glance">
				<li>EPUB · Markdown · TXT</li>
				<li>Works offline by default</li>
				<li>No account to open a book</li>
			</ul>
		</div>

		<!-- Product stage: shows the actual reading UI language -->
		<div class="welcome-stage" aria-hidden="true">
			<div class="welcome-stage-reader stage-night">
				<div class="welcome-stage-progress">
					<div class="welcome-stage-progress-fill" style="width: 34%"></div>
					<span class="welcome-stage-progress-bead"></span>
				</div>
				<div class="welcome-stage-chrome">
					<span class="type-chrome-title text-[13px]">The Star Room</span>
					<span class="type-meta text-[10px] opacity-70">Lumen Samples · 34%</span>
				</div>
				<article class="welcome-stage-prose">
					<h2 class="welcome-stage-h1">The Star Room</h2>
					<p class="welcome-stage-byline">By Lumen Samples · Demo fiction</p>
					<p class="welcome-stage-h2">Opening</p>
					<p class="welcome-stage-drop">
						<span class="welcome-drop-cap">T</span>he booth lights were already low when Mara locked
						the door. Outside, the lobby still hummed with late visitors asking which constellation
						was which.
					</p>
					<p>
						She preferred it that way. Reading weather tables under full house lights felt wrong, as
						if the sky itself had been asked to wait in a queue.
					</p>
				</article>
				<div class="welcome-stage-pct">34%</div>
			</div>

			<div class="welcome-stage-shelf">
				<p class="type-micro text-ink-mute">Your shelf</p>
				<div class="welcome-stage-covers">
					{#each shelfPreview as book, i (book.title)}
						<div class="welcome-stage-cover" style="--i: {i}">
							<div class="cover-object bezel">
								<div class="bezel-inner aspect-[2/3]">
									<CoverPlate title={book.title} author={book.author} />
								</div>
							</div>
						</div>
					{/each}
				</div>
				<p class="type-meta mt-3 text-ink-mute">Resume · progress kept</p>
			</div>
		</div>
	</section>

	<!-- ——— What you actually get ——— -->
	<section class="welcome-section animate-plate-in stagger-1" aria-labelledby="welcome-get">
		<div class="welcome-section-head">
			<p class="type-kicker text-crimson">Inside the app</p>
			<h2 id="welcome-get" class="type-section mt-2 text-[1.75rem] text-ink sm:text-[2.1rem]">
				What Lumen is built for
			</h2>
		</div>

		<div class="welcome-features">
			<article class="welcome-feature">
				<div class="welcome-feature-visual welcome-feature-formats">
					<span class="welcome-format-chip">.epub</span>
					<span class="welcome-format-chip">.md</span>
					<span class="welcome-format-chip">.txt</span>
				</div>
				<div>
					<h3 class="type-card-title text-lg text-ink">Import from your device</h3>
					<p class="type-body mt-2 text-ink-soft">
						Drag a file onto the shelf or use Import in the bar. Files live in this browser’s storage
						first — not in a storefront catalog. A sample story seeds an empty library so you can try
						the reader immediately.
					</p>
				</div>
			</article>

			<article class="welcome-feature welcome-feature-reverse">
				<div class="welcome-feature-visual welcome-feature-themes">
					{#each themes as t (t.id)}
						<div
							class="welcome-theme-swatch"
							style="background: {t.bg}; color: {t.fg}; border-color: color-mix(in srgb, {t.fg} 18%, transparent)"
						>
							<span class="welcome-theme-line" style="background: {t.fg}"></span>
							<span class="type-micro" style="color: {t.fg}">{t.label}</span>
						</div>
					{/each}
				</div>
				<div>
					<h3 class="type-card-title text-lg text-ink">A quiet reading stage</h3>
					<p class="type-body mt-2 text-ink-soft">
						Night, Paper, Sepia, or high contrast. Choose Literata, Newsreader, Source Sans, or system
						type; size, measure, spacing, alignment, hyphenation, brightness, and keep-awake. Focus
						mode hides chrome. Progress, bookmarks, and EPUB contents stay under your hand.
					</p>
				</div>
			</article>

			<article class="welcome-feature">
				<div class="welcome-feature-visual welcome-feature-local">
					<div class="welcome-local-stack">
						<div class="welcome-local-layer">
							<span class="type-micro">This device</span>
							<span class="type-meta">IndexedDB · source of truth</span>
						</div>
						<div class="welcome-local-layer welcome-local-cloud">
							<span class="type-micro">Optional cloud</span>
							<span class="type-meta">
								{session?.syncAvailable
									? 'Push / pull when signed in'
									: 'Configure R2 + passphrase to enable'}
							</span>
						</div>
					</div>
				</div>
				<div>
					<h3 class="type-card-title text-lg text-ink">Local-first, sync second</h3>
					<p class="type-body mt-2 text-ink-soft">
						Opening a chapter never waits on an account or the network. When this deployment has
						cloud storage, sign in with a passphrase to push and pull the same shelf across devices —
						from Settings or the Sign in page.
					</p>
				</div>
			</article>
		</div>
	</section>

	<!-- ——— How you move through the app ——— -->
	<section class="welcome-section animate-plate-in stagger-2" aria-labelledby="welcome-flow">
		<div class="welcome-section-head">
			<p class="type-kicker text-crimson">The path</p>
			<h2 id="welcome-flow" class="type-section mt-2 text-[1.75rem] text-ink sm:text-[2.1rem]">
				How a session goes
			</h2>
			<p class="type-body mt-3 max-w-xl text-ink-soft">
				Same spine as any serious reader: shelf, book, back to shelf. Marketing and help sit off to
				the side.
			</p>
		</div>

		<ol class="welcome-path">
			<li class="welcome-path-step">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">01</span>
				<div>
					<p class="type-card-title text-ink">Library</p>
					<p class="type-meta mt-1 text-ink-soft">
						Home is your shelf — continue reading, search, import. Not a pitch deck.
					</p>
				</div>
			</li>
			<li class="welcome-path-step">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">02</span>
				<div>
					<p class="type-card-title text-ink">Open a book</p>
					<p class="type-meta mt-1 text-ink-soft">
						Immersive page. Chrome fades; Esc returns you to the shelf.
					</p>
				</div>
			</li>
			<li class="welcome-path-step">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">03</span>
				<div>
					<p class="type-card-title text-ink">Tune type</p>
					<p class="type-meta mt-1 text-ink-soft">
						Theme and typography from the reader or Settings defaults for new sessions.
					</p>
				</div>
			</li>
			<li class="welcome-path-step">
				<span class="welcome-path-num type-micro text-crimson" aria-hidden="true">04</span>
				<div>
					<p class="type-card-title text-ink">Sync only if you need it</p>
					<p class="type-meta mt-1 text-ink-soft">
						Passphrase sign-in unlocks push/pull. Never required to read offline.
					</p>
				</div>
			</li>
		</ol>
	</section>

	<!-- ——— Type system specimen (shows the craft) ——— -->
	<section class="welcome-specimen animate-plate-in stagger-2" aria-labelledby="welcome-type">
		<div class="welcome-specimen-grid">
			<div>
				<p class="type-kicker text-crimson">Editorial faces</p>
				<h2 id="welcome-type" class="type-section mt-2 text-[1.75rem] text-ink sm:text-[2rem]">
					Type built for long sessions
				</h2>
				<p class="type-body mt-3 text-ink-soft">
					Newsreader for titles and display, Source Sans 3 for chrome, Literata for the page —
					optical sizes tuned so a chapter head and a footnote don’t share the same face.
				</p>
			</div>
			<div class="welcome-specimen-faces">
				<div class="welcome-specimen-row">
					<span class="type-micro text-ink-mute">Display</span>
					<p class="type-masthead text-[1.85rem] text-ink sm:text-[2.25rem]">The Star Room</p>
					<span class="type-meta text-ink-mute">Newsreader</span>
				</div>
				<div class="welcome-specimen-rule"></div>
				<div class="welcome-specimen-row">
					<span class="type-micro text-ink-mute">Reading</span>
					<p class="type-reading text-[1.05rem] leading-relaxed text-ink-soft">
						The booth lights were already low when Mara locked the door.
					</p>
					<span class="type-meta text-ink-mute">Literata</span>
				</div>
				<div class="welcome-specimen-rule"></div>
				<div class="welcome-specimen-row">
					<span class="type-micro text-ink-mute">UI</span>
					<p class="type-nav text-ink">Library · Settings · Import</p>
					<span class="type-meta text-ink-mute">Source Sans 3</span>
				</div>
			</div>
		</div>
	</section>

	<!-- ——— Close ——— -->
	<section class="welcome-close animate-plate-in stagger-3">
		<p class="type-eyebrow text-ink-mute">No catalog. No feed. Just the page.</p>
		<h2 class="type-section mt-3 text-[1.85rem] text-ink sm:text-[2.25rem]">
			Start on your shelf
		</h2>
		<p class="type-body mx-auto mt-3 max-w-md text-ink-soft">
			Open the library to import a file or read the sample. Sign in only if you want the same books
			on another device.
		</p>
		<div class="welcome-cta-row welcome-cta-row-center mt-8">
			<a href="/" class="no-underline" onclick={markOnboarded}>
				<Button variant="secondary" type="button" class="!px-7 !py-3">Open library</Button>
			</a>
			<a
				href="/about"
				class="type-meta text-ink-soft no-underline underline decoration-rule underline-offset-4 hover:text-ink"
			>
				Keyboard shortcuts & about
			</a>
		</div>
		{#if session && !session.syncAvailable}
			<p class="type-meta mx-auto mt-6 max-w-sm text-ink-mute">
				This deployment has no cloud yet — reading stays fully local.
			</p>
		{/if}
	</section>
</div>
