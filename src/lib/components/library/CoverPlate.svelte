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

	/** Flat ink plates — print-shop solid grounds, not gradients */
	const palette = $derived.by(() => {
		const palettes = [
			{ bg: '#1F3A68', fg: '#F4F1EA', seal: '#E03C2B' },
			{ bg: '#1A1C20', fg: '#EDE6D9', seal: '#E03C2B' },
			{ bg: '#3A1F2B', fg: '#F6EDE8', seal: '#E8A54B' },
			{ bg: '#1A3A32', fg: '#E8F2EE', seal: '#E03C2B' },
			{ bg: '#4A3420', fg: '#F7EFE3', seal: '#E03C2B' },
			{ bg: '#243044', fg: '#E9EEF5', seal: '#E03C2B' },
			{ bg: '#2F2640', fg: '#F0EAF5', seal: '#E03C2B' },
			{ bg: '#1E2A1E', fg: '#EAF0E8', seal: '#C4A35A' }
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
			<div class="flex items-start justify-between">
				<span
					class="text-[8px] font-semibold uppercase tracking-[0.16em] opacity-55 sm:text-[9px]"
					>Lumen</span
				>
				<span
					class="mt-0.5 h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
					style="background: {palette.seal}"
				></span>
			</div>
			<div class="mt-auto">
				<p
					class="font-ui text-[0.88rem] font-semibold leading-snug tracking-tight sm:text-[1.02rem]"
				>
					{shortTitle}
				</p>
				{#if author}
					<p class="mt-1.5 text-[10px] opacity-65 sm:text-[11px]">{author}</p>
				{/if}
				<span
					class="mt-4 block h-0.5 w-7 rounded-full opacity-40"
					style="background: {palette.fg}"
				></span>
			</div>
		</div>
	{/if}
</div>
