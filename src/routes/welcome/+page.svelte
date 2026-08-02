<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSession } from '$lib/client/sync';
	import type { SessionInfo } from '$lib/client/types';
	import Button from '$lib/components/ui/Button.svelte';

	const ONBOARD_KEY = 'lumen:onboarded';

	let session = $state<SessionInfo | null>(null);

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
		content="Lumen is a local-first e-reader. Import EPUB and text, read offline, sync only if you want."
	/>
</svelte:head>

<div class="landing mx-auto max-w-2xl space-y-12 pt-4 sm:space-y-14 sm:pt-8">
	<section class="animate-plate-in text-center">
		<p class="type-kicker text-crimson">Local-first e-reader</p>
		<h1
			class="type-masthead mx-auto mt-4 max-w-[14ch] text-[2.5rem] text-ink sm:text-[3.25rem] md:text-[3.75rem]"
		>
			Your shelf, not a store
		</h1>
		<p
			class="type-body mx-auto mt-5 max-w-lg text-[1.05rem] leading-relaxed text-ink-soft sm:text-[1.125rem]"
		>
			Import EPUB, Markdown, or plain text. Books stay on this device. Open a chapter offline — cloud
			sync is optional when you want the same shelf on another machine.
		</p>

		<div class="mt-9 flex flex-wrap items-center justify-center gap-3">
			<a href="/" class="no-underline" onclick={markOnboarded}>
				<Button variant="secondary" type="button" class="!px-6 !py-3">Start reading</Button>
			</a>
			<a href="/auth?next=/&intent=sync" class="no-underline" onclick={markOnboarded}>
				<Button variant="ghost" type="button" class="!px-6 !py-3">
					{session?.syncAvailable ? 'Sign in to sync' : 'Cloud sync'}
				</Button>
			</a>
		</div>
		{#if session && !session.syncAvailable}
			<p class="type-meta mx-auto mt-4 max-w-sm text-ink-mute">
				Cloud isn’t configured on this deployment. You can still read fully offline.
			</p>
		{/if}
	</section>

	<section
		class="animate-plate-in stagger-1 grid gap-4 sm:grid-cols-3 sm:gap-4"
		aria-label="How Lumen works"
	>
		{#each [
			{ title: 'Shelf first', body: 'Open the app → your library. No catalog, no feed.' },
			{ title: 'Read offline', body: 'Import a file and keep going with no network.' },
			{ title: 'Sync if you want', body: 'Sign in only when push/pull across devices matters.' }
		] as card, i (i)}
			<article
				class="rounded-lg border border-rule bg-paper px-4 py-5 sm:px-5"
				style="animation-delay: {i * 50}ms"
			>
				<h2 class="type-card-title text-base text-ink">{card.title}</h2>
				<p class="type-meta mt-2 text-ink-soft">{card.body}</p>
			</article>
		{/each}
	</section>

	<section class="animate-plate-in stagger-2 text-center">
		<p class="type-eyebrow text-ink-mute">No account required to open a book.</p>
		<div class="mt-5 flex flex-wrap items-center justify-center gap-4">
			<a
				href="/about"
				class="type-meta text-ink-soft no-underline underline decoration-rule underline-offset-4 hover:text-ink"
				>About & keys</a
			>
			<a
				href="/"
				class="continue-lead-cta inline-flex no-underline"
				onclick={markOnboarded}
			>
				Go to library
				<span class="cta-chevron" aria-hidden="true">→</span>
			</a>
		</div>
	</section>
</div>
