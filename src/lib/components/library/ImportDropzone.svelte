<script lang="ts">
	import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		onfiles,
		compact = false
	}: {
		onfiles: (files: FileList | File[]) => void;
		compact?: boolean;
	} = $props();

	let dragging = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (e.dataTransfer?.files?.length) onfiles(e.dataTransfer.files);
	}

	function handleChange(e: Event) {
		const t = e.currentTarget as HTMLInputElement;
		if (t.files?.length) {
			onfiles(t.files);
			t.value = '';
		}
	}
</script>

<div
	role="button"
	tabindex="0"
	class="relative overflow-hidden rounded-[var(--radius-xl)] transition-all duration-280 ease-[var(--ease-atelier)] outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-ash {dragging
		? 'bg-indigo/[0.06] shadow-[var(--shadow-plate-hover)]'
		: 'bg-paper shadow-[var(--shadow-plate)] hover:shadow-[var(--shadow-plate-hover)]'} {compact
		? 'p-7'
		: 'p-10 sm:p-16'}"
	ondragenter={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={handleDrop}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			inputEl?.click();
		}
	}}
	onclick={() => inputEl?.click()}
>
	<!-- registration corner marks -->
	<span class="pointer-events-none absolute left-4 top-4 h-3 w-3 border-l-2 border-t-2 border-indigo/30" aria-hidden="true"></span>
	<span class="pointer-events-none absolute right-4 top-4 h-3 w-3 border-r-2 border-t-2 border-indigo/30" aria-hidden="true"></span>
	<span class="pointer-events-none absolute bottom-4 left-4 h-3 w-3 border-b-2 border-l-2 border-indigo/30" aria-hidden="true"></span>
	<span class="pointer-events-none absolute bottom-4 right-4 h-3 w-3 border-b-2 border-r-2 border-indigo/30" aria-hidden="true"></span>

	<input
		bind:this={inputEl}
		type="file"
		accept=".epub,.txt,.md,.markdown,application/epub+zip,text/plain,text/markdown"
		multiple
		class="sr-only"
		onchange={handleChange}
	/>
	<div class="pointer-events-none flex flex-col items-center text-center">
		<span
			class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-ash shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-rule/80"
		>
			<UploadSimple size={24} weight="light" class="text-indigo" />
		</span>
		{#if !compact}
			<p class="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-indigo">Import</p>
			<h2 class="mb-2 font-ui text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
				Drop a book on the desk
			</h2>
			<p class="mb-7 max-w-sm text-[15px] leading-relaxed text-ink-soft">
				EPUB, Markdown, or plain text. Files stay on this device until you choose cloud sync.
			</p>
		{:else}
			<p class="mb-5 text-sm text-ink-soft">Drop EPUB, Markdown, or text — or browse</p>
		{/if}
		<span class="pointer-events-auto" role="presentation">
			<Button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					inputEl?.click();
				}}
			>
				Import book
			</Button>
		</span>
	</div>
</div>
