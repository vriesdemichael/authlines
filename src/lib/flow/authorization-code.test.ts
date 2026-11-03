import { describe, expect, it } from 'vitest';
import { authorizationCode as flow } from '#lib/flow/authorization-code.ts';
import { authorizationCodeSetup as setup } from '#lib/flow/authorization-code-setup.ts';
import {
	arrivalsAt,
	diffViews,
	evaluate,
	holdingsAt,
	isEmptyDiff,
	type DiagramId
} from '#lib/flow/model.ts';
import { authorizationCodeBase as base } from '#lib/flow/index.ts';
import {
	allValidSettings,
	change,
	defaultSettings,
	normalize,
	unavailable,
	type Settings
} from '#lib/flow/settings.ts';
import { parseState } from '#lib/flow/state.ts';
import type { ArtifactId } from '#lib/flow/vocabulary.ts';
import shippedStepIds from '#lib/flow/shipped-step-ids.json';
import questions from '../../../static/recordings/authorization-code/questions.json';

const { answers } = questions;
const view = (settings: Partial<Settings> = {}) =>
	evaluate(flow, { ...defaultSettings, ...settings });
const diff = (before: Partial<Settings>, after: Partial<Settings>) =>
	diffViews(view(before), view(after));
const setupView = (settings: Partial<Settings> = {}) =>
	evaluate(setup, { ...defaultSettings, ...settings });

