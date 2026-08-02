<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

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
		'inline-flex items-center justify-center gap-2 rounded-none text-[13px] font-medium tracking-tight transition-colors duration-200 ease-[var(--ease-editorial)] active:opacity-90 disabled:opacity-40 disabled:pointer-events-none';

	const variants: Record<Variant, string> = {
		primary: 'bg-ink text-paper hover:bg-ink-soft px-5 py-2.5',
		secondary: 'bg-crimson text-paper hover:bg-crimson-soft px-5 py-2.5',
		ghost: 'bg-transparent text-ink border border-rule hover:border-ink px-4 py-2.5',
		danger: 'bg-transparent text-danger border border-danger/40 hover:border-danger px-4 py-2.5'
	};
</script>

<button class="{base} {variants[variant]} {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</button>
