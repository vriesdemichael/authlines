import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUT } from '#lib/diagram/shape.ts';

// What makes the site look chosen and not generated, held where a test can hold it (#231).
const css = readFileSync('src/app.css', 'utf8');

function filesIn(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const path = join(folder, entry.name);
		if (entry.isDirectory()) return filesIn(path);
		return entry.name.endsWith('.svelte') ? [path] : [];
	});
}

const components = filesIn('src').map((path) => [path, readFileSync(path, 'utf8')] as const);

const sizes = Object.fromEntries(
	[...css.matchAll(/--size-([\w-]+):\s*([\d.]+)px/g)].map((m) => [m[1], Number(m[2])])
);
const token = (name: string) => Number(css.match(new RegExp(`--${name}:\\s*([\\d.]+)px`))?.[1]);

describe('the look (#231)', () => {
	it('has a few sizes, each with a job', () => {
		expect(Object.keys(sizes)).toEqual(['mark', 'small', 'ui', 'body', 'title', 'headline']);
		const ordered = Object.values(sizes);
		expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
	});

	it('leads the home screen with a headline clearly larger than anything else', () => {
		expect(sizes.headline).toBeGreaterThanOrEqual(sizes.title * 1.5);
		const home = readFileSync('src/routes/+page.svelte', 'utf8');
		expect(home).toMatch(/\.headline \{[^}]*font-size: var\(--size-headline\)/);
	});

	it.each(components)('takes every size in %s from the scale', (_, source) => {
		const sized = [...source.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
		const own = sized.filter(
			(value) => !/^var\(--(size-[\w-]+|raw-size, var\(--size-[\w-]+\))\)$/.test(value)
		);
		// Code in the middle of a sentence is as large as the sentence it is in.
		expect(own.filter((value) => !/^0\.9\d?em$/.test(value))).toEqual([]);
	});

	it.each(components)('takes every radius in %s from the one token', (_, source) => {
		const rounded = [...source.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
		expect(rounded.filter((value) => value !== 'var(--radius)' && value !== '0')).toEqual([]);
		const drawn = [...source.matchAll(/\brx="([\d.]+)"/g)].map((m) => Number(m[1]));
		expect(drawn.filter((value) => value !== token('radius'))).toEqual([]);
	});

	it.each(components)('draws no coloured stripe down one edge in %s', (_, source) => {
		expect(source).not.toMatch(/border-(left|right):\s*[2-9]px/);
	});

	it('cuts the corners of what is passed around as deep as the stylesheet says', () => {
		expect(token('cut')).toBe(CUT);
	});
});
