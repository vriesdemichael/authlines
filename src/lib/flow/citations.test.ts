import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flows } from '#lib/flow/index.ts';
import { evaluate, type Step } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings } from '#lib/flow/settings.ts';
import { parseState, refFor, serializeState, withSourceOpen } from '#lib/flow/state.ts';
import { noteDefs } from '#lib/keycloak/notes.ts';
import { splitRfc } from '#lib/sources/rfc.ts';
import { sources, type SourceId } from '#lib/sources/sources.ts';

// Words that say the claim is someone else's, and so that someone can be named.
const CLAIMS = /\b(the specs?|current advice|the advice|RFC ?\d+)\b/i;

const textsOf = (step: Step) =>
	[
		step.plain,
		step.label,
		step.concept,
		step.inPractice,
		step.pitfall?.title,
		step.pitfall?.text,
		...step.fields.map((field) => field.note)
	].filter((text): text is string => Boolean(text));

/** Every step there is, under every setting that changes what it says or what it cites. */
function* everyStep() {
	for (const base of Object.values(flows)) {
		for (const diagram of Object.values(base.diagrams)) {
			for (const settings of allValidSettings(base.settings)) {
				for (const step of evaluate(diagram, settings).steps) yield { base, step };
			}
		}
	}
}

/**
 * What each step cites, with a phrase from that section, so that a citation of the wrong section, or
 * on the wrong step, is noticed. A phrase is what was read there, and not from memory.
 */
const CITED: readonly [step: string, SourceId, section: string, phrase: string][] = [
	['authorize', 'rfc6749', '4.1.2.1', 'MUST NOT automatically redirect'],
	['authorize', 'rfc9700', '2.1', 'exact string matching'],
	['authorize', 'rfc7636', '4.2', 'code_challenge = code_verifier'],
	['authorize', 'rfc9700', '2.1.1', 'S256 is the only such method'],
	['redirect-to-idp', 'rfc9700', '2.1.1', 'Public clients MUST use PKCE'],
	['consent-grant', 'rfc6749', '10.2', 'SHOULD NOT process repeated authorization requests'],
	['redirect-with-code', 'rfc9700', '2.1.2', 'SHOULD NOT use the implicit grant'],
	['token-request', 'rfc9700', '2.1.1', 'Public clients MUST use PKCE'],
	['token-request', 'rfc9449', '10', 'dpop_jkt'],
	['callback', 'rfc6749', '10.12', 'inject its own authorization code'],
	['callback', 'rfc9700', '4.7', 'Cross-Site Request Forgery'],
	['redirect-with-code', 'rfc9700', '4.4', 'Mix-up attacks can occur'],
	['attacker-steals-code', 'rfc9700', '4.5.4', 'can circumvent the countermeasures'],
	['redirect-with-code', 'rfc9700', '2.1', 'a defense against mix-up attacks'],
	['service-token-request', 'rfc9700', '2.5', 'RECOMMENDED to use asymmetric cryptography'],
	['attacker-hands-code', 'rfc9700', '4.5', 'Authorization Code Injection'],
	['handed-token-response', 'rfc9700', '4.5.3.1', 'does not match this verifier'],
	['handed-nonce-check', 'rfc9700', '4.5.3.2', 'will not match'],
	['real-app-refused', 'rfc6749', '4.1.2', 'used more than once'],
	['real-app-refused', 'rfc9700', '4.2.4', 'MUST be invalidated by the authorization server'],
	['attacker-token-response', 'rfc6749', '5.2', 'Client authentication failed'],
	['nonce-challenge', 'rfc9449', '8', 'nonce'],
	['token-request-retry', 'rfc9449', '8', 'nonce'],
	[
		'refresh-again-response',
		'rfc9700',
		'2.2.2',
		'MUST be sender-constrained or use refresh token rotation'
	],
	['service-token-response', 'rfc6749', '4.4.3', 'refresh token SHOULD NOT be included'],
	['token-request', 'rfc10017', '6.3.3.1', 'should not be treated as confidential secrets'],
	['token-response', 'rfc10017', '8.5', 'none of these options can fully mitigate'],
	['token-response', 'rfc10017', '5.1.3', 'still be able to request a new set of tokens'],
	['token-response', 'rfc10017', '6.1.4.1', 'nothing will be able to prevent such attacks'],
	['token-response', 'rfc10017', '6.1.4.3', 'strongly recommended for business applications'],
	['device-request', 'rfc8628', '3.1', 'only commence a device authorization request'],
	['device-response', 'rfc8628', '3.2', 'clients MUST use 5 as the default'],
	['device-show-code', 'rfc8628', '3.3', 'and enter the user code'],
	['device-show-code', 'rfc8628', '3.3.1', 'Clients MUST still display the "user_code"'],
	['device-poll', 'rfc8628', '3.4', 'in a polling fashion'],
	['device-pending', 'rfc8628', '3.5', 'it MUST stop polling'],
	['device-submit-code', 'rfc8628', '5.1', 'rate-limit user code attempts'],
	['device-login-page', 'rfc8628', '3.3', 'up to the authorization server'],
	['device-consent-page', 'rfc8628', '3.3', 'approve or deny the request'],
	['device-consent-page', 'rfc8628', '5.4', 'authorizing a device'],
	['device-token-response', 'rfc8628', '3.5', 'access_denied'],
	['device-register', 'rfc8628', '5.6', 'treated as public clients'],
	['device-denied-response', 'rfc8628', '3.5', 'The authorization request was denied'],
	['device-expired-response', 'rfc8628', '3.5', 'SHOULD wait for user interaction'],
	['device-show-code', 'rfc8628', '5.5', 'completing the authorization faster than the user'],
	['device-submit-credentials', 'rfc8628', '5.3', 'address bar is wrong'],
	['device-discovery-document', 'rfc8628', '4', 'device_authorization_endpoint']
];

