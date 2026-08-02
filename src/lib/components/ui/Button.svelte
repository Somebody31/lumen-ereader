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
		'inline-flex items-center justify-center gap-2 rounded-md text-[13px] font-medium tracking-tight transition-[color,background-color,border-color,transform,opacity] duration-200 ease-[var(--ease-editorial)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100';

	const variants: Record<Variant, string> = {
		primary: 'bg-ink text-newsprint hover:bg-ink-soft px-5 py-2.5',
		secondary: 'bg-crimson text-ink hover:bg-crimson-soft px-5 py-2.5',
		ghost: 'bg-transparent text-ink border border-rule hover:border-ink hover:bg-surface/50 px-4 py-2.5',
		danger: 'bg-transparent text-danger border border-danger/40 hover:border-danger hover:bg-danger/10 px-4 py-2.5'
	};
</script>

<button class="{base} {variants[variant]} {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</button>
