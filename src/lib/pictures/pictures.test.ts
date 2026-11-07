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
import { PICTURE_OF, pictureFor } from '#lib/pictures/index.ts';
import { SIZE, widthOf, type Picture, type PicturePart } from '#lib/pictures/model.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';
import oidc from '../../../static/recordings/authorization-code/oidc.json';

const base = flows['authorization-code'];
const stateFor = (search: string): AppState => parseState(base, 'flow', search);

/** One thing that each picture explains, to draw it from. */
const ONE_OF_EACH = [...new Map(Object.entries(PICTURE_OF).map(([key, id]) => [id, key])).values()];

/** Each different picture the settings can give, in each kind of words, as an explanation has it. */
function everyPicture(): Picture[] {
	const seen = new Map<string, Picture>();
	for (const settings of allValidSettings()) {
		for (const wording of wordings) {
			for (const explain of ONE_OF_EACH) {
				const state = { ...stateFor(`explain=${explain}&say=${wording}&mode=advanced`), settings };
				const picture = pictureFor(state, wording);
				if (picture) seen.set(JSON.stringify(picture), picture);
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
				const preset = base.presets.find((candidate) => candidate.id === opens.preset);
				expect(preset, `${picture.id}: ${id}: ${opens.preset}`).toBeDefined();
				const settings = normalize({ ...defaultSettings, ...preset!.settings }).settings;
				const steps = evaluate(base.diagrams[opens.diagram], settings).steps.map((step) => step.id);
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

	it('is not in an explanation it does not belong to, nor on another flow', () => {
		expect(pictureFor(stateFor('explain=term.code'), 'plain')).toBeNull();
		expect(pictureFor(stateFor(''), 'plain')).toBeNull();
		const device = parseState(flows.device, 'flow', 'explain=artifact.refresh-token');
		expect(pictureFor(device, 'plain')).toBeNull();
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

const picture = (search: string) =>
	pictureFor(stateFor(search), stateFor(search).wording ?? 'plain')!;
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
	});
});

describe('the concept pictures (#167)', () => {
	it('say how trust reaches each kind of provider, and that the app knows only one', () => {
		const trust = words(picture('explain=setting.broker'));
		for (const said of ['takes its word', 'checks its', 'checks passwords', 'trusts only'])
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
		expect(response.expires_in).toBe(300);
		expect(response.refresh_expires_in).toBe(1800);
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
		const stops = picture('explain=term.pkce').parts.filter((part) => part.mark === 'full');
		expect(stops.length).toBeGreaterThan(2);
		for (const part of stops) expect(part.opens, part.id).toBeDefined();
		const dots = picture('explain=term.pkce').parts.filter((part) => part.mark === 'dot');
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
