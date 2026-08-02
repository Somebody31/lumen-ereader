<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/shell/AppShell.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Lumen</title>
	<meta name="description" content="Lumen — local-first e-reader. Import EPUB and text, read offline, sync optionally." />
	<meta name="theme-color" content="#F0EFE9" />
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>
