import { describe, expect, it } from 'vitest';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import { evaluate, holdingsAt } from '#lib/flow/model.ts';
import { defaultSettings } from '#lib/flow/settings.ts';
import { artifacts } from '#lib/flow/vocabulary.ts';

const oldWay = { ...defaultSettings, oldWay: true };
const flow = evaluate(base.diagrams.flow, oldWay);
const setup = evaluate(base.diagrams.setup, oldWay);

// A real audit found the app's and the password's own explanations denying what was on the diagram.
describe('the old way', () => {
	it('has nobody saying the app never sees the password', () => {
		const said = [...flow.lifelines, ...setup.lifelines].map(({ concept }) => concept);
		expect(said.filter((text) => /never sees|from the token|learn about/.test(text))).toEqual([]);
		expect(artifacts.password.explains).not.toMatch(/never/);
	});

	it('goes back to what they are otherwise, when it is off', () => {
		const plainly = evaluate(base.diagrams.flow, defaultSettings);
		const app = plainly.lifelines.find(({ id }) => id === 'app');
		expect(app?.concept).toMatch(/never sees/);
	});

	it('is a handful of messages, with no identity provider', () => {
		expect(flow.steps.map(({ id }) => id)).toEqual([
			'old-way-form',
			'old-way-keep',
			'old-way-call',
			'old-way-answer'
		]);
		expect(flow.lifelines.map(({ id }) => id)).not.toContain('idp');
	});

	it('leaves the password with the app and the API, and nobody has anything else', () => {
		const held = holdingsAt(flow, 'old-way-answer');
		expect(held.app).toEqual(['password']);
		expect(held.api).toEqual(['password']);
	});
});
