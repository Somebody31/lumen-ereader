<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fetchSession, login, pullLibrary } from '$lib/client/sync';
	import type { SessionInfo } from '$lib/client/types';
	import Button from '$lib/components/ui/Button.svelte';

	const ONBOARD_KEY = 'lumen:onboarded';

	let session = $state<SessionInfo | null>(null);
	let passphrase = $state('');
	let busy = $state(false);
	let loading = $state(true);
	let error = $state('');
	let message = $state('');

	const intent = $derived(page.url.searchParams.get('intent') || '');

	/** Same-origin path only; default library home */
	function safeNext(): string {
		const raw = page.url.searchParams.get('next') || '/';
		if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
		// Collapse legacy library path
		if (raw === '/library' || raw.startsWith('/library/')) return '/';
		// Allow only known app surfaces
		const allowed =
			raw === '/' ||
			raw.startsWith('/settings') ||
			raw.startsWith('/about') ||
			raw.startsWith('/welcome') ||
			raw.startsWith('/read/');
		return allowed ? raw : '/';
	}

	onMount(async () => {
		session = await fetchSession();
		loading = false;
		if (session.authenticated) {
			message = 'You are already signed in.';
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!passphrase.trim() || busy) return;
		busy = true;
		error = '';
		message = '';
		const res = await login(passphrase);
		if (!res.ok) {
			error = res.error || 'Sign-in failed';
			busy = false;
			return;
		}
		try {
			localStorage.setItem(ONBOARD_KEY, '1');
		} catch {
			/* ignore */
		}
		session = await fetchSession();
		const next = safeNext();
		if (intent === 'sync') {
			message = 'Signed in. Pulling library…';
			const pull = await pullLibrary();
			if (pull.ok) {
				message = pull.count
					? `Signed in. Pulled ${pull.count} book(s).`
					: 'Signed in. Library already up to date.';
			} else {
				// Still enter the app; pull can be retried from settings
				message = pull.error
					? `Signed in. Pull failed: ${pull.error}`
					: 'Signed in.';
			}
			// Brief status then go home (or next)
			await new Promise((r) => setTimeout(r, 600));
		}
		busy = false;
		await goto(next);
	}
</script>

<svelte:head>
	<title>Sign in · Lumen</title>
	<meta name="description" content="Sign in to sync your Lumen library across devices." />
</svelte:head>

<div class="mx-auto max-w-md space-y-8 pt-4 sm:pt-10">
	<header class="animate-plate-in text-center sm:text-left">
		<p class="type-kicker text-crimson">Cloud sync</p>
		<h1 class="type-masthead mt-2 text-[2.25rem] text-ink sm:text-[2.75rem]">Sign in</h1>
		<p class="type-body mt-3 text-ink-soft">
			Enter the deployment passphrase to push and pull your shelf. Reading offline never needs this.
		</p>
	</header>

	{#if loading}
		<p class="font-ui text-sm text-ink-soft">Checking sync…</p>
	{:else if !session?.syncAvailable}
		<section
			class="animate-plate-in space-y-5 rounded-lg border border-rule bg-paper p-6 sm:p-8"
			role="status"
		>
			<p class="type-body text-ink-soft">
				Cloud sync isn’t configured on this deployment. Set SESSION_SECRET, READER_PASSPHRASE, R2, and
				KV on Cloudflare to enable it. Until then, everything stays on this device.
			</p>
			<a href="/" class="no-underline">
				<Button variant="secondary" type="button">Open library</Button>
			</a>
		</section>
	{:else if session.authenticated}
		<section class="animate-plate-in space-y-5 rounded-lg border border-rule bg-paper p-6 sm:p-8">
			<p class="type-body text-ink" role="status">{message || 'You are signed in.'}</p>
			<div class="flex flex-wrap gap-2">
				<a href={safeNext()} class="no-underline">
					<Button variant="secondary" type="button">Continue</Button>
				</a>
				<a href="/settings" class="no-underline">
					<Button variant="ghost" type="button">Settings</Button>
				</a>
			</div>
		</section>
	{:else}
		<form
			class="animate-plate-in space-y-5 rounded-lg border border-rule bg-paper p-6 sm:p-8"
			onsubmit={handleSubmit}
		>
			<label class="block font-ui text-xs font-medium uppercase tracking-[0.1em] text-ink-mute">
				Passphrase
				<input
					type="password"
					bind:value={passphrase}
					autocomplete="current-password"
					class="mt-2 w-full rounded-md border border-rule bg-newsprint px-3 py-2.5 font-ui text-sm text-ink placeholder:text-ink-mute focus:border-ink-mute focus:outline-none"
					placeholder="Deployment passphrase"
				/>
			</label>

			{#if error}
				<p class="font-ui text-sm text-danger" role="alert">{error}</p>
			{/if}
			{#if message}
				<p class="font-ui text-sm text-ink" role="status">{message}</p>
			{/if}

			<div class="flex flex-wrap items-center gap-3 pt-1">
				<Button type="submit" disabled={busy || !passphrase.trim()}>
					{busy ? 'Signing in…' : 'Sign in'}
				</Button>
				<a
					href="/"
					class="type-meta text-ink-soft no-underline underline decoration-rule underline-offset-4 hover:text-ink"
				>
					Continue offline
				</a>
			</div>
		</form>
	{/if}

	<p class="type-meta text-center text-ink-mute sm:text-left">
		<a href="/welcome" class="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
			>What is Lumen?</a
		>
		<span class="mx-2 text-rule">·</span>
		<a href="/about" class="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
			>About</a
		>
	</p>
</div>
