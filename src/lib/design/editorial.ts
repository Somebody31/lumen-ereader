/**
 * Editorial (broadsheet) design tokens — single source for identity checks.
 * CSS mirrors these values in `src/app.css` `@theme`.
 */
export const EDITORIAL = {
	world: 'broadsheet',
	palette: {
		newsprint: '#F0EFE9',
		paper: '#FAF9F6',
		surface: '#E5E4DE',
		ink: '#0B0B0B',
		inkSoft: '#3A3A38',
		inkMute: '#6A6A66',
		rule: '#C4C3BC',
		ruleStrong: '#0B0B0B',
		/** Deep news crimson — rare emphasis, not SaaS accent scatter */
		crimson: '#7A1C1C',
		crimsonSoft: '#922424',
		danger: '#9B2C2C'
	},
	typography: {
		/** Mastheads & titles — Google News editorial face with opsz */
		display: 'Newsreader Variable',
		/** UI chrome — classic newsroom sans */
		ui: 'Source Sans 3 Variable',
		/** Long-form body — digital reading face with opsz */
		reading: 'Literata Variable'
	},
	/** Rejected dominant identities */
	not: ['atelier', 'planetarium', 'indigo-primary', 'vermillion-seal']
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
