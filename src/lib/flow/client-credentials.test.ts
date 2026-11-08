import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutDiagram } from '#lib/diagram/layout.ts';
import { authorizationCodeBase, clientCredentialsBase as base } from '#lib/flow/index.ts';
import { evaluate, holdingsAt } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	normalize,
	settingDefs,
	type SettingDef,
	settingIds,
	settingsIn
} from '#lib/flow/settings.ts';
import { parseState, serializeState, stateInFlow } from '#lib/flow/state.ts';
import { notesFor } from '#lib/keycloak/notes.ts';
import type { Recording } from '#lib/recordings/format.ts';
import { knownFrom, provenance, recordingFor } from '#lib/recordings/known.ts';

const FOLDER = `static/recordings/${base.id}`;
const recordings = base.presets.map((preset) => ({
	preset,
	settings: normalize({ ...defaultSettings, ...preset.settings }).settings,
	recording: JSON.parse(readFileSync(`${FOLDER}/${preset.id}.json`, 'utf8')) as Recording
}));
const flow = base.diagrams.flow;
const bodyOf = (recording: Recording, step: string) =>
	recording.messages.find((message) => message.step === step)?.body as Record<string, unknown>;

describe('the client credentials flow', () => {
	it('has no browser and no user on it, and the same engine draws it', () => {
		for (const diagram of Object.values(base.diagrams)) {
			for (const settings of allValidSettings(base.settings)) {
				const view = evaluate(diagram, settings);
				expect(view.lifelines.map(({ id }) => id)).not.toContain('browser');
				expect(view.steps.map(({ channel }) => channel)).not.toContain('front');
				expect(layoutDiagram(view).rows).toHaveLength(view.steps.length);
			}
		}
	});

	it('was recorded from a real server, message by message', () => {
		for (const { recording, settings } of recordings) {
			const recorded = recording.messages.flatMap(({ step }) => step ?? []);
			const inFlow = evaluate(flow, settings)
				.steps.filter(({ channel }) => channel === 'back')
				.map(({ id }) => id);
			const asDrawn = recorded.filter((step) => inFlow.includes(step));
			expect(asDrawn).toEqual(inFlow);
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
						if (place === 'body') {
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

	it('does not say the answer is about a user, and neither does what comes back', () => {
		for (const { recording } of recordings) {
			const answer = recording.messages.find(({ step }) => step === 'service-api-response');
			// An app that gives a user a role calls the admin API about one, and no API of its own (#183).
			if (!answer) continue;
			expect(JSON.stringify(answer.body)).not.toMatch(/\buser\b/);
		}
	});

	it('says only what a real server gave: an access token, and nothing else', () => {
		for (const { recording } of recordings) {
			const answer = bodyOf(recording, 'service-token-response');
			expect(answer.access_token).toBeTruthy();
			expect(answer.refresh_token).toBeUndefined();
			expect(answer.id_token).toBeUndefined();
			expect(bodyOf(recording, 'service-token-request')).toEqual({
				grant_type: 'client_credentials'
			});
		}
		const said = evaluate(flow, defaultSettings).steps.find(
			({ id }) => id === 'service-token-response'
		);
		expect(said?.concept).toContain('no refresh token');
		expect(said?.fields.map(({ name }) => name)).not.toContain('refresh_token');
	});

	it('ties the token to a key when DPoP is on, as the server did', () => {
		const { recording } = recordings.find(({ preset }) => preset.id === 'as-itself-dpop')!;
		expect(bodyOf(recording, 'service-token-response').token_type).toBe('DPoP');
		const steps = evaluate(flow, { ...defaultSettings, binding: 'dpop' }).steps;
		expect(steps[0].id).toBe('service-make-key');
	});

	it('holds a secret from the start, and nobody sees it who does not have it', () => {
		const held = holdingsAt(evaluate(flow, defaultSettings), 'service-token-request');
		expect(held.app).toContain('secret');
		expect(held.idp).toContain('secret');
		expect(held.api).not.toContain('secret');
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

	it('goes on to the other flow keeping what still applies, and has the rest when it is back', () => {
		const code = authorizationCodeBase;
		const there = parseState(code, 'flow', 'oidc=1&binding=dpop&mode=advanced&say=specs');
		const here = stateInFlow(base, code, there);
		expect(here.flow).toBe(base.id);
		expect(here.settings.binding).toBe('dpop');
		expect(here.settings.oidc).toBe(false);
		expect(here.mode).toBe('advanced');
		expect(here.wording).toBe('specs');
		expect(here.step).toBe('service-make-key');
		expect(serializeState(base, here)).not.toContain('oidc');

		const back = stateInFlow(
			code,
			base,
			{ ...here, settings: { ...here.settings, binding: 'bearer' } },
			there.settings
		);
		expect(back.settings.oidc).toBe(true);
		expect(back.settings.binding).toBe('bearer');
		expect(back.step).toBe('open-app');
	});

	it('starts another flow at the start, whatever step this one was on', () => {
		const there = parseState(
			authorizationCodeBase,
			'flow',
			'step=login-page&eyes=browser&follow=code'
		);
		const here = stateInFlow(base, authorizationCodeBase, there);
		expect(here.step).toBe('service-token-request');
		expect(here.eyes).toBeNull();
		expect(here.follow).toBeNull();
		expect(here.explained).toBeNull();
		expect(here.source).toBeNull();
	});

	it('has what a server does about it, as notes that a real server backed', () => {
		const answers = JSON.parse(readFileSync(`${FOLDER}/questions.json`, 'utf8')).answers;
		const notes = notesFor(base.id, 'service-token-request', defaultSettings);
		expect(notes.map(({ id }) => id)).toContain('service-accounts');
		expect(answers.serviceAccountsOff.before.status).toBe(200);
		expect(answers.serviceAccountsOff.after.status).toBe(401);
		expect(answers.serviceAccountsOff.after.error).toBe('unauthorized_client');
		expect(answers.refreshForClientCredentials.before.gotRefreshToken).toBe(false);
		expect(answers.refreshForClientCredentials.after.gotRefreshToken).toBe(true);
		expect(answers.serviceAccountsOff.name).toBe('service-account-demo-service');
		expect(answers.idTokenWhenAsked).toEqual({ withoutAsking: false, askedForOpenId: true });
		const saidAbout = notesFor(base.id, 'service-token-response', defaultSettings);
		expect(saidAbout.map(({ id }) => id)).toContain('id-token-for-client-credentials');
		const said = evaluate(flow, defaultSettings).steps.find(
			({ id }) => id === 'service-token-response'
		);
		expect(said?.concept).toContain('nothing asked for one');
		const looked = answers.console as Record<string, { missing: string[] }>;
		for (const note of ['service-accounts', 'refresh-for-client-credentials']) {
			expect(looked[note].missing, note).toEqual([]);
		}
	});

	it('does not claim to be recorded because a step has the same id as one that was', () => {
		const inFlow = evaluate(flow, defaultSettings).steps;
		const step = inFlow.find(({ id }) => id === 'service-token-request')!;
		expect(knownFrom(base, step, defaultSettings)?.kind).toBe('recorded');
	});
});
