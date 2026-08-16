<script lang="ts">
	import { page } from '$app/state';
	import { importFiles } from '$lib/client/importBook';
	import Button from '$lib/components/ui/Button.svelte';
	import ArrowUpRight from 'phosphor-svelte/lib/ArrowUpRight';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const isReader = $derived(path.startsWith('/read/'));
	const isLibrary = $derived(path === '/' || path === '');
	const isWelcome = $derived(path === '/welcome' || path.startsWith('/welcome/'));
	const isAuth = $derived(path === '/auth' || path.startsWith('/auth/'));
	const isAbout = $derived(path === '/about' || path.startsWith('/about/'));
	const isSettings = $derived(path.startsWith('/settings'));
	const isTranslate = $derived(path.startsWith('/translate'));
	const isSlim = $derived(isWelcome || isAuth);
	const showImport = $derived(!isSlim && !isAbout);

	let importInput: HTMLInputElement | undefined = $state();
	let importing = $state(false);
	let menuOpen = $state(false);

	$effect(() => {
		path;
		menuOpen = false;
	});

	async function onImportChange(e: Event) {
		const t = e.currentTarget as HTMLInputElement;
		if (!t.files?.length) return;
		importing = true;
		try {
			const list = Array.from(t.files);
			await importFiles(list);
			window.dispatchEvent(new CustomEvent('lumen:books-changed', { detail: { notice: '' } }));
		} catch (err) {
			window.dispatchEvent(
				new CustomEvent('lumen:books-changed', {
					detail: {
						error: err instanceof Error ? err.message : 'Import failed'
					}
				})
			);
		} finally {
			importing = false;
			t.value = '';
		}
	}

	function navClass(active: boolean) {
		return `type-nav rounded-full px-3.5 py-2 no-underline transition-[color,background-color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
			active
				? 'bg-surface text-ink shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] ring-1 ring-white/10'
				: 'text-ink-soft hover:bg-white/5 hover:text-ink'
		}`;
	}

	const overlayLinks = [
		{ href: '/', label: 'Library', delay: 'delay-100' },
		{ href: '/translate', label: 'Translate', delay: 'delay-150' },
		{ href: '/settings', label: 'Settings', delay: 'delay-200' },
		{ href: '/about', label: 'About', delay: 'delay-300' },
		{ href: '/welcome', label: 'Welcome', delay: 'delay-[350ms]' }
	];
</script>

