import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { artifacts } from '#lib/flow/vocabulary.ts';

const css = readFileSync('src/app.css', 'utf8');

function tokens(): Record<string, [string, string]> {
	const found = [...css.matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/g)];
	return Object.fromEntries(found.map((m) => [m[1], [m[2], m[3]] as [string, string]]));
}

function luminance(hex: string): number {
	const channel = (at: number) => {
		const value = parseInt(hex.slice(at, at + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

const TEXT = 4.5;
const SHAPE = 3;

// Every pair of text and what it sits on, and every shape that has to be told from its background.
const pairs: readonly (readonly [string, string, number])[] = [
	['fg', 'bg', TEXT],
	['fg', 'panel', TEXT],
	['fg', 'raised', TEXT],
	['fg', 'here-soft', TEXT],
	['muted', 'bg', TEXT],
	['muted', 'panel', TEXT],
	['muted', 'raised', TEXT],
	['here', 'bg', TEXT],
	['here', 'panel', TEXT],
	['here', 'here-soft', TEXT],
	['on-tone', 'here', TEXT],
	['fresh', 'bg', TEXT],
	['fresh', 'fresh-soft', TEXT],
	['on-tone', 'fresh', TEXT],
	['front', 'bg', TEXT],
	['front', 'here-soft', SHAPE],
	['on-tone', 'front', TEXT],
	['back', 'bg', TEXT],
	['back', 'here-soft', SHAPE],
	['on-tone', 'back', TEXT],
	['people', 'bg', TEXT],
	['people', 'here-soft', SHAPE],
	['on-tone', 'people', TEXT],
	['on-tone', 'muted', TEXT],
	['attacker', 'bg', TEXT],
	['attacker', 'raised', TEXT],
	['proves', 'proves-soft', TEXT],
	['grants', 'grants-soft', TEXT],
	['remembers', 'remembers-soft', TEXT]
];

describe('colours (ADR-014)', () => {
	const all = tokens();

	it('are found, or these tests prove nothing', () => {
		expect(Object.keys(all).length).toBeGreaterThan(20);
	});

	describe.each([
		['light', 0],
		['dark', 1]
	] as const)('in the %s theme', (_, theme) => {
		it.each(pairs)('%s on %s is readable', (front, back, needed) => {
			const ratio = contrast(all[front][theme], all[back][theme]);
			expect(ratio, `${all[front][theme]} on ${all[back][theme]}`).toBeGreaterThanOrEqual(needed);
		});
	});

	it('stay within a budget, because one thing should stand out at a time (#63)', () => {
		const neutral = new Set([
			'bg',
			'panel',
			'raised',
			'fg',
			'muted',
			'line',
			'strong-line',
			'on-tone',
			'here'
		]);
		const hues = Object.keys(all).filter((name) => !name.endsWith('-soft') && !neutral.has(name));
		expect(hues.sort()).toEqual(
			['front', 'back', 'people', 'attacker', 'fresh', 'proves', 'grants', 'remembers'].sort()
		);
	});

	// Every colour on screen is about the protocol, and none is a framework's (#231).
	it('say where you are without a hue of its own', () => {
		expect(all.here).toEqual(all.fg);
	});

	it('say what just changed without a hue of its own', () => {
		expect(all.fresh).toEqual(all.fg);
	});

	it('exist for every thing that gets passed around', () => {
		for (const id of Object.keys(artifacts)) expect(css, id).toContain(`[data-artifact='${id}']`);
	});

	it('have no text hidden behind transparency in the diagram', () => {
		const diagram = readFileSync('src/lib/components/Diagram.svelte', 'utf8');
		expect(diagram).not.toMatch(/fill-opacity/);
	});

	// A numbered line with nothing on it made people wonder what was coming (the maintainer, 2026-11-03).
	it('leave what is ahead its words', () => {
		const diagram = readFileSync('src/lib/components/Diagram.svelte', 'utf8');
		expect(diagram).not.toMatch(/\.row\.future[^{]*\.label\s*\{[^}]*opacity:\s*0\b/);
	});
});
