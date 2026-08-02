import type { RequestHandler } from './$types';
import app from '$lib/server/app';

const handle: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) {
		// Local vite without CF bindings: still serve session/health with degraded mode
		const degraded = {
			BOOKS: null as unknown as R2Bucket,
			META: null as unknown as KVNamespace,
			APP_NAME: 'Lumen'
		};
		return app.fetch(request, degraded as App.Platform['env']);
	}
	return app.fetch(request, env, platform.context);
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