{#if isReader}
	{@render children()}
{:else}
	<div class="shell-root relative min-h-[100dvh] bg-newsprint text-ink">
		<div class="grain" aria-hidden="true"></div>
		<div class="shell-orb" aria-hidden="true"></div>

		<header class="island-nav pointer-events-none fixed inset-x-0 top-0 z-40 px-4 pt-5 sm:px-6">
			<div
				class="pointer-events-auto mx-auto flex w-full max-w-[1120px] items-center justify-center"
			>
				<div
					class="flex w-full max-w-full items-center gap-2 rounded-full border border-white/10 bg-paper/70 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl sm:w-max sm:max-w-[min(100%,52rem)]"
				>
					<a
						href="/"
						class="type-chrome-title shrink-0 rounded-full px-4 py-2 text-[1.2rem] leading-none text-ink no-underline sm:text-[1.35rem]"
						title="Library">Lumen</a
					>

					{#if !isSlim}
						<nav
							class="hidden min-w-0 items-center rounded-full border-rule bg-black/20 p-0.5 sm:flex"
							aria-label="Primary"
						>
							<a href="/" class={navClass(isLibrary)} aria-current={isLibrary ? 'page' : undefined}
								>Library</a
							>
							<a
								href="/translate"
								class={navClass(isTranslate)}
								aria-current={isTranslate ? 'page' : undefined}>Translate</a
							>
							<a
								href="/settings"
								class={navClass(isSettings)}
								aria-current={isSettings ? 'page' : undefined}>Settings</a
							>
						</nav>
					{:else}
						<nav class="hidden min-w-0 items-center gap-1 sm:flex" aria-label="Primary">
							<a
								href="/"
								class="type-nav rounded-full px-3 py-2 text-ink-soft no-underline hover:text-ink"
								>Library</a
							>
						</nav>
					{/if}

					<div class="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-2">
						<input
							bind:this={importInput}
							type="file"
							accept=".epub,.txt,.md,.markdown,application/epub+zip,text/plain,text/markdown"
							multiple
							class="sr-only"
							onchange={onImportChange}
						/>
						{#if showImport}
							<Button
								variant="secondary"
								type="button"
								class="!hidden !py-2 !pl-4 !pr-1.5 text-[13px] font-medium sm:!inline-flex"
								disabled={importing}
								onclick={() => importInput?.click()}
							>
								{importing ? 'Importing…' : 'Import'}
								<span
									class="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105"
									aria-hidden="true"
								>
									<ArrowUpRight size={14} weight="light" />
								</span>
							</Button>
						{/if}
						<button
							type="button"
							class="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-ink ring-1 ring-white/10 sm:hidden"
							aria-expanded={menuOpen}
							aria-label={menuOpen ? 'Close menu' : 'Open menu'}
							onclick={() => (menuOpen = !menuOpen)}
						>
							<span
								class="absolute h-px w-4 bg-ink transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] {menuOpen
									? 'rotate-45'
									: '-translate-y-1'}"
							></span>
							<span
								class="absolute h-px w-4 bg-ink transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] {menuOpen
									? '-rotate-45'
									: 'translate-y-1'}"
							></span>
						</button>
					</div>
				</div>
			</div>
		</header>

		{#if menuOpen}
			<div
				class="fixed inset-0 z-30 flex flex-col justify-end bg-black/80 px-4 pb-10 pt-28 backdrop-blur-3xl sm:hidden"
			>
				<nav class="flex flex-col gap-1" aria-label="Mobile">
					{#each overlayLinks as item, i (item.href)}
						<a
							href={item.href}
							class="type-masthead translate-y-0 text-4xl text-ink no-underline opacity-100 {item.delay}"
							style="animation: island-link-in 700ms cubic-bezier(0.32,0.72,0,1) both; animation-delay: {80 +
								i * 50}ms"
							aria-current={path === item.href || (item.href === '/' && isLibrary)
								? 'page'
								: undefined}>{item.label}</a
						>
					{/each}
					{#if !isAuth}
						<a
							href="/auth"
							class="type-masthead mt-4 text-3xl text-ink-soft no-underline"
							style="animation: island-link-in 700ms cubic-bezier(0.32,0.72,0,1) both; animation-delay: 360ms"
							>Sign in</a
						>
					{/if}
					{#if showImport}
						<button
							type="button"
							class="mt-6 self-start font-ui text-sm text-crimson"
							disabled={importing}
							onclick={() => importInput?.click()}
						>
							{importing ? 'Importing…' : 'Import a book'}
						</button>
					{/if}
				</nav>
			</div>
		{/if}

		<main
			class="relative z-10 mx-auto w-full max-w-[1120px] px-4 pb-24 pt-28 sm:px-6 sm:pb-28 sm:pt-32 {isSlim
				? 'sm:pt-28'
				: ''}"
		>
			{@render children()}
		</main>

		{#if !isLibrary}
			<footer class="relative z-10 mx-auto max-w-[1120px] px-4 py-10 sm:px-6">
				<div
					class="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-white/10 bg-white/5 p-2"
				>
					<div
						class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-[calc(2rem-0.5rem)] bg-paper px-5 py-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
					>
						<p class="type-micro text-ink-soft">Local-first · offline by default</p>
						<nav class="flex flex-wrap gap-4" aria-label="Footer">
							<a
								href="/"
								class="type-meta text-ink-mute no-underline hover:text-ink-soft"
								aria-current={isLibrary ? 'page' : undefined}>Library</a
							>
							<a href="/translate" class="type-meta text-ink-mute no-underline hover:text-ink-soft"
								>Translate</a
							>
							<a href="/settings" class="type-meta text-ink-mute no-underline hover:text-ink-soft"
								>Settings</a
							>
							<a href="/about" class="type-meta text-ink-mute no-underline hover:text-ink-soft"
								>About</a
							>
							<a href="/welcome" class="type-meta text-ink-mute no-underline hover:text-ink-soft"
								>Welcome</a
							>
							{#if !isAuth}
								<a href="/auth" class="type-meta text-ink-mute no-underline hover:text-ink-soft"
									>Sign in</a
								>
							{/if}
						</nav>
					</div>
				</div>
			</footer>
		{/if}
	</div>
{/if}
