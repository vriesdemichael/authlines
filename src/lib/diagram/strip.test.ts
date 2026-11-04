import { describe, expect, it } from 'vitest';
import { LABEL_CHAR_WIDTH, layoutDiagram } from '#lib/diagram/layout.ts';
import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { allValidSettings } from '#lib/flow/settings.ts';

// What a phone has, at its narrowest that is still in use (#15).
const PHONE = { width: 360, height: 420 };

/** Every diagram of every flow, under every setting, as a phone lays it out. */
function* everyStrip() {
	for (const base of Object.values(flows)) {
		for (const diagram of Object.values(base.diagrams)) {
			for (const settings of allValidSettings(base.settings)) {
				const view = evaluate(diagram, settings);
				for (const mode of ['simple', 'advanced'] as const) {
					yield { name: `${base.id} ${diagram.id} ${mode}`, view, mode };
				}
			}
		}
	}
}

describe('the lanes in a strip, on a phone', () => {
	it('keeps every lane, close together, and leaves the rest of the width to the words', () => {
		for (const { name, view, mode } of everyStrip()) {
			const layout = layoutDiagram(view, mode, PHONE, undefined, false, true);
			expect(
				layout.lanes.map((lane) => lane.id),
				name
			).toEqual(view.lifelines.map((l) => l.id));
			const xs = layout.lanes.map((lane) => lane.x);
			expect(Math.max(...xs), name).toBeLessThanOrEqual(PHONE.width / 2);
			expect(layout.width, name).toBe(PHONE.width);
		}
	});

	it('puts every word beside the strip, and inside the screen', () => {
		for (const { name, view, mode } of everyStrip()) {
			const layout = layoutDiagram(view, mode, PHONE, undefined, false, true);
			const strip = Math.max(...layout.lanes.map((lane) => lane.x));
			for (const row of layout.rows) {
				for (const line of row.lines) {
					expect(line.anchor, `${name} ${row.id}`).toBe('start');
					expect(line.x, `${name} ${row.id}`).toBeGreaterThan(strip + 20);
					expect(
						line.x + line.text.length * LABEL_CHAR_WIDTH,
						`${name} ${row.id}`
					).toBeLessThanOrEqual(PHONE.width);
				}
			}
			for (const chip of layout.chips) {
				expect(chip.x, `${name} ${chip.id}`).toBeGreaterThan(strip + 20);
				expect(chip.x + chip.width, `${name} ${chip.id}`).toBeLessThanOrEqual(PHONE.width);
			}
		}
	});

	// Chips still to come leave their room under the words, so the words stay beside their arrow.
	it('puts the first line of words level with its arrow', () => {
		for (const { name, view, mode } of everyStrip()) {
			const { rows } = layoutDiagram(view, mode, PHONE, undefined, false, true);
			for (const row of rows) {
				if (!row.lines.length) continue;
				expect(row.lines[0].y - row.y, `${name} ${row.id}`).toBe(4);
			}
		}
	});

	// A list reads by its gaps, so a line kept for another mode or other words, which this one never
	// fills, looked like a break that meant something. Chips still to come keep theirs.
	it('keeps as much room under a row as over it, and none for what it never shows', () => {
		for (const { name, view, mode } of everyStrip()) {
			const { rows, chips } = layoutDiagram(view, mode, PHONE, undefined, false, true);
			for (const row of rows) {
				const baselines = [
					...row.lines.map((line) => line.y),
					...chips.filter((chip) => chip.step === row.id).map((chip) => chip.y + 13)
				];
				const last = Math.max(row.y + 4, ...baselines) - 4;
				expect(row.top + row.band - last, `${name} ${row.id}`).toBeCloseTo(row.y - row.top, 6);
			}
		}
	});

	it('keeps rows apart, so a row of two lines does not run into the next', () => {
		for (const { name, view, mode } of everyStrip()) {
			const { rows } = layoutDiagram(view, mode, PHONE, undefined, false, true);
			for (let i = 1; i < rows.length; i++) {
				const lowest = Math.max(...rows[i - 1].lines.map((line) => line.y), rows[i - 1].y);
				const highest = Math.min(...rows[i].lines.map((line) => line.y - 13), rows[i].y);
				expect(highest, `${name} ${rows[i].id}`).toBeGreaterThan(lowest);
			}
		}
	});

	it('is a layout of its own, so a phone turning wide moves nothing as if a setting had', () => {
		const view = evaluate(flows['authorization-code'].diagrams.flow, allValidSettings()[0]);
		const strip = layoutDiagram(view, 'simple', PHONE, undefined, false, true);
		const lanes = layoutDiagram(view, 'simple', PHONE);
		expect(strip.roomKey).not.toBe(lanes.roomKey);
		expect(strip.strip).toBe(true);
		expect(lanes.strip).toBe(false);
	});
});