const flat = (text: string) => text.replace(/\s+/g, ' ');

function sectionOf(source: SourceId, section: string) {
	const { parts } = splitRfc(readFileSync(`static/rfc/${sources[source].textFile}`, 'utf8'));
	const at = parts.findIndex((part) => part.section === section);
	if (at < 0) throw new Error(`${source} has no section ${section}`);
	// A section runs on through its subsections, which is how they are read.
	const next = parts.findIndex(
		(part, i) => i > at && part.section && !part.section.startsWith(`${section}.`)
	);
	return flat(
		parts
			.slice(at, next < 0 ? undefined : next)
			.map((part) => `${part.heading} ${part.body}`)
			.join(' ')
	);
}

describe('a claim about a spec', () => {
	it('says which one, on every step in every combination', () => {
		const left = new Set<string>();
		for (const { base, step } of everyStep()) {
			if (step.specOnly || step.cites.length) continue;
			for (const text of textsOf(step)) {
				if (CLAIMS.test(text)) left.add(`${base.id} ${step.id}: ${text}`);
			}
		}
		expect([...left]).toEqual([]);
	});

	it('cites the RFC it names', () => {
		const wrong = new Set<string>();
		for (const { step } of everyStep()) {
			for (const text of textsOf(step)) {
				for (const [, number] of text.matchAll(/\bRFC ?(\d+)\b/g)) {
					const named = `rfc${number}`;
					if (!step.cites.some(({ source }) => source === named) && !step.specOnly) {
						wrong.add(`${step.id} names RFC ${number} and does not cite it`);
					}
				}
			}
		}
		expect([...wrong]).toEqual([]);
	});

	it('cites a section that was read, and that says what it is cited for', () => {
		const cited = new Set<string>();
		for (const { step } of everyStep()) {
			for (const { source, section } of step.cites) {
				if (section) cited.add(`${step.id} ${source} ${section}`);
			}
		}
		expect([...cited].sort()).toEqual(
			CITED.map(([step, source, section]) => `${step} ${source} ${section}`).sort()
		);
		for (const [step, source, section, phrase] of CITED) {
			expect(sectionOf(source, section), `${step} ${source} ${section}`).toContain(phrase);
		}
	});

	it('cites only what the settings on screen make it say', () => {
		const citesOf = (search: string, step: string) =>
			parseState(flows['authorization-code'], 'flow', `${search}&step=${step}`) &&
			evaluate(
				flows['authorization-code'].diagrams.flow,
				parseState(flows['authorization-code'], 'flow', search).settings
			)
				.steps.find(({ id }) => id === step)
				?.cites.map(({ source }) => source);
		expect(citesOf('pkce=1', 'authorize')).toContain('rfc7636');
		expect(citesOf('', 'authorize')).not.toContain('rfc7636');
		expect(citesOf('', 'redirect-to-idp')).toContain('rfc9700');
		expect(citesOf('pkce=1', 'redirect-to-idp')).not.toContain('rfc9700');
	});

	it('opens from a step, and says so in the address, so a reload keeps it', () => {
		const base = flows['authorization-code'];
		const search = 'source=rfc9700&for=step&section=2.1.2&step=redirect-with-code';
		const state = parseState(base, 'flow', search);
		expect(state.source).toEqual({
			id: 'rfc9700',
			setting: null,
			section: '2.1.2',
			fromStep: true
		});
		const again = parseState(base, 'flow', serializeState(base, state));
		expect(again.source).toEqual(state.source);
		// Not from a step that does not cite it, because nothing would say what it means there.
		const elsewhere = 'source=rfc9700&for=step&section=2.1.2&step=open-app';
		expect(parseState(base, 'flow', elsewhere).source).toBeNull();
		const onward = withSourceOpen(state, null, { source: 'rfc9700', why: 'x' }, true);
		expect(onward.source?.fromStep).toBe(true);
	});

	it('tells two sections of the same spec apart, because they say different things', () => {
		const cites = evaluate(flows['authorization-code'].diagrams.flow, {
			...defaultSettings,
			pkce: true
		}).steps.find(({ id }) => id === 'authorize')!.cites;
		expect(refFor(cites, 'rfc9700', '2.1')?.why).toContain('exact match');
		expect(refFor(cites, 'rfc9700', '2.1.1')?.why).toContain('S256');
		expect(refFor(cites, 'rfc9700', 'not there')?.section).toBe('2.1');
		expect(refFor(cites, 'rfc9449', '2.1')).toBeUndefined();
	});

	it('says what the source means here, in words about this step', () => {
		for (const { step } of everyStep()) {
			for (const { source, why } of step.cites) {
				expect(why.length, `${step.id} ${source}`).toBeGreaterThan(30);
				// Only an RFC has sections to open at. For the rest the section is in the words.
				expect(sources[source], source).toBeDefined();
			}
		}
	});

	it('cites only specs on a step, and leaves what one server does to its notes (ADR-015)', () => {
		for (const { step } of everyStep()) {
			for (const { source } of step.cites) expect(source, step.id).not.toMatch(/^keycloak/);
		}
		expect(noteDefs.length).toBeGreaterThan(0);
	});
});
