import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { breakages } from './breakages.mjs';

// The breakages themselves only run weekly, so a list gone stale would otherwise wait a week to be
// found. break-on-purpose.mjs leaves this file out, or every breakage would look noticed.
describe('the list of breakages', () => {
	it('names each one once', () => {
		const names = breakages.map((breakage) => breakage.name);
		expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
	});

	it.each(breakages.map((breakage) => [breakage.name, breakage] as const))(
		'can still make: %s',
		(_, { file, from, to }) => {
			expect(readFileSync(file, 'utf8').split(from).length).toBe(2);
			expect(to).not.toBe(from);
		}
	);
});
