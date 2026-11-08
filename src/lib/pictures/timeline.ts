import { barAt, bottomOf, keyAt, markAt, textAt, type KeyEntry } from './build.ts';
import type { MarkKind, Opens, PictureLine, PicturePart } from './model.ts';

export const MINUTE = 60;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** A row of a timeline: what it is, how long it lasts as bars, and one more thing on the right. */
export interface TimelineRow {
	id: string;
	name: string;
	/** What it is, for someone who has not met it before. */
	is: string;
	opens?: Opens;
	bars: readonly { to: number; tone: 'solid' | 'light' | 'open'; says: string }[];
	/** How long, in words, after the bar. */
	after: string;
	/** A mark on the right, or words where a mark would mean something else. */
	right: MarkKind | string;
	rightSays: string;
	rightOpens?: Opens;
}

const MARKS: readonly string[] = ['full', 'half', 'empty', 'dot', 'none'];

/**
 * Lengths of time on a scale where each step is ten times the last, so that minutes and days fit on
 * one line, with a key drawn with the same bars and marks, a line on what each row is, and a column
 * on the right that each picture uses for its own question.
 */
export function timeline(options: {
	/** What the picture is about, above the key, where the explanation it is in says something else. */
	lead?: string;
	key: readonly KeyEntry[];
	rightHead: string;
	rows: readonly TimelineRow[];
	note: string;
	/** Under the names, beside the ticks: that the scale stretches minutes and squeezes days. */
	scale: string;
	/** Wider for words than for a mark. */
	rightWidth?: number;
}): { parts: PicturePart[]; lines: PictureLine[]; height: number } {
	const W = 800;
	const rightW = options.rightWidth ?? 150;
	const RIGHT = { left: W - 10 - rightW, w: rightW };
	const NAME = { left: 10, w: 230 };
	const PLOT = { left: 250, right: RIGHT.left - 20 };
	const FROM = Math.log10(MINUTE);
	const TO = Math.log10(60 * DAY);
	const at = (seconds: number) =>
		PLOT.left + ((Math.log10(seconds) - FROM) / (TO - FROM)) * (PLOT.right - PLOT.left);

	const lead = options.lead ? textAt('lead', 10, 8, 780, options.lead) : null;
	const keyTop = lead ? bottomOf(lead) + 10 : 8;
	// A key says only what is drawn, so a row simple mode leaves out takes its marks with it.
	const used = new Set<string>([
		...options.rows.flatMap((row) => row.bars.map((bar) => bar.tone)),
		...options.rows.map((row) => row.right)
	]);
	const key = keyAt(
		'key',
		10,
		keyTop,
		780,
		options.key.filter((entry) => used.has(entry.mark ?? entry.tone ?? ''))
	);
	const parts: PicturePart[] = lead ? [lead, ...key.parts] : [...key.parts];
	const head = textAt('right-head', RIGHT.left, keyTop + key.h + 10, RIGHT.w, options.rightHead, {
		size: 'more',
		align: 'middle'
	});
	parts.push(head);
	const lines: PictureLine[] = [];
	const TOP = bottomOf(head) + 8;
	let top = TOP;
	lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	for (const row of options.rows) {
		const name = textAt(`name-${row.id}`, NAME.left, top + 8, NAME.w, row.name, {
			opens: row.opens
		});
		const is = textAt(`is-${row.id}`, NAME.left, bottomOf(name) + 2, NAME.w, row.is, {
			size: 'more'
		});
		const right = MARKS.includes(row.right)
			? markAt(
					`right-${row.id}`,
					RIGHT.left + RIGHT.w / 2,
					0,
					row.right as MarkKind,
					`${row.name}: ${row.rightSays}`,
					row.rightOpens
				)
			: textAt(`right-${row.id}`, RIGHT.left, 0, RIGHT.w, row.right, {
					size: 'more',
					align: 'middle',
					opens: row.rightOpens
				});
		const height = Math.max(58, bottomOf(is) - top + 10, right.h + 20);
		const y = top + height / 2;
		parts.push(name, is, { ...right, y });
		const end = Math.max(...row.bars.map((bar) => at(bar.to)), PLOT.left);
		row.bars.forEach((bar, i) => {
			parts.push(barAt(`${row.id}.${i}`, PLOT.left, y, at(bar.to) - PLOT.left, bar.tone, bar.says));
		});
		// What it is in words, after the bar where there is room, and over it where there is not.
		const room = PLOT.right + 10 - end;
		parts.push(
			room > 90
				? textAt(`after-${row.id}`, end + 8, y - 8, Math.min(room - 8, 200), row.after, {
						size: 'more'
					})
				: textAt(`after-${row.id}`, PLOT.left + 8, y - 26, PLOT.right - PLOT.left, row.after, {
						size: 'more'
					})
		);
		top += height;
		lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	}
	const axisY = top + 6;
	lines.push({ d: `M${PLOT.left} ${axisY} H${PLOT.right}`, bare: true, faint: true });
	for (const [seconds, label] of [
		[5 * MINUTE, '5 min'],
		[30 * MINUTE, '30 min'],
		[10 * HOUR, '10 h'],
		[30 * DAY, '30 days']
	] as const) {
		const x = at(seconds);
		lines.push({ d: `M${x} ${TOP} V${axisY + 4}`, bare: true, faint: true });
		parts.push(
			textAt(`tick-${label}`, x - 26, axisY + 8, 52, label, { size: 'more', align: 'middle' })
		);
	}
	const scale = textAt('scale', NAME.left, axisY + 8, NAME.w, options.scale, { size: 'more' });
	parts.push(scale);
	const note = textAt('note', 10, Math.max(axisY + 32, bottomOf(scale) + 10), 780, options.note, {
		size: 'more'
	});
	parts.push(note);
	return { parts, lines, height: bottomOf(note) + 12 };
}
