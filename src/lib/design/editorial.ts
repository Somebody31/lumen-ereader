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
		inkSoft: '#B8B7B0',
		inkMute: '#7A7A74',
		rule: '#2A2A28',
		ruleStrong: '#E8E7E1',
		/** Lifted crimson for dark grounds */
		crimson: '#C44A42',
		crimsonSoft: '#D45A52',
		danger: '#E06058'
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
	// Atelier residue is only a problem when it is still the identity and editorial is missing
	return (indigoPrimary || sealPrimary) && !hasEditorial;
}
