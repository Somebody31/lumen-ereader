export type BookFormat = 'epub' | 'text' | 'markdown';

export type ReadingTheme = 'night' | 'paper' | 'sepia' | 'contrast';

/** Body face for reading surface */
export type ReadingFont = 'literata' | 'newsreader' | 'source-sans' | 'system';

export type TextAlign = 'left' | 'justify';

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
	fontFamily: ReadingFont;
	fontSize: number;
	lineHeight: number;
	/** Letter-spacing in em (0 = default tracking) */
	letterSpacing: number;
	/** Paragraph bottom margin as em multiples of line height feel (0.5–2) */
	paragraphSpacing: number;
	/** max width in ch */
	measure: number;
	margin: number;
	textAlign: TextAlign;
	hyphenate: boolean;
	/** 0.55–1; multiplies stage brightness via dim overlay */
	brightness: number;
	/** Request screen wake lock while reading */
	keepAwake: boolean;
}

export const DEFAULT_PREFS: ReaderPrefs = {
	theme: 'night',
	fontFamily: 'literata',
	fontSize: 18,
	lineHeight: 1.7,
	letterSpacing: 0,
	paragraphSpacing: 1,
	measure: 68,
	margin: 24,
	textAlign: 'left',
	hyphenate: false,
	brightness: 1,
	keepAwake: false
};

export const READING_FONTS: {
	id: ReadingFont;
	label: string;
	/** CSS font-family stack for reader body */
	stack: string;
}[] = [
	{
		id: 'literata',
		label: 'Literata',
		stack: '"Literata Variable", Literata, Georgia, "Times New Roman", serif'
	},
	{
		id: 'newsreader',
		label: 'Newsreader',
		stack: '"Newsreader Variable", Newsreader, Georgia, "Times New Roman", serif'
	},
	{
		id: 'source-sans',
		label: 'Source Sans',
		stack: '"Source Sans 3 Variable", "Source Sans 3", system-ui, sans-serif'
	},
	{
		id: 'system',
		label: 'System',
		stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
	}
];

export function fontStack(family: ReadingFont | string | undefined): string {
	const id = (family as ReadingFont) || 'literata';
	return READING_FONTS.find((f) => f.id === id)?.stack ?? READING_FONTS[0].stack;
}

export interface SessionInfo {
	authenticated: boolean;
	syncAvailable: boolean;
	message?: string;
}
