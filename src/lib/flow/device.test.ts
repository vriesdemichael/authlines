import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutDiagram } from '#lib/diagram/layout.ts';
import { authorizationCodeBase, deviceBase as base } from '#lib/flow/index.ts';
import { evaluate, holdingsAt } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	normalize,
	settingDefs,
	settingIds,
	settingsIn
} from '#lib/flow/settings.ts';
import { parseState, stateInFlow } from '#lib/flow/state.ts';
import { deviceNoteDefs, notesFor } from '#lib/keycloak/notes.ts';
import { mapNodes } from '#lib/map/nodes.ts';
import { addressAt } from '#lib/recordings/address.ts';
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
			expect(between.map(({ id }) => id)).toEqual(['device-show-code']);
			expect(between[0].channel).toBe('people');
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
			const needs = settingDefs[id].requires;
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

	it('claims a recording for what was recorded, and not for what people did', () => {
		const known = (id: string) => knownFrom(base, stepAt(id), defaultSettings);
		expect(known('device-poll')?.kind).toBe('recorded');
		expect(known('device-code-page')?.kind).toBe('recorded');
		expect(known('device-show-code')).toBeNull();
	});
});
