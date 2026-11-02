import { describe, expect, it } from 'vitest';
import { interpolate, toFrame } from '#lib/diagram/motion.ts';
import { layoutDiagram } from '#lib/diagram/layout.ts';
import { authorizationCode } from '#lib/flow/authorization-code.ts';
import { authorizationCodeSetup } from '#lib/flow/authorization-code-setup.ts';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import { evaluate, introsOf, type DiagramView } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings, settingDefs, settingIds } from '#lib/flow/settings.ts';
import {
	parseState,
	serializeState,
	withServerNotes,
	withWording,
	wordingOf
} from '#lib/flow/state.ts';
import { nameIn, roleIn, sayer, speak, wordings, type Wording } from '#lib/flow/wording.ts';
import { noteDefs } from '#lib/keycloak/notes.ts';
import { keycloakKnownAs } from '#lib/keycloak/words.ts';
import { mapNodes } from '#lib/map/tracks.ts';
import { nameSources } from '#lib/sources/sources.ts';

const diagrams = [authorizationCode, authorizationCodeSetup];

function textsOf(view: DiagramView): string[] {
	return [
		...view.steps.flatMap((step) => [
			step.plain,
			step.label,
			step.concept,
			step.inPractice ?? '',
			step.pitfall?.title ?? '',
			step.pitfall?.text ?? '',
			step.specOnly ?? '',
			step.recordedAs ?? '',
			...step.links.map((link) => link.text),
			...step.practice.map((example) => example.text),
			...step.fields.map((field) => field.note ?? '')
		]),
		...view.groups.flatMap((group) => [group.plain, group.label]),
		...view.parts.map((part) => part.why)
	].filter(Boolean);
}

/** Every text there is, in those words, under every setting that changes what it says. */
function everything(wording: Wording): string[] {
	const seen = new Set<string>();
	for (const settings of allValidSettings()) {
		const say = sayer(wording);
		for (const diagram of diagrams) {
			for (const text of textsOf(speak(evaluate(diagram, settings), say))) seen.add(text);
			for (const intro of introsOf(diagram)) seen.add(say(intro));
			seen.add(say(diagram.caption));
		}
		for (const id of settingIds) {
			const def = settingDefs[id];
			seen.add(say(def.summary));
			seen.add(say(def.why));
			if (def.simple) seen.add(say(def.simple.summary));
		}
		for (const node of mapNodes) seen.add(say(node.answer));
		for (const note of noteDefs) {
			seen.add(say(note.title));
			if (typeof note.text === 'string') seen.add(say(note.text));
			else for (const { text } of note.text) seen.add(say(text));
		}
		if (seen.size > 5000) throw new Error('This is not what the words are for');
	}
	return [...seen];
}

const lastingWords: Record<Exclude<Wording, 'plain'>, readonly RegExp[]> = {
	specs: [
		/(?<![\w/.-])(?<!\b(?:demo|web|[Oo]pen the|opens the|opens a second|opens another) )apps?(?![\w/-])(?! team\b)/gi,
		/(?<!\b(?:upstream|External|external) )\b[Ii]dentity providers?\b/g,
		/(?<!\b(?:upstream|External|external) )\bIdP\b/g,
		/(?<!\b(?:demo|stored-token) )\bAPIs?\b(?! V[12]\b)/g
	],
	keycloak: [
		/(?<![\w/.-])(?<!\b(?:demo|web|[Oo]pen the|opens the|opens a second|opens another) )apps?(?![\w/-])(?! team\b)/gi,
		/\bthe identity provider\b/gi,
		/\bthe IdP\b/gi,
		/\bthe other provider\b/gi
	]
};

