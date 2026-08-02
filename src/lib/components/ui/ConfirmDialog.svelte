<script lang="ts">
	import { onMount } from 'svelte';
	import Button from './Button.svelte';

	let {
		open = false,
		title = 'Confirm',
		message = '',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		onconfirm,
		oncancel
	}: {
		open?: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	let panel: HTMLElement | undefined = $state();

	onMount(() => {
		function onKey(e: KeyboardEvent) {
			if (!open) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				oncancel();
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	$effect(() => {
		if (open && panel) {
			const btn = panel.querySelector<HTMLElement>('#confirm-cancel-btn');
			btn?.focus();
		}
	});
</script>

{#if open}
	<div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
		<button
			type="button"
			class="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
			aria-label="Dismiss"
			onclick={oncancel}
		></button>
		<div
			bind:this={panel}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="confirm-title"
			aria-describedby="confirm-desc"
			class="relative z-10 w-full max-w-sm rounded-lg border border-rule bg-paper p-6 shadow-[var(--shadow-plate-hover)]"
		>
			<h2 id="confirm-title" class="type-section text-xl text-ink">
				{title}
			</h2>
			<p id="confirm-desc" class="type-body mt-3 text-ink-soft">
				{message}
			</p>
			<div class="mt-6 flex flex-wrap justify-end gap-2">
				<Button id="confirm-cancel-btn" variant="ghost" type="button" onclick={oncancel}>
					{cancelLabel}
				</Button>
				<Button variant={danger ? 'danger' : 'primary'} type="button" onclick={onconfirm}>
					{confirmLabel}
				</Button>
			</div>
		</div>
	</div>
{/if}
