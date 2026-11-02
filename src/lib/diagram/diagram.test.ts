import { describe, expect, it } from 'vitest';
import {
	layHeld,
	layoutDiagram,
	WIDTH,
	LABEL_CHAR_WIDTH,
	type DiagramLayout,
	type LabelLine,
	type RowLayout
} from '#lib/diagram/layout.ts';
import { interpolate, readingTime, toFrame, type Frame } from '#lib/diagram/motion.ts';
import { authorizationCode as flow } from '#lib/flow/authorization-code.ts';
import { authorizationCodeSetup as setup } from '#lib/flow/authorization-code-setup.ts';
import { evaluate, holdingsAt } from '#lib/flow/model.ts';
import { allValidSettings, defaultSettings, type Settings } from '#lib/flow/settings.ts';
import type { Mode } from '#lib/flow/vocabulary.ts';

interface Box {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

const overlap = (a: Box, b: Box) =>
	a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function lineBox(line: LabelLine): Box & { what: string } {
	const width = line.text.length * LABEL_CHAR_WIDTH;
	const left =
		line.anchor === 'start' ? line.x : line.anchor === 'end' ? line.x - width : line.x - width / 2;
	return { what: line.text, left, right: left + width, top: line.y - 13, bottom: line.y + 4 };
}

function boxesOf(layout: DiagramLayout) {
	return [
		...layout.rows.flatMap((row: RowLayout) =>
			row.lines.map((line) => ({ ...lineBox(line), step: row.id, chip: false }))
		),
		...layout.chips.map((chip) => ({
			what: chip.text,
			step: chip.step,
			chip: true,
			left: chip.x,
			right: chip.x + chip.width,
			top: chip.y,
			bottom: chip.y + 18
		}))
	];
}

const layout = (settings: Partial<Settings> = {}, mode: Mode = 'advanced') =>
	layoutDiagram(evaluate(flow, { ...defaultSettings, ...settings }), mode);

describe('layout', () => {
	it.each(allValidSettings().map((settings) => [JSON.stringify(settings), settings] as const))(
		'gives every step a row, top to bottom: %s',
		(_, settings) => {
			for (const diagram of [flow, setup]) {
				const result = layoutDiagram(evaluate(diagram, settings));
				const expected = evaluate(diagram, settings).steps.map((s) => s.id);
				expect(result.rows.map((row) => row.id)).toEqual(expected);
				const ys = result.rows.map((row) => row.y);
				expect(ys).toEqual([...ys].sort((a, b) => a - b));
				expect(new Set(ys).size).toBe(ys.length);
				expect(result.height).toBeGreaterThan(ys[ys.length - 1]);
			}
		}
	);

	describe('in the room it has', () => {
		const rooms = [
			[640, 400],
			[710, 500],
			[850, 620],
			[1240, 900],
			[2000, 1300]
		] as const;
		const allIn = (diagram: typeof flow, settings: Settings, width: number, height: number) =>
			layoutDiagram(evaluate(diagram, settings), 'advanced', { width, height });

		it.each(rooms)('keeps every head whole, and clear of the next, at %i wide', (width, height) => {
			for (const settings of allValidSettings()) {
				for (const diagram of [flow, setup]) {
					const result = allIn(diagram, settings, width, height);
					const lanes = result.lanes;
					expect(lanes[0].x - lanes[0].headWidth / 2).toBeGreaterThanOrEqual(0);
					expect(lanes.at(-1)!.x + lanes.at(-1)!.headWidth / 2).toBeLessThanOrEqual(result.width);
					for (const [i, lane] of lanes.entries()) {
						if (i) expect(lane.x - lanes[i - 1].x).toBeGreaterThanOrEqual(lane.headWidth);
					}
				}
			}
		});

		it.each(rooms)('keeps labels and chips inside, at %i wide', (width, height) => {
			for (const settings of allValidSettings()) {
				for (const diagram of [flow, setup]) {
					const result = allIn(diagram, settings, width, height);
					for (const chip of result.chips) {
						expect(chip.x).toBeGreaterThanOrEqual(0);
						expect(chip.x + chip.width).toBeLessThanOrEqual(result.width);
					}
					for (const row of result.rows) {
						for (const box of row.lines.map(lineBox)) {
							expect(box.left, row.label).toBeGreaterThanOrEqual(0);
							expect(box.right, row.label).toBeLessThanOrEqual(result.width);
						}
					}
				}
			}
		});

		it('keeps what a lifeline has seen under its own head, however narrow', () => {
			for (const settings of allValidSettings()) {
				const view = evaluate(flow, settings);
				const { headHeight, heldWidth, lanes } = layoutDiagram(view, 'simple', {
					width: 640,
					height: 400
				});
				const spacing = lanes[1].x - lanes[0].x;
				for (const held of Object.values(holdingsAt(view, view.steps.at(-1)!.id))) {
					for (const chip of layHeld(held, heldWidth)) {
						expect(chip.y + 16).toBeLessThanOrEqual(headHeight);
						expect(chip.x + chip.width).toBeLessThanOrEqual(spacing / 2 + 40);
					}
				}
			}
		});

		it('never goes narrower than its lifelines need, or wider than can be followed', () => {
			const view = evaluate(flow, { ...defaultSettings, oidc: true, broker: true });
			expect(layoutDiagram(view, 'simple', { width: 300, height: 500 }).width).toBe(640);
			expect(layoutDiagram(view, 'simple', { width: 5000, height: 500 }).width).toBe(1240);
		});

		it('gives rows the height there is, within limits', () => {
			const view = evaluate(flow, defaultSettings);
			const gap = (height: number) => {
				const { rows } = layoutDiagram(view, 'simple', { width: 900, height });
				const plain = rows.findIndex((row) => row.id === 'open-app');
				return rows[plain + 1].y - rows[plain].y;
			};
			expect(gap(300)).toBe(36);
			expect(gap(5000)).toBe(56);
			expect(gap(800)).toBeGreaterThan(gap(600));
		});

		it('looks at the whole window, with the drawing in the middle of it', () => {
			const view = evaluate(flow, defaultSettings);
			const wide = layoutDiagram(view, 'simple', { width: 2000, height: 900 });
			expect(wide.width).toBe(1240);
			expect(wide.viewWidth).toBe(2000);
			expect(wide.viewX).toBe(-380);
			const narrow = layoutDiagram(view, 'simple', { width: 900, height: 900 });
			expect(narrow.viewX).toBe(0);
			expect(narrow.viewWidth).toBe(narrow.width);
		});

		it('says what room it was for, so that a change of room can jump', () => {
			const view = evaluate(flow, defaultSettings);
			expect(layoutDiagram(view, 'simple', { width: 900, height: 700 }).roomKey).toBe('900x700');
			expect(layoutDiagram(view).roomKey).toBe('');
		});
	});

	describe('what a message says and carries (#63)', () => {
		const everyLayout = allValidSettings().flatMap((settings) =>
			(['simple', 'advanced'] as const).flatMap((mode) =>
				[flow, setup].flatMap((diagram) =>
					[undefined, { width: 640, height: 500 }, { width: 1280, height: 800 }].map((room) => ({
						where: `${mode} ${room?.width ?? 880}`,
						layout: layoutDiagram(evaluate(diagram, settings), mode, room)
					}))
				)
			)
		);

		it('never has a label overlap a chip or another label', () => {
			const wrong = new Set<string>();
			for (const { where, layout } of everyLayout) {
				const boxes = boxesOf(layout);
				for (const [i, a] of boxes.entries()) {
					for (const b of boxes.slice(i + 1)) {
						if (a.step === b.step && a.chip && b.chip) continue;
						if (overlap(a, b)) wrong.add(`${where}: ${a.what} and ${b.what}`);
					}
				}
			}
			expect([...wrong].slice(0, 10)).toEqual([]);
		});

		it('never has a label overrun its arrow, unless one word is longer than the arrow', () => {
			const wrong = new Set<string>();
			for (const { where, layout } of everyLayout) {
				for (const row of layout.rows.filter((candidate) => !candidate.self)) {
					const low = Math.min(row.x1, row.x2);
					const high = Math.max(row.x1, row.x2);
					const onThisRow = boxesOf(layout).filter((box) => box.step === row.id);
					for (const box of onThisRow) {
						const alone = !box.what.includes(' ') || box.chip;
						if (alone && box.right - box.left > high - low) continue;
						if (box.left < low || box.right > high) wrong.add(`${where}: ${box.what}`);
					}
				}
			}
			expect([...wrong].slice(0, 10)).toEqual([]);
		});

		it('keeps the words off the number of the step', () => {
			const wrong = new Set<string>();
			for (const { where, layout } of everyLayout) {
				for (const row of layout.rows.filter((candidate) => !candidate.self)) {
					const number = {
						left: row.x1 - 9.5,
						right: row.x1 + 9.5,
						top: row.y - 9.5,
						bottom: row.y + 9.5
					};
					for (const box of row.lines.map(lineBox)) {
						const alone = !box.what.includes(' ');
						if (!alone && overlap(box, number)) wrong.add(`${where}: ${row.label}`);
					}
				}
			}
			expect([...wrong].slice(0, 10)).toEqual([]);
		});

		it('moves no row when the mode changes', () => {
			for (const settings of allValidSettings()) {
				const view = evaluate(flow, settings);
				const ys = (mode: 'simple' | 'advanced') =>
					layoutDiagram(view, mode).rows.map((row) => row.y);
				expect(ys('simple')).toEqual(ys('advanced'));
			}
		});

		it('puts a chip on the line of the words when there is room', () => {
			const { rows, chips } = layoutDiagram(evaluate(flow, defaultSettings), 'simple');
			const row = rows.find((candidate) => candidate.id === 'submit-credentials');
			const chip = chips.find((candidate) => candidate.step === 'submit-credentials');
			expect(chip!.y + 13).toBe(row!.lines.at(-1)!.y);
		});
	});

	it('keeps lanes inside the diagram, and slides them over for a new lifeline', () => {
		const before = layout();
		const after = layout({ broker: true });
		expect(after.lanes.map((lane) => lane.id)).toEqual([
			'browser',
			'app',
			'idp',
			'upstream',
			'api'
		]);
		for (const lane of after.lanes) {
			expect(lane.x).toBeGreaterThan(0);
			expect(lane.x).toBeLessThan(WIDTH);
		}
		const app = (l: typeof before) => l.lanes.find((lane) => lane.id === 'app')?.x;
		expect(app(after)).toBeLessThan(app(before) ?? 0);
	});

	it('puts what a setting changed, and credentials and tokens, on the message', () => {
		const base = layout().chips;
		expect(base.every((chip) => chip.artifact)).toBe(true);
		expect(base.map((chip) => chip.id)).toContain('token-response:access_token');

		const chips = layout({ oidc: true }).chips;
		const ids = chips.map((chip) => chip.id);
		expect(ids).toContain('authorize:scope=openid');
		expect(ids).toContain('token-response:id_token');
		expect(ids).not.toContain('authorize:client_id');
		expect(chips.find((chip) => chip.id === 'token-response:id_token')?.text).toBe('ID token');
		expect(chips.find((chip) => chip.id === 'authorize:scope=openid')?.text).toBe('scope=openid');
	});

	it('moves nothing when the mode changes (ADR-004)', () => {
		for (const settings of allValidSettings()) {
			const [simple, advanced] = (['simple', 'advanced'] as const).map((mode) =>
				layoutDiagram(evaluate(flow, settings), mode)
			);
			expect(simple.rows.map((row) => row.y)).toEqual(advanced.rows.map((row) => row.y));
			expect(simple.height).toBe(advanced.height);
		}
	});

	it('shows plain words and no parameters in simple mode', () => {
		const simple = layout({ oidc: true }, 'simple');
		expect(simple.rows.find((row) => row.id === 'authorize')?.label).toBe(
			'The browser asks to log in'
		);
		expect(simple.chips.every((chip) => chip.artifact)).toBe(true);
		expect(simple.lanes.find((lane) => lane.id === 'idp')?.name).toBe('Identity provider');
	});

	it('still marks what a real server did not do in simple mode', () => {
		const simple = layout({ binding: 'dpop', dpopNonce: true }, 'simple');
		expect(simple.chips.map((chip) => chip.id)).toContain('nonce-challenge:spec only');
	});

	it('numbers every message, and says in words what the arrow shows', () => {
		const { rows } = layout();
		expect(rows.map((row) => row.number)).toEqual(rows.map((_, i) => i + 1));
		expect(rows[2].route).toBe("User's browser to Identity provider");
	});

	it('keeps every chip inside the diagram, in every combination', () => {
		for (const settings of allValidSettings()) {
			for (const mode of ['simple', 'advanced'] as const) {
				const { chips, width } = layoutDiagram(evaluate(flow, settings), mode);
				for (const chip of chips) {
					expect(chip.x, chip.id).toBeGreaterThanOrEqual(0);
					expect(chip.x + chip.width, chip.id).toBeLessThanOrEqual(width);
				}
			}
		}
	});

	it('leaves room on a row for its chips, and keeps them clear of the next row', () => {
		const { rows, chips } = layout({ oidc: true, binding: 'dpop' });
		for (const chip of chips) {
			const row = rows.find((candidate) => candidate.id === chip.step)!;
			const next = rows[rows.indexOf(row) + 1];
			expect(chip.y + 18).toBeLessThanOrEqual(row.y - 26 + row.band + 2);
			if (next) expect(chip.y + 18).toBeLessThan(next.y - 8);
			expect(chip.x).toBeGreaterThanOrEqual(0);
			expect(chip.x + chip.width).toBeLessThanOrEqual(WIDTH);
		}
	});

	it('fits what a lifeline can have seen in the room under its name, in every combination', () => {
		for (const settings of allValidSettings()) {
			for (const diagram of [flow, setup]) {
				const view = evaluate(diagram, settings);
				const { headHeight } = layoutDiagram(view);
				for (const step of view.steps) {
					for (const held of Object.values(holdingsAt(view, step.id))) {
						for (const chip of layHeld(held)) {
							expect(chip.y + 16).toBeLessThanOrEqual(headHeight);
							expect(Math.abs(chip.x)).toBeLessThanOrEqual(87);
							expect(chip.x + chip.width).toBeLessThanOrEqual(87);
						}
					}
				}
			}
		}
	});

	it('keeps the heads the same size in both modes and while stepping', () => {
		const view = evaluate(flow, { ...defaultSettings, oidc: true, pkce: true });
		expect(layoutDiagram(view, 'simple').headHeight).toBe(
			layoutDiagram(view, 'advanced').headHeight
		);
	});

	it('only makes the heads taller when a diagram needs it, so the first one stays compact', () => {
		const plain = layout().headHeight;
		const busy = layout({ oidc: true, pkce: true, binding: 'dpop' }).headHeight;
		expect(busy).toBeGreaterThan(plain);
	});

	it('frames a group around exactly its rows', () => {
		const result = layout({ broker: true });
		const frame = result.groups.find((group) => group.id === 'brokered-login');
		const members = ['redirect-to-upstream', 'match-user'].map((id) =>
			result.rows.find((row) => row.id === id)!
		);
		expect(frame!.y).toBeLessThan(members[0].y);
		expect(frame!.y + frame!.height).toBeGreaterThan(members[1].y);
		const after = result.rows.find((row) => row.id === 'redirect-with-code')!;
		expect(frame!.y + frame!.height).toBeLessThanOrEqual(after.y);
	});

	it('keeps setup rows out of the user flow', () => {
		const rows = layout({ broker: true, upstreamTokens: 'v1' }).rows.map((row) => row.id);
		for (const step of setup.steps) expect(rows).not.toContain(step.id);
	});
});

describe('transitions', () => {
	const before = toFrame(layout());
	const after = toFrame(layout({ broker: true, oidc: true }));
	const row = (frame: Frame, id: string) => frame.rows.find((r) => r.id === id);

	it('start where the diagram is and end at the new layout', () => {
		const start = interpolate(before, after, 0);
		expect(row(start, 'token-request')?.y).toBeCloseTo(row(before, 'token-request')!.y);
		expect(start.lanes.find((l) => l.id === 'app')?.x).toBeCloseTo(
			before.lanes.find((l) => l.id === 'app')!.x
		);
		expect(interpolate(before, after, 1)).toEqual(after);
	});

	it('move what stays', () => {
		const middle = interpolate(before, after, 0.45);
		const y = row(middle, 'token-request')!.y;
		expect(y).toBeGreaterThan(row(before, 'token-request')!.y);
		expect(y).toBeLessThan(row(after, 'token-request')!.y);
	});

	it('fade out what leaves first, and draw in what arrives last', () => {
		const early = interpolate(before, after, 0.3);
		expect(row(early, 'login-page')?.leaving).toBe(true);
		expect(row(early, 'login-page')?.opacity).toBeCloseTo(0);
		expect(row(early, 'upstream-authorize')?.opacity).toBe(0);
		expect(row(early, 'upstream-authorize')?.draw).toBe(0);

		const coming = interpolate(before, after, 0.6);
		expect(row(coming, 'upstream-authorize')?.draw).toBeGreaterThan(0);
		expect(row(coming, 'upstream-authorize')?.draw).toBeLessThan(1);
		expect(row(coming, 'upstream-authorize')?.words).toBe(0);

		const late = interpolate(before, after, 0.85);
		expect(row(late, 'upstream-authorize')?.draw).toBe(1);
		expect(row(late, 'upstream-authorize')?.words).toBeGreaterThan(0);
		expect(row(late, 'upstream-authorize')?.words).toBeLessThan(1);
	});

	it('have something coming into the room before what made room has gone', () => {
		const start = toFrame(layout());
		const end = toFrame(layout({ attacker: true }));
		const added = end.rows
			.filter(({ id }) => !start.rows.some((row) => row.id === id))
			.map(({ id }) => id);
		expect(added.length).toBeGreaterThan(0);
		// By the time the rows after them are half way, they are on their way.
		const halfway = interpolate(start, end, 0.5);
		for (const id of added) expect(row(halfway, id)?.opacity).toBeGreaterThan(0.05);
	});

	it('bring in a new field on a message that stays', () => {
		const middle = interpolate(before, after, 0.8);
		const chip = middle.chips.find((c) => c.id === 'authorize:scope=openid');
		expect(chip?.opacity).toBeGreaterThan(0);
		expect(chip?.opacity).toBeLessThan(1);
		expect(row(middle, 'authorize')?.opacity).toBe(1);
	});

	describe.each([
		['OpenID Connect', {}, { oidc: true }],
		['an external provider', {}, { broker: true }],
		['DPoP with a nonce', { oidc: true }, { oidc: true, binding: 'dpop', dpopNonce: true }],
		['the attacker', {}, { attacker: true }],
		['PKCE', {}, { pkce: true }],
		['PKCE with the attacker', { attacker: true }, { attacker: true, pkce: true }],
		['consent', {}, { consent: true }]
	] as [string, Partial<Settings>, Partial<Settings>][])('filmed, turning on %s', (_, off, on) => {
		const moments = Array.from({ length: 41 }, (_, i) => i / 40);

		function drawn(frame: Frame) {
			const words = frame.rows
				.filter((row) => row.opacity > 0.05 && row.words > 0.05)
				.flatMap((row) => row.lines.map((line) => lineBox(line)));
			const chips = frame.chips
				.filter((chip) => chip.opacity > 0.05)
				.map((chip) => ({
					what: chip.text,
					left: chip.x,
					right: chip.x + chip.width,
					top: chip.y,
					bottom: chip.y + 18
				}));
			return { words, chips };
		}

		it.each(['simple', 'advanced'] as Mode[])('no chip crosses any words, in %s mode', (mode) => {
			for (const [a, b] of [
				[off, on],
				[on, off]
			]) {
				const start = toFrame(layout(a, mode));
				const end = toFrame(layout(b, mode));
				const wrong = new Set<string>();
				for (const t of moments) {
					const { words, chips } = drawn(interpolate(start, end, t));
					for (const chip of chips) {
						for (const line of words) {
							if (overlap(chip, line)) wrong.add(`${chip.what} on "${line.what}"`);
						}
					}
				}
				expect([...wrong]).toEqual([]);
			}
		});

		it('never loses what is staying', () => {
			const start = toFrame(layout(off));
			const end = toFrame(layout(on));
			const staying = end.rows.filter(({ id }) => start.rows.some((row) => row.id === id));
			for (const t of moments) {
				const frame = interpolate(start, end, t);
				for (const { id } of staying) {
					expect(frame.rows.find((row) => row.id === id)?.opacity).toBe(1);
				}
			}
		});
	});

	it('take words that change away and bring the new ones in, and swap them unseen', () => {
		const start = toFrame(layout());
		const end = toFrame(layout({ oidc: true }));
		const id = start.rows.find((a) =>
			end.rows.some((b) => b.id === a.id && b.label !== a.label)
		)!.id;
		expect(row(interpolate(start, end, 0), id)?.words).toBe(1);
		expect(row(interpolate(start, end, 0.45), id)?.words).toBe(0);
		expect(row(interpolate(start, end, 0.45), id)?.label).toBe(row(start, id)?.label);
		expect(row(interpolate(start, end, 0.55), id)?.words).toBe(0);
		expect(row(interpolate(start, end, 0.55), id)?.label).toBe(row(end, id)?.label);
		expect(row(interpolate(start, end, 0.85), id)?.words).toBeGreaterThan(0);
	});

	it('continue smoothly when a toggle flips mid-transition', () => {
		const middle = interpolate(before, after, 0.5);
		const reversed = interpolate(middle, before, 0);
		expect(row(reversed, 'token-request')?.y).toBeCloseTo(row(middle, 'token-request')!.y);
		expect(interpolate(middle, before, 1)).toEqual(before);
	});
});

describe('playing by itself', () => {
	const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

	it('leaves longer for more to read', () => {
		expect(readingTime(words(20))).toBeGreaterThan(readingTime(words(10)));
	});

	it('leaves a moment even for a word, and does not wait for ever', () => {
		expect(readingTime('word')).toBeGreaterThanOrEqual(2000);
		expect(readingTime(words(500))).toBeLessThanOrEqual(9000);
	});
});
