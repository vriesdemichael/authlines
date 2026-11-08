import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authorizationCodeBase as base, flows } from '#lib/flow/index.ts';
import { allValidSettings, defaultSettings } from '#lib/flow/settings.ts';
import { parseState, serializeOnNode } from '#lib/flow/state.ts';
import { socialKey } from '#lib/map/social.ts';
import social from '#lib/map/social.json';
import { recordingFor } from '#lib/recordings/known.ts';
import {
	allNodes,
	mapNodes,
	mapTracks,
	nextQuestion,
	nodeMatching,
	stillAnswers,
	nodeSearch,
	nodeSettings,
	nodeState,
	nodeView
} from '#lib/map/nodes.ts';

const asCases = mapNodes.map((node) => [node.id, node] as const);
const wrong = mapTracks.find((track) => track.id === 'when-it-goes-wrong')!;

describe('the map', () => {
	it('has unique IDs, which cannot be taken for a diagram', () => {
		const ids = mapNodes.map((node) => node.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).not.toContain('setup');
		for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
	});

	it('has somewhere to start, in simple mode, at the very beginning', () => {
		const first = mapTracks[0].chains[0][0];
		expect(first.mode).toBe('simple');
		expect(first.step).toBeUndefined();
		// What came before, which the plain flow right after it is the answer to.
		expect(nodeSettings(first)).toEqual({ ...defaultSettings, oldWay: true });
		const second = mapTracks[0].chains[0][1];
		expect(second.step).toBeUndefined();
		expect(nodeSettings(second)).toEqual(defaultSettings);
	});

	// "Very busy and cluttered", the maintainer said on 2026-11-02. A new question takes one off, or
	// says why not (#142). 54 since 2026-11-08, when the maintainer put the implicit flow on: "a good one
	// because the name is vague".
	it('stays short enough to look through', () => {
		expect(mapNodes.length).toBeLessThanOrEqual(54);
	});

	it('offers everything that was recorded', () => {
		const used = new Set(allNodes.map((node) => node.preset));
		expect(base.presets.filter((preset) => !used.has(preset.id)).map((p) => p.id)).toEqual([]);
	});

	it('has a title and a summary for each, and no two alike', () => {
		const titles = mapNodes.map((node) => node.title);
		expect(new Set(titles).size).toBe(titles.length);
		for (const node of mapNodes) {
			expect(node.title.length, node.id).toBeGreaterThan(10);
			expect(node.summary.length, node.id).toBeGreaterThan(10);
		}
	});

	it('says each answer straight away, in a sentence or two', () => {
		for (const node of mapNodes) {
			expect(node.answer.length, node.id).toBeGreaterThan(30);
			expect(node.answer.length, node.id).toBeLessThan(260);
			expect(node.answer, node.id).not.toMatch(/[a-z][.,:;!?][A-Za-z]/);
			expect(node.answer, node.id).not.toBe(node.summary);
		}
	});

	it('opens each question where its answer can be seen, or says why not', () => {
		const left = mapNodes.filter((node) => !node.step && !node.startsAtTheBeginning);
		expect(left.map((node) => node.id)).toEqual([]);
		const both = mapNodes.filter((node) => node.step && node.startsAtTheBeginning);
		expect(both.map((node) => node.id)).toEqual([]);
	});

	it('opens these two on the step that shows what was asked', () => {
		const stepOf = (id: string) => nodeState(mapNodes.find((node) => node.id === id)!).step;
		expect(stepOf('who-logged-in')).toBe('token-response');
		expect(stepOf('another-provider')).toBe('redirect-to-upstream');
	});

	it('does not answer with what only one server calls things, on a plain question', () => {
		const simple = mapNodes.filter((node) => node.mode === 'simple');
		for (const node of simple) expect(node.answer, node.id).not.toMatch(/keycloak/i);
	});

	it('speaks plainly where it is meant for someone new', () => {
		const wire = /\b(GET|POST|302|client_id|redirect_uri|scope|nonce|IdP)\b/;
		const simple = mapNodes.filter((node) => node.mode === 'simple');
		// An error is said as it is on someone's screen, because that is how they recognise it.
		const errors = new Set(wrong.chains.flat());
		const jargon = simple.filter((node) => !errors.has(node) && wire.test(node.title));
		expect(jargon.map((node) => node.id)).toEqual([]);
	});

	it('draws the most common error where it happens, and nothing after it', () => {
		const node = mapNodes.find(({ id }) => id === 'redirect-uri-error')!;
		const steps = nodeView(node).steps.map(({ id }) => id);
		expect(steps.at(-1)).toBe('address-refused');
		expect(steps).not.toContain('login-page');
	});

	it('has what someone runs into early where they would look, for someone new', () => {
		const questions = wrong.chains.flat();
		expect(questions.map((node) => node.id)).toEqual(
			expect.arrayContaining(['redirect-uri-error', 'why-401', '401-or-403'])
		);
		for (const node of questions) expect(node.mode, node.id).toBe('simple');
		const hood = mapTracks.find((track) => track.id === 'under-the-hood')!;
		for (const node of hood.chains.flat()) expect(node.title, node.id).not.toMatch(/why do i get/i);
	});
});

