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

	/** Monochrome + ink editorial plates with more contrast range */
	const palette = $derived.by(() => {
		const palettes = [
			{ bg: '#0B0B0B', fg: '#F3F2ED', accent: '#7A1C1C' },
			{ bg: '#161412', fg: '#EDE6D9', accent: '#C4C3BC' },
			{ bg: '#F0EFE9', fg: '#0B0B0B', accent: '#7A1C1C' },
			{ bg: '#2C2A26', fg: '#F3F2ED', accent: '#9A9A94' },
			{ bg: '#E5E4DE', fg: '#0B0B0B', accent: '#3A3A38' },
			{ bg: '#7A1C1C', fg: '#F3F2ED', accent: '#E8DCC8' },
			{ bg: '#1A1A18', fg: '#F3F2ED', accent: '#7A1C1C' },
			{ bg: '#3A3A38', fg: '#F3F2ED', accent: '#C4C3BC' }
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
		<!-- light film so photo covers still sit in the tray -->
		<div
			class="pointer-events-none absolute inset-0"
			style="box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08), inset 0 0 40px rgba(0,0,0,0.04)"
		></div>
	{:else}
		<div
			class="flex h-full w-full flex-col justify-between p-3.5 sm:p-4"
			style="background: {palette.bg}; color: {palette.fg}"
		>
			<div
				class="flex items-start justify-between border-b pb-2"
				style="border-color: color-mix(in srgb, {palette.fg} 22%, transparent)"
			>
				<span
					class="font-ui text-[8px] font-medium uppercase tracking-[0.18em] opacity-70 sm:text-[9px]"
					>Lumen</span
				>
				<span
					class="h-1.5 w-1.5 shrink-0 self-center"
					style="background: {palette.accent}"
					aria-hidden="true"
				></span>
			</div>
			<div class="mt-auto">
				<p
					class="font-display text-[0.95rem] font-semibold leading-snug tracking-tight sm:text-[1.1rem]"
					style="font-family: var(--font-display); font-variation-settings: 'opsz' 36"
				>
					{shortTitle}
				</p>
				{#if author}
					<p class="mt-2 font-ui text-[10px] opacity-75 sm:text-[11px]">{author}</p>
				{/if}
				<div
					class="mt-4 h-px w-8"
					style="background: color-mix(in srgb, {palette.fg} 35%, transparent)"
				></div>
			</div>
		</div>
	{/if}
</div>
