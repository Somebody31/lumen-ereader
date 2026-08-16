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
		'group inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-medium tracking-tight transition-[color,background-color,border-color,transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100';

	const variants: Record<Variant, string> = {
		primary:
			'bg-ink text-newsprint hover:opacity-90 px-6 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
		secondary:
			'bg-crimson text-ink hover:bg-crimson-soft px-6 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]',
		ghost:
			'bg-surface/60 text-ink ring-1 ring-white/10 hover:bg-surface px-5 py-3',
		danger:
			'bg-transparent text-danger ring-1 ring-danger/40 hover:bg-danger/15 px-5 py-3'
	};
</script>

<button class="{base} {variants[variant]} {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</button>
