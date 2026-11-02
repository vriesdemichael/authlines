import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutDiagram } from '#lib/diagram/layout.ts';
import { authorizationCode as flow } from '#lib/flow/authorization-code.ts';
import { evaluate } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import type { Recording } from '#lib/recordings/format.ts';

const recording = (id: string) =>
	JSON.parse(readFileSync(`static/recordings/authorization-code/${id}.json`, 'utf8')) as Recording;
const settings = (more: Partial<Settings>) =>
	normalize({ ...defaultSettings, attacker: true, attackerUses: 'real-app', ...more }).settings;
const step = (more: Partial<Settings>, id: string) =>
	evaluate(flow, settings(more)).steps.find((candidate) => candidate.id === id);
const answer = (id: string, step: string) =>
	recording(id).messages.find((message) => message.step === step);

describe('a stolen code handed to the real app', () => {
	it('is what a real server answers, with no PKCE: the tokens, for the app, with its secret', () => {
		const sent = answer('attack-at-the-app', 'handed-token-request');
		expect(sent?.headers.authorization).toMatch(/^Basic /);
		const got = answer('attack-at-the-app', 'handed-token-response');
		expect(got?.status).toBe(200);
		expect((got?.body as { access_token: string }).access_token).toBeTruthy();
		expect(answer('attack-at-the-app', 'attacker-handed-answer')?.status).toBe(200);

		expect(step({}, 'handed-token-response')?.label).toBe('200 with tokens');
		expect(step({}, 'attacker-handed-answer')?.plain).toContain('logged in as the real user');
	});

	it('is refused by a real server with PKCE, on the same arrow', () => {
		const got = answer('attack-at-the-app-pkce', 'handed-token-response');
		expect(got?.status).toBe(400);
		expect((got?.body as { error_description: string }).error_description).toContain('PKCE');
		expect(answer('attack-at-the-app-pkce', 'attacker-handed-answer')?.status).toBe(400);

		expect(step({ pkce: true }, 'handed-token-response')?.label).toBe('400 invalid_grant');
		expect(step({ pkce: true }, 'handed-token-response')?.plain).toContain('Refused');
		expect(step({ pkce: true }, 'attacker-handed-answer')?.plain).toBe('The login fails');
	});

	it('gets the tokens from a real server with a nonce, and is stopped by the app', () => {
		expect(answer('attack-at-the-app-oidc', 'handed-token-response')?.status).toBe(200);
		expect(answer('attack-at-the-app-oidc', 'attacker-handed-answer')?.status).toBe(400);

		expect(step({ oidc: true }, 'handed-token-response')?.label).toBe('200 with tokens');
		expect(step({ oidc: true }, 'handed-nonce-check')).toBeDefined();
		expect(step({ oidc: true }, 'attacker-handed-answer')?.plain).toBe('The app refuses');
		expect(step({ oidc: true, pkce: true }, 'handed-nonce-check')).toBeUndefined();
	});

	it('uses their own state, which matches, and the real user’s code', () => {
		const handed = new URL(answer('attack-at-the-app', 'attacker-hands-code')?.url ?? '');
		const theirs = new URL(
			answer('attack-at-the-app', 'attacker-sent-to-login')?.headers.location ?? ''
		);
		const real = new URL(answer('attack-at-the-app', 'callback')?.url ?? '');
		expect(handed.searchParams.get('state')).toBe(theirs.searchParams.get('state'));
		expect(handed.searchParams.get('state')).not.toBe(real.searchParams.get('state'));
		expect(handed.searchParams.get('code')).toBe(real.searchParams.get('code'));
	});

	it('uses a verifier that is theirs, and a nonce that is theirs', () => {
		const theirChallenge = new URL(
			answer('attack-at-the-app-pkce', 'attacker-sent-to-login')?.headers.location ?? ''
		).searchParams.get('code_challenge');
		const realChallenge = new URL(
			answer('attack-at-the-app-pkce', 'authorize')?.url ?? ''
		).searchParams.get('code_challenge');
		expect(theirChallenge).toBeTruthy();
		expect(theirChallenge).not.toBe(realChallenge);
	});

	it('leaves the real user with nothing, in all three, as a real server does', () => {
		for (const id of ['attack-at-the-app', 'attack-at-the-app-pkce', 'attack-at-the-app-oidc']) {
			expect(answer(id, 'real-app-refused')?.status, id).toBe(400);
		}
		for (const more of [{}, { pkce: true }, { oidc: true }]) {
			const ids = evaluate(flow, settings(more)).steps.map(({ id }) => id);
			expect(ids).toContain('real-app-refused');
			expect(ids).not.toContain('api-request');
		}
	});

	it('takes a different path from trading it themselves, on the same diagram', () => {
		const ids = (uses: Settings['attackerUses']) =>
			evaluate(flow, settings({ attackerUses: uses })).steps.map(({ id }) => id);
		expect(ids('real-app')).not.toContain('attacker-token-request');
		expect(ids('themselves')).toContain('attacker-token-request');
		expect(ids('themselves')).not.toContain('attacker-hands-code');
		expect(ids('themselves')).toContain('api-request');
	});

	it('only exists where there is a secret to get around, and someone to do it', () => {
		for (const candidate of allValidSettings()) {
			if (candidate.attackerUses !== 'real-app') continue;
			expect(candidate.attacker).toBe(true);
			expect(candidate.clientType).toBe('confidential');
		}
		const noSecret = normalize({ ...defaultSettings, attacker: true, clientType: 'public' });
		expect(
			normalize({ ...noSecret.settings, attackerUses: 'real-app' }).settings.attackerUses
		).toBe('themselves');
	});

	it('draws on the arrow what the refusal is about, without saying it is the real one', () => {
		const sent = step({ pkce: true }, 'handed-token-request');
		const verifier = sent?.fields.find(({ name }) => name === 'code_verifier');
		expect(verifier?.chip).toBe('their verifier');
		expect(verifier?.artifact).toBeUndefined();
		const started = step({ pkce: true }, 'attacker-sent-to-login');
		expect(started?.fields.find(({ name }) => name === 'code_challenge')?.chip).toBe(
			'their challenge'
		);
		const layout = layoutDiagram(evaluate(flow, settings({ pkce: true })), 'simple');
		const chips = layout.chips.filter((chip) => chip.step === 'handed-token-request');
		expect(chips.map(({ text }) => text)).toContain('their verifier');
	});

	it('goes through a browser, theirs, which is what the arrows say', () => {
		for (const id of ['attacker-opens-app', 'attacker-sent-to-login', 'attacker-hands-code']) {
			expect(step({}, id)?.channel, id).toBe('front');
		}
		expect(step({}, 'handed-token-request')?.channel).toBe('back');
	});
});