describe('every valid combination', () => {
	const combinations = allValidSettings();
	const diagrams: readonly DiagramId[] = ['flow', 'setup'];

	it.each(diagrams)('uses unique step IDs in the definition of %s', (diagram) => {
		const ids = base.diagrams[diagram].steps.map((step) => step.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	describe.each(diagrams)('in %s', (diagram) => {
		it('lands what a step carries with whoever gets it, and only there', () => {
			for (const settings of combinations.slice(0, 40)) {
				const view = evaluate(base.diagrams[diagram], settings);
				for (const [i, step] of view.steps.entries()) {
					const before = i ? holdingsAt(view, view.steps[i - 1].id) : null;
					const after = holdingsAt(view, step.id);
					for (const arrival of arrivalsAt(view, step.id)) {
						const [line, artifact] = arrival.split(':') as [string, ArtifactId];
						expect(after[line]).toContain(artifact);
						if (before) expect(before[line]).not.toContain(artifact);
					}
				}
			}
		});

		describe('parts', () => {
			const flow = base.diagrams[diagram];

			it('start from steps that exist, the first from the first step', () => {
				const ids = flow.steps.map((step) => step.id);
				expect(flow.parts.filter((part) => !ids.includes(part.from))).toEqual([]);
				expect(flow.parts[0].from).toBe(ids[0]);
			});

			it('are in the order of the steps, with different names', () => {
				const ids = flow.steps.map((step) => step.id);
				const starts = flow.parts.map((part) => ids.indexOf(part.from));
				expect(starts).toEqual([...starts].sort((a, b) => a - b));
				const labels = flow.parts.map((part) => part.label);
				expect(new Set(labels).size).toBe(labels.length);
			});

			it('hold every step exactly once, in order, in every combination', () => {
				for (const settings of combinations) {
					const view = evaluate(flow, settings);
					expect(view.parts.flatMap((part) => part.steps)).toEqual(
						view.steps.map((step) => step.id)
					);
					expect(view.parts.filter((part) => !part.steps.length)).toEqual([]);
				}
			});

			it('say why in a sentence short enough to read in passing', () => {
				for (const part of flow.parts) {
					expect(part.why.split(' ').length).toBeLessThanOrEqual(18);
					expect(part.why).toMatch(/\.$/);
				}
			});
		});

		it.each(combinations.map((settings) => [JSON.stringify(settings), settings] as const))(
			'builds a coherent diagram: %s',
			(_, settings) => {
				const result = evaluate(base.diagrams[diagram], settings);
				const lifelines = new Set(result.lifelines.map((line) => line.id));
				for (const step of result.steps) {
					expect(lifelines.has(step.from), `${step.id} from ${step.from}`).toBe(true);
					expect(lifelines.has(step.to), `${step.id} to ${step.to}`).toBe(true);
					expect(step.label).not.toBe('');
					expect(step.concept).not.toBe('');
					expect(new Set(step.fields.map((f) => f.name)).size).toBe(step.fields.length);
				}
				for (const group of result.groups) {
					const members = result.steps.filter((step) => step.group === group.id);
					expect(members.length, `group ${group.id}`).toBeGreaterThan(0);
					const first = result.steps.indexOf(members[0]);
					expect(result.steps.slice(first, first + members.length)).toEqual(members);
				}
				for (const step of result.steps) {
					if (step.group) expect(result.groups.map((g) => g.id)).toContain(step.group);
					for (const link of step.links) {
						const target = evaluate(base.diagrams[link.diagram], settings);
						expect(link.diagram, `${step.id} links to its own diagram`).not.toBe(diagram);
						expect(target.steps.map((s) => s.id)).toContain(link.step);
					}
				}
			}
		);
	});

	it('produces a different user flow for each one', () => {
		const shapes = combinations.map((settings) => JSON.stringify(evaluate(flow, settings)));
		expect(new Set(shapes).size).toBe(combinations.length);
	});
});

describe('step IDs', () => {
	it('stay stable, because links depend on them (ADR-003)', () => {
		const ids = [...flow.steps, ...setup.steps].map((step) => step.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.sort()).toEqual([...shippedStepIds].sort());
	});
});

describe('the plain language', () => {
	const everything = [...flow.steps, ...setup.steps];
	const plainTexts = allValidSettings().flatMap((settings) =>
		[flow, setup].flatMap((diagram) => evaluate(diagram, settings).steps.map((step) => step.plain))
	);

	it('is there for every step', () => {
		for (const text of plainTexts) expect(text).not.toBe('');
		expect(everything.every((step) => step.plain)).toBe(true);
	});

	it('uses no words from the wire, because that is what advanced mode is for', () => {
		const wire = /\b(GET|POST|\d{3}|\/\w+|client_id|redirect_uri|scope|nonce|IdP)\b/;
		expect([...new Set(plainTexts)].filter((text) => wire.test(text))).toEqual([]);
	});

	it('fits on the lifelines', () => {
		for (const line of [...flow.lifelines, ...setup.lifelines]) {
			expect(line.plainName.length, line.id).toBeLessThanOrEqual(18);
			expect(line.plainRole.length, line.id).toBeLessThanOrEqual(20);
		}
	});

	it('explains what an issuer is, on the identity provider', () => {
		const idp = flow.lifelines.find((line) => line.id === 'idp');
		expect(idp?.concept).toContain('issuer');
	});
});

describe('what a step means for someone building an app', () => {
	it('is said wherever their app or API does something', () => {
		const everything = {
			...defaultSettings,
			oidc: true,
			pkce: true,
			binding: 'dpop',
			broker: true,
			upstreamTokens: 'v1'
		} as const;
		const left = evaluate(flow, everything)
			.steps.filter((step) => step.from === 'app' || step.from === 'api')
			.filter((step) => !step.inPractice)
			.map((step) => step.id);
		expect(left).toEqual([]);
	});

	it('does not tell them a library does what a low-level one leaves to them', () => {
		const said = (id: string, settings = defaultSettings) =>
			evaluate(flow, settings).steps.find((step) => step.id === id)?.inPractice;
		expect(said('callback')).toContain('comparing state');
		expect(said('validate-id-token', { ...defaultSettings, oidc: true })).toContain('nonce');
		expect(said('api-check-token')).toContain('scope');
	});

	it('says what is left to them in setup', () => {
		const said = evaluate(setup, defaultSettings).steps.filter((step) => step.inPractice);
		expect(said.map((step) => step.id)).toEqual(
			expect.arrayContaining(['register-client', 'configure-app'])
		);
	});

	it('uses no words from the wire, whichever mode it is read in', () => {
		const wire = /\b(GET|POST|\d{3}|client_id|redirect_uri|IdP)\b/;
		for (const diagram of [flow, setup]) {
			for (const settings of allValidSettings()) {
				for (const step of evaluate(diagram, settings).steps) {
					expect(step.inPractice ?? '', step.id).not.toMatch(wire);
				}
			}
		}
	});
});

describe('why a step is here', () => {
	const causesOf = (id: string, settings: Settings) =>
		evaluate(flow, settings).steps.find((step) => step.id === id)?.causes;

	it('is nothing, for everything in the base flow', () => {
		for (const diagram of [flow, setup]) {
			for (const step of evaluate(diagram, defaultSettings).steps) {
				expect(step.causes, step.id).toEqual([]);
			}
		}
	});

	it('names only what would take it away, and never a setting that is still off', () => {
		for (const settings of allValidSettings()) {
			for (const step of evaluate(flow, settings).steps) {
				for (const cause of step.causes) {
					expect(settings[cause], `${step.id} because of ${cause}`).not.toBe(
						defaultSettings[cause]
					);
				}
			}
		}
	});

	it('is what brought the attacker on, and not the protection that is off', () => {
		const settings = { ...defaultSettings, attacker: true, clientType: 'public' } as const;
		expect(causesOf('attacker-api-request', settings)).toEqual(['attacker', 'clientType']);
	});

	it('does not blame a setting for a step that is there anyway', () => {
		expect(causesOf('login-page', defaultSettings)).toEqual([]);
		expect(causesOf('api-response', { ...defaultSettings, attacker: true })).toEqual([]);
	});
});

describe('how a message travels', () => {
	const channelOf = (id: string) => view().steps.find((step) => step.id === id)?.channel;

	it('is through the browser whenever the browser is on either end', () => {
		for (const settings of allValidSettings()) {
			for (const step of evaluate(flow, settings).steps) {
				const browser = step.from === 'browser' || step.to === 'browser';
				// Someone's own browser, which is not the one on this diagram.
				const theirs = step.from === 'attacker' || step.to === 'attacker';
				// An app in the page thinking to itself, which goes nowhere.
				if (step.kind === 'internal') continue;
				if (browser) expect(step.channel, step.id).toBe('front');
				else if (!theirs) expect(step.channel, step.id).not.toBe('front');
			}
		}
	});

	it('tells the code in the redirect from the tokens on the direct call', () => {
		expect(channelOf('redirect-with-code')).toBe('front');
		expect(channelOf('token-request')).toBe('back');
		expect(channelOf('token-response')).toBe('back');
		expect(channelOf('api-check-token')).toBe('internal');
	});

	it('is people in setup, until the app itself calls', () => {
		const channel = (id: string) => setupView().steps.find((step) => step.id === id)?.channel;
		expect(channel('register-client')).toBe('people');
		expect(channel('discover')).toBe('back');
	});
});

// This is what the application teaches at every step, so it must hold everywhere it can be seen.
describe('who has seen what', () => {
	const lastStep = (settings: Settings) => evaluate(flow, settings).steps.at(-1)!.id;
	const heldAtEnd = (settings: Settings) =>
		holdingsAt(evaluate(flow, settings), lastStep(settings));

	it('keeps the password from the app, whatever the settings', () => {
		for (const settings of allValidSettings()) {
			if (settings.oldWay) continue;
			if (settings.appRuns !== 'page') expect(heldAtEnd(settings).app).not.toContain('password');
			expect(heldAtEnd(settings).api).not.toContain('password');
		}
	});

	it('gives the password to the app and the API in the old way, and no one else has anything', () => {
		const held = heldAtEnd({ ...defaultSettings, oldWay: true });
		expect(held.app).toEqual(['password']);
		expect(held.api).toEqual(['password']);
		expect(held.idp).toBeUndefined();
	});

	it('keeps tokens from the browser, because they never go through it', () => {
		for (const settings of allValidSettings()) {
			if (settings.appRuns === 'page') continue;
			const browser = heldAtEnd(settings).browser;
			expect(browser).not.toContain('access-token');
			// Logging out is the one exception, and the step says so: the app sends it to say who this is.
			if (!settings.logout) expect(browser).not.toContain('id-token');
			expect(browser).not.toContain('secret');
		}
	});

	describe('with the app in the page', () => {
		const inPage = {
			...defaultSettings,
			appRuns: 'page',
			clientType: 'public',
			pkce: true
		} as const;

		it('is one place with the browser, and keeps its arrows', () => {
			const page = evaluate(flow, inPage);
			expect(page.lifelines.map(({ id }) => id)).not.toContain('app');
			expect(page.steps.filter(({ from, to }) => from === 'app' || to === 'app')).toEqual([]);
			const trade = page.steps.find(({ id }) => id === 'token-request')!;
			expect(trade.from).toBe('browser');
			expect(trade.channel).toBe('front');
		});

		it('has the tokens end up there, because for this kind of app they do', () => {
			const held = holdingsAt(evaluate(flow, inPage), 'token-response').browser;
			expect(held).toContain('access-token');
			expect(held).toContain('verifier');
			expect(held).not.toContain('secret');
		});

		it('does not call a redirect a redirect when no server answered', () => {
			const ids = evaluate(flow, inPage).steps.map(({ id }) => id);
			expect(ids).toContain('page-goes-to-log-in');
			expect(ids).not.toContain('redirect-to-idp');
			expect(ids).toContain('redirect-with-code');
		});

		it('says the password does not reach the app, though the browser holds it', () => {
			const line = evaluate(flow, inPage).lifelines.find(({ id }) => id === 'browser')!;
			expect(line.concept).toMatch(/still does not reach the app/);
			expect(line.plainName).toBe('Browser and app');
		});

		it('brings with it what it takes, for someone who only knows where their app runs', () => {
			const { settings } = change(defaultSettings, 'appRuns', 'page');
			expect(settings.clientType).toBe('public');
			expect(settings.pkce).toBe(true);
			expect(change(settings, 'appRuns', 'server').settings.clientType).toBe('confidential');
		});

		it('leaves an address that asks for a public client as it was', () => {
			expect(parseState(base, 'flow', 'client=public').settings.appRuns).toBe('server');
		});
	});

	it('does show the code to the browser, which is why a code is worth little alone', () => {
		expect(heldAtEnd(defaultSettings).browser).toContain('code');
	});

	it('never shows the API the ID token, which is not for it', () => {
		for (const settings of allValidSettings()) {
			expect(heldAtEnd(settings).api).not.toContain('id-token');
		}
	});

	it('lets the API see the access token only when the app calls it', () => {
		const flowView = view();
		expect(holdingsAt(flowView, 'token-response').api).toEqual([]);
		expect(holdingsAt(flowView, 'api-request').api).toEqual(['access-token']);
	});

	it('builds up step by step', () => {
		const flowView = view();
		expect(holdingsAt(flowView, 'open-app').app).toEqual(['secret']);
		expect(holdingsAt(flowView, 'callback').app).toEqual(['secret', 'code']);
		expect(holdingsAt(flowView, 'token-response').app).toEqual([
			'secret',
			'code',
			'access-token',
			'refresh-token'
		]);
	});

	it('hands the password to the upstream IdP instead when another IdP does the login', () => {
		const brokered = { ...defaultSettings, broker: true };
		expect(heldAtEnd(brokered).upstream).toContain('password');
		expect(heldAtEnd(brokered).idp).not.toContain('password');
		expect(heldAtEnd(defaultSettings).idp).toContain('password');
	});

	it('gives a public client no secret to start with', () => {
		const held = heldAtEnd({ ...defaultSettings, clientType: 'public' });
		expect(held.app).not.toContain('secret');
	});

	it('moves the secret from the admin to the team to the app in setup', () => {
		const setupFlow = setupView();
		expect(holdingsAt(setupFlow, 'register-client')['idp-admin']).toEqual([]);
		expect(holdingsAt(setupFlow, 'create-client')['idp-admin']).toEqual(['secret']);
		expect(holdingsAt(setupFlow, 'create-client')['app-team']).toEqual([]);
		expect(holdingsAt(setupFlow, 'hand-over-credentials')['app-team']).toEqual(['secret']);
		expect(holdingsAt(setupFlow, 'hand-over-credentials').app).toEqual([]);
		expect(holdingsAt(setupFlow, 'configure-app').app).toEqual(['secret']);
	});
});

describe('the two diagrams', () => {
	const combinations = allValidSettings();

	it('keep the user and the browser out of setup', () => {
		for (const settings of combinations) {
			const ids = evaluate(setup, settings).lifelines.map((line) => line.id);
			expect(ids).not.toContain('browser');
		}
	});

	it('put the people who do setup on its diagram', () => {
		expect(setupView().lifelines.map((line) => line.id)).toEqual([
			'app-team',
			'app',
			'idp',
			'idp-admin',
			'api'
		]);
	});

	it('keep people out of the user flow', () => {
		for (const settings of combinations) {
			expect(evaluate(flow, settings).steps.map((step) => step.kind)).not.toContain('human');
		}
	});

	it('draw hand-offs differently from discovery, which really is HTTP', () => {
		const kindOf = (id: string) => setupView().steps.find((step) => step.id === id)?.kind;
		expect(kindOf('register-client')).toBe('human');
		expect(kindOf('hand-over-credentials')).toBe('human');
		expect(kindOf('discover')).toBe('request');
		expect(kindOf('discovery-document')).toBe('response');
	});

	it('link the redirect URI check to where it was registered, and back', () => {
		const authorize = view().steps.find((step) => step.id === 'authorize');
		expect(authorize?.links.map((link) => link.step)).toEqual(['register-client']);
		const register = setupView().steps.find((step) => step.id === 'register-client');
		expect(register?.links.map((link) => link.step)).toEqual(['authorize']);
	});

	it('link the start of the user flow to setup, and the end of setup to the user flow', () => {
		expect(view().steps[0].links[0]).toMatchObject({ diagram: 'setup' });
		expect(setupView().steps.at(-1)?.links[0]).toMatchObject({ diagram: 'flow', step: 'open-app' });
	});

	it('let a setting reach into setup', () => {
		const change = diffViews(setupView(), setupView({ broker: true }));
		expect(change.addedLifelines).toEqual(['upstream']);
		expect(change.addedSteps).toEqual(['register-with-upstream']);
	});
});

// These four test whether one model can absorb very different kinds of change (premise section 8).
describe('OIDC', () => {
	const change = diff({}, { oidc: true });

	it('adds a scope and an ID token to existing messages', () => {
		expect(change.addedFields).toContainEqual({ step: 'authorize', field: 'scope=openid' });
		expect(change.addedFields).toContainEqual({ step: 'token-response', field: 'id_token' });
	});

	it('adds an endpoint and renames two lifelines', () => {
		expect(change.addedSteps).toEqual([
			'validate-id-token',
			'userinfo-request',
			'userinfo-response'
		]);
		expect(change.renamedLifelines).toEqual(['app', 'idp']);
	});

	it('leaves the lifelines themselves alone', () => {
		expect(change.addedLifelines).toEqual([]);
	});
});

describe('DPoP', () => {
	const change = diff({}, { binding: 'dpop' });

	it('touches several existing steps', () => {
		const touched = new Set(change.addedFields.map((field) => field.step));
		expect([...touched]).toEqual(
			expect.arrayContaining(['authorize', 'token-request', 'token-response', 'api-request'])
		);
		expect(change.addedSteps).toEqual(['generate-key']);
	});

	it('adds a retry only when the server requires a nonce', () => {
		const retry = diff({ binding: 'dpop' }, { binding: 'dpop', dpopNonce: true });
		expect(retry.addedSteps).toEqual(['nonce-challenge', 'token-request-retry']);
		const steps = view({ binding: 'dpop', dpopNonce: true }).steps.map((step) => step.id);
		expect(steps.indexOf('token-request')).toBeLessThan(steps.indexOf('nonce-challenge'));
		expect(steps.indexOf('token-request-retry')).toBeLessThan(steps.indexOf('token-response'));
	});

	it('says which setting brought a field onto a message', () => {
		const field = view({ binding: 'dpop' })
			.steps.find((step) => step.id === 'authorize')
			?.fields.find((candidate) => candidate.name.startsWith('dpop_jkt'));
		expect(field?.causes).toEqual(['binding']);
	});

	it('says the words of whichever token type is on', () => {
		const said = (binding: Settings['binding'], id: string) =>
			view({ binding }).steps.find((step) => step.id === id)?.concept;
		expect(said('bearer', 'api-request')).toContain('Whoever holds');
		expect(said('dpop', 'api-request')).toContain('proof');
		expect(said('dpop', 'api-request')).not.toContain('Whoever holds');
		expect(said('bearer', 'api-check-token')).not.toContain('proof');
		expect(said('dpop', 'api-check-token')).toContain('proof');
	});

	it('does not promise what only an API that checks the proof delivers', () => {
		const dpop = view({ binding: 'dpop' }).steps;
		const said = (id: string) => dpop.find((step) => step.id === id);
		expect(said('generate-key')?.concept).toContain('at an API that checks the proof');
		expect(said('token-response')?.inPractice).toContain('At an API that checks the proof');
	});

	it('does not say that whoever has the code gets the tokens, when the login named the key', () => {
		const settings = { binding: 'dpop', clientType: 'public' } as const;
		const said = (id: string) => view(settings).steps.find((step) => step.id === id);
		expect(said('token-request')?.pitfall?.text).toContain('refuses the code');
		expect(said('token-request')?.pitfall?.text).not.toContain('gets the tokens');
		expect(said('token-request')?.concept).not.toContain('anyone holding the code');
		expect(said('callback')?.concept).not.toContain('all anyone needs');
		// The answers behind that, and the case it does not cover.
		expect(answers.interceptedCode.withDpop).toMatchObject({
			namedKeyNoProof: { status: 400 },
			namedKeyOtherProof: { status: 400 },
			namedKeyRightProof: { status: 200 },
			noNamedKeyTheirOwnProof: { status: 200 },
			requiredTheirOwnProof: { status: 200 }
		});
		expect(said('token-request')?.pitfall?.text).toContain('a key of their own');
	});
});

describe('PKCE', () => {
	const change = diff({}, { pkce: true });
	const fieldsOf = (id: string, settings: Partial<Settings> = { pkce: true }) =>
		view(settings)
			.steps.find((step) => step.id === id)
			?.fields.map((field) => field.name);

	it('adds the challenge going out and the verifier coming back', () => {
		expect(fieldsOf('authorize')).toEqual(
			expect.arrayContaining(['code_challenge', 'code_challenge_method=S256'])
		);
		expect(fieldsOf('token-request')).toContain('code_verifier');
		expect(fieldsOf('authorize')).not.toContain('code_verifier');
	});

	it('adds the app making them and the identity provider checking them', () => {
		expect(change.addedSteps).toEqual(['make-verifier', 'check-verifier']);
		expect(change.addedLifelines).toEqual([]);
		const steps = view({ pkce: true }).steps.map((step) => step.id);
		expect(steps.indexOf('make-verifier')).toBeLessThan(steps.indexOf('redirect-to-idp'));
		expect(steps.indexOf('check-verifier')).toBe(steps.indexOf('token-response') - 1);
	});

	it('never sends the verifier through the browser, whatever the settings', () => {
		for (const settings of allValidSettings()) {
			const flowView = evaluate(flow, settings);
			const held = holdingsAt(flowView, flowView.steps.at(-1)!.id);
			if (settings.appRuns !== 'page') expect(held.browser).not.toContain('verifier');
			if (settings.pkce) expect(held.browser).toContain('challenge');
		}
	});

	it('leaves the secret with the app, so a verifier does not replace it', () => {
		const heldAt = (id: string) => holdingsAt(view({ pkce: true }), id);
		expect(heldAt('make-verifier').app).toEqual(['secret', 'verifier', 'challenge']);
		expect(heldAt('authorize').idp).toEqual(['secret', 'challenge']);
		expect(heldAt('callback').idp).not.toContain('verifier');
		expect(heldAt('token-request').idp).toContain('verifier');
	});

	// Keycloak takes all four, which is what makes the two settings independent (questions.json).
	it('does not depend on the client type', () => {
		const combinations = allValidSettings();
		for (const clientType of ['public', 'confidential'] as const) {
			for (const pkce of [false, true]) {
				expect(combinations).toContainEqual({ ...defaultSettings, clientType, pkce });
			}
		}
	});

	it('says what a stolen code is worth, and that differs for each case', () => {
		const stolen = (settings: Partial<Settings>) =>
			view(settings).steps.find((step) => step.id === 'token-request')?.pitfall;
		expect(stolen({ clientType: 'public' })?.text).toMatch(/gets the tokens/);
		expect(stolen({ clientType: 'public', pkce: true })?.text).toMatch(/get nothing/);
		expect(stolen({})?.text).toMatch(/hand the code to the real app/);
		expect(stolen({ pkce: true })?.text).toMatch(/get nothing/);
		expect(stolen({ oidc: true })?.text).toMatch(/nonce/);
	});

	it('takes back what the app says about a code being worth little, when it is not', () => {
		const said = (settings: Partial<Settings>) =>
			view(settings).steps.find((step) => step.id === 'callback')?.concept;
		expect(said({})).toMatch(/not quite the end of it/);
		expect(said({ pkce: true })).toMatch(/worth little/);
		expect(said({ clientType: 'public', pkce: true })).toMatch(/worth little/);
		expect(said({ clientType: 'public' })).toMatch(/all anyone needs/);
	});
});

describe('consent', () => {
	const change = diff({}, { consent: true });

	it('adds the question and the answer, and nothing else', () => {
		expect(change.addedSteps).toEqual(['consent-page', 'consent-grant']);
		expect(change.addedLifelines).toEqual([]);
		expect(change.addedFields).toEqual([]);
	});

	it('comes after the login and before the code, wherever the login happens', () => {
		for (const settings of [{ consent: true }, { consent: true, broker: true }]) {
			const steps = view(settings).steps.map((step) => step.id);
			const signedIn = steps.indexOf(settings.broker ? 'match-user' : 'submit-credentials');
			expect(steps.indexOf('consent-page')).toBe(signedIn + 1);
			expect(steps.indexOf('consent-grant')).toBe(signedIn + 2);
			expect(steps.indexOf('redirect-with-code')).toBe(signedIn + 3);
		}
	});

	it('is the step Execute goes through', () => {
		const stepOf = (settings: Partial<Settings>, id: string) =>
			view(settings).steps.find((step) => step.id === id);
		expect(stepOf({}, 'submit-credentials')?.execute).toBe('redirect-with-code');
		expect(stepOf({ consent: true }, 'submit-credentials')?.execute).toBeUndefined();
		expect(stepOf({ consent: true }, 'consent-grant')?.execute).toBe('redirect-with-code');
	});

	it('says what happens if the answer is no', () => {
		const page = view({ consent: true }).steps.find((step) => step.id === 'consent-page');
		expect(page?.pitfall?.text).toContain('access_denied');
	});
});

describe('an attacker', () => {
	const on = (settings: Partial<Settings>) => view({ attacker: true, ...settings });
	const held = (settings: Partial<Settings>) => {
		const flowView = on(settings);
		return holdingsAt(flowView, flowView.steps.at(-1)!.id).attacker;
	};
	const answer = (settings: Partial<Settings>) =>
		on(settings).steps.find((step) => step.id === 'attacker-token-response');
	const steps = (settings: Partial<Settings>) => on(settings).steps.map((step) => step.id);

	it('adds a lifeline and what they try, and changes nothing the app does up to there', () => {
		const change = diff({}, { attacker: true });
		expect(change.addedLifelines).toEqual(['attacker']);
		expect(change.addedSteps).toContain('attacker-steals-code');
		expect(change.removedSteps).toEqual([]);
		expect(change.addedFields).toEqual([]);
	});

	it('gets the tokens from an app with no secret and no PKCE, and uses them', () => {
		expect(held({ clientType: 'public' })).toEqual(['code', 'access-token', 'refresh-token']);
		expect(answer({ clientType: 'public' })?.label).toMatch(/^200/);
		expect(steps({ clientType: 'public' })).toContain('attacker-api-request');
	});

	it('gets nothing with PKCE, and the real app still loses the code', () => {
		const settings = { clientType: 'public', pkce: true } as const;
		expect(held(settings)).toEqual(['code']);
		expect(answer(settings)?.label).toMatch(/^400/);
		expect(steps(settings)).not.toContain('attacker-api-request');
		expect(steps(settings)).toContain('real-app-refused');
		expect(steps(settings)).not.toContain('token-response');
	});

	it('gets nothing from an app with a secret, and the app carries on', () => {
		expect(held({})).toEqual(['code']);
		expect(answer({})?.label).toMatch(/^401/);
		expect(steps({})).toContain('token-response');
		expect(steps({})).toContain('api-response');
		expect(steps({})).not.toContain('real-app-refused');
	});

	it('changes the answer on the same arrow when PKCE is flipped, instead of redrawing it', () => {
		const flip = diffViews(on({ clientType: 'public' }), on({ clientType: 'public', pkce: true }));
		expect(flip.addedLifelines).toEqual([]);
		expect(flip.removedLifelines).toEqual([]);
		expect(flip.rewordedSteps).toContain('attacker-token-response');
		expect(flip.removedSteps).toContain('attacker-api-request');
	});

	it('stops the flow where it really stops', () => {
		const list = steps({ clientType: 'public' });
		expect(list.at(-1)).toBe('real-app-refused');
		expect(list.indexOf('attacker-api-response')).toBeLessThan(list.indexOf('callback'));
	});

	it('is only offered in the plain case, and says why otherwise', () => {
		expect(unavailable('attacker', true, { ...defaultSettings, binding: 'dpop' })?.because).toMatch(
			/plain case/
		);
		expect(unavailable('attacker', true, { ...defaultSettings, broker: true })).not.toBeNull();
	});

	describe('says what really happens, in simple mode too, for each protection', () => {
		const publicClient = { clientType: 'public' } as const;
		const withSecret = { clientType: 'confidential' } as const;
		const request = (settings: Partial<Settings>) =>
			on(settings).steps.find((step) => step.id === 'attacker-token-request');

		it.each([
			[publicClient, false, 'They get the tokens'],
			[publicClient, true, 'Refused: they have no verifier'],
			[withSecret, false, 'Refused: they have no secret'],
			[withSecret, true, 'Refused: they have no secret']
		] as const)('%o with PKCE %s: %s', (client, pkce, plain) => {
			expect(answer({ ...client, pkce })?.plain).toBe(plain);
		});

		it('matches what a real server answered, each way', () => {
			expect(answers.interceptedCode.publicWithoutPkce.gotTokens).toBe(true);
			expect(answers.interceptedCode.publicWithPkceNoVerifier.gotTokens).toBe(false);
			expect(answers.interceptedCode.confidentialNoPkceNoSecret.gotTokens).toBe(false);
		});

		it('does not call their request the same as the real app when it lacks the verifier', () => {
			const said = request({ ...publicClient, pkce: true })?.concept;
			expect(said).toContain('without the verifier');
			expect(said).not.toContain('nothing marks');
			expect(request({ ...publicClient, pkce: false })?.concept).toContain('nothing marks');
		});

		it('does not say the real app can be used against PKCE', () => {
			const said = answer({ ...withSecret, pkce: true })?.concept;
			expect(said).toContain('gets them nothing');
			expect(said).not.toContain('which is what PKCE stops');
			expect(answer({ ...withSecret, pkce: false })?.concept).toContain('which is what PKCE stops');
			expect(answers.interceptedCode.confidentialWithPkceSecretButWrongVerifier).toMatchObject({
				gotTokens: false,
				theRealAppAfterwards: { status: 400 }
			});
		});
	});
});

describe('logging out', () => {
	const on = { oidc: true, logout: true } as const;

	it('ends the session for everyone who held it, and leaves the tokens', () => {
		const held = view(on);
		const before = holdingsAt(held, 'end-session');
		expect(before.browser).toContain('session');
		expect(before.idp).toContain('session');
		const after = holdingsAt(held, 'session-ended');
		expect(after.browser).not.toContain('session');
		expect(after.idp).not.toContain('session');
		expect(after.app).toContain('access-token');
		expect(after.app).toContain('refresh-token');
		expect(after.api).toContain('access-token');
	});

	it('leaves the session alone if nobody logged out', () => {
		expect(holdingsAt(view({ oidc: true }), 'api-response').browser).toContain('session');
	});

	it('tells the second app only if there is one', () => {
		const ids = (settings: Partial<Settings>) => view(settings).steps.map((step) => step.id);
		expect(ids(on)).not.toContain('backchannel-logout');
		expect(ids({ ...on, sso: true })).toContain('backchannel-logout');
	});

	it('needs OpenID Connect, which is what it is part of', () => {
		const { settings } = normalize({ ...defaultSettings, logout: true });
		expect(settings.logout).toBe(false);
	});
});

describe('a second app', () => {
	const on = { sso: true } as const;

	it('never hands the session to an app, in any combination', () => {
		for (const settings of allValidSettings()) {
			if (!settings.sso) continue;
			const held = holdingsAt(evaluate(flow, settings), 'second-callback');
			expect(held.app).not.toContain('session');
			expect(held['second-app']).not.toContain('session');
			if (settings.ssoAsks !== 'fresh') {
				expect(held.browser).toContain('session');
				expect(held.idp).toContain('session');
			}
		}
	});

	it('has none of the login until an app insists', () => {
		const ids = (settings: Partial<Settings>) => view(settings).steps.map((step) => step.id);
		expect(ids(on)).not.toContain('second-login-page');
		expect(ids(on)).not.toContain('second-submit-credentials');
		expect(ids({ ...on, ssoAsks: 'insists' })).toContain('second-submit-credentials');
	});

	it('gets no code and no tokens with no session, and sends no cookie', () => {
		const fresh = view({ ...on, ssoAsks: 'fresh' });
		const authorize = fresh.steps.find((step) => step.id === 'second-authorize');
		expect(authorize?.fields.map((field) => field.name)).not.toContain('Cookie');
		expect(fresh.steps.map((step) => step.id)).not.toContain('second-token-request');
	});
});

describe('when the token runs out', () => {
	const on = { refresh: true } as const;
	const after = (settings: Partial<Settings>) => {
		const { steps } = view(settings);
		return steps.slice(steps.findIndex((step) => step.id === 'token-runs-out') + 1);
	};

	it('keeps the user out of it', () => {
		for (const step of after(on)) {
			expect([step.from, step.to]).not.toContain('user');
			expect([step.from, step.to]).not.toContain('browser');
		}
	});

	it('sends nothing while time passes, and has no message to record', () => {
		const time = view(on).steps.find((step) => step.id === 'token-runs-out');
		expect(time?.kind).toBe('time');
		expect(time?.channel).toBe('internal');
		expect(time?.fields).toEqual([]);
	});

	it('only goes on past the second use when it does not end things', () => {
		const ids = (settings: Partial<Settings>) => after(settings).map((step) => step.id);
		expect(ids(on)).not.toContain('refresh-newest');
		expect(ids({ ...on, reuse: 'ends' })).toContain('refresh-newest-response');
	});

	it('says what is stolen in the same words as the attacker', () => {
		const words = 'new access tokens without the user';
		const stolen = view({ clientType: 'public', attacker: true }).steps.find(
			(step) => step.id === 'attacker-token-response'
		);
		const again = view({ ...on, clientType: 'public' }).steps.find(
			(step) => step.id === 'refresh-again-response'
		);
		expect(stolen?.concept).toContain(words);
		expect(again?.concept).toContain(words);
	});
});

describe('brokering', () => {
	const change = diff({}, { broker: true });

	it('adds a lifeline and a nested flow in place of the local login', () => {
		expect(change.addedLifelines).toEqual(['upstream']);
		expect(change.removedSteps).toEqual(['login-page', 'submit-credentials']);
		expect(change.addedSteps).toContain('upstream-token-request');
		expect(view({ broker: true }).groups.map((group) => group.id)).toEqual(['brokered-login']);
	});

	it('changes nothing the app sends or receives', () => {
		expect(change.addedFields).toEqual([]);
		expect(change.removedFields).toEqual([]);
		const appSteps = (settings: Partial<Settings>) =>
			view(settings)
				.steps.filter((step) => step.from === 'app' || step.to === 'app')
				.map((step) => step.id);
		expect(appSteps({ broker: true })).toEqual(appSteps({}));
	});
});

describe('stored upstream tokens', () => {
	it('add a retrieval that differs between the two API versions', () => {
		const v1 = view({ broker: true, upstreamTokens: 'v1' });
		const v2 = view({ broker: true, upstreamTokens: 'v2' });
		const retrieval = (result: typeof v1) =>
			result.steps.find((step) => step.id === 'retrieve-upstream-token');
		expect(retrieval(v1)?.label).toMatch(/^GET/);
		expect(retrieval(v2)?.label).toMatch(/^POST/);
		expect(retrieval(v2)?.fields.map((f) => f.name)).toContain('client_secret');
		expect(retrieval(v1)?.fields.map((f) => f.name)).toEqual(['Authorization: Bearer']);
	});

	it('store the tokens inside the nested flow', () => {
		const stored = view({ broker: true, upstreamTokens: 'v1' }).steps.find(
			(step) => step.id === 'store-upstream-tokens'
		);
		expect(stored?.group).toBe('brokered-login');
	});
});

describe('diffs', () => {
	it('are empty for no change', () => {
		expect(isEmptyDiff(diff({ oidc: true }, { oidc: true }))).toBe(true);
	});

	it('run in both directions', () => {
		const on = diff({}, { broker: true });
		const off = diff({ broker: true }, {});
		expect(off.removedSteps).toEqual(on.addedSteps);
		expect(off.addedSteps).toEqual(on.removedSteps);
	});
});

describe('presets', () => {
	it.each(base.presets.map((preset) => [preset.id, preset] as const))(
		'%s is valid',
		(_, preset) => {
			const settings = { ...defaultSettings, ...preset.settings };
			expect(allValidSettings()).toContainEqual(settings);
		}
	);
});

describe('with a server behind the page', () => {
	const { settings } = change(defaultSettings, 'appRuns', 'bff');
	const held = () => holdingsAt(evaluate(flow, settings), 'page-gets-answer');

	it('keeps the tokens at the server, and the browser only gets a cookie', () => {
		expect(held().app).toContain('access-token');
		expect(held().app).toContain('refresh-token');
		expect(held().browser).toContain('app-session');
		expect(held().browser).not.toContain('access-token');
		expect(held().browser).not.toContain('refresh-token');
	});

	it('brings along what it needs, so that nobody has to know it is a confidential client', () => {
		expect(settings).toMatchObject({ clientType: 'confidential', pkce: true });
	});
});
