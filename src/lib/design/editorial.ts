/**
 * Editorial nocturne design tokens — single source for identity checks.
 * CSS mirrors these values in `src/app.css` `@theme`.
 */
export const EDITORIAL = {
	world: 'nocturne',
	palette: {
		/** Page ground — near-black */
		newsprint: '#0A0A0A',
		/** Elevated cards */
		paper: '#141413',
		surface: '#1C1C1A',
		/** Warm ivory type */
		ink: '#F0EFE9',
		inkSoft: '#C8C7C0',
		inkMute: '#9C9B94',
		rule: '#3F3F3C',
		ruleStrong: '#E8E7E1',
		/** Lifted crimson for dark grounds */
		crimson: '#D0544C',
		crimsonSoft: '#E0665E',
		danger: '#E86A62'
	},
	radius: {
		sm: '6px',
		md: '10px',
		lg: '14px',
		xl: '18px'
	},
	typography: {
		/** Mastheads & titles — editorial face with opsz */
		display: 'Newsreader Variable',
		/** UI chrome — classic newsroom sans */
		ui: 'Source Sans 3 Variable',
		/** Long-form body — digital reading face with opsz */
		reading: 'Literata Variable'
	},
	/** Rejected dominant identities */
	not: ['atelier', 'planetarium', 'indigo-primary', 'vermillion-seal', 'light-newsprint']
} as const;

/**
 * Role → face/weight/style rules. Components and CSS utility classes follow this map.
 * Tests assert these rules so size/weight choices stay coherent.
 */
export type TypeRole =
	| 'masthead'
	| 'section'
	| 'cardTitle'
	| 'eyebrow'
	| 'kicker'
	| 'body'
	| 'meta'
	| 'micro'
	| 'readingBody'
	| 'readingHead'
	| 'nav'
	| 'chromeTitle';

export type FaceToken = 'display' | 'ui' | 'reading';

export interface TypeRoleSpec {
	/** Which font token */
	face: FaceToken;
	/** CSS font-weight */
	weight: number;
	/** italic only for editorial eyebrows / authors — not chrome */
	italic: boolean;
	/** Suggested size band (px or rem) for docs/tests */
	size: string;
	/** Optical size when variable font supports opsz */
	opsz?: number;
	/** Tracking */
	tracking?: string;
	/** CSS custom property for font-family */
	cssVar: string;
	/** Utility class in app.css */
	className: string;
}

export const TYPE_ROLES: Record<TypeRole, TypeRoleSpec> = {
	masthead: {
		face: 'display',
		weight: 600,
		italic: false,
		size: '2.5–3.25rem',
		opsz: 72,
		tracking: '-0.03em',
		cssVar: '--font-display',
		className: 'type-masthead'
	},
	section: {
		face: 'display',
		weight: 600,
		italic: false,
		size: '1.5–1.75rem',
		opsz: 48,
		tracking: '-0.02em',
		cssVar: '--font-display',
		className: 'type-section'
	},
	cardTitle: {
		face: 'display',
		weight: 600,
		italic: false,
		size: '0.95–1.1rem',
		opsz: 36,
		tracking: '-0.02em',
		cssVar: '--font-display',
		className: 'type-card-title'
	},
	/** Magazine lead eyebrows — display italic, light weight */
	eyebrow: {
		face: 'display',
		weight: 400,
		italic: true,
		size: '0.95rem',
		opsz: 18,
		tracking: '0.01em',
		cssVar: '--font-display',
		className: 'type-eyebrow'
	},
	kicker: {
		face: 'ui',
		weight: 500,
		italic: false,
		size: '0.6875rem',
		tracking: '0.12em',
		cssVar: '--font-ui',
		className: 'type-kicker'
	},
	body: {
		face: 'ui',
		weight: 400,
		italic: false,
		size: '0.9375rem',
		cssVar: '--font-ui',
		className: 'type-body'
	},
	meta: {
		face: 'ui',
		weight: 400,
		italic: false,
		size: '0.75–0.8125rem',
		cssVar: '--font-ui',
		className: 'type-meta'
	},
	micro: {
		face: 'ui',
		weight: 500,
		italic: false,
		size: '0.625–0.6875rem',
		tracking: '0.1em',
		cssVar: '--font-ui',
		className: 'type-micro'
	},
	readingBody: {
		face: 'reading',
		weight: 400,
		italic: false,
		size: '1.125rem (pref-driven)',
		opsz: 14,
		cssVar: '--font-reading',
		className: 'type-reading'
	},
	readingHead: {
		face: 'display',
		weight: 600,
		italic: false,
		size: '1.15–1.75em relative',
		opsz: 48,
		tracking: '-0.02em',
		cssVar: '--font-display',
		className: 'type-reading-head'
	},
	nav: {
		face: 'ui',
		weight: 500,
		italic: false,
		size: '13px',
		tracking: '-0.01em',
		cssVar: '--font-ui',
		className: 'type-nav'
	},
	chromeTitle: {
		face: 'display',
		weight: 600,
		italic: false,
		size: '15–16px',
		opsz: 36,
		tracking: '-0.02em',
		cssVar: '--font-display',
		className: 'type-chrome-title'
	}
} as const;

/** CSS variable name for a role’s face */
export function fontVarForRole(role: TypeRole): string {
	return TYPE_ROLES[role].cssVar;
}

/** True when italic is allowed for this role */
export function roleAllowsItalic(role: TypeRole): boolean {
	return TYPE_ROLES[role].italic;
}

/** Map face token → CSS custom property */
export function faceToCssVar(face: FaceToken): string {
	if (face === 'display') return '--font-display';
	if (face === 'ui') return '--font-ui';
	return '--font-reading';
}

/** All utility class names shipped for type roles */
export function typeRoleClassNames(): string[] {
	return Object.values(TYPE_ROLES).map((r) => r.className);
}

export function isEditorialPalette(css: string): boolean {
	const need = [
		EDITORIAL.palette.newsprint,
		EDITORIAL.palette.ink,
		EDITORIAL.palette.crimson,
		'--font-display',
		'--font-ui',
		'--font-reading',
		'Newsreader',
		'Source Sans 3',
		'Literata'
	];
	const lower = css.toLowerCase();
	return need.every((t) => lower.includes(t.toLowerCase()));
}

/** True when atelier-primary branding still dominates the stylesheet */
export function hasAtelierPrimaryIdentity(css: string): boolean {
	const indigoPrimary = /--color-indigo:\s*#1f3a68/i.test(css);
	const sealPrimary = /--color-seal:\s*#e03c2b/i.test(css);
	const hasEditorial = isEditorialPalette(css);
	return (indigoPrimary || sealPrimary) && !hasEditorial;
}
