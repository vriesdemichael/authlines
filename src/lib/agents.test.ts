import { describe, expect, it } from 'vitest';
import { examples, guide } from '#lib/agents.ts';
import { flows } from '#lib/flow/index.ts';
import { evaluate, type DiagramId } from '#lib/flow/model.ts';
import { parseNames, partiesOf } from '#lib/flow/names.ts';
import { parseState, serializeState } from '#lib/flow/state.ts';

/** An example's address, read the way the site reads it. */
function opened(path: string) {
	const [beforeHash, hash = ''] = path.split('#');
	const [where, query = ''] = beforeHash.split('?');
	const [flowId, view] = where.split('/');
	const base = flows[flowId];
	const diagram: DiagramId = view === 'setup' ? 'setup' : 'flow';
	return { base, diagram, query, hash, state: base && parseState(base, diagram, query) };
}

// #168: an agent given only this page should write a link that opens what it meant.
describe('the page for agents', () => {
	it('has examples that open what they say', () => {
		for (const example of examples.filter((candidate) => !candidate.broken)) {
			const { base, diagram, query, hash, state } = opened(example.path);
			expect(base, example.path).toBeDefined();
			// Every setting and switch in it is taken as written, and none is dropped as invalid.
			const kept = new URLSearchParams(serializeState(base, state));
			for (const [param, value] of new URLSearchParams(query)) {
				expect(kept.get(param), `${example.path} ${param}`).toBe(value);
			}
			const { names, problems } = parseNames(`#${hash}`, base);
			expect(problems, example.path).toEqual([]);
			const drawn = evaluate(base.diagrams[diagram], state.settings).lifelines.map((l) => l.id);
			for (const party of Object.keys(names)) expect(drawn, example.path).toContain(party);
		}
	});

	it('has a broken example, which says what is wrong', () => {
		const broken = examples.filter((example) => example.broken);
		expect(broken.length).toBeGreaterThan(0);
		for (const example of broken) {
			const { base, hash } = opened(example.path);
			const { names, problems } = parseNames(`#${hash}`, base);
			expect(names).toEqual({});
			expect(problems.length).toBeGreaterThan(0);
		}
	});

	it('lists every flow, with every party a link can name', () => {
		expect(guide.map((flow) => flow.id)).toEqual(Object.keys(flows));
		for (const flow of guide) {
			const listed = new Set(flow.diagrams.flatMap((d) => d.parties.map((p) => p.id)));
			expect([...listed].sort()).toEqual(partiesOf(flows[flow.id]).sort());
			for (const diagram of flow.diagrams) expect(diagram.steps.length).toBeGreaterThan(0);
		}
	});
});
