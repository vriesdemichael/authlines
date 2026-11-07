import { describe, expect, it } from 'vitest';
import { explanationOf } from '#lib/flow/explain.ts';
import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import { parseState, type AppState } from '#lib/flow/state.ts';
import { sayer, wordings } from '#lib/flow/wording.ts';
import { pictureFor } from '#lib/pictures/index.ts';
import { SIZE, widthOf, type Picture, type PicturePart } from '#lib/pictures/model.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';

const base = flows['authorization-code'];

/** Each different picture the settings can give, in each kind of words, as an explanation has it. */
function everyPicture(): Picture[] {
	const seen = new Map<string, Picture>();
	for (const settings of allValidSettings()) {
		for (const wording of wordings) {
			for (const explain of ['artifact.refresh-token', 'lifeline.idp']) {
				const state = {
					...parseState(base, 'flow', `explain=${explain}&say=${wording}`),
					settings
				};
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

describe('a picture', () => {
	it('has more than one form, because it follows the settings', () => {
		for (const id of ['refresh', 'who-knows-whom']) {
			expect(pictures.filter((picture) => picture.id === id).length, id).toBeGreaterThan(3);
		}
	});

	it('keeps every part inside it, and apart from the others', () => {
		for (const picture of pictures) {
			for (const part of picture.parts) {
				const b = box(part);
				expect(b.left, part.id).toBeGreaterThanOrEqual(0);
				expect(b.top, part.id).toBeGreaterThanOrEqual(0);
				expect(b.right, part.id).toBeLessThanOrEqual(picture.width);
				expect(b.bottom, part.id).toBeLessThanOrEqual(picture.height);
				for (const other of picture.parts.filter((candidate) => candidate !== part)) {
					const o = box(other);
					const apart =
						b.right <= o.left || o.right <= b.left || b.bottom <= o.top || o.bottom <= b.top;
					expect(apart, `${picture.id}: ${part.id} and ${other.id}`).toBe(true);
				}
			}
		}
	});

	it('has words that fit in what they are in', () => {
		for (const picture of pictures) {
			for (const part of picture.parts) {
				if (part.shape === 'party') {
					// A party's words start at its left, and each line was broken to fit.
					const room = part.w - 28;
					for (const line of part.title ?? [])
						expect(widthOf(line, SIZE.title, true), `${part.id}: ${line}`).toBeLessThanOrEqual(
							room
						);
					for (const line of part.says)
						expect(widthOf(line, SIZE.more), `${part.id}: ${line}`).toBeLessThanOrEqual(room);
					for (const row of part.rows ?? []) {
						expect(widthOf(row.says, SIZE.row), row.says).toBeLessThanOrEqual(part.w - 44);
						expect(widthOf(row.more, SIZE.rowMore), row.more).toBeLessThanOrEqual(part.w - 44);
					}
					continue;
				}
				// A diamond has room for about half its width where its words are.
				const room = part.shape === 'ask' ? part.w * 0.62 : part.w - 16;
				for (const line of part.says)
					expect(widthOf(line, SIZE.says), `${part.id}: ${line}`).toBeLessThanOrEqual(room);
				for (const line of part.more ?? [])
					expect(widthOf(line, SIZE.more), `${part.id}: ${line}`).toBeLessThanOrEqual(room);
				const lines = part.says.length * 17 + (part.more?.length ?? 0) * 15;
				expect(lines, part.id).toBeLessThanOrEqual(part.h);
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
					for (const part of picture.parts) {
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
	it('opens, from every part and everything a party holds, a step a recording draws', () => {
		for (const picture of pictures) {
			const opening = picture.parts.flatMap((part) => [
				{ id: part.id, opens: part.opens },
				...(part.rows ?? []).map((row) => ({ id: `${part.id}.${row.id}`, opens: row.opens }))
			]);
			for (const { id, opens } of opening) {
				const preset = base.presets.find((candidate) => candidate.id === opens.preset);
				expect(preset, `${id}: ${opens.preset}`).toBeDefined();
				const settings = normalize({ ...defaultSettings, ...preset!.settings }).settings;
				const steps = evaluate(base.diagrams[opens.diagram], settings).steps.map((step) => step.id);
				expect(steps, `${picture.id}: ${id} with ${opens.preset}`).toContain(opens.step);
			}
		}
	});

	it('opens a part with the settings on screen, where those can draw it', () => {
		const settings: Settings = normalize({ ...defaultSettings, refresh: true }).settings;
		for (const { id, opens } of refreshPicture(settings, sayer('plain')).parts) {
			const wanted = normalize({ ...settings, ...opens.settings }).settings;
			const steps = evaluate(base.diagrams[opens.diagram], wanted).steps.map((step) => step.id);
			expect(steps, id).toContain(opens.step);
		}
	});
});

const stateFor = (search: string): AppState => parseState(base, 'flow', search);

describe('the refresh picture', () => {
	it('is in what explains a refresh token, and running out', () => {
		for (const search of [
			'explain=artifact.refresh-token',
			'explain=term.refresh-token',
			'explain=setting.refresh'
		]) {
			expect(pictureFor(stateFor(search), 'plain')?.id, search).toBe('refresh');
		}
		for (const search of ['explain=artifact.access-token', '']) {
			expect(pictureFor(stateFor(search), 'plain'), search).toBeNull();
		}
		const device = parseState(flows.device, 'flow', 'explain=artifact.refresh-token');
		expect(pictureFor(device, 'plain')).toBeNull();
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

describe('who knows whom', () => {
	const picture = (search: string) =>
		pictureFor(stateFor(search), stateFor(search).wording ?? 'plain')!;
	const parts = (search: string) => picture(search).parts.map((part) => part.id);
	const words = (search: string) =>
		JSON.stringify([picture(search).parts, picture(search).lines.map((line) => line.label)]);

	it('is in what explains the identity provider, on either diagram', () => {
		expect(picture('explain=lifeline.idp').id).toBe('who-knows-whom');
		expect(picture('explain=term.identity-provider').id).toBe('who-knows-whom');
		const setup = parseState(base, 'setup', 'explain=lifeline.idp');
		expect(pictureFor(setup, 'plain')?.id).toBe('who-knows-whom');
	});

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

	it('trusts ID tokens only with OpenID Connect', () => {
		expect(words('explain=lifeline.idp')).not.toContain('trusts ID tokens');
		expect(words('explain=lifeline.idp&oidc=1')).toContain('trusts ID tokens');
	});

	it("uses Keycloak's names for what a realm holds only in Keycloak's words", () => {
		expect(words('explain=lifeline.idp&broker=1')).toContain('Other providers');
		expect(words('explain=lifeline.idp&broker=1')).not.toContain('Identity providers');
		expect(words('explain=lifeline.idp&broker=1&say=keycloak')).toContain('Identity providers');
		expect(words('explain=lifeline.idp&say=keycloak')).toContain('Clients');
	});
});
