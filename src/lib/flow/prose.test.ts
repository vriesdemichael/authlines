import { describe, expect, it } from 'vitest';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import { evaluate, type DiagramView } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	settingDefs,
	type Settings
} from '#lib/flow/settings.ts';
import { artifacts, channels } from '#lib/flow/vocabulary.ts';
import { notesFor } from '#lib/keycloak/notes.ts';

const diagrams = [base.diagrams.flow, base.diagrams.setup];
const inEachState = (visit: (view: DiagramView, settings: Settings) => void) => {
	for (const settings of allValidSettings()) {
		for (const diagram of diagrams) visit(evaluate(diagram, settings), settings);
	}
};

describe('the words on screen', () => {
	// Edit scripts have left "error.The" and "again:after" on screen, and nothing else would notice.
	const noSpace = /[a-z][.,:;!?][A-Za-z]/;
	const expectSpaced = (text: string | undefined, where: string) =>
		expect(text ?? '', where).not.toMatch(noSpace);

	it('have a space after each sentence, in the flow, in every combination', () => {
		inEachState((view) => {
			for (const step of view.steps) {
				expectSpaced(step.plain, step.id);
				expectSpaced(step.concept, step.id);
				expectSpaced(step.inPractice, step.id);
				expectSpaced(step.pitfall?.title, step.id);
				expectSpaced(step.pitfall?.text, step.id);
			}
		});
	});

	it('have a space after each sentence, in the notes, in every combination', () => {
		const stepIds = diagrams.flatMap((diagram) => diagram.steps.map((step) => step.id));
		for (const settings of allValidSettings()) {
			for (const id of stepIds) {
				for (const note of notesFor(base.id, id, settings)) expectSpaced(note.text, note.id);
			}
		}
	});

	it('have a space after each sentence, in settings and explanations', () => {
		for (const [id, def] of Object.entries(settingDefs)) {
			expectSpaced(def.why, id);
			expectSpaced(def.summary, id);
		}
		for (const [id, thing] of [...Object.entries(artifacts), ...Object.entries(channels)]) {
			expectSpaced(thing.explains, id);
		}
	});
});

describe('a line about what libraries do', () => {
	const aboutLibraries = /\b(librar|framework|gateway)/i;
	const saysTheyDiffer = /\b(usually|often|many|others|not all|if it supports|low-level)\b/i;

	it('names one someone can go and look at, in every combination', () => {
		inEachState((view) => {
			for (const step of view.steps) {
				if (!aboutLibraries.test(step.inPractice ?? '')) continue;
				expect(step.practice.length, `${step.id}: ${step.inPractice}`).toBeGreaterThan(0);
			}
		});
	});

	it('names one each way when it says they differ', () => {
		inEachState((view) => {
			for (const step of view.steps) {
				const line = step.inPractice ?? '';
				if (!aboutLibraries.test(line) || !saysTheyDiffer.test(line)) continue;
				const ways = new Set(step.practice.map((example) => example.does));
				expect(ways.size, `${step.id}: ${step.inPractice}`).toBe(2);
			}
		});
	});

	it('links to where it can be read', () => {
		inEachState((view) => {
			for (const step of view.steps) {
				for (const example of step.practice) {
					expect(example.url, example.name).toMatch(/^https:\/\//);
					expect(example.text.length, example.name).toBeGreaterThan(4);
				}
			}
		});
	});

	it('says what state is on a logout, where it has nothing to do with a login', () => {
		const settings = { ...defaultSettings, oidc: true, logout: true };
		const steps = evaluate(base.diagrams.flow, settings).steps;
		for (const id of ['logout-redirect', 'end-session', 'logout-redirect-back', 'logged-out']) {
			const state = steps
				.find((step) => step.id === id)
				?.fields.find(({ name }) => name === 'state');
			expect(state?.note, id).toContain('comes back with the user');
		}
	});

	it('does not say Auth.js checks a nonce, which it only does once someone adds it', () => {
		const check = evaluate(base.diagrams.flow, { ...defaultSettings, oidc: true }).steps.find(
			(step) => step.id === 'validate-id-token'
		);
		const authjs = check?.practice.find((example) => example.name === 'Auth.js');
		expect(authjs?.does).toBe(false);
		expect(authjs?.text).toContain('once you add it');
	});

	it('does not say what a DPoP-unaware one does not do', () => {
		const dpop = { ...defaultSettings, binding: 'dpop' as const };
		const check = evaluate(base.diagrams.flow, dpop).steps.find(
			(step) => step.id === 'api-check-token'
		);
		expect(check?.inPractice).toContain('ignores the proof');
		expect(check?.inPractice).not.toContain('A library or a gateway does this');
		expect(check?.practice.map((example) => example.does)).toEqual([true, false]);
	});
});
