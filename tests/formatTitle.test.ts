import { describe, expect, test } from 'bun:test';
import { formatDisplayTitle } from '../src/lib/client/formatTitle';

describe('formatDisplayTitle', () => {
	test('title-cases ALL CAPS metadata', () => {
		expect(formatDisplayTitle('COMPUTER NETWORKS')).toBe('Computer Networks');
	});

	test('leaves mixed case alone', () => {
		expect(formatDisplayTitle('The Star Room')).toBe('The Star Room');
	});

	test('handles empty', () => {
		expect(formatDisplayTitle('')).toBe('Untitled');
	});
});
