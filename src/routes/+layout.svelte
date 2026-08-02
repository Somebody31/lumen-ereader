<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/shell/AppShell.svelte';
	import { onNavigate } from '$app/navigation';

	let { children } = $props();

	/**
	 * Editorial page transitions (View Transitions API).
	 * Progressive: no-op without startViewTransition; skipped for reduced motion.
	 */
	onNavigate((navigation) => {
		if (typeof document === 'undefined') return;
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		// Same-URL or non-DOM navigations: leave alone
		if (navigation.from?.url.href === navigation.to?.url.href) return;

		return new Promise<void>((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Lumen</title>
	<meta name="description" content="Lumen — local-first e-reader. Import EPUB and text, read offline, sync optionally." />
	<meta name="theme-color" content="#0A0A0A" />
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>
