import type { RequestHandler } from './$types';
import app from '$lib/server/app';

function localDeepseekKey(): string | undefined {
	const g = globalThis as typeof globalThis & {
		process?: { env?: Record<string, string | undefined> };
	};
	return g.process?.env?.DEEPSEEK_API_KEY;
}

function withLocalSecrets(env: App.Platform['env']): App.Platform['env'] {
	const key = env.DEEPSEEK_API_KEY || localDeepseekKey();
	if (key && key !== env.DEEPSEEK_API_KEY) {
		return { ...env, DEEPSEEK_API_KEY: key };
	}
	return env;
}

const handle: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env) {
		// Local vite without CF bindings: still serve session/health with degraded mode
		const degraded = {
			BOOKS: null as unknown as R2Bucket,
			META: null as unknown as KVNamespace,
			APP_NAME: 'Lumen',
			DEEPSEEK_API_KEY: localDeepseekKey()
		};
		return app.fetch(request, degraded as App.Platform['env']);
	}
	return app.fetch(request, withLocalSecrets(env), platform.context);
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
