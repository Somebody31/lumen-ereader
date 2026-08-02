<script lang="ts">
	let {
		title,
		author,
		coverDataUrl,
		class: className = ''
	}: {
		title: string;
		author: string;
		coverDataUrl?: string | null;
		class?: string;
	} = $props();

	/** Monochrome + ink editorial plates */
	const palette = $derived.by(() => {
		const palettes = [
			{ bg: '#0B0B0B', fg: '#F3F2ED' },
			{ bg: '#1A1A18', fg: '#F3F2ED' },
			{ bg: '#F3F2ED', fg: '#0B0B0B' },
			{ bg: '#2C2A26', fg: '#F3F2ED' },
			{ bg: '#EBEAE4', fg: '#0B0B0B' },
			{ bg: '#7A1C1C', fg: '#F3F2ED' },
			{ bg: '#3A3A38', fg: '#F3F2ED' },
			{ bg: '#161412', fg: '#EDE6D9' }
		];
		let h = 0;
		const s = title || 'book';
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
		return palettes[h % palettes.length];
	});

	const shortTitle = $derived(title.length > 42 ? title.slice(0, 40) + '…' : title);
</script>

<div class="relative h-full w-full overflow-hidden {className}">
	{#if coverDataUrl}
		<img src={coverDataUrl} alt="" class="h-full w-full object-cover" loading="lazy" />
	{:else}
		<div
			class="flex h-full w-full flex-col justify-between p-3.5 sm:p-4"
			style="background: {palette.bg}; color: {palette.fg}"
		>
			<div class="flex items-start justify-between border-b pb-2" style="border-color: color-mix(in srgb, {palette.fg} 25%, transparent)">
				<span
					class="font-ui text-[8px] font-medium uppercase tracking-[0.18em] opacity-60 sm:text-[9px]"
					>Lumen</span
				>
				<span class="font-ui text-[8px] opacity-45 sm:text-[9px]">Vol.</span>
			</div>
			<div class="mt-auto">
				<p
					class="font-display text-[0.95rem] font-semibold leading-snug tracking-tight sm:text-[1.1rem]"
					style="font-family: var(--font-display)"
				>
					{shortTitle}
				</p>
				{#if author}
					<p class="mt-2 font-ui text-[10px] opacity-65 sm:text-[11px]">{author}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
