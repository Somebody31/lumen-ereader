/**
 * Normalize storage titles for UI: ALL CAPS metadata → Title Case.
 * Leaves mixed-case and short strings alone.
 */
export function formatDisplayTitle(raw: string): string {
	const s = (raw || '').trim();
	if (!s) return 'Untitled';
	const letters = s.replace(/[^a-zA-Z]/g, '');
	if (letters.length < 4) return s;
	const upper = letters.replace(/[^A-Z]/g, '').length;
	const ratio = upper / letters.length;
	// Only rewrite when overwhelmingly uppercase
	if (ratio < 0.85) return s;
	return s
		.toLowerCase()
		.split(/(\s+|[-–—:/|]+)/)
		.map((part) => {
			if (/^\s+$/.test(part) || /^[-–—:/|]+$/.test(part)) return part;
			if (!part) return part;
			// Small words stay lower unless first token handled by caller context
			const small = /^(a|an|and|as|at|but|by|for|in|nor|of|on|or|the|to|vs\.?|via)$/i;
			if (small.test(part)) return part.toLowerCase();
			return part.charAt(0).toUpperCase() + part.slice(1);
		})
		.join('')
		.replace(/^\w/, (c) => c.toUpperCase());
}
