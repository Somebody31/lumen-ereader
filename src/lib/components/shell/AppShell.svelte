<script lang="ts">
	import { page } from '$app/state';
	import { importFiles } from '$lib/client/importBook';
	import { formatBytes, LARGE_SIZE_BYTES, WARN_SIZE_BYTES } from '$lib/client/textRender';
	import Button from '$lib/components/ui/Button.svelte';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const isReader = $derived(path.startsWith('/read/'));
	const isLibrary = $derived(path === '/library' || path.startsWith('/library/'));
	const isLanding = $derived(path === '/' || path === '/welcome' || path.startsWith('/welcome/'));
	const isAbout = $derived(path === '/about' || path.startsWith('/about/'));
	const isSettings = $derived(path.startsWith('/settings'));

	let importInput: HTMLInputElement | undefined = $state();
	let importing = $state(false);

	async function onImportChange(e: Event) {
		const t = e.currentTarget as HTMLInputElement;
		if (!t.files?.length) return;
		importing = true;
		try {
			const list = Array.from(t.files);
			await importFiles(list);
			const large = list.filter((f) => f.size >= WARN_SIZE_BYTES);
			let notice = '';
			if (large.length) {
				const biggest = large.reduce((a, b) => (a.size > b.size ? a : b));
				notice =
					biggest.size >= LARGE_SIZE_BYTES
						? `Imported large file (${formatBytes(biggest.size)}). Opening uses chunked rendering.`
						: `Imported ${formatBytes(biggest.size)} file.`;
			}
			window.dispatchEvent(new CustomEvent('lumen:books-changed', { detail: { notice } }));
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
		return `type-nav rounded-[calc(var(--radius-md)-2px)] px-3 py-2 no-underline transition-[color,background-color] duration-200 sm:px-3.5 ${
			active
				? 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]'
				: 'text-ink-soft hover:bg-surface/60 hover:text-ink'
		}`;
	}
</script>

{#if isReader}
	{@render children()}
{:else}
	<div class="relative min-h-[100dvh] bg-newsprint text-ink">
		<div class="grain" aria-hidden="true"></div>

		<header class="sticky top-0 z-40 border-b border-rule bg-newsprint/88 backdrop-blur-md">
			<div
				class="mx-auto flex h-14 max-w-[1120px] items-center gap-2.5 px-4 sm:h-[3.75rem] sm:gap-4 sm:px-6"
			>
				<a href="/" class="group flex shrink-0 items-center no-underline" title="Home">
					<span class="type-chrome-title text-[1.35rem] leading-none text-ink sm:text-[1.5rem]"
						>Lumen</span
					>
				</a>

				<nav
					class="flex min-w-0 items-center overflow-x-auto rounded-md border border-rule bg-paper p-0.5"
					aria-label="Primary"
				>
					<a
						href="/library"
						class={navClass(isLibrary)}
						aria-current={isLibrary ? 'page' : undefined}>Library</a
					>
					<a
						href="/settings"
						class={navClass(isSettings)}
						aria-current={isSettings ? 'page' : undefined}>Settings</a
					>
					<a href="/about" class={navClass(isAbout)} aria-current={isAbout ? 'page' : undefined}
						>About</a
					>
				</nav>

				<div class="ml-auto flex shrink-0 items-center gap-2">
					<input
						bind:this={importInput}
						type="file"
						accept=".epub,.txt,.md,.markdown,application/epub+zip,text/plain,text/markdown"
						multiple
						class="sr-only"
						onchange={onImportChange}
					/>
					{#if !isLanding}
						<Button
							variant="secondary"
							type="button"
							class="!px-4 !py-2 text-[13px] font-medium"
							disabled={importing}
							onclick={() => importInput?.click()}
						>
							{importing ? 'Importing…' : 'Import'}
						</Button>
					{/if}
				</div>
			</div>
		</header>

		<main
			class="relative z-10 mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12 {isLanding
				? 'sm:pt-10'
				: ''}"
		>
			{@render children()}
		</main>

		{#if !isLibrary}
			<footer class="relative z-10 mx-auto max-w-[1120px] border-t border-rule px-4 py-6 sm:px-6">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="type-micro text-ink-soft">Local-first · offline by default</p>
					<nav class="flex gap-4" aria-label="Footer">
						<a
							href="/"
							class="type-meta text-ink-mute no-underline hover:text-ink-soft"
							aria-current={isLanding ? 'page' : undefined}>Home</a
						>
						<a
							href="/library"
							class="type-meta text-ink-mute no-underline hover:text-ink-soft"
							aria-current={isLibrary ? 'page' : undefined}>Library</a
						>
						<a href="/about" class="type-meta text-ink-mute no-underline hover:text-ink-soft"
							>About</a
						>
						<a href="/settings" class="type-meta text-ink-mute no-underline hover:text-ink-soft"
							>Settings</a
						>
					</nav>
				</div>
			</footer>
		{/if}
	</div>
{/if}
