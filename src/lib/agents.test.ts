import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
	examples,
	guide,
	notDrawn,
	pasteInstruction,
	PLUGIN_DIR,
	pluginFiles,
	REFERENCE_PATH,
	referenceMarkdown,
	SKILL_NAME,
	SKILL_PATH,
	skillDescription,
	skillMarkdown
} from '#lib/agents.ts';
import { notHereYet } from '#lib/search/errors.ts';
import { search } from '#lib/search/search.ts';
import { SITE_URL } from '#lib/site-url.ts';
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

const tick = (text: string) => '`' + text + '`';

// The skill and the plugin are what someone installs, so they keep to the formats that read them.
describe('the skill', () => {
	it('keeps to the Agent Skills rules for its name and description (agentskills.io)', () => {
		expect(SKILL_NAME).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		expect(SKILL_NAME.length).toBeLessThanOrEqual(64);
		expect(skillDescription.length).toBeGreaterThan(0);
		expect(skillDescription.length).toBeLessThanOrEqual(1024);
		expect(skillDescription).not.toMatch(/[<>]/);
		const [, frontmatter] = skillMarkdown().split('---');
		expect(frontmatter).toContain(`name: ${SKILL_NAME}`);
		expect(frontmatter).toContain(`description: ${JSON.stringify(skillDescription)}`);
	});

	it('stays short enough to load whole, and leaves the detail to the reference', () => {
		expect(skillMarkdown().split('\n').length).toBeLessThan(500);
		expect(skillMarkdown()).toContain('(references/reference.md)');
	});

	it('names every flow, and the reference lists every setting, party and step', () => {
		const reference = referenceMarkdown();
		for (const flow of guide) {
			expect(skillMarkdown(), flow.id).toContain(tick(flow.id));
			for (const setting of flow.settings) expect(reference).toContain('`' + setting.param + '=');
			for (const diagram of flow.diagrams) {
				for (const party of diagram.parties) expect(reference).toContain(tick(party.id));
				for (const step of diagram.steps) expect(reference).toContain(tick(step.id));
			}
		}
	});

	it('is committed as the plugin makes it, so that Claude Code installs the current one', () => {
		for (const file of pluginFiles()) {
			const committed = existsSync(file.path) ? readFileSync(file.path, 'utf8') : null;
			expect(committed, `${file.path} is out of date: run pnpm agent-skill`).toBe(file.text);
		}
		const marketplace = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
		expect(marketplace.plugins.map((plugin: { source: string }) => plugin.source)).toEqual([
			`./${PLUGIN_DIR}`
		]);
	});

	it('points at addresses the site has', () => {
		for (const path of [REFERENCE_PATH, SKILL_PATH]) {
			expect(existsSync(`src/routes/${path}/+server.ts`), path).toBe(true);
		}
		expect(pasteInstruction).toContain(`${SITE_URL}/${REFERENCE_PATH}`);
	});
});

describe('what the skill says is not drawn', () => {
	it('is what the search says is not here yet, so that building one fails this', () => {
		for (const item of notDrawn) {
			expect(notHereYet, item.term).toContain(item.term);
			expect(search(item.term).notHereYet, item.term).not.toBeNull();
		}
	});
});

// Read the way a link is read, not the way the guide works it out, so that this checks the guide.
describe('what the guide says a setting needs', () => {
	it('is true of a link: the value alone is turned off, and with what it needs it stays', () => {
		let checked = 0;
		for (const flow of guide) {
			const base = flows[flow.id];
			for (const setting of flow.settings) {
				for (const need of setting.needs) {
					const [, alone, first] = need.match(/^`([^`]+)` needs `([^`]+)`/)!;
					const kept = (query: string) =>
						new URLSearchParams(serializeState(base, parseState(base, 'flow', query)));
					const [param, value] = alone.split('=');
					expect(kept(alone).get(param), `${flow.id} ${alone} alone`).not.toBe(value);
					expect(kept(`${alone}&${first}`).get(param), `${flow.id} ${alone}&${first}`).toBe(value);
					checked++;
				}
			}
		}
		expect(checked).toBeGreaterThan(10);
	});
});
