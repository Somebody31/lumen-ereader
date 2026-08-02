<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const isReader = $derived(path.startsWith('/read/'));
	const isLibrary = $derived(path === '/');
</script>

{#if isReader}
	{@render children()}
{:else}
	<div class="relative min-h-[100dvh] bg-newsprint text-ink">
		<div class="grain" aria-hidden="true"></div>

		<header class="sticky top-0 z-40 border-b border-rule bg-newsprint/85 backdrop-blur-md">
			<div
				class="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:h-[3.75rem] sm:px-6"
			>
				<a href="/" class="group flex items-baseline gap-3 no-underline">
					<span class="display text-[1.65rem] tracking-[-0.03em] sm:text-[1.85rem]">Lumen</span>
					<span
						class="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-ink-mute sm:inline"
						>Reader</span
					>
				</a>
				<nav class="flex items-center gap-0" aria-label="Primary">
					<a
						href="/"
						class="px-3 py-2 font-ui text-[13px] tracking-tight transition-colors duration-200 {path ===
						'/'
							? 'text-ink underline decoration-1 underline-offset-[6px]'
							: 'text-ink-mute hover:text-ink'}"
					>
						Library
					</a>
					<a
						href="/settings"
						class="px-3 py-2 font-ui text-[13px] tracking-tight transition-colors duration-200 {path.startsWith(
							'/settings'
						)
							? 'text-ink underline decoration-1 underline-offset-[6px]'
							: 'text-ink-mute hover:text-ink'}"
					>
						Settings
					</a>
				</nav>
			</div>
		</header>

		<main class="relative z-10 mx-auto max-w-[1120px] px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
			{@render children()}
		</main>

		{#if !isLibrary}
			<footer class="relative z-10 mx-auto max-w-[1120px] border-t border-rule/70 px-4 py-6 sm:px-6">
				<p class="font-ui text-[10px] uppercase tracking-[0.12em] text-ink-mute/80">
					Local-first · offline by default
				</p>
			</footer>
		{/if}
	</div>
{/if}
