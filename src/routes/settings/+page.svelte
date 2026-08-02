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
	<header class="animate-plate-in border-b border-rule pb-8">
		<p class="kicker mb-3">Preferences</p>
		<h1
			class="font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] text-ink"
			style="font-family: var(--font-display)"
		>
			Settings
		</h1>
		<p class="mt-4 font-ui text-[15px] leading-relaxed text-ink-soft">
			Defaults for new reading sessions. Cloud sync is optional and never required to open a book.
		</p>
	</header>

	{#if prefs}
		<section class="animate-plate-in stagger-1 space-y-5 border border-rule bg-paper p-6">
			<div class="border-b border-rule pb-3">
				<h2
					class="font-display text-xl font-semibold tracking-tight text-ink"
					style="font-family: var(--font-display)"
				>
					Reading defaults
				</h2>
				<p class="mt-1 font-ui text-sm text-ink-mute">Applied when you open a book.</p>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each themes as t (t.id)}
					<button
						type="button"
						class="border px-3 py-1.5 font-ui text-xs tracking-tight transition-colors duration-200 {prefs.theme ===
						t.id
							? 'border-ink bg-ink text-paper'
							: 'border-rule text-ink-soft hover:border-ink hover:text-ink'}"
						onclick={() => savePrefs({ theme: t.id })}
					>
						{t.label}
					</button>
				{/each}
			</div>
			<label class="block font-ui text-xs text-ink-mute">
				Font size · {prefs.fontSize}px
				<input
					type="range"
					min="14"
					max="32"
					value={prefs.fontSize}
					class="mt-2 w-full accent-ink"
					oninput={(e) => savePrefs({ fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
			<label class="block font-ui text-xs text-ink-mute">
				Line height · {prefs.lineHeight.toFixed(2)}
				<input
					type="range"
					min="1.4"
					max="2.2"
					step="0.05"
					value={prefs.lineHeight}
					class="mt-2 w-full accent-ink"
					oninput={(e) =>
						savePrefs({ lineHeight: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
			<label class="block font-ui text-xs text-ink-mute">
				Column measure · {prefs.measure}ch
				<input
					type="range"
					min="45"
					max="90"
					value={prefs.measure}
					class="mt-2 w-full accent-ink"
					oninput={(e) => savePrefs({ measure: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
		</section>
	{/if}

	<section class="animate-plate-in stagger-2 space-y-5 border border-rule bg-paper p-6">
		<div class="flex items-start gap-3.5 border-b border-rule pb-4">
			<span class="mt-0.5 flex h-9 w-9 items-center justify-center border border-rule bg-newsprint">
				{#if session?.syncAvailable && session.authenticated}
					<Cloud size={17} weight="light" class="text-ink" />
				{:else}
					<CloudSlash size={17} weight="light" class="text-ink-mute" />
				{/if}
			</span>
			<div>
				<h2
					class="font-display text-xl font-semibold tracking-tight text-ink"
					style="font-family: var(--font-display)"
				>
					Cloud sync
				</h2>
				<p class="mt-1 font-ui text-sm leading-relaxed text-ink-soft">
					{session?.message || 'Checking sync status…'}
				</p>
			</div>
		</div>

		{#if session?.syncAvailable}
			{#if session.authenticated}
				<div class="flex flex-wrap gap-2">
					<Button type="button" disabled={busy} onclick={handlePush}>Push library</Button>
					<Button type="button" variant="ghost" disabled={busy} onclick={handlePull}
						>Pull library</Button
					>
					<Button type="button" variant="ghost" disabled={busy} onclick={handleLogout}
						>Sign out</Button
					>
				</div>
			{:else}
				<form
					class="space-y-3"
					onsubmit={(e) => {
						e.preventDefault();
						handleLogin();
					}}
				>
					<label class="block font-ui text-xs text-ink-mute">
						Passphrase
						<input
							type="password"
							bind:value={passphrase}
							autocomplete="current-password"
							class="mt-1.5 w-full border border-rule bg-newsprint px-3 py-2.5 font-ui text-sm text-ink placeholder:text-ink-mute focus:border-ink focus:outline-none"
							placeholder="Deployment passphrase"
						/>
					</label>
					<Button type="submit" disabled={busy || !passphrase}>Sign in</Button>
				</form>
			{/if}
		{:else}
			<p class="font-ui text-xs leading-relaxed text-ink-mute">
				To enable sync on Cloudflare: create R2 bucket and KV namespace, set secrets
				<code class="border border-rule bg-newsprint px-1 py-0.5 text-ink-soft">SESSION_SECRET</code>
				and
				<code class="border border-rule bg-newsprint px-1 py-0.5 text-ink-soft"
					>READER_PASSPHRASE</code
				>, then redeploy. Until then, everything stays local.
			</p>
		{/if}

		{#if message}
			<p class="font-ui text-sm text-ink" role="status">{message}</p>
		{/if}
		{#if error}
			<p class="font-ui text-sm text-danger" role="alert">{error}</p>
		{/if}
	</section>

	<section class="animate-plate-in stagger-3 font-ui text-xs leading-relaxed text-ink-mute">
		<p>
			Lumen never requires an account to read. Keyboard in the reader: F focus, T contents, +/− size,
			arrows or J/K for EPUB pages, Esc back.
		</p>
	</section>
</div>
