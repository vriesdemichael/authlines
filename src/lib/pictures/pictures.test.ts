import { describe, expect, it } from 'vitest';
import { explanationOf } from '#lib/flow/explain.ts';
import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings, normalize, type Settings } from '#lib/flow/settings.ts';
import { parseState, type AppState } from '#lib/flow/state.ts';
import { sayer, wordings } from '#lib/flow/wording.ts';
import { pictureFor } from '#lib/pictures/index.ts';
import type { Picture, PicturePart } from '#lib/pictures/model.ts';
import { refreshPicture } from '#lib/pictures/refresh.ts';

const base = flows['authorization-code'];

/** Each different picture the settings can give, in each kind of words. */
function everyPicture(): Picture[] {
	const seen = new Map<string, Picture>();
	for (const settings of allValidSettings()) {
		for (const wording of wordings) {
			const picture = refreshPicture(settings, sayer(wording));
			seen.set(JSON.stringify(picture), picture);
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
// IBM Plex Sans is narrower than this on average, so a line under it fits with room to spare.
const wide = (text: string, size: number) => text.length * size * 0.54;

describe('a picture', () => {
	it('has more than one form, because it follows the settings', () => {
		expect(pictures.length).toBeGreaterThan(3);
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
					expect(apart, `${part.id} and ${other.id}`).toBe(true);
				}
			}
		}
	});

	it('has words that fit in what they are in', () => {
		for (const picture of pictures) {
			for (const part of picture.parts) {
				// A diamond has room for about half its width where its words are.
				const room = part.shape === 'ask' ? part.w * 0.62 : part.w - 16;
				for (const line of part.says)
					expect(wide(line, 13), `${part.id}: ${line}`).toBeLessThanOrEqual(room);
				for (const line of part.more ?? [])
					expect(wide(line, 11.5), `${part.id}: ${line}`).toBeLessThanOrEqual(room);
				const lines = part.says.length * 17 + (part.more?.length ?? 0) * 15;
				expect(lines, part.id).toBeLessThanOrEqual(part.h);
			}
			for (const line of picture.lines) {
				if (!line.label) continue;
				for (const text of line.label.lines) {
					const width = wide(text, 12);
					const from =
						line.label.anchor === 'start'
							? line.label.x
							: line.label.anchor === 'end'
								? line.label.x - width
								: line.label.x - width / 2;
					expect(from, text).toBeGreaterThanOrEqual(0);
					expect(from + width, text).toBeLessThanOrEqual(picture.width);
				}
			}
		}
	});

	// From any part of it, one click goes to the steps behind it (#167).
	it('opens, from every part, a step a recording draws', () => {
		for (const picture of pictures) {
			for (const { id, opens } of picture.parts) {
				const preset = base.presets.find((candidate) => candidate.id === opens.preset);
				expect(preset, `${id}: ${opens.preset}`).toBeDefined();
				const settings = normalize({ ...defaultSettings, ...preset!.settings }).settings;
				const steps = evaluate(base.diagrams[opens.diagram], settings).steps.map((step) => step.id);
				expect(steps, `${id} with ${opens.preset}`).toContain(opens.step);
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

describe('the refresh picture', () => {
	const stateFor = (search: string): AppState => parseState(base, 'flow', search);

	it('is in what explains a refresh token, and running out, and nowhere else', () => {
		for (const search of [
			'explain=artifact.refresh-token',
			'explain=term.refresh-token',
			'explain=setting.refresh'
		]) {
			expect(pictureFor(stateFor(search), sayer('plain'))?.id, search).toBe('refresh');
		}
		for (const search of ['explain=artifact.access-token', 'explain=lifeline.idp', '']) {
			expect(pictureFor(stateFor(search), sayer('plain')), search).toBeNull();
		}
		const device = parseState(flows.device, 'flow', 'explain=artifact.refresh-token');
		expect(pictureFor(device, sayer('plain'))).toBeNull();
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
