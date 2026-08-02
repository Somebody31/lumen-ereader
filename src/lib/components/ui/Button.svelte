<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'ghost' | 'danger';

	let {
		variant = 'primary',
		class: className = '',
		children,
		...rest
	}: {
		variant?: Variant;
		class?: string;
		children?: Snippet;
	} & HTMLButtonAttributes = $props();

	const base =
		'inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-all duration-200 ease-[var(--ease-out-expo)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';

	const variants: Record<Variant, string> = {
		primary: 'bg-star text-void hover:bg-star-soft px-5 py-2.5',
		ghost:
			'bg-transparent text-ink ring-1 ring-hairline hover:bg-void-panel px-4 py-2.5',
		danger: 'bg-danger/15 text-danger ring-1 ring-danger/30 hover:bg-danger/25 px-4 py-2.5'
	};
</script>

<button class="{base} {variants[variant]} {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</button>
