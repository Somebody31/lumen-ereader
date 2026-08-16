<script lang="ts">
	import { onMount } from 'svelte';
	import { getPrefs, putPrefs } from '$lib/client/idb';
	import { fetchSession, logout, pullLibrary, pushAll } from '$lib/client/sync';
	import {
		fontStack,
		READING_FONTS,
		type ReaderPrefs,
		type ReadingFont,
		type ReadingTheme,
		type SessionInfo
	} from '$lib/client/types';
	import { fetchTranslateStatus } from '$lib/client/translateJob';
	import Button from '$lib/components/ui/Button.svelte';
	import Cloud from 'phosphor-svelte/lib/Cloud';
	import CloudSlash from 'phosphor-svelte/lib/CloudSlash';
	import Translate from 'phosphor-svelte/lib/Translate';

	let prefs = $state<ReaderPrefs | null>(null);
	let session = $state<SessionInfo | null>(null);
	let busy = $state(false);
	let message = $state('');
	let error = $state('');
	let showSyncHelp = $state(false);
	let translateConfigured = $state<boolean | null>(null);
	let translateModel = $state('deepseek-v4-flash');

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
		const tr = await fetchTranslateStatus();
		translateConfigured = tr.configured;
		translateModel = tr.model;
	});

	async function savePrefs(partial: Partial<ReaderPrefs>) {
		if (!prefs) return;
		prefs = { ...prefs, ...partial };
		await putPrefs(prefs);
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
		<p class="type-kicker text-crimson">Preferences</p>
		<h1 class="type-masthead mt-2 text-[2.75rem] text-ink">Settings</h1>
		<p class="type-body mt-4 text-ink-soft">
			Defaults for new reading sessions. Cloud sync is optional and never required to open a book.
		</p>
		<div class="mt-8 h-px bg-rule"></div>
	</header>

	{#if prefs}
		<section
			class="animate-plate-in stagger-1 grid gap-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-paper p-0 lg:grid-cols-[1fr_minmax(16rem,22rem)]"
		>
			<div class="space-y-6 p-6 sm:p-8">
				<div>
					<h2 class="type-section text-xl text-ink">Reading defaults</h2>
					<p class="type-meta mt-1 text-ink-soft">Applied when you open a book.</p>
				</div>

				<div>
					<p class="type-micro mb-2.5 text-ink-soft">Theme</p>
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

				<div>
					<p class="type-micro mb-2.5 text-ink-soft">Typeface</p>
					<div class="flex flex-wrap gap-2">
						{#each READING_FONTS as f (f.id)}
							<button
								type="button"
								class="rounded-md border border-rule px-3 py-2 font-ui text-[13px] text-ink transition-colors hover:bg-newsprint"
								style="font-family: {f.stack}; background: {prefs.fontFamily === f.id
									? 'var(--color-newsprint, #ebe8e1)'
									: 'transparent'}"
								aria-pressed={prefs.fontFamily === f.id}
								onclick={() => savePrefs({ fontFamily: f.id as ReadingFont })}
							>
								{f.label}
							</button>
						{/each}
					</div>
				</div>

				<label class="block font-ui text-xs text-ink-soft">
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
				<label class="block font-ui text-xs text-ink-soft">
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
				<label class="block font-ui text-xs text-ink-soft">
					Letter spacing ·
					<span class="tabular-nums text-ink">{(prefs.letterSpacing ?? 0).toFixed(3)}em</span>
					<input
						type="range"
						min="0"
						max="0.08"
						step="0.005"
						value={prefs.letterSpacing ?? 0}
						class="mt-2 w-full accent-ink"
						oninput={(e) =>
							savePrefs({ letterSpacing: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>
				<label class="block font-ui text-xs text-ink-soft">
					Paragraph space ·
					<span class="tabular-nums text-ink">{(prefs.paragraphSpacing ?? 1).toFixed(2)}em</span>
					<input
						type="range"
						min="0.4"
						max="2"
						step="0.1"
						value={prefs.paragraphSpacing ?? 1}
						class="mt-2 w-full accent-ink"
						oninput={(e) =>
							savePrefs({
								paragraphSpacing: Number((e.currentTarget as HTMLInputElement).value)
							})}
					/>
				</label>
				<label class="block font-ui text-xs text-ink-soft">
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
				<label class="block font-ui text-xs text-ink-soft">
					Margin · <span class="tabular-nums text-ink">{prefs.margin}px</span>
					<input
						type="range"
						min="12"
						max="48"
						step="2"
						value={prefs.margin}
						class="mt-2 w-full accent-ink"
						oninput={(e) =>
							savePrefs({ margin: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>

				<div>
					<p class="type-micro mb-2.5 text-ink-soft">Composition</p>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							class="rounded-md border border-rule px-3 py-2 font-ui text-[13px] text-ink"
							style="background: {(prefs.textAlign ?? 'left') === 'left'
								? 'var(--color-newsprint, #ebe8e1)'
								: 'transparent'}"
							aria-pressed={(prefs.textAlign ?? 'left') === 'left'}
							onclick={() => savePrefs({ textAlign: 'left' })}
						>
							Left
						</button>
						<button
							type="button"
							class="rounded-md border border-rule px-3 py-2 font-ui text-[13px] text-ink"
							style="background: {prefs.textAlign === 'justify'
								? 'var(--color-newsprint, #ebe8e1)'
								: 'transparent'}"
							aria-pressed={prefs.textAlign === 'justify'}
							onclick={() => savePrefs({ textAlign: 'justify' })}
						>
							Justify
						</button>
						<button
							type="button"
							class="rounded-md border border-rule px-3 py-2 font-ui text-[13px] text-ink"
							style="background: {prefs.hyphenate
								? 'var(--color-newsprint, #ebe8e1)'
								: 'transparent'}"
							aria-pressed={!!prefs.hyphenate}
							onclick={() => savePrefs({ hyphenate: !prefs!.hyphenate })}
						>
							Hyphenate
						</button>
					</div>
				</div>

				<label class="block font-ui text-xs text-ink-soft">
					Brightness ·
					<span class="tabular-nums text-ink">{Math.round((prefs.brightness ?? 1) * 100)}%</span>
					<input
						type="range"
						min="0.55"
						max="1"
						step="0.05"
						value={prefs.brightness ?? 1}
						class="mt-2 w-full accent-ink"
						oninput={(e) =>
							savePrefs({ brightness: Number((e.currentTarget as HTMLInputElement).value) })}
					/>
				</label>

				<label class="flex cursor-pointer items-center justify-between gap-3 font-ui text-sm text-ink">
					<span>
						Keep screen awake while reading
						<span class="mt-0.5 block font-ui text-xs text-ink-soft"
							>Requests a screen wake lock in the reader when supported</span
						>
					</span>
					<input
						type="checkbox"
						class="h-4 w-4 shrink-0 accent-ink"
						checked={!!prefs.keepAwake}
						onchange={(e) =>
							savePrefs({ keepAwake: (e.currentTarget as HTMLInputElement).checked })}
					/>
				</label>
			</div>

			<!-- Live preview -->
			<div
				class="relative flex min-h-[16rem] flex-col justify-center border-t border-rule p-6 sm:p-8 lg:border-l lg:border-t-0"
				style="background: {previewTheme.bg}; color: {previewTheme.fg}"
				aria-label="Reading preview"
			>
				<p class="font-ui text-[10px] uppercase tracking-[0.12em] opacity-70">Preview</p>
				<p
					class="mt-4 font-reading"
					lang="en"
					style="font-family: {fontStack(prefs.fontFamily)}; font-size: {prefs.fontSize}px; line-height: {prefs.lineHeight}; letter-spacing: {(prefs.letterSpacing ??
						0)}em; max-width: {prefs.measure}ch; text-align: {prefs.textAlign ??
						'left'}; hyphens: {prefs.hyphenate
						? 'auto'
						: 'manual'}; font-variation-settings: 'opsz' 14"
				>
					{sample}
				</p>
				<p class="mt-4 font-ui text-[11px] opacity-70">
					{previewTheme.label} · {READING_FONTS.find((f) => f.id === prefs!.fontFamily)?.label ??
						'Literata'} · {prefs!.fontSize}px · {prefs!.measure}ch
				</p>
			</div>
		</section>
	{/if}

	<section class="animate-plate-in stagger-2 space-y-5 rounded-[1.75rem] border border-white/10 bg-paper p-6 sm:p-8">
		<div class="flex items-start gap-3.5">
			<span class="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-newsprint">
				{#if session?.syncAvailable && session.authenticated}
					<Cloud size={17} weight="light" class="text-ink" />
				{:else}
					<CloudSlash size={17} weight="light" class="text-ink-mute" />
				{/if}
			</span>
			<div>
				<h2 class="type-section text-xl text-ink">Cloud sync</h2>
				<p class="type-body mt-1 text-ink-soft">
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
				<div class="space-y-3">
					<p class="type-body text-sm text-ink-soft">
						Sign in on the dedicated page to push or pull this shelf.
					</p>
					<a href="/auth?next=/settings" class="inline-block no-underline">
						<Button type="button" variant="secondary">Sign in to sync</Button>
					</a>
				</div>
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

	<section class="animate-plate-in stagger-3 space-y-5 rounded-[1.75rem] border border-white/10 bg-paper p-6 sm:p-8">
		<div class="flex items-start gap-3.5">
			<span class="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-newsprint">
				<Translate size={17} weight="light" class="text-ink" />
			</span>
			<div>
				<h2 class="type-section text-xl text-ink">Translation</h2>
				<p class="type-body mt-1 text-ink-soft">
					{#if translateConfigured}
						DeepSeek {translateModel} is configured. The API key stays on the server.
					{:else if translateConfigured === false}
						Not configured. Set <code class="text-ink">DEEPSEEK_API_KEY</code> in
						<code class="text-ink">.env</code> or as a Wrangler secret, then restart the server.
					{:else}
						Checking…
					{/if}
				</p>
				<p class="type-meta mt-3 text-ink-mute">
					<a href="/translate" class="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
						>Open translator</a
					>
				</p>
			</div>
		</div>
	</section>

	<section class="animate-plate-in stagger-3 type-meta leading-relaxed text-ink-mute">
		<p>
			No account required to read. Shortcuts live on the
			<a href="/about" class="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
				>About</a
			>
			page. In the reader: F focus, T contents, B bookmark, , type panel, Esc library.
		</p>
	</section>
</div>
