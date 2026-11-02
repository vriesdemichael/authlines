import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authorizationCodeBase as base, flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { defaultSettings, normalize } from '#lib/flow/settings.ts';
import { pageShots } from '#lib/flow/vocabulary.ts';
import { addressAt, readAddress } from '#lib/recordings/address.ts';
import { pagesGone } from '#lib/recordings/check.ts';
import type { Recording } from '#lib/recordings/format.ts';

const FOLDER = 'static/recordings/authorization-code';
const recordings = base.presets.map(
	(preset) => JSON.parse(readFileSync(`${FOLDER}/${preset.id}.json`, 'utf8')) as Recording
);
const viewOf = (recording: Recording) => evaluate(base.diagrams.flow, recording.settings);
const oauth = recordings.find(({ preset }) => preset === 'oauth')!;

/** A kilobyte more than the largest of them, so a page that got much heavier is noticed. */
const LARGEST_PICTURE = 30 * 1024;

describe('what a person sees in their browser', () => {
	it('has the address that was recorded, wherever a page is, in every recording', () => {
		for (const recording of recordings) {
			for (const step of viewOf(recording).steps.filter(({ page }) => page)) {
				// Someone who stole the code got there before the app did, and the app never got its turn.
				const where = `${recording.preset} ${step.id}`;
				const address = addressAt(recording, step.page!.address);
				expect(address, where).toBeTruthy();
				expect(
					recording.messages.map(({ url }) => url),
					where
				).toContain(address);
			}
		}
	});

	it('marks what is in that address', () => {
		for (const recording of recordings) {
			for (const step of viewOf(recording).steps.filter(({ page }) => page?.marks)) {
				const { parts } = readAddress(addressAt(recording, step.page!.address)!, step.page!.marks);
				expect(parts.length, `${recording.preset} ${step.id}`).toBeGreaterThan(0);
			}
		}
	});

	it('has a window for every page a real server answered with', () => {
		for (const recording of recordings) {
			const view = viewOf(recording);
			for (const message of recording.messages) {
				if (message.direction !== 'response' || message.status !== 200 || !message.step) continue;
				const step = view.steps.find(({ id }) => id === message.step);
				if (!step || step.from !== 'idp' || step.to !== 'browser') continue;
				expect(step.page, `${recording.preset} ${step.id}`).toBeDefined();
			}
		}
	});

	it('shows the code where it really was', () => {
		const { parts, where } = readAddress(addressAt(oauth, 'callback')!, ['code', 'state']);
		expect(where).toBe('localhost:9100/callback');
		expect(parts.map(({ name }) => name).sort()).toEqual(['code', 'state']);
		expect(parts.every(({ marked }) => marked)).toBe(true);
		expect(parts.find(({ name }) => name === 'code')?.term).toBe('code');
	});

	it('has all of the address for someone who asked, with nothing made up', () => {
		const url = addressAt(oauth, 'callback')!;
		const all = readAddress(url, ['code'], { everything: true });
		expect(all.left).toBe(0);
		expect(all.parts.map(({ name, whole }) => [name, whole])).toEqual([
			...new URL(url).searchParams
		]);
		expect(all.parts.filter(({ marked }) => marked).map(({ name }) => name)).toEqual(['code']);
		const some = readAddress(url, ['code']);
		expect(some.parts).toHaveLength(1);
		expect(some.left).toBe(all.parts.length - 1);
	});

	it('cuts a long value short, and says so', () => {
		const { parts } = readAddress(`http://a.example/?code=${'x'.repeat(40)}&state=short`, [
			'code',
			'state'
		]);
		expect(parts[0].value).toBe(`${'x'.repeat(18)}…`);
		expect(parts[0].whole).toHaveLength(40);
		expect(parts[1].value).toBe('short');
	});

	it('has no window on a step that is not in the browser', () => {
		for (const diagram of Object.values(base.diagrams)) {
			const settings = normalize({ ...defaultSettings, oidc: true, broker: true }).settings;
			for (const step of evaluate(diagram, settings).steps.filter(({ page }) => page)) {
				expect([step.from, step.to], step.id).toContain('browser');
			}
		}
	});

	it('has each picture, none of them heavy, and uses all of them', () => {
		const used = new Set(
			Object.values(flows)
				.flatMap(({ diagrams }) => Object.values(diagrams))
				.flatMap(({ steps }) =>
					steps.flatMap((step) => [step.page?.shot, step.pitfall?.shot].filter(Boolean))
				)
		);
		expect([...used].sort()).toEqual([...pageShots].sort());
		for (const shot of pageShots) {
			const file = `static/recordings/pages/${shot}.jpg`;
			expect(existsSync(file), file).toBe(true);
			expect(statSync(file).size, file).toBeLessThan(LARGEST_PICTURE);
		}
		expect(readdirSync('static/recordings/pages').sort()).toEqual(
			[...pageShots].map((shot) => `${shot}.jpg`).sort()
		);
	});

	it('says in words what is on each picture', () => {
		for (const { steps } of Object.values(base.diagrams)) {
			for (const step of steps) {
				if (step.page) expect(step.page.shows.length, step.id).toBeGreaterThan(20);
				if (step.pitfall?.shot) expect(step.pitfall.shows?.length, step.id).toBeGreaterThan(20);
			}
		}
	});

	it('notices a page that stopped appearing, and not one that looks different', () => {
		expect(pagesGone(pageShots)).toEqual([]);
		expect(pagesGone(pageShots.filter((shot) => shot !== 'consent'))).toEqual([
			'The page "consent" no longer appears.'
		]);
	});
});
