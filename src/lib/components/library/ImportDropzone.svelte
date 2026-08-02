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
	class="relative rounded-[var(--radius-lg)] border border-dashed transition-colors duration-200 ease-[var(--ease-out-expo)] outline-none focus-visible:ring-2 focus-visible:ring-star {dragging
		? 'border-star bg-star/5'
		: 'border-hairline bg-void-elevated/60 hover:border-star-muted/60'} {compact
		? 'p-6'
		: 'p-10 sm:p-14'}"
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
			class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-void-panel ring-1 ring-hairline"
		>
			<UploadSimple size={22} weight="light" class="text-star" />
		</span>
		{#if !compact}
			<h2 class="mb-2 font-ui text-xl font-semibold tracking-tight text-ink">Drop a book to begin</h2>
			<p class="mb-6 max-w-sm text-sm leading-relaxed text-ink-dim">
				EPUB, Markdown, or plain text. Files stay on this device until you opt into cloud sync.
			</p>
		{:else}
			<p class="mb-4 text-sm text-ink-dim">Drop EPUB, Markdown, or text — or browse</p>
		{/if}
		<span class="pointer-events-auto" role="presentation">
			<Button type="button" onclick={(e) => { e.stopPropagation(); inputEl?.click(); }}>Import book</Button>
		</span>
	</div>
</div>
