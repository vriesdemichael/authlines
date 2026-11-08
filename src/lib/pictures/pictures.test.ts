import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { explanationOf } from '#lib/flow/explain.ts';
import { terms } from '#lib/flow/glossary.ts';
import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import {
	allValidSettings,
	defaultSettings,
	normalize,
	settingDefs,
	type Settings
} from '#lib/flow/settings.ts';
import { parseState, type AppState } from '#lib/flow/state.ts';
import { artifacts } from '#lib/flow/vocabulary.ts';
import { sayer, wordings } from '#lib/flow/wording.ts';
import { landingSettings } from '#lib/pictures/build.ts';
import { LIFETIMES } from '#lib/pictures/how-long-each-lasts.ts';
import { PICTURE_OF, pictureFor, type Opens } from '#lib/pictures/index.ts';
import { noteDefs } from '#lib/keycloak/notes.ts';
import { SIZE, widthOf, type Picture, type PicturePart } from '#lib/pictures/model.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';
import { inSimpleMode } from '#lib/pictures/simple.ts';
import { SCOPES_RECORDED } from '#lib/pictures/what-each-scope-asks-for.ts';
import { CLAIM_ROWS, RECORDED } from '#lib/pictures/what-a-token-says.ts';
import { ASKING } from '#lib/pictures/the-app-keeps-asking.ts';
import oidc from '../../../static/recordings/authorization-code/oidc.json';
import onADevice from '../../../static/recordings/device/on-a-device.json';
import asItself from '../../../static/recordings/client-credentials/as-itself.json';
import deviceQuestions from '../../../static/recordings/device/questions.json';

const base = flows['authorization-code'];
const stateFor = (search: string): AppState => parseState(base, 'flow', search);

/** One thing that each picture explains, to draw it from. */
const ONE_OF_EACH = [...new Map(Object.entries(PICTURE_OF).map(([key, id]) => [id, key])).values()];

/**
 * Each different picture the settings can give, in each kind of words and each mode, as an
 * explanation has it.
 */
function everyPicture(): Picture[] {
	const seen = new Map<string, Picture>();
	for (const settings of allValidSettings()) {
		for (const wording of wordings) {
			for (const explain of ONE_OF_EACH) {
				for (const mode of ['advanced', 'simple']) {
					const state = { ...stateFor(`explain=${explain}&say=${wording}&mode=${mode}`), settings };
					const picture = pictureFor(state, wording);
					if (picture) seen.set(JSON.stringify(picture), picture);
				}
			}
		}
	}
	// The other flows, whose pictures are about their own steps, or which flow fits.
	for (const other of [flows.device, flows['client-credentials']]) {
		for (const settings of allValidSettings(other.settings)) {
			for (const wording of wordings) {
				for (const explain of ONE_OF_EACH) {
					for (const mode of ['advanced', 'simple']) {
						const search = `explain=${explain}&say=${wording}&mode=${mode}`;
						const state = { ...parseState(other, 'flow', search), settings };
						const picture = pictureFor(state, wording);
						if (picture) seen.set(JSON.stringify(picture), picture);
					}
				}
			}
		}
	}
	return [...seen.values()];
}

const pictures = everyPicture();
const box = (part: PicturePart) => ({
	left: part.x - part.w / 2,
	right: part.x + part.w / 2,
	top: part.y - part.h / 2,
	bottom: part.y + part.h / 2
});
// A zone holds parts, and the bars of one row lie on each other, so neither keeps apart.
const container = (part: PicturePart) => part.shape === 'zone';
const sameRowBars = (a: PicturePart, b: PicturePart) =>
	a.shape === 'bar' && b.shape === 'bar' && a.id.split('.')[0] === b.id.split('.')[0];

