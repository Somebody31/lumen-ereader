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
	class="relative border transition-colors duration-200 ease-[var(--ease-editorial)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink {dragging
		? 'border-ink bg-surface'
		: 'border-rule bg-paper hover:border-ink'} {compact ? 'p-6 sm:p-8' : 'p-10 sm:p-14'}"
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
			class="mb-4 flex h-11 w-11 items-center justify-center border border-rule bg-newsprint"
		>
			<UploadSimple size={20} weight="light" class="text-ink" />
		</span>
		{#if !compact}
			<p class="kicker mb-2">Import</p>
			<h2
				class="mb-2 font-display text-[1.65rem] font-semibold tracking-tight text-ink sm:text-3xl"
				style="font-family: var(--font-display)"
			>
				Drop a manuscript
			</h2>
			<p class="mb-7 max-w-sm font-ui text-[14px] leading-relaxed text-ink-soft">
				EPUB, Markdown, or plain text. Files stay on this device until you choose cloud sync.
			</p>
		{:else}
			<p class="mb-5 font-ui text-sm text-ink-soft">Drop EPUB, Markdown, or text — or browse</p>
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
