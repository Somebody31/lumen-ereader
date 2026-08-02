<script lang="ts">
	import { page } from '$app/state';
	import BookOpen from 'phosphor-svelte/lib/BookOpen';
	import GearSix from 'phosphor-svelte/lib/GearSix';
	import House from 'phosphor-svelte/lib/House';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const isReader = $derived(path.startsWith('/read/'));
</script>

{#if isReader}
	{@render children()}
{:else}
	<div class="min-h-[100dvh] bg-void text-ink">
		<header
			class="sticky top-0 z-40 border-b border-hairline/80 bg-void/90 backdrop-blur-md"
		>
			<div class="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
				<a href="/" class="group flex items-center gap-2.5 no-underline">
					<span
						class="flex h-8 w-8 items-center justify-center rounded-full bg-void-panel ring-1 ring-hairline transition-transform duration-200 ease-[var(--ease-out-expo)] group-active:scale-[0.98]"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-star"></span>
					</span>
					<span class="font-ui text-sm font-semibold tracking-tight text-ink">Lumen</span>
				</a>
				<nav class="flex items-center gap-1" aria-label="Primary">
					<a
						href="/"
						class="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-200 {path ===
						'/'
							? 'bg-void-panel text-ink'
							: 'text-ink-dim hover:text-ink'}"
					>
						<House size={18} weight="light" />
						<span class="hidden sm:inline">Library</span>
					</a>
					<a
						href="/settings"
						class="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-200 {path.startsWith(
							'/settings'
						)
							? 'bg-void-panel text-ink'
							: 'text-ink-dim hover:text-ink'}"
					>
						<GearSix size={18} weight="light" />
						<span class="hidden sm:inline">Settings</span>
					</a>
				</nav>
			</div>
		</header>
		<main class="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 sm:py-10">
			{@render children()}
		</main>
		<footer class="mx-auto max-w-[1120px] px-4 pb-10 pt-4 sm:px-6">
			<p class="flex items-center gap-2 text-xs text-ink-faint">
				<BookOpen size={14} weight="light" />
				Local-first reading. Cloud sync optional.
			</p>
		</footer>
	</div>
{/if}
