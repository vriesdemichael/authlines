import { describe, expect, it } from 'vitest';
import {
	allValidSettings,
	change,
	defaultSettings,
	holds,
	is,
	not,
	normalize,
	settingDefs,
	settingIds,
	settingsIn,
	codeFlowSettingIds,
	simpleSettingIds,
	unavailable,
	all,
	any
} from '#lib/flow/settings.ts';

describe('conditions', () => {
	it('evaluate against the settings', () => {
		const oidcAndDpop = all(is('oidc', true), is('binding', 'dpop'));
		expect(holds(oidcAndDpop, defaultSettings)).toBe(false);
		expect(holds(oidcAndDpop, { ...defaultSettings, oidc: true, binding: 'dpop' })).toBe(true);
		expect(holds(not(is('oidc', true)), defaultSettings)).toBe(true);
		expect(holds(any(is('oidc', true), is('broker', false)), defaultSettings)).toBe(true);
	});

	it('name the settings they depend on', () => {
		expect(settingsIn(all(is('oidc', true), not(is('binding', 'dpop'))))).toEqual([
			'oidc',
			'binding'
		]);
	});
});

describe('what a setting says for itself', () => {
	it('is the problem it solves, for every setting', () => {
		for (const id of settingIds) expect(settingDefs[id].why.length, id).toBeGreaterThan(40);
	});

	it('is in plain words for the few simple mode offers', () => {
		expect(simpleSettingIds.filter((id) => codeFlowSettingIds.includes(id))).toEqual([
			'oidc',
			'consent',
			'pkce',
			'attacker',
			'broker',
			'appRuns'
		]);
		for (const id of simpleSettingIds) {
			expect(settingDefs[id].simple?.label).not.toBe(settingDefs[id].label);
		}
	});
});

