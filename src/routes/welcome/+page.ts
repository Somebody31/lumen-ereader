import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Old welcome URL → root landing */
export const load: PageLoad = () => {
	redirect(308, '/');
};
