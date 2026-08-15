export type BookFormat = 'epub' | 'text' | 'markdown';

export type ReadingTheme = 'night' | 'paper' | 'sepia' | 'contrast';

/** Body face for reading surface */
export type ReadingFont = 'literata' | 'newsreader' | 'source-sans' | 'system';

export type TextAlign = 'left' | 'justify';

export type BookLang = 'zh' | 'en';
export type SourceLang = 'zh' | 'en' | 'unknown';
export type TranslationStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';
export type ChapterJobStatus = 'skipped' | 'pending' | 'done' | 'error';
export type GlossaryCategory = 'name' | 'place' | 'title' | 'term' | 'other';

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
	'name',
	'place',
	'title',
	'term',
	'other'
];

export interface TranslationMeta {
	status: TranslationStatus;
	chaptersSelected: number;
	chaptersDone: number;
	error?: string;
	updatedAt: number;
}

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
	sourceLang?: SourceLang;
	/** Last language opened in the reader */
	activeLang?: BookLang;
	translation?: TranslationMeta;
}

export interface BookRecord extends BookMeta {
	/** Raw source file bytes (Chinese, or the original import) */
	blob: Blob;
	/** English (or in-progress) EPUB rebuilt from the source */
	translatedBlob?: Blob;
}

/** Library shelf item — blob stripped so listing stays cheap */
export type BookListItem = BookMeta;

export interface ProgressLangSlice {
	location: string;
	fraction: number;
	label?: string;
}

export interface ProgressRecord {
	bookId: string;
	/** 0–1 fraction through the book when known */
	fraction: number;
	/** EPUB CFI or scroll marker for text */
	location: string;
	/** Human label e.g. chapter title */
	label?: string;
	updatedAt: number;
	/** Per-language restore points — CFIs do not survive ZH↔EN */
	byLang?: Partial<Record<BookLang, ProgressLangSlice>>;
}

export interface GlossaryEntry {
	id: string;
	bookId: string;
	source: string;
	preferred: string;
	aliases?: string[];
	category: GlossaryCategory;
	locked: boolean;
	notes?: string;
	showInReader: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface GlossaryUpdate {
	source: string;
	preferred: string;
	category?: string;
	notes?: string;
	aliases?: string[];
}

export interface ReaderGlossaryItem {
	id: string;
	source: string;
	preferred: string;
	category: GlossaryCategory;
}

export interface TranslationChapter {
	href: string;
	title: string;
	charCount: number;
	selected: boolean;
	status: ChapterJobStatus;
	error?: string;
}

export interface TranslationJob {
	bookId: string;
	chapters: TranslationChapter[];
	startedAt?: number;
	updatedAt: number;
	lastError?: string;
}

export interface TranslateStatus {
	configured: boolean;
	model: string;
}

export function isGlossaryCategory(v: string | undefined): v is GlossaryCategory {
	return !!v && (GLOSSARY_CATEGORIES as string[]).includes(v);
}

export function translationBadge(t?: TranslationMeta): string | null {
	if (!t) return null;
	if (t.chaptersSelected <= 0 && t.chaptersDone <= 0) return null;
	if (t.status === 'done' || (t.chaptersSelected > 0 && t.chaptersDone >= t.chaptersSelected)) {
		return 'EN';
	}
	if (t.chaptersDone > 0 || t.status === 'running' || t.status === 'paused' || t.status === 'error') {
		return `EN ${t.chaptersDone}/${t.chaptersSelected}`;
	}
	return null;
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
