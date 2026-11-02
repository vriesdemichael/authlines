import { describe, expect, it } from 'vitest';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { defaultSettings } from '#lib/flow/settings.ts';
import { pack, render, ticksIn, type Section } from './review-pack.ts';

const flow = base.diagrams.flow;
const body = render(pack());

describe('the review pack', () => {
	it('leaves out no step of the default flow, or of the switch', () => {
		for (const settings of [defaultSettings, { ...defaultSettings, oidc: true }]) {
			for (const step of evaluate(flow, settings).steps) {
				expect(body, step.id).toContain(step.concept);
			}
		}
	});

	it('fits in one GitHub issue', () => {
		expect(body.length).toBeLessThan(65_536);
	});

	it('has each item once', () => {
		const ids = pack().flatMap(({ items }) => items.map(({ id }) => id));
		expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
	});

	it('finds claims people should look at', () => {
		const claims = pack().find(({ title }) => title.startsWith('Every absolute'))!;
		expect(claims.items.length).toBeGreaterThan(20);
		for (const { text } of claims.items) {
			expect(text).toMatch(/\b(only|never|always|nowhere|nobody|no one|the one place)\b/i);
		}
	});
});

describe('running it again', () => {
	const sections = (text: string): Section[] => [
		{ title: 'A part', intro: 'Words.', items: [{ id: 'one', text }] }
	];
	const tick = (markdown: string) => markdown.replace('- [ ]', '- [x]');

	it('keeps a tick on what has not changed', () => {
		const first = tick(render(sections('The same.')));
		expect(ticksIn(first).has('one')).toBe(true);
		expect(render(sections('The same.'), first)).toContain('- [x] The same.');
	});

	it('asks again about what changed', () => {
		const first = tick(render(sections('Before.')));
		const again = render(sections('After.'), first);
		expect(again).toContain('- [ ] **Changed since you ticked it.** After.');
	});

	it('says what is new', () => {
		const first = render(sections('Before.'));
		const more = [
			...sections('Before.'),
			{ title: 'B part', intro: 'Words.', items: [{ id: 'two', text: 'Another.' }] }
		];
		expect(render(more, first)).toContain('- [ ] **New.** Another.');
	});

	it('does not call everything new the first time', () => {
		expect(body).not.toContain('**New.**');
		expect(render(pack(), 'Being generated.')).not.toContain('**New.**');
	});
});