describe.each(asCases)('the node %s', (_, node) => {
	it('is a state the application can be in', () => {
		expect(allValidSettings(flows[node.flow].settings)).toContainEqual(nodeSettings(node));
		const steps = nodeView(node).steps.map((step) => step.id);
		if (node.step) expect(steps).toContain(node.step);
	});

	it('survives its own address', () => {
		const parsed = parseState(flows[node.flow], node.diagram, nodeSearch(node));
		expect(parsed).toEqual(nodeState(node));
	});

	it('has a recording to show when it opens in advanced mode', () => {
		expect(recordingFor(flows[node.flow], nodeSettings(node))?.id).toBe(node.preset);
	});

	it('has an image for a shared link, which says what the node says', () => {
		const keys: Record<string, string> = social;
		expect(keys[node.id], 'run pnpm social').toBe(socialKey(node));
		const bytes = statSync(`static/social/${node.id}.png`);
		expect(bytes.size).toBeLessThan(120 * 1024);
	});

	it('is what the application says it is at', () => {
		expect(nodeMatching(nodeState(node))?.id).toBe(node.id);
	});
});

describe('where someone is', () => {
	const start = mapNodes.find((node) => node.id === 'how-access-works')!;

	it('is still a node while stepping through it', () => {
		const stepped = { ...nodeState(start), step: 'token-request' };
		expect(nodeMatching(stepped)?.preset).toBe(start.preset);
	});

	it('is the one with the same step, when more than one has these settings', () => {
		const error = mapNodes.find((node) => node.id === 'redirect-uri-error')!;
		expect(nodeMatching(nodeState(error))?.id).toBe('redirect-uri-error');
	});

	it('is the one in this mode, when the step does not settle it', () => {
		const state = { ...nodeState(start), mode: 'advanced' as const, step: 'callback' };
		expect(nodeMatching(state)?.mode).toBe('advanced');
	});

	it('is only a question in the mode someone is in', () => {
		const wire = mapNodes.find((node) => node.id === 'on-the-wire')!;
		const state = { ...nodeState(wire), mode: 'simple' as const };
		expect(nodeMatching(state)?.mode).toBe('simple');
		const advancedOnly = mapNodes.find((node) => node.id === 'calling-the-other-provider')!;
		expect(nodeMatching({ ...nodeState(advancedOnly), mode: 'simple' })).toBeNull();
	});

	it('is no node at all for a state that has none', () => {
		const state = {
			...nodeState(start),
			settings: { ...defaultSettings, oidc: true, binding: 'dpop' as const }
		};
		expect(nodeMatching(state)).toBeNull();
	});

	it('takes what a query adds on top of the node', () => {
		const search = nodeSearch(start, 'step=callback');
		expect(new URLSearchParams(search).get('step')).toBe('callback');
	});
});

describe('going on from a question', () => {
	const node = (id: string) => mapNodes.find((candidate) => candidate.id === id)!;

	it('goes to the next one the map lays out', () => {
		expect(nextQuestion(node('how-access-works'))?.id).toBe('why-a-code');
		expect(nextQuestion(node('why-a-code'))?.id).toBe('the-implicit-flow');
		expect(nextQuestion(node('the-implicit-flow'))?.id).toBe('what-the-browser-sees');
		expect(nextQuestion(mapNodes.at(-1)!)).toBeNull();
	});
});

describe('whether what is on screen still answers a question', () => {
	const question = mapNodes.find((candidate) => candidate.id === 'stolen-code')!;

	it('holds wherever someone has stepped to', () => {
		expect(stillAnswers(question, { ...nodeState(question), step: 'open-app' })).toBe(true);
	});

	it('stops when the settings change', () => {
		const state = nodeState(question);
		expect(stillAnswers(question, { ...state, settings: { ...state.settings, pkce: true } })).toBe(
			false
		);
	});

	it('stops on the other diagram', () => {
		expect(stillAnswers(question, { ...nodeState(question), diagram: 'setup' })).toBe(false);
	});
});

// The maintainer, 2026-11-06: on a question that opens with an explanation, Close seemed to do
// nothing, because the question's own address opened it again.
describe('a question that opens with something explained', () => {
	const explaining = allNodes.filter((node) => node.explains);

	it('stays closed once it is closed, on its own address', () => {
		expect(explaining.length).toBeGreaterThan(0);
		for (const node of explaining) {
			const flow = flows[node.flow];
			const closed = { ...nodeState(node), explained: null };
			const address = nodeSearch(node, serializeOnNode(flow, closed, true));
			expect(parseState(flow, node.diagram, address).explained, node.id).toBeNull();
			const open = nodeSearch(node, serializeOnNode(flow, nodeState(node), true));
			expect(parseState(flow, node.diagram, open).explained, node.id).toEqual(node.explains);
		}
	});
});
