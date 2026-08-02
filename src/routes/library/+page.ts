import { redirect } from '@sveltejs/kit';

/** Legacy shelf URL → library is home at `/` */
export function load() {
	redirect(308, '/');
}
