import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formsOf, pathOf, USED_UP } from '#lib/flow/follow.ts';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import { evaluate, type DiagramId } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings, type Settings } from '#lib/flow/settings.ts';
import {
	parseState,
	serializeState,
	withDiagram,
	withFollow,
	withSetting
} from '#lib/flow/state.ts';
import { artifacts, type ArtifactId } from '#lib/flow/vocabulary.ts';
import { mapNodes, nodeSettings } from '#lib/map/nodes.ts';
import type { Recording } from '#lib/recordings/format.ts';

const diagrams: DiagramId[] = ['flow', 'setup'];
const everything = Object.keys(artifacts) as ArtifactId[];
const path = (artifact: ArtifactId, settings: Partial<Settings> = {}) =>
	pathOf(evaluate(base.diagrams.flow, { ...defaultSettings, ...settings }), artifact);
const recorded = (preset: string) =>
	JSON.parse(
		readFileSync(`static/recordings/authorization-code/${preset}.json`, 'utf8')
	) as Recording;

describe('the path of something', () => {
	it.each(diagrams)('is every step that carries it, in order, in every combination of %s', (id) => {
		for (const settings of allValidSettings()) {
			const view = evaluate(base.diagrams[id], settings);
			const order = view.steps.map((step) => step.id);
			for (const artifact of everything) {
				const stops = pathOf(view, artifact).map(({ step }) => step);
				const forms = formsOf(artifact);
				const carrying = view.steps
					.filter(
						(step) =>
							step.fields.some((field) => field.artifact && forms.includes(field.artifact)) ||
							step.ends.some((ended) => forms.includes(ended)) ||
							step.id === USED_UP[artifact]?.step
					)
					.map((step) => step.id);
				expect(stops).toEqual(carrying);
				const places = stops.map((step) => order.indexOf(step));
				expect(places).toEqual([...places].sort((a, b) => a - b));
			}
		}
	});

	it('says made and checked only of what is really made and checked', () => {
		for (const settings of allValidSettings()) {
			const view = evaluate(base.diagrams.flow, settings);
			for (const artifact of everything) {
				for (const stop of pathOf(view, artifact)) {
					// The app makes it, or someone else does, for a link of their own.
					if (/made here/i.test(stop.says)) {
						expect(['make-verifier', 'attacker-makes-link']).toContain(stop.step);
					}
					if (/checked here/i.test(stop.says)) expect(stop.step).toBe('check-verifier');
				}
			}
		}
	});

	it('follows a code from where it is issued to where it is traded', () => {
		expect(path('code')).toEqual([
			{ step: 'redirect-with-code', says: 'First sent here' },
			{ step: 'callback', says: 'Sent here' },
			{ step: 'token-request', says: 'Sent here' }
		]);
	});

	it('follows the two forms of a verifier together, which is PKCE in one picture', () => {
		const stops = path('verifier', { pkce: true });
		expect(path('challenge', { pkce: true })).toEqual(stops);
		expect(stops).toEqual([
			{ step: 'make-verifier', says: 'Made here' },
			{ step: 'redirect-to-idp', says: 'Code challenge: sent here' },
			{ step: 'authorize', says: 'Code challenge: sent here' },
			{ step: 'token-request', says: 'Code verifier: sent here' },
			{ step: 'check-verifier', says: 'Checked here' }
		]);
	});

	it('has nothing to follow where it is not in the flow', () => {
		expect(path('verifier')).toEqual([]);
	});

	it('ends a session where the flow ends it', () => {
		const stops = path('session', { oidc: true, logout: true });
		expect(stops.at(-1)).toEqual({ step: 'session-ended', says: 'Ends here' });
	});
});

describe('what is used up', () => {
	it.each(['attack-public', 'attack-public-pkce'])(
		'is what a real server refused: %s',
		(preset) => {
			const used = USED_UP.code!;
			const message = recorded(preset).messages.find(({ step }) => step === used.step);
			expect(message?.status).toBe(400);
			expect(message?.body).toMatchObject({ error: 'invalid_grant' });
		}
	);

	it('is only said where that step is there', () => {
		expect(path('code').some(({ says }) => says.startsWith('Refused here'))).toBe(false);
		const stolen = path('code', { attacker: true, clientType: 'public' });
		expect(stolen.at(-1)?.says).toMatch(/^Refused here/);
	});

	it('is always on a step in the flow', () => {
		const ids = base.diagrams.flow.steps.map((step) => step.id);
		for (const used of Object.values(USED_UP)) expect(ids).toContain(used.step);
	});
});

describe('the state', () => {
	const stateWith = (search: string) => parseState(base, 'flow', search);

	it('round-trips through the address', () => {
		const state = stateWith('follow=code&step=callback');
		expect(state.follow).toBe('code');
		expect(parseState(base, 'flow', serializeState(base, state))).toEqual(state);
	});

	it('ignores what does not exist, or is not in this flow', () => {
		expect(stateWith('follow=nothing').follow).toBeNull();
		expect(stateWith('follow=verifier').follow).toBeNull();
		expect(stateWith('pkce=1&follow=verifier').follow).toBe('verifier');
	});

	it('changes nothing about the flow', () => {
		const state = stateWith('oidc=1&step=token-request');
		expect({ ...withFollow(state, 'code'), follow: null }).toEqual(state);
	});

	it('lets go of what a setting takes away', () => {
		const state = stateWith('pkce=1&follow=verifier');
		expect(withSetting(base, state, 'pkce', false).state.follow).toBeNull();
		expect(withSetting(base, state, 'oidc', true).state.follow).toBe('verifier');
	});

	it('lets go of what the other diagram does not have', () => {
		expect(withDiagram(base, stateWith('follow=code'), 'setup').follow).toBeNull();
	});
});

describe('the questions that link to it', () => {
	it('name something that is on the way in their own state', () => {
		const linking = mapNodes.filter((node) => node.follows);
		expect(linking.map((node) => node.id)).toEqual(expect.arrayContaining(['why-a-code', 'pkce']));
		for (const node of linking) {
			const view = evaluate(base.diagrams[node.diagram], nodeSettings(node));
			expect(pathOf(view, node.follows!).length).toBeGreaterThan(1);
		}
	});
});
