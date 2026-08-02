<script lang="ts">
	import { page } from '$app/state';
	import { importFiles } from '$lib/client/importBook';
	import { formatBytes, LARGE_SIZE_BYTES, WARN_SIZE_BYTES } from '$lib/client/textRender';
	import Button from '$lib/components/ui/Button.svelte';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const isReader = $derived(path.startsWith('/read/'));
	const isLibrary = $derived(path === '/');

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
			window.dispatchEvent(
				new CustomEvent('lumen:books-changed', { detail: { notice } })
			);
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
</script>

{#if isReader}
	{@render children()}
{:else}
	<div class="relative min-h-[100dvh] bg-newsprint text-ink">
		<div class="grain" aria-hidden="true"></div>

		<header class="sticky top-0 z-40 border-b border-rule bg-newsprint/88 backdrop-blur-md">
			<div
				class="mx-auto flex h-13 max-w-[1120px] items-center gap-3 px-4 sm:h-14 sm:gap-4 sm:px-6"
			>
				<a href="/" class="group flex shrink-0 items-baseline gap-2 no-underline">
					<span
						class="display text-[1.35rem] tracking-[-0.03em] sm:text-[1.45rem]"
						style="font-variation-settings: 'opsz' 36"
						>Lumen</span
					>
				</a>
				<nav class="flex min-w-0 items-center gap-0.5" aria-label="Primary">
					<a
						href="/"
						class="px-2.5 py-1.5 font-ui text-[13px] tracking-tight transition-colors duration-200 sm:px-3 {path ===
						'/'
							? 'text-ink underline decoration-1 underline-offset-[5px]'
							: 'text-ink-soft hover:text-ink'}"
					>
						Library
					</a>
					<a
						href="/settings"
						class="px-2.5 py-1.5 font-ui text-[13px] tracking-tight transition-colors duration-200 sm:px-3 {path.startsWith(
							'/settings'
						)
							? 'text-ink underline decoration-1 underline-offset-[5px]'
							: 'text-ink-soft hover:text-ink'}"
					>
						Settings
					</a>
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
					<Button
						variant="secondary"
						type="button"
						class="!px-3.5 !py-2 text-[12px] sm:!px-4"
						disabled={importing}
						onclick={() => importInput?.click()}
					>
						{importing ? 'Importing…' : 'Import'}
					</Button>
				</div>
			</div>
		</header>

		<main class="relative z-10 mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12">
			{@render children()}
		</main>

		{#if !isLibrary}
			<footer class="relative z-10 mx-auto max-w-[1120px] border-t border-rule px-4 py-6 sm:px-6">
				<p class="font-ui text-[10px] uppercase tracking-[0.12em] text-ink-soft">
					Local-first · offline by default
				</p>
			</footer>
		{/if}
	</div>
{/if}
