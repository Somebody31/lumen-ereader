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
		'inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium tracking-tight transition-all duration-200 ease-[var(--ease-atelier)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';

	const variants: Record<Variant, string> = {
		primary:
			'bg-seal text-white hover:bg-seal-soft px-5 py-2.5 shadow-[0_1px_2px_rgba(224,60,43,0.25),0_6px_16px_rgba(224,60,43,0.2)]',
		secondary: 'bg-indigo text-white hover:bg-indigo-soft px-5 py-2.5',
		ghost:
			'bg-paper text-ink shadow-[var(--shadow-plate)] hover:shadow-[var(--shadow-plate-hover)] px-4 py-2.5',
		danger: 'bg-danger/10 text-danger hover:bg-danger/15 px-4 py-2.5'
	};
</script>

<button class="{base} {variants[variant]} {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</button>