describe('a picture', () => {
	it('exists for every picture an explanation can have', () => {
		const ids = new Set(pictures.map((picture) => picture.id));
		for (const id of new Set(Object.values(PICTURE_OF))) expect(ids, id).toContain(id);
	});

	it('is in explanations of things that can be explained', () => {
		const flowLines = evaluate(
			base.diagrams.flow,
			normalize({ ...defaultSettings, broker: true }).settings
		).lifelines.map((line) => line.id);
		const directory = evaluate(
			base.diagrams.flow,
			normalize({ ...defaultSettings, federation: true }).settings
		).lifelines.map((line) => line.id);
		for (const key of Object.keys(PICTURE_OF)) {
			const [kind, id] = key.split('.');
			if (kind === 'term') expect(Object.keys(terms), key).toContain(id);
			if (kind === 'setting') expect(Object.keys(settingDefs), key).toContain(id);
			if (kind === 'artifact') expect(Object.keys(artifacts), key).toContain(id);
			if (kind === 'lifeline') expect([...flowLines, ...directory], key).toContain(id);
		}
	});

	it('keeps every part inside it, and apart from the others', () => {
		for (const picture of pictures) {
			for (const part of picture.parts) {
				const b = box(part);
				expect(b.left, `${picture.id}: ${part.id}`).toBeGreaterThanOrEqual(0);
				expect(b.top, `${picture.id}: ${part.id}`).toBeGreaterThanOrEqual(0);
				expect(b.right, `${picture.id}: ${part.id}`).toBeLessThanOrEqual(picture.width);
				expect(b.bottom, `${picture.id}: ${part.id}`).toBeLessThanOrEqual(picture.height);
				if (container(part)) continue;
				for (const other of picture.parts) {
					if (other === part || container(other) || sameRowBars(part, other)) continue;
					const o = box(other);
					const apart =
						b.right <= o.left || o.right <= b.left || b.bottom <= o.top || o.bottom <= b.top;
					expect(apart, `${picture.id}: ${part.id} and ${other.id}`).toBe(true);
				}
			}
		}
	});

	it('keeps what a zone holds inside it', () => {
		for (const picture of pictures) {
			for (const zone of picture.parts.filter(container)) {
				const z = box(zone);
				const prefix = zone.id.split('.')[0];
				for (const part of picture.parts.filter(
					(candidate) => !container(candidate) && candidate.id.startsWith(`${prefix}.`)
				)) {
					const b = box(part);
					const inside =
						b.left >= z.left && b.right <= z.right && b.top >= z.top && b.bottom <= z.bottom;
					const outside =
						b.bottom <= z.top || b.top >= z.bottom || b.right <= z.left || b.left >= z.right;
					expect(inside || outside, `${picture.id}: ${part.id} across ${zone.id}`).toBe(true);
				}
			}
		}
	});

	it('has words that fit in what they are in', () => {
		for (const picture of pictures) {
			for (const part of picture.parts) {
				const name = `${picture.id}: ${part.id}`;
				if (part.shape === 'party') {
					// A party's words start at its left, and each line was broken to fit.
					const room = part.w - 28;
					for (const line of part.title ?? [])
						expect(widthOf(line, SIZE.title, true), `${name}: ${line}`).toBeLessThanOrEqual(room);
					for (const line of part.says)
						expect(widthOf(line, SIZE.more), `${name}: ${line}`).toBeLessThanOrEqual(room);
					for (const row of part.rows ?? []) {
						expect(widthOf(row.says, SIZE.row), `${name}: ${row.says}`).toBeLessThanOrEqual(
							part.w - 44
						);
						expect(widthOf(row.more, SIZE.rowMore), `${name}: ${row.more}`).toBeLessThanOrEqual(
							part.w - 44
						);
					}
					continue;
				}
				if (part.shape === 'text') {
					const size = part.size ?? 'says';
					for (const line of part.says)
						expect(
							widthOf(line, SIZE[size], size === 'title'),
							`${name}: ${line}`
						).toBeLessThanOrEqual(part.w);
					continue;
				}
				if (part.shape === 'zone') {
					for (const line of part.title ?? [])
						expect(widthOf(line, 12), `${name}: ${line}`).toBeLessThanOrEqual(part.w - 24);
					continue;
				}
				if (part.shape === 'mark' || part.shape === 'bar') {
					// Read out, and not drawn, so it has to say something.
					expect(part.says.join(' ').length, name).toBeGreaterThan(2);
					continue;
				}
				// A diamond has room for about half its width where its words are.
				const room = part.shape === 'ask' ? part.w * 0.62 : part.w - 16;
				for (const line of part.says)
					expect(widthOf(line, SIZE.says), `${name}: ${line}`).toBeLessThanOrEqual(room);
				for (const line of part.more ?? [])
					expect(widthOf(line, SIZE.more), `${name}: ${line}`).toBeLessThanOrEqual(room);
				const lines = part.says.length * 17 + (part.more?.length ?? 0) * 15;
				expect(lines, name).toBeLessThanOrEqual(part.h);
			}
			for (const line of picture.lines) {
				if (!line.label) continue;
				for (const text of line.label.lines) {
					const width = widthOf(text, SIZE.label);
					const { anchor, x } = line.label;
					const from = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
					expect(from, `${picture.id}: ${text}`).toBeGreaterThanOrEqual(0);
					expect(from + width, `${picture.id}: ${text}`).toBeLessThanOrEqual(picture.width);
					// Words on a line between two parts stay out of both.
					for (const part of picture.parts.filter((candidate) => !container(candidate))) {
						const top = line.label.y - 10;
						const corners = [from, from + width].flatMap((cx) =>
							[top, line.label!.y].map((cy) => [cx, cy] as const)
						);
						const b = box(part);
						const on =
							part.shape === 'ask'
								? corners.some(
										([cx, cy]) =>
											Math.abs(cx - part.x) / (part.w / 2) + Math.abs(cy - part.y) / (part.h / 2) <
											1
									)
								: from < b.right && b.left < from + width && line.label.y > b.top && top < b.bottom;
						expect(on, `${picture.id}: "${text}" on ${part.id}`).toBe(false);
					}
				}
			}
		}
	});

	// From any part of it, one click goes to the steps behind it (#167).
	it('opens, from every part and row that goes somewhere, a step a recording draws', () => {
		let checked = 0;
		for (const picture of pictures) {
			const opening = picture.parts.flatMap((part) => [
				...(part.opens ? [{ id: part.id, opens: part.opens }] : []),
				...(part.rows ?? []).map((row) => ({ id: `${part.id}.${row.id}`, opens: row.opens }))
			]);
			for (const { id, opens } of opening) {
				const flow = flows[opens.flow ?? 'authorization-code'];
				const preset = flow.presets.find((candidate) => candidate.id === opens.preset);
				expect(preset, `${picture.id}: ${id}: ${opens.preset}`).toBeDefined();
				const settings = normalize({ ...defaultSettings, ...preset!.settings }).settings;
				const steps = evaluate(flow.diagrams[opens.diagram], settings).steps.map((step) => step.id);
				expect(steps, `${picture.id}: ${id} with ${opens.preset}`).toContain(opens.step);
				// What it adds to the settings on screen is what the preset has, so the two agree.
				for (const [setting, value] of Object.entries(opens.settings)) {
					expect(settings[setting as keyof Settings], `${picture.id}: ${id}: ${setting}`).toBe(
						value
					);
				}
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(100);
	});

	// A review found cells opening on the opposite of what they said, because the settings on screen
	// changed the outcome. From every screen, a link lands where its step is drawn as recorded.
	it('lands, from every screen, on its step as the recording draws it', () => {
		const flow = (opens: { diagram: 'flow' | 'setup' }) => base.diagrams[opens.diagram];
		const drawn = (opens: Opens, settings: Settings) =>
			evaluate(flow(opens), settings).steps.find((step) => step.id === opens.step);
		const screens = allValidSettings();
		const links = new Map<string, Opens>();
		for (const picture of pictures) {
			for (const part of picture.parts) {
				if (part.opens) links.set(JSON.stringify(part.opens), part.opens);
				for (const row of part.rows ?? []) links.set(JSON.stringify(row.opens), row.opens);
			}
		}
		let checked = 0;
		for (const opens of links.values()) {
			// Another flow is opened from where it starts, with what that flow keeps (stateInFlow).
			if (opens.flow && opens.flow !== base.id) {
				const other = flows[opens.flow];
				const landed = evaluate(
					other.diagrams[opens.diagram],
					landingSettings(opens, defaultSettings)
				).steps.find((step) => step.id === opens.step);
				expect(landed, `${opens.flow}: ${opens.step}`).toBeDefined();
				continue;
			}
			const preset = base.presets.find((candidate) => candidate.id === opens.preset)!;
			const recorded = drawn(
				opens,
				normalize({ ...defaultSettings, ...preset.settings }).settings
			)!;
			for (const screen of screens) {
				const landed = drawn(opens, landingSettings(opens, screen));
				expect(landed, `${opens.step} from ${JSON.stringify(screen)}`).toBeDefined();
				// Where the words are about how it ended, it lands on the same answer.
				if (opens.exact) expect(landed!.label).toEqual(recorded.label);
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(10000);
	});

	it('opens the answer a cell says, in what stops what', () => {
		const matrix = picture('explain=setting.pkce');
		let checked = 0;
		for (const cell of matrix.parts.filter((part) => part.shape === 'mark' && part.opens)) {
			const opens = cell.opens!;
			expect(opens.exact, cell.id).toBe(true);
			const recording = JSON.parse(
				readFileSync(`static/recordings/authorization-code/${opens.preset}.json`, 'utf8')
			) as { messages: { step: string; status?: number }[] };
			const status = recording.messages.find((message) => message.step === opens.step)?.status;
			if (cell.mark === 'full') expect(status, cell.id).toBeGreaterThanOrEqual(400);
			if (cell.mark === 'empty') expect(status, cell.id).toBeLessThan(400);
			if (cell.mark === 'full' || cell.mark === 'empty') checked++;
		}
		expect(checked).toBeGreaterThan(6);
	});

	it('is not in an explanation it does not belong to, nor on another flow', () => {
		expect(pictureFor(stateFor('explain=term.code'), 'plain')).toBeNull();
		expect(pictureFor(stateFor(''), 'plain')).toBeNull();
		const device = parseState(flows.device, 'flow', 'explain=artifact.refresh-token');
		expect(pictureFor(device, 'plain')).toBeNull();
		// Except which flow fits, which opens every flow, and is in what explains each.
		const fits = parseState(flows.device, 'flow', 'explain=term.device-flow');
		expect(pictureFor(fits, 'plain')?.id).toBe('which-flow-fits');
	});
});

describe('the refresh picture', () => {
	it('is in what explains a refresh token, and running out', () => {
		for (const search of [
			'explain=artifact.refresh-token',
			'explain=term.refresh-token',
			'explain=setting.refresh'
		]) {
			expect(pictureFor(stateFor(search), 'plain')?.id, search).toBe('refresh');
		}
	});

	it('comes with the explanation, in the words chosen', () => {
		const state = stateFor('explain=setting.refresh&say=specs');
		const view = evaluate(base.diagrams.flow, state.settings);
		const explained = explanationOf(state, view, {});
		expect(explained?.picture?.id).toBe('refresh');
		const said = explained!
			.picture!.parts.flatMap((part) => [...part.says, ...(part.more ?? [])])
			.join(' ');
		expect(said).toContain('authorization server');
		expect(said).not.toContain('identity provider');
	});

	it('says what a copy of the token is worth to an app with no secret', () => {
		const say = (settings: Partial<Settings>) =>
			refreshPicture(
				normalize({ ...defaultSettings, refresh: true, ...settings }).settings,
				sayer('plain')
			)
				.parts.find((part) => part.id === 'refreshes')!
				.more!.join(' ');
		expect(say({})).toContain('With its secret');
		expect(say({ clientType: 'public', pkce: true })).toContain('a copy of the token');
	});

	it('says a used refresh token ends things only where the site draws that', () => {
		const failed = (settings: Partial<Settings>) =>
			refreshPicture(
				normalize({ ...defaultSettings, refresh: true, ...settings }).settings,
				sayer('plain')
			)
				.lines.flatMap((line) => line.label?.lines ?? [])
				.join(' ');
		expect(failed({ reuse: 'ends' })).toContain('used twice');
		expect(failed({})).not.toContain('used twice');
	});
});

// Each in advanced mode, which draws all of it, unless the search says otherwise.
const picture = (search: string) => {
	const state = stateFor(search.includes('mode=') ? search : `${search}&mode=advanced`);
	return pictureFor(state, state.wording ?? 'plain')!;
};
const words = (found: Picture) =>
	JSON.stringify([
		found.parts.map((part) => [
			part.title,
			part.says,
			part.more,
			part.rows?.map((row) => [row.says, row.more])
		]),
		found.lines.map((line) => line.label?.lines)
	]);

describe('who knows whom', () => {
	it('is in what explains the identity provider, on either diagram', () => {
		expect(picture('explain=lifeline.idp').id).toBe('who-knows-whom');
		expect(picture('explain=term.identity-provider').id).toBe('who-knows-whom');
		const setup = parseState(base, 'setup', 'explain=lifeline.idp');
		expect(pictureFor(setup, 'plain')?.id).toBe('who-knows-whom');
	});

	it('trusts ID tokens only with OpenID Connect', () => {
		expect(words(picture('explain=lifeline.idp'))).not.toContain('trusts ID tokens');
		expect(words(picture('explain=lifeline.idp&oidc=1'))).toContain('trusts ID tokens');
	});

	const parts = (search: string) => picture(search).parts.map((part) => part.id);

	// The maintainer, 2026-11-06: the first version left the app and the API disconnected.
	it('joins the app to the API, and the user to the app', () => {
		const labels = picture('explain=lifeline.idp').lines.flatMap((line) => line.label?.lines ?? []);
		expect(labels).toContain('calls, with an access token');
		expect(labels).toContain('uses');
	});

	it('has the other provider or the directory only where the settings do', () => {
		expect(parts('explain=lifeline.idp')).toEqual(['user', 'idp', 'app', 'api']);
		expect(parts('explain=lifeline.idp&broker=1')).toContain('upstream');
		expect(parts('explain=lifeline.idp&mode=advanced&directory=1')).toContain('directory');
	});

	it("uses Keycloak's names for what a realm holds only in Keycloak's words", () => {
		expect(words(picture('explain=lifeline.idp&broker=1'))).toContain('Other providers');
		expect(words(picture('explain=lifeline.idp&broker=1'))).not.toContain('Identity providers');
		expect(words(picture('explain=lifeline.idp&broker=1&say=keycloak'))).toContain(
			'Identity providers'
		);
		expect(words(picture('explain=lifeline.idp&say=keycloak'))).toContain('Clients');
	});
});

describe('the concept pictures (#167)', () => {
	it('say how trust reaches each kind of provider, and that the app knows only one', () => {
		const trust = words(picture('explain=setting.broker'));
		// The recorder has the identity provider check another OpenID provider's ID token with its keys.
		expect(trust).not.toContain('takes its word');
		for (const said of ['ID token', 'signature', 'checks passwords', 'trusts only'])
			expect(trust).toContain(said);
	});

	it('work out who sees each token from the steps, so an app in the page shows its browser has them', () => {
		const cells = (search: string) =>
			Object.fromEntries(
				picture(search)
					.parts.filter((part) => part.shape === 'mark')
					.map((part) => [part.id, part.mark])
			);
		const server = cells('explain=term.token');
		expect(server['access-token.browser']).toBe('none');
		expect(server['access-token.idp']).toBe('full');
		expect(server['access-token.api']).toBe('empty');
		expect(server['session.app']).toBe('none');
		const page = cells('explain=term.token&client=public&pkce=1&runs=page');
		expect(page['access-token.browser']).toBe('empty');
	});

	it('take the lifetimes from a recording, which a re-recording would show changing', () => {
		const response = (
			oidc as { messages: { step: string; body?: Record<string, unknown> }[] }
		).messages.find((message) => message.step === 'token-response')!.body!;
		expect(LIFETIMES.access).toBe(response.expires_in);
		expect(LIFETIMES.idle).toBe(response.refresh_expires_in);
		const note = (id: string) => JSON.stringify(noteDefs.find((def) => def.id === id)!.text);
		expect(LIFETIMES.most).toBe(10 * 3600);
		expect(note('sso-session-max')).toContain('ten hours at most');
		expect(LIFETIMES.offline).toBe(30 * 86400);
		expect(note('offline-session-lifetimes')).toContain('Thirty days idle');
		const said = (id: string) =>
			picture('explain=term.session')
				.parts.find((part) => part.id === id)!
				.says.join(' ');
		expect(said('after-access-token')).toBe(`${(response.expires_in as number) / 60} min`);
		expect(said('after-session')).toBe(
			`${(response.refresh_expires_in as number) / 60} min unused, 10 h at most`
		);
	});

	it('show where a protection stops an attack only where a recording does', () => {
		const stops = picture('explain=term.pkce').parts.filter(
			(part) => part.mark === 'full' && !part.id.startsWith('key.')
		);
		expect(stops.length).toBeGreaterThan(2);
		for (const part of stops) expect(part.opens, part.id).toBeDefined();
		const dots = picture('explain=term.pkce').parts.filter(
			(part) => part.mark === 'dot' && !part.id.startsWith('key.')
		);
		for (const part of dots) expect(part.opens, part.id).toBeUndefined();
	});

	it('mark where the app runs on screen, among the four', () => {
		const current = (search: string) =>
			picture(search)
				.parts.filter((part) => part.shape === 'zone' && part.current)
				.map((part) => part.id.split('.')[0]);
		expect(current('explain=setting.appRuns')).toEqual(['server', 'server']);
		expect(current('explain=setting.appRuns&client=public&pkce=1&runs=page')).toEqual([
			'page',
			'page'
		]);
	});

	it('keep what is in a token on Keycloak to where its notes are', () => {
		expect(picture('explain=term.realm&mode=advanced').id).toBe('what-is-in-a-token-here');
		expect(pictureFor(stateFor('explain=term.realm'), 'plain')).toBeNull();
		expect(pictureFor(stateFor('explain=term.realm&keycloak=off'), 'plain')).toBeNull();
	});
});

// The maintainer, 2026-11-07: the circles were not explained, and the rows took knowing already.
describe('what a token says (#200)', () => {
	const claimsIn = (name: string) => {
		const body = (
			oidc as { messages: { step: string; body?: Record<string, unknown> }[] }
		).messages.find((message) => message.step === 'token-response')!.body!;
		const payload = String(body[name]).split('.')[1];
		return JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
	};

	it('says what the recorded tokens said, which a re-recording would show changing', () => {
		const shape = (claims: Record<string, unknown>) =>
			Object.fromEntries(Object.keys(claims).map((name) => [name, typeof claims[name]]));
		// The values change with each run, so they are held to it in kind, and the names in full.
		expect(shape(RECORDED.access)).toEqual(shape(claimsIn('access_token')));
		expect(shape(RECORDED.id)).toEqual(shape(claimsIn('id_token')));
		for (const name of ['iss', 'aud', 'azp', 'scope', 'acr', 'typ'] as const) {
			expect(RECORDED.access[name], name).toEqual(claimsIn('access_token')[name]);
		}
		expect(RECORDED.id.aud).toEqual(claimsIn('id_token').aud);
		// And the token an app got for itself, from its own recording.
		const service = (
			asItself as { messages: { step: string; body?: Record<string, unknown> }[] }
		).messages.find((message) => message.step === 'service-token-response')!.body!;
		const itself = JSON.parse(
			Buffer.from(String(service.access_token).split('.')[1], 'base64url').toString()
		) as Record<string, unknown>;
		expect(shape(RECORDED.service)).toEqual(shape(itself));
		for (const name of ['azp', 'client_id', 'preferred_username', 'scope'] as const) {
			expect(RECORDED.service[name], name).toEqual(itself[name]);
		}
		// No refresh token comes with it, and nothing about a login.
		expect(service.refresh_token).toBeUndefined();
		expect(itself.sid).toBeUndefined();
		expect(RECORDED.access.exp - RECORDED.access.iat).toBe(
			(claimsIn('access_token').exp as number) - (claimsIn('access_token').iat as number)
		);
	});

	it('has a row for every claim in either token, and none for a claim in neither', () => {
		const named = CLAIM_ROWS.flatMap((row) => row.names);
		const inEither = new Set([
			...Object.keys(RECORDED.access),
			...Object.keys(RECORDED.id),
			...Object.keys(RECORDED.service)
		]);
		expect(new Set(named)).toEqual(inEither);
		expect(named.length).toBe(inEither.size);
	});

	it('is in what explains a claim and a JWT, with values only where values are shown', () => {
		const advanced = picture('explain=term.claim&mode=advanced');
		const simple = picture('explain=term.jwt&mode=simple');
		expect(advanced.id).toBe('what-a-token-says');
		expect(simple.id).toBe('what-a-token-says');
		const said = (found: Picture) => found.parts.map((part) => part.says.join(' ')).join(' ');
		expect(said(advanced)).toContain(RECORDED.access.iss);
		expect(said(simple)).not.toContain(RECORDED.access.iss);
		// The access token has no nonce, and the ID token no scope, in either mode.
		const cell = (found: Picture, id: string) => found.parts.find((part) => part.id === id);
		expect(cell(simple, 'nonce.access')?.mark).toBe('none');
		expect(cell(advanced, 'scope.id')?.mark).toBe('none');
		expect(cell(simple, 'aud.id')?.mark).toBe('full');
		expect(cell(advanced, 'aud.access')?.says).toEqual(['account']);
	});
});

describe('the pictures of the other flows (#200)', () => {
	it('put the token an app gets for itself beside one for a user, on client credentials', () => {
		const state = parseState(flows['client-credentials'], 'flow', 'explain=term.jwt&mode=advanced');
		const found = pictureFor(state, 'plain')!;
		expect(found.id).toBe('what-a-token-says');
		const said = found.parts.map((part) => part.says.join(' ')).join(' ');
		expect(said).toContain('An access token for the app itself');
		expect(said).toContain('stands for the app itself');
		expect(found.parts.find((part) => part.id === 'sid.service')?.mark).toBe('none');
		expect(found.parts.some((part) => part.id.startsWith('nonce.'))).toBe(false);
		// Simple mode keeps where the two differ, or every circle would be the same.
		const simple = pictureFor(
			parseState(flows['client-credentials'], 'flow', 'explain=term.jwt&mode=simple'),
			'plain'
		)!;
		const mark = (id: string) => simple.parts.find((part) => part.id === id)?.mark;
		expect(mark('sid.access')).toBe('full');
		expect(mark('sid.service')).toBe('none');
		expect(mark('user.service')).toBe('half');
		expect(simple.parts.some((part) => part.id === 'jti.access')).toBe(false);
	});

	it('take how often the app asks, and for how long, from a recording', () => {
		const answer = (
			onADevice as { messages: { step: string; body?: Record<string, unknown> }[] }
		).messages.find((message) => message.step === 'device-response')!.body!;
		expect(ASKING.interval).toBe(answer.interval);
		expect(ASKING.expiresIn).toBe(answer.expires_in);
		const polling = (deviceQuestions as { answers: { devicePolling: Record<string, string> } })
			.answers.devicePolling;
		expect(polling.tooSoon).toBe('slow_down');
		expect(polling.afterWaiting).toBe('authorization_pending');
	});

	it('keep how the asking ends to advanced mode, where the choice is', () => {
		const ids = (mode: string) =>
			pictureFor(
				parseState(flows.device, 'flow', `explain=term.polling&mode=${mode}`),
				'plain'
			)!.parts.map((part) => part.id);
		expect(ids('simple')).toContain('tokens');
		expect(ids('simple')).not.toContain('access-denied');
		expect(ids('advanced')).toContain('expired-token');
		expect(pictureFor(stateFor('explain=term.polling'), 'plain')).toBeNull();
	});
});

// The maintainer, 2026-11-08: "Perhaps something about expected scopes with oidc as well".
describe('what each scope asks for', () => {
	it('says what three recorded runs asked for and were given', () => {
		for (const [preset, recorded] of Object.entries(SCOPES_RECORDED)) {
			const run = JSON.parse(
				readFileSync(`static/recordings/authorization-code/${preset}.json`, 'utf8')
			) as { messages: { step: string; url?: string; body?: Record<string, unknown> }[] };
			const url = run.messages.find((message) => message.step === 'authorize')!.url!;
			const asked = new URL(url).searchParams.get('scope')?.split(' ') ?? [];
			const given = String(
				run.messages.find((message) => message.step === 'token-response')!.body!.scope
			).split(' ');
			expect([...asked].sort(), preset).toEqual([...recorded.asked].sort());
			expect([...given].sort(), preset).toEqual([...recorded.given].sort());
		}
	});

	it('is in what explains a scope, and keeps offline access to advanced mode', () => {
		const advanced = picture('explain=term.scope&mode=advanced');
		expect(advanced.id).toBe('what-each-scope-asks-for');
		const mark = (found: Picture, id: string) => found.parts.find((part) => part.id === id)?.mark;
		expect(mark(advanced, 'openid.oidc')).toBe('full');
		expect(mark(advanced, 'openid.oauth')).toBe('none');
		expect(mark(advanced, 'profile.oidc')).toBe('empty');
		expect(mark(advanced, 'offline_access.logout-offline')).toBe('full');
		// Not a permission, which is what it looks like to someone who has not met it.
		const openid = advanced.parts.find((part) => part.id === 'is-openid')!.says.join(' ');
		expect(openid).toContain('A switch, not a permission');
		const simple = picture('explain=term.scope&mode=simple');
		expect(simple.parts.some((part) => part.id.startsWith('offline_access'))).toBe(false);
		expect(simple.parts.some((part) => part.id.endsWith('.logout-offline'))).toBe(false);
	});
});

describe('cookies, JWTs and OAuth (#200)', () => {
	it('opens where one recorded login has each of the three', () => {
		const found = picture('explain=term.cookie&mode=advanced');
		expect(found.id).toBe('cookies-jwts-oauth');
		const rows = found.parts.flatMap((part) => (part.rows ?? []).map((row) => row.opens.step));
		expect(rows).toEqual(
			expect.arrayContaining(['redirect-with-code', 'set-session', 'validate-id-token'])
		);
		const said = found.parts.map((part) => [...(part.title ?? []), ...part.says].join(' '));
		expect(said.join(' ')).toContain('One login here has all three');
	});
});

describe('what the circles and the rows mean', () => {
	it('is in a key drawn with the same marks, wherever there are marks', () => {
		for (const found of pictures) {
			const cells = found.parts.filter(
				(part) => part.shape === 'mark' && !part.id.startsWith('key.')
			);
			const keyed = new Set(
				found.parts
					.filter((part) => part.id.startsWith('key.') && part.mark)
					.map((part) => part.mark)
			);
			for (const cell of cells) expect(keyed, `${found.id}: ${cell.id}`).toContain(cell.mark);
		}
	});

	it('says what each row of the timeline and of the protections is', () => {
		for (const search of ['explain=term.session', 'explain=setting.pkce', 'explain=term.token']) {
			const found = picture(search);
			const names = found.parts.filter((part) => part.id.startsWith('name-'));
			for (const name of names) {
				const is = found.parts.find((part) => part.id === name.id.replace('name-', 'is-'));
				expect(is?.says.join(' ').length, `${found.id}: ${name.id}`).toBeGreaterThan(20);
			}
		}
		const offline = picture('explain=term.session').parts.find(
			(part) => part.id === 'is-offline-token'
		)!;
		expect(offline.says.join(' ')).toContain('for when the user is gone');
	});
});

describe('a picture in simple mode', () => {
	const linked = (picture: Picture) => [
		...picture.parts,
		...picture.parts.flatMap((part) => part.rows ?? [])
	];
	const drawn = (explain: string, search = '') =>
		pictureFor(stateFor(`explain=${explain}&mode=simple${search}`), 'plain');

	// The maintainer decided on 2026-11-08 that simple mode leaves out what is tied to advanced settings.
	it.each(ONE_OF_EACH)('leaves out what only advanced mode reaches: %s', (explain) => {
		const picture = drawn(explain);
		if (!picture) return;
		const advanced = linked(picture).filter((part) => !inSimpleMode(part.opens));
		expect(advanced.map((part) => part.id)).toEqual([]);
	});

	it('leaves out less than advanced mode, which draws it all', () => {
		const simple = drawn('setting.pkce');
		const advanced = pictureFor(stateFor('explain=setting.pkce&mode=advanced'), 'plain');
		expect(simple?.parts.some((part) => part.id === 'head-link')).toBe(false);
		expect(advanced?.parts.some((part) => part.id === 'head-link')).toBe(true);
	});

	it('keeps what a setting on screen has on, as simple mode keeps it as a chip', () => {
		const ids = (picture: Picture | null) => picture?.parts.map((part) => part.id) ?? [];
		expect(ids(drawn('setting.pkce'))).not.toContain('dpop.token');
		expect(ids(drawn('setting.pkce', '&binding=dpop&thief=1'))).toContain('dpop.token');
	});

	it('says in its key only what it draws', () => {
		const picture = drawn('term.session');
		const keyed = picture?.parts.filter((part) => part.id.startsWith('key.')) ?? [];
		expect(keyed.map((part) => part.says.join(' ')).join(' ')).not.toContain('does not end it');
	});
});
