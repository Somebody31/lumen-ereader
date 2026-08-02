<script lang="ts">
	const keys = [
		{ keys: 'F', action: 'Focus mode — hide chrome' },
		{ keys: 'T', action: 'Table of contents' },
		{ keys: 'B', action: 'Bookmark this place' },
		{ keys: 'Shift+B', action: 'Open bookmarks list' },
		{ keys: ',', action: 'Type & theme panel' },
		{ keys: '+ / −', action: 'Font size' },
		{ keys: '← → or J / K', action: 'EPUB previous / next' },
		{ keys: 'Esc', action: 'Close panel or return to library' }
	];
</script>

<svelte:head>
	<title>About · Lumen</title>
	<meta name="description" content="About Lumen, keyboard shortcuts, and how local-first reading works." />
</svelte:head>

<div class="space-y-12 sm:space-y-14">
	<header class="animate-plate-in max-w-2xl">
		<p class="type-kicker text-crimson">About</p>
		<h1 class="type-masthead mt-2 text-[2.5rem] text-ink sm:text-[3rem]">Lumen</h1>
		<p class="type-body mt-4 text-[1.05rem] leading-relaxed text-ink-soft">
			A sparse, local-first e-reader. Built for long reading sessions — not for browsing a store.
		</p>
		<div class="mt-8 h-px bg-rule"></div>
	</header>

	<section class="animate-plate-in stagger-1 grid gap-8 lg:grid-cols-2">
		<div class="space-y-4">
			<h2 class="type-section text-xl text-ink sm:text-2xl">How it works</h2>
			<ul class="space-y-3">
				<li class="type-body text-ink-soft">
					<span class="font-medium text-ink">Import</span> EPUB, Markdown, or plain text. Files are
					stored in IndexedDB on this device.
				</li>
				<li class="type-body text-ink-soft">
					<span class="font-medium text-ink">Read</span> with themes, typefaces, measure, spacing,
					hyphenation, brightness, and optional keep-awake.
				</li>
				<li class="type-body text-ink-soft">
					<span class="font-medium text-ink">Progress & bookmarks</span> save locally. Optional cloud
					push/pull when the deployment has R2 and a passphrase.
				</li>
			</ul>
		</div>
		<div class="space-y-4">
			<h2 class="type-section text-xl text-ink sm:text-2xl">Type system</h2>
			<p class="type-body text-ink-soft">
				Three faces, one job each:
			</p>
			<ul class="space-y-2.5">
				<li class="type-body text-ink-soft">
					<span class="type-card-title text-[1rem] text-ink">Newsreader</span>
					— mastheads, titles, chapter heads
				</li>
				<li class="type-body text-ink-soft">
					<span class="font-ui font-medium text-ink">Source Sans 3</span>
					— chrome, labels, meta
				</li>
				<li class="type-body text-ink-soft">
					<span class="type-reading text-[1rem] text-ink">Literata</span>
					— long-form body (or your chosen reading face)
				</li>
			</ul>
		</div>
	</section>

	<section
		class="animate-plate-in stagger-2 overflow-hidden rounded-lg border border-rule bg-paper"
	>
		<div class="border-b border-rule px-5 py-4 sm:px-6">
			<h2 class="type-section text-xl text-ink">Keyboard</h2>
			<p class="type-meta mt-1 text-ink-soft">While a book is open</p>
		</div>
		<ul class="divide-y divide-rule">
			{#each keys as row (row.keys)}
				<li class="flex items-baseline justify-between gap-4 px-5 py-3 sm:px-6">
					<span
						class="shrink-0 rounded border border-rule bg-newsprint px-2 py-0.5 font-ui text-[12px] font-medium tabular-nums text-ink"
						>{row.keys}</span
					>
					<span class="type-body min-w-0 flex-1 text-right text-ink-soft sm:text-left"
						>{row.action}</span
					>
				</li>
			{/each}
		</ul>
	</section>

	<section class="animate-plate-in stagger-3 flex flex-wrap gap-3">
		<a href="/" class="no-underline">
			<span
				class="inline-flex items-center justify-center rounded-md bg-crimson px-5 py-2.5 font-ui text-[13px] font-medium text-ink transition-colors hover:bg-crimson-soft"
				>Library</span
			>
		</a>
		<a href="/welcome" class="no-underline">
			<span
				class="inline-flex items-center justify-center rounded-md border border-rule bg-surface px-5 py-2.5 font-ui text-[13px] font-medium text-ink transition-colors hover:border-ink-mute"
				>Welcome</span
			>
		</a>
		<a href="/settings" class="no-underline">
			<span
				class="inline-flex items-center justify-center rounded-md border border-rule bg-surface px-5 py-2.5 font-ui text-[13px] font-medium text-ink transition-colors hover:border-ink-mute"
				>Settings</span
			>
		</a>
	</section>
</div>
