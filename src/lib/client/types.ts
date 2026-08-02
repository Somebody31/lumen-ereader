export type BookFormat = 'epub' | 'text' | 'markdown';

export type ReadingTheme = 'night' | 'paper' | 'sepia' | 'contrast';

export interface BookMeta {
	id: string;
	title: string;
	author: string;
	format: BookFormat;
	mimeType: string;
	fileName: string;
	coverDataUrl?: string;
	addedAt: number;
	updatedAt: number;
	sizeBytes: number;
	/** Word-ish length for text books; spine item count for epub when known */
	lengthHint?: number;
}

export interface BookRecord extends BookMeta {
	/** Raw file bytes */
	blob: Blob;
}

/** Library shelf item — blob stripped so listing stays cheap */
export type BookListItem = BookMeta;

export interface ProgressRecord {
	bookId: string;
	/** 0–1 fraction through the book when known */
	fraction: number;
	/** EPUB CFI or scroll marker for text */
	location: string;
	/** Human label e.g. chapter title */
	label?: string;
	updatedAt: number;
}

export interface BookmarkRecord {
	id: string;
	bookId: string;
	location: string;
	label: string;
	createdAt: number;
}

export interface ReaderPrefs {
	theme: ReadingTheme;
	fontSize: number;
	lineHeight: number;
	/** max width in ch */
	measure: number;
	margin: number;
}

export const DEFAULT_PREFS: ReaderPrefs = {
	theme: 'night',
	fontSize: 18,
	lineHeight: 1.7,
	measure: 68,
	margin: 24
};

export interface SessionInfo {
	authenticated: boolean;
	syncAvailable: boolean;
	message?: string;
}
