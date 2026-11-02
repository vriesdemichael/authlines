import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutDiagram } from '#lib/diagram/layout.ts';
import { authorizationCodeBase, deviceBase as base } from '#lib/flow/index.ts';
import { evaluate, holdingsAt } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	type Settings,
	normalize,
	settingDefs,
	type SettingDef,
	settingIds,
	settingsIn
} from '#lib/flow/settings.ts';
import { parseState, stateInFlow } from '#lib/flow/state.ts';
import { deviceNoteDefs, notesFor } from '#lib/keycloak/notes.ts';
import { mapNodes } from '#lib/map/nodes.ts';
import { addressAt } from '#lib/recordings/address.ts';
import { traceRun } from '#lib/recordings/wire.ts';
import { leftToYou } from '#lib/flow/left-to-you.ts';
import { sayer } from '#lib/flow/wording.ts';
import { evidenceDifferences } from '#lib/recordings/check.ts';
import type { Recording } from '#lib/recordings/format.ts';
import { knownFrom, provenance, recordingFor } from '#lib/recordings/known.ts';

const FOLDER = `static/recordings/${base.id}`;
const recordings = base.presets.map((preset) => ({
	preset,
	settings: normalize({ ...defaultSettings, ...preset.settings }).settings,
	recording: JSON.parse(readFileSync(`${FOLDER}/${preset.id}.json`, 'utf8')) as Recording
}));
const { answers } = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8'));
const flow = base.diagrams.flow;
const plainRun = recordings[0];
const bodyOf = (recording: Recording, step: string) =>
	recording.messages.find((message) => message.step === step)?.body as Record<string, string>;
const stepAt = (id: string, settings = defaultSettings) =>
	evaluate(flow, settings).steps.find((step) => step.id === id)!;

