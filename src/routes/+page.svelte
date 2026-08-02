<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head>
	<title>Welcome · Lumen</title>
	<meta
		name="description"
		content="Lumen is a local-first e-reader. Import EPUB and text, read offline, sync only if you want."
	/>
</svelte:head>

<div class="landing space-y-16 sm:space-y-24">
	<section class="animate-plate-in mx-auto max-w-3xl pt-4 text-center sm:pt-8">
		<p class="type-kicker text-crimson">Local-first e-reader</p>
		<h1
			class="type-masthead mx-auto mt-4 max-w-[16ch] text-[2.75rem] text-ink sm:text-[3.75rem] md:text-[4.25rem]"
		>
			Read without the storefront
		</h1>
		<p class="type-body mx-auto mt-6 max-w-xl text-[1.05rem] leading-relaxed text-ink-soft sm:text-[1.125rem]">
			Lumen keeps your books on this device. Import EPUB, Markdown, or plain text — open them offline,
			set type the way you like, and sync to the cloud only when you choose.
		</p>
		<div class="mt-9 flex flex-wrap items-center justify-center gap-3">
			<a href="/library" class="no-underline">
				<Button variant="secondary" type="button" class="!px-6 !py-3">Open library</Button>
			</a>
			<a href="/about" class="no-underline">
				<Button variant="ghost" type="button" class="!px-6 !py-3">About & keys</Button>
			</a>
		</div>
	</section>

	<section
		class="animate-plate-in stagger-1 mx-auto grid max-w-4xl gap-6 sm:grid-cols-3 sm:gap-5"
		aria-label="What Lumen does"
	>
		{#each [
			{
				title: 'Your shelf',
				body: 'Files live in this browser first. No account required to open a chapter.'
			},
			{
				title: 'Quiet reading',
				body: 'Night, paper, sepia, or contrast. Faces, measure, and spacing you control.'
			},
			{
				title: 'Optional cloud',
				body: 'Push or pull when R2 is configured. Offline remains the default.'
			}
		] as card, i (i)}
			<article
				class="rounded-lg border border-rule bg-paper px-5 py-6 sm:px-6"
				style="animation-delay: {i * 60}ms"
			>
				<h2 class="type-section text-xl text-ink">{card.title}</h2>
				<p class="type-body mt-3 text-ink-soft">{card.body}</p>
			</article>
		{/each}
	</section>

	<section
		class="animate-plate-in stagger-2 mx-auto max-w-2xl rounded-lg border border-rule bg-paper px-6 py-8 text-center sm:px-10 sm:py-10"
	>
		<p class="type-eyebrow text-ink-mute">No catalog. No feed. Just the page.</p>
		<p class="type-body mx-auto mt-4 max-w-md text-ink-soft">
			Import a file from the library bar, drop it onto the shelf, or open the sample when the shelf is
			empty.
		</p>
		<a
			href="/library"
			class="continue-lead-cta mt-7 inline-flex no-underline"
		>
			Go to library
			<span class="cta-chevron" aria-hidden="true">→</span>
		</a>
	</section>
</div>
