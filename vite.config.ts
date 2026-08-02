import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-cloudflare';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				// See https://svelte.dev/docs/kit/adapter-cloudflare
				routes: {
					include: ['/*'],
					exclude: ['<all>']
				},
				platformProxy: {
					configPath: 'wrangler.jsonc'
				}
			})
		})
	],
	optimizeDeps: {
		include: ['epubjs', 'jszip', 'marked', 'idb']
	},
	ssr: {
		noExternal: ['phosphor-svelte']
	}
});