describe('the device flow', () => {
	it('has nothing between the app and the browser but a person, and the same engine draws it', () => {
		for (const settings of allValidSettings(base.settings)) {
			const view = evaluate(flow, settings);
			const between = view.steps.filter(
				({ from, to }) => from !== to && [from, to].every((id) => id === 'app' || id === 'browser')
			);
			// Someone with a code to send has taken the place of the app.
			expect(between.map(({ id }) => id)).toEqual(
				settings.deviceAttack === 'sends-code' ? [] : ['device-show-code']
			);
			for (const step of between) expect(step.channel).toBe('people');
			expect(layoutDiagram(view).rows).toHaveLength(view.steps.length);
		}
	});

	it('was recorded from a real server, message by message', () => {
		for (const { recording, settings } of recordings) {
			const recorded = recording.messages.flatMap(({ step }) => step ?? []);
			const onTheWire = evaluate(flow, settings)
				.steps.filter(({ channel }) => channel === 'back' || channel === 'front')
				.map(({ id }) => id);
			expect(recorded.filter((step) => onTheWire.includes(step))).toEqual(onTheWire);
			expect(recordingFor(base, settings)?.id).toBe(recording.preset);
			expect(provenance(base, flow, settings).recorded).toBe(true);
		}
	});

	it('holds what it says about each message to the recording, in both diagrams', () => {
		for (const { recording, settings } of recordings) {
			for (const diagram of Object.values(base.diagrams)) {
				for (const step of evaluate(diagram, settings).steps) {
					const message = recording.messages.find(({ step: recorded }) => recorded === step.id);
					if (!message) continue;
					for (const { name, place } of step.fields) {
						if (place === 'header') {
							const header = name.split(':')[0].toLowerCase();
							expect(Object.keys(message.headers), `${step.id} ${name}`).toContain(header);
						}
						if (place === 'body' && name !== 'username and password') {
							const [key, value] = name.split('=');
							const body = message.body as Record<string, unknown>;
							expect(Object.keys(body), `${step.id} ${name}`).toContain(key);
							if (value) expect(body[key], `${step.id} ${name}`).toBe(value);
						}
					}
				}
			}
		}
	});

	it('leaves the browser with no token, and the app with no password, as the recording did', () => {
		const held = holdingsAt(evaluate(flow, defaultSettings), 'device-api-response');
		expect(held.browser).toEqual(expect.arrayContaining(['user-code', 'password', 'session']));
		expect(held.browser).not.toContain('device-code');
		expect(held.browser).not.toContain('access-token');
		expect(held.app).toEqual(
			expect.arrayContaining(['user-code', 'device-code', 'access-token', 'refresh-token'])
		);
		expect(held.app).not.toContain('password');
		expect(held.app).not.toContain('session');

		const inTheBrowser = plainRun.recording.messages.filter(
			({ url }) => url?.includes('/device') && !url.includes('/auth/device')
		);
		expect(JSON.stringify(inTheBrowser)).not.toContain(
			bodyOf(plainRun.recording, 'device-response').device_code
		);
	});

	it('asks with the same device code before and after, and gets a different answer', () => {
		const { recording } = plainRun;
		const before = bodyOf(recording, 'device-poll');
		expect(bodyOf(recording, 'device-poll-again')).toEqual(before);
		expect(before.device_code).toBe(bodyOf(recording, 'device-response').device_code);
		expect(bodyOf(recording, 'device-pending').error).toBe('authorization_pending');
		expect(bodyOf(recording, 'device-token-response').access_token).toBeTruthy();
		expect(bodyOf(recording, 'device-submit-code').device_user_code).toBe(
			bodyOf(recording, 'device-response').user_code
		);
	});

	it('does not say a code on a screen is harmless, or that the page that asks is enough', () => {
		expect(stepAt('device-response').concept).toContain('logged in as them');
		expect(stepAt('device-show-code').pitfall?.text).toContain('logged in as them');
		expect(stepAt('device-show-code').cites.map(({ section }) => section)).toContain('5.5');
		expect(stepAt('device-consent-page').pitfall?.text).toContain('client ID');
		const asked = answers.deviceConsent;
		expect(asked.afterAgreeingBefore.asked).toBe(true);
		expect(answers.devicePkce.askedWithNoVerifier.error).toBe('invalid_grant');
	});

	it('never says the code, which means the code of the other flow, and explains itself as that', () => {
		const said = [
			...Object.values(base.diagrams).flatMap(({ steps, intro, lifelines, parts }) => [
				intro,
				...lifelines.map(({ concept }) => concept),
				...parts.map(({ why }) => why),
				...steps
			]),
			...deviceNoteDefs,
			...mapNodes.filter((node) => node.flow === base.id)
		];
		expect(JSON.stringify(said)).not.toMatch(/\bthe code\b|one-time code|authorization code/i);
	});

	it('says what is left to the app in the app’s part of the list', () => {
		const groups = leftToYou(base, defaultSettings, sayer('plain')).groups;
		const inTheApp = groups.find(({ id }) => id === 'app')?.items.map(({ step }) => step);
		expect(inTheApp).toContain('device-show-code');
		expect(inTheApp).toContain('device-consent-page');
		const before = groups.find(({ id }) => id === 'before')?.items.map(({ step }) => step);
		expect(before).toContain('device-register');
		expect(before).not.toContain('device-show-code');
	});

	it('does not have the browser holding the password before it is sent', () => {
		const view = evaluate(flow, defaultSettings);
		expect(holdingsAt(view, 'device-show-code').browser).not.toContain('password');
		expect(holdingsAt(view, 'device-submit-credentials').browser).toContain('password');
	});

	it('follows both codes through the run, as it does the other values', () => {
		const names = traceRun(plainRun.recording).map(({ name }) => name);
		expect(names).toEqual(expect.arrayContaining(['device_code', 'user_code', 'access_token']));
	});

	it('says what a real server said about asking too fast, and about not getting there', () => {
		expect(answers.devicePolling.tooSoon).toBe('slow_down');
		expect(stepAt('device-pending').pitfall?.text).toContain('slow_down');
		expect(answers.deviceDenied.error).toBe('access_denied');
		expect(answers.deviceExpired.error).toBe('expired_token');
		const about = stepAt('device-token-response').pitfall?.text;
		expect(about).toContain('access_denied');
		expect(about).toContain('expired_token');
	});

	it('says there is no nonce to compare, because none was sent and none came back', () => {
		const oidc = recordings.find(({ preset }) => preset.id === 'on-a-device-oidc')!;
		const { id_token: idToken } = bodyOf(oidc.recording, 'device-token-response');
		const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
		expect(claims.nonce).toBeUndefined();
		expect(bodyOf(oidc.recording, 'device-request')).toEqual({
			client_id: expect.any(String),
			scope: 'openid'
		});
		const checked = stepAt('device-check-id-token', oidc.settings);
		expect(checked.concept).toContain('no nonce');
		expect(bodyOf(plainRun.recording, 'device-token-response').id_token).toBeUndefined();
		expect(evaluate(flow, defaultSettings).steps.map(({ id }) => id)).not.toContain(
			'device-check-id-token'
		);
	});

	it('shows the address a person really had, including where a redirect sent them', () => {
		const { recording } = plainRun;
		expect(addressAt(recording, 'device-open-page')).toMatch(/\/device$/);
		expect(addressAt(recording, 'device-login-page')).toContain('/login-actions/authenticate');
		expect(addressAt(recording, 'device-consent-page')).toContain('/login-actions/required-action');
		expect(addressAt(recording, 'device-done-page')).toMatch(/\/device\/status$/);
		for (const step of evaluate(flow, defaultSettings).steps) {
			if (step.page) expect(addressAt(recording, step.page.address), step.id).toBeTruthy();
		}
	});

	it('says why each setting is not here, or needs one that is not', () => {
		for (const id of settingIds) {
			if (base.settings.includes(id) || base.notHere?.[id]) continue;
			const def: SettingDef = settingDefs[id];
			if (def.onlyOn && def.onlyOn !== base.id) continue;
			const needs = def.requires;
			expect(needs, `${id} is neither here nor says why`).toBeDefined();
			expect(
				settingsIn(needs!.when).some((other) => !base.settings.includes(other)),
				id
			).toBe(true);
		}
		for (const id of base.settings) expect(base.notHere?.[id], id).toBeUndefined();
	});

	it('goes on to the other flow keeping what still applies, and starts at the start', () => {
		const code = authorizationCodeBase;
		const there = parseState(code, 'flow', 'oidc=1&pkce=1&mode=advanced&step=login-page');
		const here = stateInFlow(base, code, there);
		expect(here.settings.oidc).toBe(true);
		expect(here.settings.pkce).toBe(false);
		expect(here.mode).toBe('advanced');
		expect(here.step).toBe('device-request');
		expect(recordingFor(base, here.settings)?.id).toBe('on-a-device-oidc');
	});

	it('has each note backed by what a real server did, and where its console says', () => {
		expect(evidenceDifferences(answers, deviceNoteDefs)).toEqual([]);
		expect(notesFor(base.id, 'device-request', defaultSettings).map(({ id }) => id)).toContain(
			'device-grant'
		);
	});

	it('has a question on the map for each recording', () => {
		const used = new Set(
			mapNodes.filter((node) => node.flow === base.id).map(({ preset }) => preset)
		);
		expect(base.presets.filter(({ id }) => !used.has(id))).toEqual([]);
	});

	it('draws the two other ways it ends, each from what a real server answered', () => {
		const said = (id: string) => recordings.find(({ preset }) => preset.id === id)!;
		const no = said('on-a-device-says-no');
		expect(bodyOf(no.recording, 'device-denied-response').error).toBe('access_denied');
		expect(bodyOf(no.recording, 'device-consent-deny')).toHaveProperty('cancel');
		const noSteps = evaluate(flow, no.settings).steps.map(({ id }) => id);
		expect(noSteps).toContain('device-consent-deny');
		expect(noSteps).not.toContain('device-token-response');
		expect(noSteps).not.toContain('device-api-request');
		expect(noSteps.at(-1)).toBe('device-denied-response');
		expect(holdingsAt(evaluate(flow, no.settings), 'device-denied-response').app).not.toContain(
			'access-token'
		);

		const late = said('on-a-device-runs-out');
		expect(bodyOf(late.recording, 'device-response').expires_in).toBe(2);
		expect(bodyOf(late.recording, 'device-expired-response').error).toBe('expired_token');
		const lateSteps = evaluate(flow, late.settings).steps.map(({ id }) => id);
		expect(lateSteps).not.toContain('device-open-page');
		expect(lateSteps).toContain('device-time-passes');
		expect(lateSteps.at(-1)).toBe('device-expired-response');
	});

	describe('with someone sending the user a code of theirs', () => {
		const at = (deviceEnds: Settings['deviceEnds']) =>
			evaluate(flow, { ...defaultSettings, deviceAttack: 'sends-code', deviceEnds });
		const recorded = (id: string) => recordings.find(({ preset }) => preset.id === id)!.recording;

		it('takes the app off the diagram, and they do what it did', () => {
			const view = at('agrees');
			expect(view.lifelines.map(({ id }) => id)).not.toContain('app');
			expect(view.lifelines.map(({ id }) => id)).toContain('attacker');
			expect(holdingsAt(view, 'sent-token-response').attacker).toContain('access-token');
			expect(holdingsAt(view, 'sent-token-response').browser).not.toContain('access-token');
		});

		it('gets what the user decides, on the same step of the story', () => {
			expect(bodyOf(recorded('on-a-device-sent'), 'sent-token-response').access_token).toBeTruthy();
			expect(bodyOf(recorded('on-a-device-sent-says-no'), 'sent-denied-response').error).toBe(
				'access_denied'
			);
			expect(bodyOf(recorded('on-a-device-sent-runs-out'), 'sent-expired-response').error).toBe(
				'expired_token'
			);
			expect(at('says-no').steps.map(({ id }) => id)).not.toContain('sent-api-request');
		});

		it('says who stops it', () => {
			const view = at('agrees');
			const answer = view.steps.find(({ id }) => id === 'sent-token-response')!;
			expect(answer.inPractice).toMatch(/Your app cannot stop this/);
			expect(answer.inPractice).toMatch(/Only the user can/);
		});
	});

	describe('with someone reading the code off the screen', () => {
		const view = evaluate(flow, { ...defaultSettings, deviceAttack: 'reads-code' });
		const recording = recordings.find(({ preset }) => preset.id === 'on-a-device-read')!.recording;

		it('tells the user the code is not valid', () => {
			// The recording run only goes on once the page says so, and a code that worked gets a 302.
			const refused = recording.messages.find(({ step }) => step === 'read-code-refused')!;
			expect(refused.status).toBe(200);
		});

		it('leaves the app with tokens for the account that got there first', () => {
			const token = String(bodyOf(recording, 'device-token-response').access_token);
			const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
			expect(claims.preferred_username).toBe('someone-else');
		});

		it('gives them no token', () => {
			const held = holdingsAt(view, view.steps.at(-1)!.id).attacker;
			expect(held).not.toContain('access-token');
			expect(held).toContain('user-code');
		});

		it('cannot end any other way', () => {
			expect(
				allValidSettings(base.settings).filter(
					(settings) => settings.deviceAttack === 'reads-code' && settings.deviceEnds !== 'agrees'
				)
			).toEqual([]);
		});
	});

	it('says on an arrow what the server said, and not something else', () => {
		for (const { recording, settings } of recordings) {
			for (const step of evaluate(flow, settings).steps) {
				const said = /^(\d{3})(?: (\w+_\w+))?/.exec(step.label);
				if (!said) continue;
				const message = recording.messages.find(({ step: id }) => id === step.id);
				expect(message?.status, step.id).toBe(Number(said[1]));
				if (said[2]) expect(bodyOf(recording, step.id).error, step.id).toBe(said[2]);
			}
		}
	});

	it('has no part for what did not happen', () => {
		const partsWhen = (deviceEnds: Settings['deviceEnds']) =>
			evaluate(flow, { ...defaultSettings, deviceEnds }).parts.map(({ label }) => label);
		expect(partsWhen('agrees')).toEqual(['Ask', 'Wait', 'Log in', 'Collect', 'Use']);
		expect(partsWhen('says-no')).toEqual(['Ask', 'Wait', 'Log in', 'Collect']);
		expect(partsWhen('runs-out')).toEqual(['Ask', 'Wait', 'Collect']);
		const theirs = (settings: Partial<Settings>) =>
			evaluate(flow, { ...defaultSettings, ...settings }).parts.map(({ label }) => label);
		expect(theirs({ deviceAttack: 'sends-code' })).toEqual([
			'Start',
			'Wait',
			'Log in',
			'Collect',
			'Use'
		]);
		expect(theirs({ deviceAttack: 'reads-code' })).toEqual([
			'Ask',
			'Wait',
			'Get there first',
			'Log in',
			'Collect',
			'Use'
		]);
	});

	it('offers how it ends in advanced mode only, and on this flow only', () => {
		expect(settingDefs.deviceEnds.simple).toBeUndefined();
		expect(settingDefs.deviceEnds.onlyOn).toBe(base.id);
		expect(authorizationCodeBase.settings).not.toContain('deviceEnds');
	});

	it('claims a recording for what was recorded, and not for what people did', () => {
		const known = (id: string) => knownFrom(base, stepAt(id), defaultSettings);
		expect(known('device-poll')?.kind).toBe('recorded');
		expect(known('device-code-page')?.kind).toBe('recorded');
		expect(known('device-show-code')).toBeNull();
	});
});
