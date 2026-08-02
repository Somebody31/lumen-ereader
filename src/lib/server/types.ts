export type AppEnv = {
	Bindings: {
		BOOKS: R2Bucket;
		META: KVNamespace;
		ASSETS?: Fetcher;
		SESSION_SECRET?: string;
		READER_PASSPHRASE?: string;
		APP_NAME?: string;
	};
};

export interface BookMetaDto {
	id: string;
	title: string;
	author: string;
	format: 'epub' | 'text' | 'markdown';
	mimeType: string;
	fileName: string;
	coverDataUrl?: string;
	addedAt: number;
	updatedAt: number;
	sizeBytes: number;
	lengthHint?: number;
}

export interface ProgressDto {
	bookId: string;
	fraction: number;
	location: string;
	label?: string;
	updatedAt: number;
}
