<script lang="ts">
	import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		onfiles,
		compact = false,
		featured = false,
		accept = '.epub,.txt,.md,.markdown,application/epub+zip,text/plain,text/markdown',
		multiple = true,
		heading = '',
		detail = ''
	}: {
		onfiles: (files: FileList | File[]) => void;
		compact?: boolean;
		/** Full empty-state hero treatment */
		featured?: boolean;
		accept?: string;
		multiple?: boolean;
		heading?: string;
		detail?: string;
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
	class="import-frame relative border-2 border-dashed border-rule bg-paper outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink {dragging
		? 'is-dragging border-crimson'
		: 'hover:border-ink-mute'} {featured
		? 'p-12 sm:p-16'
		: compact
			? 'p-6 sm:p-8'
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
		{accept}
		{multiple}
		class="sr-only"
		onchange={handleChange}
	/>
	<div class="pointer-events-none flex flex-col items-center text-center">
		<span
			class="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-rule bg-newsprint transition-transform duration-200 {dragging
				? 'scale-105 border-ink'
				: ''}"
		>
			<UploadSimple size={20} weight="light" class="text-ink" />
		</span>
		{#if featured}
			<h2 class="type-section mb-3 text-[2rem] text-ink sm:text-[2.5rem]">{heading || 'Drop a manuscript'}</h2>
			<p class="type-body mb-8 max-w-md text-ink-soft">
				{detail ||
					'EPUB, Markdown, or plain text. Files stay on this device until you choose cloud sync.'}
			</p>
		{:else if !compact}
			<h2 class="type-section mb-2 text-[1.65rem] text-ink sm:text-3xl">{heading || 'Drop a manuscript'}</h2>
			<p class="type-body mb-7 max-w-sm text-[14px] text-ink-soft">
				{detail ||
					'EPUB, Markdown, or plain text. Files stay on this device until you choose cloud sync.'}
			</p>
		{:else}
			<p class="type-body mb-5 text-sm text-ink-soft">
				{dragging ? 'Release to import' : detail || 'Drop EPUB, Markdown, or text — or browse'}
			</p>
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
