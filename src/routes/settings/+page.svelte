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
	let showSyncHelp = $state(false);

	const themes: { id: ReadingTheme; label: string; bg: string; fg: string; line: string }[] = [
		{ id: 'night', label: 'Night', bg: '#0c0c0c', fg: '#f3f2ed', line: '#9a9a94' },
		{ id: 'paper', label: 'Paper', bg: '#f7f5f0', fg: '#1a1c22', line: '#5a5a56' },
		{ id: 'sepia', label: 'Sepia', bg: '#e8dcc8', fg: '#3d3428', line: '#6b5e4e' },
		{ id: 'contrast', label: 'Contrast', bg: '#000000', fg: '#ffffff', line: '#c0c0c0' }
	];

	const sample =
		'The booth lights were already low when Mara locked the door. Outside, the lobby still hummed with late visitors asking which constellation was which.';

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

	const previewTheme = $derived(themes.find((t) => t.id === prefs?.theme) ?? themes[0]);
</script>

<svelte:head>
	<title>Settings · Lumen</title>
</svelte:head>

<div class="space-y-10">
	<header class="animate-plate-in max-w-2xl">
		<h1
			class="font-display text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] text-ink"
			style="font-family: var(--font-display); font-variation-settings: 'opsz' 72"
		>
			Settings
		</h1>
		<p class="mt-4 font-ui text-[15px] leading-relaxed text-ink-soft">
			Defaults for new reading sessions. Cloud sync is optional and never required to open a book.
		</p>
		<div class="mt-8 h-px bg-rule"></div>
	</header>

	{#if prefs}
		<section
			class="animate-plate-in stagger-1 grid gap-8 overflow-hidden rounded-lg border border-rule bg-paper p-0 lg:grid-cols-[1fr_minmax(16rem,22rem)]"
		>
			<div class="space-y-6 p-6 sm:p-8">
				<div>
					<h2
						class="font-display text-xl font-semibold tracking-tight text-ink"
						style="font-family: var(--font-display)"
					>
						Reading defaults
					</h2>
					<p class="mt-1 font-ui text-sm text-ink-mute">Applied when you open a book.</p>
				</div>

				<div>
					<p class="mb-2.5 font-ui text-[11px] uppercase tracking-[0.1em] text-ink-mute">Theme</p>
					<div class="flex flex-wrap gap-2">
						{#each themes as t (t.id)}
							<button
								type="button"
								class="theme-swatch"
								aria-pressed={prefs.theme === t.id}
								aria-label="{t.label} theme"
								onclick={() => savePrefs({ theme: t.id })}
							>
								<span class="theme-swatch-face" style="background: {t.bg}">
									<span
										class="mx-auto mt-2 block h-0.5 w-8 rounded-full opacity-80"
										style="background: {t.fg}"
									></span>
									<span
										class="mx-auto mt-1.5 block h-0.5 w-6 rounded-full opacity-40"
										style="background: {t.line}"
									></span>
								</span>
								<span class="theme-swatch-label">{t.label}</span>
							</button>
						{/each}
					</div>
				</div>

				<label class="block font-ui text-xs text-ink-mute">
					Font size · <span class="tabular-nums text-ink">{prefs.fontSize}px</span>
					<input
						type="range"
						min="14"
						max="32"
						value={prefs.fontSize}
						class="mt-2 w-full accent-ink"
						oninput={(e) =>
							savePrefs({ fontSize: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>
				<label class="block font-ui text-xs text-ink-mute">
					Line height · <span class="tabular-nums text-ink">{prefs.lineHeight.toFixed(2)}</span>
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
					Column measure · <span class="tabular-nums text-ink">{prefs.measure}ch</span>
					<input
						type="range"
						min="45"
						max="90"
						value={prefs.measure}
						class="mt-2 w-full accent-ink"
						oninput={(e) =>
							savePrefs({ measure: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>
			</div>

			<!-- Live preview -->
			<div
				class="relative flex min-h-[16rem] flex-col justify-center border-t border-rule p-6 sm:p-8 lg:border-l lg:border-t-0"
				style="background: {previewTheme.bg}; color: {previewTheme.fg}"
				aria-label="Reading preview"
			>
				<p class="font-ui text-[10px] uppercase tracking-[0.12em] opacity-50">Preview</p>
				<p
					class="mt-4 font-reading"
					style="font-family: var(--font-reading); font-size: {prefs.fontSize}px; line-height: {prefs.lineHeight}; max-width: {prefs.measure}ch; font-variation-settings: 'opsz' 14"
				>
					{sample}
				</p>
				<p class="mt-4 font-ui text-[11px] opacity-45">
					{previewTheme.label} · {prefs.fontSize}px · {prefs.measure}ch
				</p>
			</div>
		</section>
	{/if}

	<section class="animate-plate-in stagger-2 space-y-5 rounded-lg border border-rule bg-paper p-6 sm:p-8">
		<div class="flex items-start gap-3.5">
			<span class="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-newsprint">
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
					{#if session?.syncAvailable}
						{session.message || 'Cloud is available.'}
					{:else}
						Optional. Not configured on this deployment — everything stays on this device.
					{/if}
				</p>
			</div>
		</div>

		<div class="h-px bg-rule"></div>

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
							class="mt-1.5 w-full rounded-md border border-rule bg-newsprint px-3 py-2.5 font-ui text-sm text-ink placeholder:text-ink-mute focus:border-ink-mute focus:outline-none"
							placeholder="Deployment passphrase"
						/>
					</label>
					<Button type="submit" disabled={busy || !passphrase}>Sign in</Button>
				</form>
			{/if}
		{:else}
			<button
				type="button"
				class="font-ui text-xs text-ink-mute underline decoration-rule underline-offset-4 hover:text-ink"
				onclick={() => (showSyncHelp = !showSyncHelp)}
			>
				{showSyncHelp ? 'Hide setup notes' : 'How to enable on Cloudflare'}
			</button>
			{#if showSyncHelp}
				<p class="font-ui text-xs leading-relaxed text-ink-mute">
					Create an R2 bucket and KV namespace, set SESSION_SECRET and READER_PASSPHRASE, then redeploy.
					Until then, reading and progress stay local.
				</p>
			{/if}
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
			No account required to read. In the reader: F focus, T contents, +/− size, arrows or J/K for
			EPUB, Esc back.
		</p>
	</section>
</div>
