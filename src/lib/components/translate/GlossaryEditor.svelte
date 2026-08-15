<script lang="ts">
	import type { GlossaryCategory, GlossaryEntry } from '$lib/client/types';
	import { GLOSSARY_CATEGORIES } from '$lib/client/types';
	import { exportGlossaryJson, parseGlossaryImport } from '$lib/client/glossary';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		bookId,
		entries,
		onchange
	}: {
		bookId: string;
		entries: GlossaryEntry[];
		onchange: (next: GlossaryEntry[]) => void;
	} = $props();

	let importInput: HTMLInputElement | undefined = $state();
	let importError = $state('');

	function patch(id: string, partial: Partial<GlossaryEntry>) {
		onchange(
			entries.map((e) =>
				e.id === id ? { ...e, ...partial, updatedAt: Date.now() } : e
			)
		);
	}

	function addRow() {
		const now = Date.now();
		onchange([
			...entries,
			{
				id: crypto.randomUUID(),
				bookId,
				source: '',
				preferred: '',
				category: 'name',
				locked: false,
				showInReader: true,
				createdAt: now,
				updatedAt: now
			}
		]);
	}

	function removeRow(id: string) {
		onchange(entries.filter((e) => e.id !== id));
	}

	function downloadExport() {
		const blob = new Blob([exportGlossaryJson(entries)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'glossary.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function onImportFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		importError = '';
		try {
			const text = await file.text();
			const incoming = parseGlossaryImport(text, bookId);
			const bySource = new Map(entries.map((row) => [row.source.trim().toLowerCase(), row]));
			for (const row of incoming) {
				const key = row.source.trim().toLowerCase();
				const prev = bySource.get(key);
				if (prev) {
					bySource.set(key, {
						...prev,
						preferred: row.preferred || prev.preferred,
						aliases: row.aliases ?? prev.aliases,
						category: row.category,
						locked: row.locked,
						notes: row.notes ?? prev.notes,
						showInReader: row.showInReader,
						updatedAt: Date.now()
					});
				} else {
					bySource.set(key, row);
				}
			}
			onchange([...bySource.values()]);
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Import failed';
		}
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="type-section text-xl text-ink">Glossary</h2>
			<p class="type-meta mt-1 text-ink-soft">
				Sent to DeepSeek on every chapter. Edits in the reader lock the English for later chapters.
				Locked terms cannot be overwritten.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<input
				bind:this={importInput}
				type="file"
				accept="application/json,.json"
				class="sr-only"
				onchange={onImportFile}
			/>
			<Button type="button" variant="ghost" onclick={() => importInput?.click()}>Import JSON</Button>
			<Button type="button" variant="ghost" onclick={downloadExport} disabled={!entries.length}
				>Export</Button
			>
			<Button type="button" variant="ghost" onclick={addRow}>Add term</Button>
		</div>
	</div>

	{#if importError}
		<p class="font-ui text-sm text-danger" role="alert">{importError}</p>
	{/if}

	{#if entries.length === 0}
		<p class="type-body text-sm text-ink-mute">No terms yet. Add names before you start, or let the model propose them as chapters finish.</p>
	{:else}
		<div class="overflow-x-auto rounded-md border border-rule">
			<table class="glossary-table w-full min-w-[44rem] text-left">
				<thead>
					<tr class="border-b border-rule bg-newsprint">
						<th>Chinese</th>
						<th>English</th>
						<th>Kind</th>
						<th>Lock</th>
						<th>Reader</th>
						<th class="w-10"><span class="sr-only">Remove</span></th>
					</tr>
				</thead>
				<tbody>
					{#each entries as row (row.id)}
						<tr class="border-b border-rule last:border-0">
							<td>
								<input
									class="glossary-input"
									value={row.source}
									placeholder="林动"
									oninput={(e) =>
										patch(row.id, { source: (e.currentTarget as HTMLInputElement).value })}
								/>
							</td>
							<td>
								<input
									class="glossary-input"
									value={row.preferred}
									placeholder="Lin Dong"
									oninput={(e) =>
										patch(row.id, { preferred: (e.currentTarget as HTMLInputElement).value })}
								/>
							</td>
							<td>
								<select
									class="glossary-input"
									value={row.category}
									onchange={(e) =>
										patch(row.id, {
											category: (e.currentTarget as HTMLSelectElement).value as GlossaryCategory
										})}
								>
									{#each GLOSSARY_CATEGORIES as cat (cat)}
										<option value={cat}>{cat}</option>
									{/each}
								</select>
							</td>
							<td class="text-center">
								<input
									type="checkbox"
									class="accent-ink"
									checked={row.locked}
									aria-label="Lock {row.source || 'term'}"
									onchange={(e) =>
										patch(row.id, { locked: (e.currentTarget as HTMLInputElement).checked })}
								/>
							</td>
							<td class="text-center">
								<input
									type="checkbox"
									class="accent-ink"
									checked={row.showInReader}
									aria-label="Show {row.source || 'term'} in reader"
									onchange={(e) =>
										patch(row.id, { showInReader: (e.currentTarget as HTMLInputElement).checked })}
								/>
							</td>
							<td>
								<button
									type="button"
									class="px-1 font-ui text-xs text-ink-mute hover:text-danger"
									aria-label="Remove term"
									onclick={() => removeRow(row.id)}>×</button
								>
							</td>
						</tr>
						<tr class="border-b border-rule last:border-0 bg-newsprint/40">
							<td colspan="6" class="px-2 pb-2">
								<input
									class="glossary-input text-[12px]"
									value={row.notes ?? ''}
									placeholder="Notes for the model only — hidden from the reader"
									oninput={(e) =>
										patch(row.id, { notes: (e.currentTarget as HTMLInputElement).value })}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
