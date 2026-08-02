<script lang="ts">
	import { onMount } from 'svelte';
	import { getPrefs, putPrefs } from '$lib/client/idb';
	import { fetchSession, login, logout, pullLibrary, pushAll } from '$lib/client/sync';
	import type { ReaderPrefs, ReadingTheme, SessionInfo } from '$lib/client/types';
	import Button from '$lib/components/ui/Button.svelte';
	import Cloud from 'phosphor-svelte/lib/Cloud';
	import CloudSlash from 'phosphor-svelte/lib/CloudSlash';

	let prefs = $state<ReaderPrefs | null>(null);
	let session = $state<SessionInfo | null>(null);
	let passphrase = $state('');
	let busy = $state(false);
	let message = $state('');
	let error = $state('');

	const themes: { id: ReadingTheme; label: string }[] = [
		{ id: 'night', label: 'Night' },
		{ id: 'paper', label: 'Paper' },
		{ id: 'sepia', label: 'Sepia' },
		{ id: 'contrast', label: 'High contrast' }
	];

	onMount(async () => {
		prefs = await getPrefs();
		session = await fetchSession();
	});

	async function savePrefs(partial: Partial<ReaderPrefs>) {
		if (!prefs) return;
		prefs = { ...prefs, ...partial };
		await putPrefs(prefs);
	}

	async function handleLogin() {
		busy = true;
		error = '';
		message = '';
		const res = await login(passphrase);
		if (!res.ok) {
			error = res.error || 'Login failed';
		} else {
			message = 'Signed in. You can push or pull your library.';
			passphrase = '';
			session = await fetchSession();
		}
		busy = false;
	}

	async function handleLogout() {
		await logout();
		session = await fetchSession();
		message = 'Signed out.';
	}

	async function handlePush() {
		busy = true;
		error = '';
		const res = await pushAll();
		if (!res.ok) error = res.error || 'Push failed';
		else message = 'Library pushed to cloud.';
		busy = false;
	}

	async function handlePull() {
		busy = true;
		error = '';
		const res = await pullLibrary();
		if (!res.ok) error = res.error || 'Pull failed';
		else message = res.count ? `Pulled ${res.count} book(s).` : 'Library already up to date.';
		busy = false;
	}
</script>

<svelte:head>
	<title>Settings · Lumen</title>
</svelte:head>

<div class="mx-auto max-w-lg space-y-10">
	<header>
		<p class="mb-2 text-xs font-medium tracking-wide text-star-muted">Settings</p>
		<h1 class="font-ui text-3xl font-semibold tracking-tight">Instrument</h1>
		<p class="mt-2 text-sm leading-relaxed text-ink-dim">
			Defaults for new reading sessions. Cloud sync is optional and never required to open a book.
		</p>
	</header>

	{#if prefs}
		<section class="space-y-4 rounded-[var(--radius-lg)] bg-void-panel p-5 ring-1 ring-hairline">
			<h2 class="font-ui text-sm font-semibold tracking-tight">Reading defaults</h2>
			<div class="flex flex-wrap gap-2">
				{#each themes as t (t.id)}
					<button
						type="button"
						class="rounded-full px-3 py-1.5 text-xs ring-1 transition-colors {prefs.theme === t.id
							? 'bg-star text-void ring-star'
							: 'bg-void-elevated text-ink-dim ring-hairline hover:text-ink'}"
						onclick={() => savePrefs({ theme: t.id })}
					>
						{t.label}
					</button>
				{/each}
			</div>
			<label class="block text-xs text-ink-dim">
				Font size · {prefs.fontSize}px
				<input
					type="range"
					min="14"
					max="32"
					value={prefs.fontSize}
					class="mt-1 w-full accent-star"
					oninput={(e) => savePrefs({ fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
			<label class="block text-xs text-ink-dim">
				Line height · {prefs.lineHeight.toFixed(2)}
				<input
					type="range"
					min="1.4"
					max="2.2"
					step="0.05"
					value={prefs.lineHeight}
					class="mt-1 w-full accent-star"
					oninput={(e) =>
						savePrefs({ lineHeight: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
			<label class="block text-xs text-ink-dim">
				Column measure · {prefs.measure}ch
				<input
					type="range"
					min="45"
					max="90"
					value={prefs.measure}
					class="mt-1 w-full accent-star"
					oninput={(e) => savePrefs({ measure: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
		</section>
	{/if}

	<section class="space-y-4 rounded-[var(--radius-lg)] bg-void-panel p-5 ring-1 ring-hairline">
		<div class="flex items-start gap-3">
			<span class="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-void-elevated ring-1 ring-hairline">
				{#if session?.syncAvailable && session.authenticated}
					<Cloud size={18} weight="light" class="text-star" />
				{:else}
					<CloudSlash size={18} weight="light" class="text-ink-dim" />
				{/if}
			</span>
			<div>
				<h2 class="font-ui text-sm font-semibold tracking-tight">Cloud sync</h2>
				<p class="mt-1 text-sm leading-relaxed text-ink-dim">
					{session?.message || 'Checking sync status…'}
				</p>
			</div>
		</div>

		{#if session?.syncAvailable}
			{#if session.authenticated}
				<div class="flex flex-wrap gap-2">
					<Button type="button" disabled={busy} onclick={handlePush}>Push library</Button>
					<Button type="button" variant="ghost" disabled={busy} onclick={handlePull}>Pull library</Button>
					<Button type="button" variant="ghost" disabled={busy} onclick={handleLogout}>Sign out</Button>
				</div>
			{:else}
				<form
					class="space-y-3"
					onsubmit={(e) => {
						e.preventDefault();
						handleLogin();
					}}
				>
					<label class="block text-xs text-ink-dim">
						Passphrase
						<input
							type="password"
							bind:value={passphrase}
							autocomplete="current-password"
							class="mt-1 w-full rounded-[var(--radius-md)] bg-void-elevated px-3 py-2.5 text-sm text-ink ring-1 ring-hairline placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-star"
							placeholder="Deployment passphrase"
						/>
					</label>
					<Button type="submit" disabled={busy || !passphrase}>Sign in</Button>
				</form>
			{/if}
		{:else}
			<p class="text-xs leading-relaxed text-ink-faint">
				To enable sync on Cloudflare: create R2 bucket and KV namespace, set secrets
				<code class="text-ink-dim">SESSION_SECRET</code> and
				<code class="text-ink-dim">READER_PASSPHRASE</code>, then redeploy. Until then, everything stays local.
			</p>
		{/if}

		{#if message}
			<p class="text-sm text-star-soft" role="status">{message}</p>
		{/if}
		{#if error}
			<p class="text-sm text-danger" role="alert">{error}</p>
		{/if}
	</section>

	<section class="text-xs leading-relaxed text-ink-faint">
		<p>
			Lumen never requires an account to read. Keyboard in the reader: F focus, T contents, +/− size, arrows or
			J/K for EPUB pages, Esc back.
		</p>
	</section>
</div>
