<script lang="ts">
	import { page } from '$app/state';
	import GearSix from 'phosphor-svelte/lib/GearSix';
	import Books from 'phosphor-svelte/lib/Books';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const isReader = $derived(path.startsWith('/read/'));
</script>

{#if isReader}
	{@render children()}
{:else}
	<div class="relative min-h-[100dvh] bg-ash text-ink">
		<!-- soft atelier light (not a neon mesh orb) -->
		<div
			class="pointer-events-none fixed inset-0 z-0"
			aria-hidden="true"
			style="background:
				radial-gradient(ellipse 80% 50% at 15% -10%, rgba(31,58,104,0.07), transparent 55%),
				radial-gradient(ellipse 50% 40% at 95% 5%, rgba(224,60,43,0.04), transparent 45%);"
		></div>
		<!-- subtle ruled desk texture -->
		<div
			class="pointer-events-none fixed inset-0 z-0 opacity-[0.28]"
			aria-hidden="true"
			style="background-image: linear-gradient(var(--color-rule) 1px, transparent 1px); background-size: 100% 52px; mask-image: linear-gradient(to bottom, black 0%, transparent 68%);"
		></div>

		<header class="sticky top-0 z-40 px-4 pt-4 sm:px-6 sm:pt-5">
			<div
				class="mx-auto flex h-[3.35rem] max-w-[1180px] items-center justify-between rounded-full bg-paper/92 px-2 pl-3 shadow-[var(--shadow-island)] backdrop-blur-xl ring-1 ring-black/[0.045]"
			>
				<a href="/" class="group flex items-center gap-2.5 no-underline">
					<span
						class="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-indigo text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(31,58,104,0.25)] transition-transform duration-200 ease-[var(--ease-atelier)] group-active:scale-95"
					>
						<span class="font-ui text-[11px] font-semibold tracking-tight">L</span>
						<span
							class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-seal ring-2 ring-paper"
						></span>
					</span>
					<span class="font-ui text-[15px] font-semibold tracking-tight text-ink">Lumen</span>
				</a>
				<nav class="flex items-center gap-0.5 pr-0.5" aria-label="Primary">
					<a
						href="/"
						class="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium tracking-tight transition-all duration-200 ease-[var(--ease-atelier)] {path ===
						'/'
							? 'bg-indigo text-white shadow-[0_2px_10px_rgba(31,58,104,0.28)]'
							: 'text-ink-soft hover:bg-ash hover:text-ink'}"
					>
						<Books size={17} weight="light" />
						<span class="hidden sm:inline">Library</span>
					</a>
					<a
						href="/settings"
						class="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium tracking-tight transition-all duration-200 ease-[var(--ease-atelier)] {path.startsWith(
							'/settings'
						)
							? 'bg-indigo text-white shadow-[0_2px_10px_rgba(31,58,104,0.28)]'
							: 'text-ink-soft hover:bg-ash hover:text-ink'}"
					>
						<GearSix size={17} weight="light" />
						<span class="hidden sm:inline">Settings</span>
					</a>
				</nav>
			</div>
		</header>

		<main class="relative z-10 mx-auto max-w-[1180px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
			{@render children()}
		</main>

		<footer class="relative z-10 mx-auto max-w-[1180px] px-4 pb-10 sm:px-6">
			<p class="text-[12px] leading-relaxed text-ink-mute">
				Local-first reading · files stay on this device · cloud sync optional
			</p>
		</footer>
	</div>
{/if}
