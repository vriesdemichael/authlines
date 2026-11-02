import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { diagramParts, isExplained, markTerms, terms, type Term } from '#lib/flow/glossary.ts';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	normalize,
	settingDefs,
	simpleSettingIds,
	type Settings
} from '#lib/flow/settings.ts';
import { mapNodes } from '#lib/map/nodes.ts';

const diagrams = [base.diagrams.flow, base.diagrams.setup];

/** Everything simple mode can put on screen, in words, for someone new. */
function simpleModeText(): string[] {
	const said = new Set<string>();
	for (const settings of allValidSettings()) {
		for (const diagram of diagrams) {
			const view = evaluate(diagram, settings);
			for (const line of view.lifelines) {
				said.add(line.plainName);
				said.add(line.plainRole);
				said.add(line.concept);
			}
			for (const step of view.steps) {
				said.add(step.plain);
				said.add(step.concept);
				if (step.inPractice) said.add(step.inPractice);
				if (step.pitfall) said.add(step.pitfall.text);
			}
		}
	}
	for (const diagram of diagrams) said.add(diagram.intro);
	for (const id of simpleSettingIds) {
		said.add(settingDefs[id].simple?.label ?? '');
		said.add(settingDefs[id].simple?.summary ?? '');
		said.add(settingDefs[id].why);
	}
	for (const node of mapNodes.filter((candidate) => candidate.mode === 'simple')) {
		said.add(node.title);
		said.add(node.summary);
		said.add(node.answer);
	}
	return [...said];
}

// Words that need explaining. A new one goes here and gets an entry, or the test below says so.
const WATCH =
	/\b(library|libraries|redirect|redirects|scope|scopes|issuer|HTTP|HTTPS|Keycloak|OpenID Connect|signature|signed|bearer|framework|gateway|endpoint|session|fingerprint|public client|OAuth|front channel|back channel|state|audience|nonce|token|tokens|PKCE|DPoP|consent|client|discovery)\b/g;
const ACRONYM = /\b[A-Z]{2,}\b/g;
const SNAKE = /\b[a-z]+_[a-z_]+\b/g;
// Plain to anyone, or part of a word that has an entry.
const FINE = new Set(['ID', 'URL', 'RFC', 'WWW', 'TV']);

describe('words in simple mode', () => {
	const text = simpleModeText();

	it.each([
		['words that need explaining', WATCH],
		['acronyms', ACRONYM],
		['names from the wire', SNAKE]
	] as const)('have an explanation: %s', (_, pattern) => {
		const unexplained = new Set(
			text.flatMap((line) =>
				[...line.matchAll(pattern)]
					.map((match) => match[0])
					.filter((word) => !FINE.has(word) && !isExplained(word))
			)
		);
		expect([...unexplained]).toEqual([]);
	});

	it('have one entry each', () => {
		const source = readFileSync('src/lib/flow/glossary.ts', 'utf8');
		const ids = [...source.matchAll(/^\s+id: '([^']+)',$/gm)].map(([, id]) => id);
		expect(ids.length).toBeGreaterThan(10);
		expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
	});

	it('include those people arrive with', () => {
		for (const word of ['SSO', 'single sign-on', 'JWT', 'refresh token', 'consent', 'realm']) {
			expect(isExplained(word), word).toBe(true);
		}
	});
});

describe('marking terms', () => {
	it('finds the longest, so an access token is not just a token', () => {
		const [segments] = markTerms(['The access token goes to the API.']);
		expect(segments.filter((s) => s.term).map((s) => s.term?.id)).toEqual(['access-token', 'api']);
	});

	it('keeps every word, in order', () => {
		const text = 'The identity provider checks the redirect URI, and sends the code.';
		const [segments] = markTerms([text]);
		expect(segments.map((segment) => segment.text).join('')).toBe(text);
	});

	it('marks only the first use across what it is given', () => {
		const [one, two] = markTerms(['A token, and a token.', 'And another token.']);
		expect(one.filter((s) => s.term)).toHaveLength(1);
		expect(two.filter((s) => s.term)).toHaveLength(0);
	});

	it('does not take your code for the code', () => {
		const [segments] = markTerms(['This part is your code.']);
		expect(segments.filter((s) => s.term)).toHaveLength(0);
	});

	it('matches a sentence start, and leaves other words alone', () => {
		expect(markTerms(['The code arrives.'])[0][0].term?.id).toBe('code');
		expect(markTerms(['Stated clearly, a client-side thing.'])[0].filter((s) => s.term)).toEqual(
			[]
		);
	});

	it('only takes an acronym in its own case', () => {
		expect(markTerms(['the api of it'])[0].filter((s) => s.term)).toEqual([]);
	});

	it('leaves out what is about one server when its notes are off', () => {
		const [segments] = markTerms(['On Keycloak this is a realm.'], { serverNamed: false });
		expect(segments.filter((s) => s.term)).toEqual([]);
	});
});

describe('every entry', () => {
	const all = Object.values(terms);

	it('says something', () => {
		for (const term of all) {
			if (term.artifact || term.setting) continue;
			expect(term.explains.length, term.id).toBeGreaterThan(15);
			expect(term.explains, term.id).not.toMatch(/[a-z][.,:;!?][A-Za-z]/);
		}
	});

	const inPlace = (term: Term) => {
		const place = term.at;
		if (!place) return true;
		const settings: Settings = normalize({ ...defaultSettings, ...place.settings }).settings;
		const view = evaluate(base.diagrams[place.diagram], settings);
		return (
			(!place.step || view.steps.some((step) => step.id === place.step)) &&
			(!place.lifeline || view.lifelines.some((line) => line.id === place.lifeline))
		);
	};

	it.each(all.filter((term) => term.at).map((term) => [term.id, term] as const))(
		'%s points at something that is there, with the settings it names',
		(_, term) => {
			expect(inPlace(term)).toBe(true);
		}
	);

	it('has no two with the same word', () => {
		const words = all.flatMap((term) => term.words.map((word) => word.toLowerCase()));
		expect(new Set(words).size).toBe(words.length);
	});

	it('includes the parts of the diagram, which are not found in text', () => {
		expect(diagramParts.length).toBeGreaterThan(5);
		for (const part of diagramParts) expect(part.words).toEqual([]);
	});
});
