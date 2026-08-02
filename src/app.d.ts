// See https://svelte.dev/docs/kit/types#app.d.ts

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				BOOKS: R2Bucket;
				META: KVNamespace;
				ASSETS?: Fetcher;
				SESSION_SECRET?: string;
				READER_PASSPHRASE?: string;
				APP_NAME?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
