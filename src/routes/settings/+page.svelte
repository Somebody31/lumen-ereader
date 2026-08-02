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

<div class="mx-auto max-w-lg space-y-8">
	<header class="animate-plate-in">
		<h1 class="font-ui text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
			Settings
		</h1>
		<p class="mt-3 text-[15px] leading-relaxed text-ink-soft">
			Defaults for new reading sessions. Cloud sync is optional and never required to open a book.
		</p>
	</header>

	{#if prefs}
		<section class="plate animate-plate-in stagger-1 space-y-5 p-6">
			<div>
				<h2 class="font-ui text-base font-semibold tracking-tight text-ink">Reading defaults</h2>
				<p class="mt-1 text-sm text-ink-mute">Applied when you open a book.</p>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each themes as t (t.id)}
					<button
						type="button"
						class="rounded-full px-3.5 py-1.5 text-xs font-medium tracking-tight transition-colors duration-200 ease-[var(--ease-atelier)] {prefs.theme ===
						t.id
							? 'bg-indigo text-white'
							: 'bg-ash text-ink-soft hover:text-ink'}"
						onclick={() => savePrefs({ theme: t.id })}
					>
						{t.label}
					</button>
				{/each}
			</div>
			<label class="block text-xs font-medium text-ink-mute">
				Font size · {prefs.fontSize}px
				<input
					type="range"
					min="14"
					max="32"
					value={prefs.fontSize}
					class="mt-2 w-full accent-indigo"
					oninput={(e) => savePrefs({ fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
			<label class="block text-xs font-medium text-ink-mute">
				Line height · {prefs.lineHeight.toFixed(2)}
				<input
					type="range"
					min="1.4"
					max="2.2"
					step="0.05"
					value={prefs.lineHeight}
					class="mt-2 w-full accent-indigo"
					oninput={(e) =>
						savePrefs({ lineHeight: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
			<label class="block text-xs font-medium text-ink-mute">
				Column measure · {prefs.measure}ch
				<input
					type="range"
					min="45"
					max="90"
					value={prefs.measure}
					class="mt-2 w-full accent-indigo"
					oninput={(e) => savePrefs({ measure: Number((e.currentTarget as HTMLInputElement).value) })}
				/>
			</label>
		</section>
	{/if}

	<section class="plate animate-plate-in stagger-2 space-y-5 p-6">
		<div class="flex items-start gap-3.5">
			<span
				class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-ash ring-1 ring-rule/70"
			>
				{#if session?.syncAvailable && session.authenticated}
					<Cloud size={18} weight="light" class="text-indigo" />
				{:else}
					<CloudSlash size={18} weight="light" class="text-ink-mute" />
				{/if}
			</span>
			<div>
				<h2 class="font-ui text-base font-semibold tracking-tight text-ink">Cloud sync</h2>
				<p class="mt-1 text-sm leading-relaxed text-ink-soft">
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
					<label class="block text-xs font-medium text-ink-mute">
						Passphrase
						<input
							type="password"
							bind:value={passphrase}
							autocomplete="current-password"
							class="mt-1.5 w-full rounded-[var(--radius-md)] bg-ash px-3.5 py-2.5 text-sm text-ink ring-1 ring-rule/80 placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-indigo"
							placeholder="Deployment passphrase"
						/>
					</label>
					<Button type="submit" disabled={busy || !passphrase}>Sign in</Button>
				</form>
			{/if}
		{:else}
			<p class="text-xs leading-relaxed text-ink-mute">
				To enable sync on Cloudflare: create R2 bucket and KV namespace, set secrets
				<code class="rounded bg-ash px-1 py-0.5 text-ink-soft">SESSION_SECRET</code>
				and
				<code class="rounded bg-ash px-1 py-0.5 text-ink-soft">READER_PASSPHRASE</code>, then
				redeploy. Until then, everything stays local.
			</p>
		{/if}

		{#if message}
			<p class="text-sm font-medium text-indigo" role="status">{message}</p>
		{/if}
		{#if error}
			<p class="text-sm text-danger" role="alert">{error}</p>
		{/if}
	</section>

	<section class="animate-plate-in stagger-3 text-xs leading-relaxed text-ink-mute">
		<p>
			Lumen never requires an account to read. Keyboard in the reader: F focus, T contents, +/− size,
			arrows or J/K for EPUB pages, Esc back.
		</p>
	</section>
</div>