describe('whose words the diagram is in', () => {
	it('changes nothing about a flow, only what it says (ADR-004)', () => {
		for (const diagram of diagrams) {
			for (const settings of allValidSettings()) {
				const view = evaluate(diagram, settings);
				for (const wording of wordings) {
					const said = speak(view, sayer(wording));
					expect(
						said.steps.map(({ id, from, to, kind, channel }) => [id, from, to, kind, channel])
					).toEqual(
						view.steps.map(({ id, from, to, kind, channel }) => [id, from, to, kind, channel])
					);
					expect(said.steps.flatMap((step) => step.fields.map((field) => field.name))).toEqual(
						view.steps.flatMap((step) => step.fields.map((field) => field.name))
					);
					expect(said.lifelines).toEqual(view.lifelines);
				}
			}
		}
	});

	it('changes no word in plain words', () => {
		const view = evaluate(authorizationCode, defaultSettings);
		expect(speak(view, sayer('plain'))).toEqual(view);
	});

	it.each(['specs', 'keycloak'] as const)('leaves no name of a party behind in %s', (wording) => {
		const left = everything(wording).filter((text) =>
			lastingWords[wording].some((word) => text.search(word) >= 0)
		);
		expect(left).toEqual([]);
	});

	it.each(['specs', 'keycloak'] as const)('stays grammar in %s', (wording) => {
		const wrong = everything(wording).filter((text) =>
			/\b[Aa] (?:authorization|OpenID|API|identity|app)\b|(?<=[a-z,] )(?:Resource server|Authorization server|Client)\b|\b[Aa]n (?:client|relying|resource|realm|Keycloak)\b|\b[Tt]he Keycloak\b(?! (?:admin|docs|console|client))|\b(\w+) \1\b(?<!\bthat that\b)/.test(
				text
			)
		);
		expect(wrong).toEqual([]);
	});

	it('reads the same with OpenID Connect on, as the spec mostly does, and the heads show both', () => {
		const say = sayer('specs');
		expect(say('An app asks the identity provider, and an app’s API.')).toBe(
			'A client asks the authorization server, and a client’s resource server.'
		);
		const lines = evaluate(authorizationCode, { ...defaultSettings, oidc: true }).lifelines;
		const head = (id: string) => {
			const line = lines.find((candidate) => candidate.id === id)!;
			return [nameIn(line, 'specs'), roleIn(line, 'specs')];
		};
		expect(head('app')).toEqual(['Relying party', 'Client']);
		expect(head('idp')).toEqual(['OpenID provider', 'Authorization server']);
	});

	it('capitalises only the start of a sentence', () => {
		const say = sayer('specs');
		expect(say('API calls fail. API calls work, and your API is fine.')).toBe(
			'Resource server calls fail. Resource server calls work, and your resource server is fine.'
		);
		expect(say('The IdP hands it to the IdP.')).toBe(
			'The authorization server hands it to the authorization server.'
		);
	});

	it('keeps what would turn false', () => {
		const say = sayer('specs');
		for (const kept of [
			'The app team knows',
			'the demo app and API V2',
			'Identity Provider Redirector'
		]) {
			expect(say(kept).startsWith(kept.split(' ')[0])).toBe(true);
			expect(say(kept)).not.toContain('client team');
			expect(say(kept)).not.toContain('resource server V2');
		}
		expect(say('the demo app')).toBe('the demo app');
		expect(say('Identity Provider Redirector')).toBe('Identity Provider Redirector');
		expect(say('The user opens the app')).toBe('The user opens the app');
		const inKeycloak = sayer('keycloak');
		expect(inKeycloak('Many identity providers remember')).toBe('Many identity providers remember');
		expect(inKeycloak('The identity provider’s broker')).toBe('Keycloak’s broker');
		expect(inKeycloak('at the same identity provider')).toBe('at the same realm');
		expect(inKeycloak('each realm is an identity provider')).toBe(
			'each realm is an identity provider'
		);
		expect(inKeycloak('to the other provider')).toBe('to the external identity provider');
		expect(inKeycloak('the API')).toBe('the API');
	});

	it('gives everything taking part a name in each', () => {
		for (const diagram of diagrams) {
			for (const settings of allValidSettings()) {
				for (const line of evaluate(diagram, settings).lifelines) {
					for (const wording of wordings) {
						expect(nameIn(line, wording), line.id).toBeTruthy();
						expect(roleIn(line, wording), line.id).toBeTruthy();
					}
				}
			}
		}
	});

	it('says who calls it what, with a source that can be opened', () => {
		for (const diagram of diagrams) {
			for (const line of evaluate(diagram, defaultSettings).lifelines) {
				for (const { source } of line.knownAs) {
					expect(nameSources.map((ref) => ref.source)).toContain(source.source);
				}
			}
		}
		const lines = evaluate(authorizationCode, defaultSettings).lifelines;
		const known = (id: string) => lines.find((line) => line.id === id)?.knownAs;
		expect(known('app')?.map(({ word }) => word)).toEqual(['client', 'relying party']);
		expect(known('idp')?.map(({ word }) => word)).toEqual([
			'authorization server',
			'OpenID provider'
		]);
		expect(keycloakKnownAs('idp').map(({ word }) => word)).toEqual(['realm']);
		expect(keycloakKnownAs('app').map(({ word }) => word)).toEqual(['client']);
		expect(keycloakKnownAs('browser')).toEqual([]);
		expect(known('api')?.map(({ word }) => word)).toEqual(['resource server', 'resource server']);
		expect(known('browser')?.map(({ word }) => word)).toEqual(['user agent', 'user agent']);
	});

	it('stays in plain words in either mode until someone chooses, and the choice is in the URL', () => {
		const simple = parseState(base, 'flow', '');
		expect(wordingOf(simple)).toBe('plain');
		expect(wordingOf(parseState(base, 'flow', 'mode=advanced'))).toBe('plain');
		expect(serializeState(base, parseState(base, 'flow', 'mode=advanced'))).not.toContain('say');

		const chosen = withWording(simple, 'specs');
		expect(serializeState(base, chosen)).toBe('say=specs');
		expect(wordingOf(parseState(base, 'flow', 'say=plain&mode=advanced'))).toBe('plain');
		expect(wordingOf(parseState(base, 'flow', 'say=nonsense'))).toBe('plain');
	});

	it('leaves out Keycloak’s words along with the notes about it (ADR-015)', () => {
		const chosen = withWording(parseState(base, 'flow', ''), 'keycloak');
		expect(withServerNotes(chosen, false).wording).toBeNull();
		expect(withServerNotes(withWording(chosen, 'specs'), false).wording).toBe('specs');
		expect(parseState(base, 'flow', 'say=keycloak&keycloak=off').wording).toBeNull();
	});

	it('opens a source about a name with no setting involved', () => {
		const state = parseState(base, 'flow', 'source=rfc6749&section=1.1');
		expect(state.source).toEqual({ id: 'rfc6749', setting: null, section: '1.1' });
		expect(serializeState(base, state)).toBe('source=rfc6749&section=1.1');
		// Only the ones about names, because every other source says what it means for its setting.
		expect(parseState(base, 'flow', 'source=rfc9700').source).toBeNull();
		expect(parseState(base, 'flow', 'source=keycloak-concepts&keycloak=off').source).toBeNull();
	});

	it('takes a name away and brings the other back, rather than crossing them', () => {
		const view = evaluate(authorizationCode, defaultSettings);
		const from = toFrame(layoutDiagram(view, 'simple', undefined, 'plain'));
		const to = toFrame(layoutDiagram(view, 'simple', undefined, 'specs'));
		const app = (t: number) => interpolate(from, to, t).lanes.find((lane) => lane.id === 'app')!;
		expect(app(0).name).toBe('App');
		expect(app(0).words).toBe(1);
		expect(app(0.4).words).toBe(0);
		expect(app(0.6).name).toBe('Client');
		expect(app(0.6).words).toBe(0);
		expect(app(0.99).words).toBeGreaterThan(0.9);
		expect(app(1).words).toBe(1);
	});

	it('moves no arrow, so the frame of reference stays when the words change', () => {
		const view = evaluate(authorizationCode, defaultSettings);
		for (const mode of ['simple', 'advanced'] as const) {
			for (const room of [undefined, { width: 700, height: 600 }, { width: 1240, height: 900 }]) {
				const place = (wording: Wording) => {
					const { lanes, rows } = layoutDiagram(view, mode, room, wording);
					return [lanes.map((lane) => lane.x), rows.map((row) => row.y)];
				};
				expect(place('specs')).toEqual(place('plain'));
				expect(place('keycloak')).toEqual(place('plain'));
			}
		}
	});

	it('gives a long name a second line, and only then leaves out what it is', () => {
		const view = evaluate(authorizationCode, defaultSettings);
		const lane = (wording: Wording) =>
			layoutDiagram(view, 'simple', { width: 1240, height: 800 }, wording).lanes.find(
				({ id }) => id === 'idp'
			)!;
		expect(lane('plain').nameLines).toEqual(['Identity provider']);
		expect(lane('specs').nameLines).toEqual(['Authorization', 'server']);
		expect(lane('keycloak').nameLines).toEqual(['Keycloak']);
	});
});