describe('constraints', () => {
	it('allow exactly the expected combinations', () => {
		// oidc (2) x pkce (2) x token type x client and upstream tokens. Confidential has no broker, broker, V1
		// and V2. Public has no V2, and neither does DPoP, because Keycloak refused its token. With V2,
		// an API can read it or be refused, which an app with no secret can have as well (#180).
		const bearer = 4 + 3 + 2 + 2;
		const dpop = 3 + 3;
		const dpopWithNonce = 3 + 3;
		const withAttacker = 2 * 2 * 2; // oidc x pkce x client, and only Bearer with no other provider.
		// Only where there is a secret to get around, so oidc x pkce.
		const handedToTheApp = 2 * 2;
		const withConsent = 2;
		// It stops before the rest would matter, so OpenID Connect x client x PKCE.
		const withAddressRefused = 2 * 2 * 2;
		// With no secret, in the plain case, so OpenID Connect x PKCE.
		const inThePage = 2 * 2;
		// On the plain flow only, so client type and PKCE, with each way an API can say no.
		const withApiAnswers = 2 * 2 * 5;
		// With OpenID Connect and consent, and two answers to using one twice. With another provider, only
		// the one recorded there, that it keeps working (#186).
		const withRefresh = 2 * 2 * 2 * 2 * (2 + 1);
		// The second app has its own client, so the first one's type and PKCE do not get in the way.
		// What it asks for is part of OpenID Connect, so with that off it just goes by the session.
		// With another provider it goes by the session, with OpenID Connect or not (#186).
		const withASecondApp = 2 * 2 * (1 + 3) + 2 * 2 * 2;
		// With OpenID Connect, on the plain flow, and with or without a second app to tell.
		// Each keeping a refresh token or an offline token (#184).
		const withLogout = 2 * 2 * 2 * 2;
		// On its own, because nothing else here means anything without an identity provider.
		const theOldWay = 1;
		// Each brings a different client. A document can have OpenID Connect and another provider (#186).
		const howItRegisters = 1 + 2 * 2;
		const inADirectory = 1;
		const withAServerBehindThePage = 1;
		// Through another provider in the plain case: what their provider speaks, and whether they leave.
		const eachCustomerHasAProvider = 2 * 2;
		// With DPoP in the plain case, at an API that checks the proof or knows only Bearer.
		const aStolenToken = 2;
		// A login link of theirs, in the plain case: OpenID Connect, the client type, PKCE, and what the
		// app registered.
		const aLinkOfTheirs = 2 * 2 * 2 * 2;
		// The request pushed first: OpenID Connect, consent, the client type and PKCE, with nothing else.
		const pushedFirst = 2 * 2 * 2 * 2;
		// An API that trades the token: the same four, with or without a refresh token from it (#185). With
		// another provider, only without one, as recorded (#186).
		const exchanged = 2 * 2 * 2 * 2 * (2 + 1);
		// Linking another account, only on the plain flow with a secret, linked or cancelled (#179).
		const linking = 2;
		expect(allValidSettings()).toBe(allValidSettings());
		expect(Object.isFrozen(allValidSettings())).toBe(true);
		expect(allValidSettings().every((settings) => Object.isFrozen(settings))).toBe(true);
		expect(allValidSettings()).toHaveLength(
			withConsent * (2 * 2 * (bearer + dpop + dpopWithNonce) + withAttacker + handedToTheApp) +
				withAddressRefused +
				inThePage +
				withApiAnswers +
				withRefresh +
				withASecondApp +
				withLogout +
				theOldWay +
				howItRegisters +
				inADirectory +
				withAServerBehindThePage +
				eachCustomerHasAProvider +
				aStolenToken +
				aLinkOfTheirs +
				pushedFirst +
				exchanged +
				linking
		);
	});

	it('include the defaults', () => {
		expect(normalize(defaultSettings).resets).toEqual([]);
	});

	it('say why an option is unavailable', () => {
		const publicClient = { ...defaultSettings, clientType: 'public', broker: true } as const;
		expect(unavailable('upstreamTokens', 'v2', publicClient)?.because).toMatch(/confidential/);
		expect(unavailable('upstreamTokens', 'v1', publicClient)).toBeNull();
		expect(unavailable('upstreamTokens', 'v1', defaultSettings)?.because).toMatch(/another IdP/);
		expect(unavailable('dpopNonce', true, defaultSettings)?.because).toMatch(/DPoP/);
	});

	it('reject invalid combinations and fall back to a valid one', () => {
		const invalid = { ...defaultSettings, dpopNonce: true, upstreamTokens: 'v1' } as const;
		const { settings, resets } = normalize(invalid);
		expect(settings).toEqual(defaultSettings);
		expect(resets.map((reset) => reset.setting)).toEqual(['dpopNonce', 'upstreamTokens']);
	});

	it('are stable: normalizing twice changes nothing', () => {
		for (const settings of allValidSettings()) {
			expect(normalize(normalize(settings).settings).settings).toEqual(settings);
		}
	});

	it('flips between another provider and a directory, because they are two answers to one question', () => {
		const brokered = { ...defaultSettings, broker: true };
		const toDirectory = change(brokered, 'federation', true);
		expect(toDirectory.settings).toMatchObject({ broker: false, federation: true });
		const back = change(toDirectory.settings, 'broker', true);
		expect(back.settings).toMatchObject({ broker: true, federation: false });
		// An address can say both, and then it is one of them.
		expect(normalize({ ...brokered, federation: true }).settings.federation).toBe(false);
	});

	it('cascade when a change takes away what another setting needs', () => {
		const start = { ...defaultSettings, broker: true, upstreamTokens: 'v2' } as const;
		const toPublic = change(start, 'clientType', 'public');
		expect(toPublic.settings.upstreamTokens).toBe('off');
		expect(toPublic.settings.broker).toBe(true);
		expect(toPublic.resets[0].because).toMatch(/confidential/);

		const brokerOff = change({ ...start, upstreamTokens: 'v1' }, 'broker', false);
		expect(brokerOff.settings.upstreamTokens).toBe('off');
	});
});
