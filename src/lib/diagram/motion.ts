import type {
	ChipLayout,
	DiagramLayout,
	GroupLayout,
	LaneLayout,
	RowLayout
} from '#lib/diagram/layout.ts';

export const TRANSITION_MS = 900;

const SLOWEST_STEP_MS = 9000;
const QUICKEST_STEP_MS = 2000;
const MS_PER_WORD = 260;

/** How long to leave some words on screen when the flow plays by itself. */
export function readingTime(text: string) {
	const words = text.trim().split(/\s+/).length;
	return Math.max(QUICKEST_STEP_MS, Math.min(SLOWEST_STEP_MS, words * MS_PER_WORD));
}

/** Fades, and for an arrow how far it has drawn, on top of the layout's geometry. */
interface Visibility {
	opacity: number;
	draw: number;
	leaving: boolean;
}

export type FrameLane = LaneLayout &
	Visibility & {
		/** How far its name is showing, because a name that changes goes and comes back. */
		words: number;
	};
export type FrameRow = RowLayout &
	Visibility & {
		/** How far its words are showing, because words that change go and come back. */
		words: number;
	};
export type FrameChip = ChipLayout & Visibility;
export type FrameGroup = GroupLayout & Visibility;

export interface Frame {
	width: number;
	viewX: number;
	viewWidth: number;
	height: number;
	heldWidth: number;
	headHeight: number;
	whole: boolean;
	strip: boolean;
	numberRadius: number;
	lanes: FrameLane[];
	rows: FrameRow[];
	chips: FrameChip[];
	groups: FrameGroup[];
}

const settled = <T>(item: T) => ({ ...item, opacity: 1, draw: 1, leaving: false });

export function toFrame(layout: DiagramLayout): Frame {
	return {
		width: layout.width,
		viewX: layout.viewX,
		viewWidth: layout.viewWidth,
		height: layout.height,
		heldWidth: layout.heldWidth,
		headHeight: layout.headHeight,
		whole: layout.whole,
		strip: layout.strip,
		numberRadius: layout.numberRadius,
		lanes: layout.lanes.map((lane) => ({ ...settled(lane), words: 1 })),
		rows: layout.rows.map((row) => ({ ...settled(row), words: 1 })),
		chips: layout.chips.map(settled),
		groups: layout.groups.map(settled)
	};
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Progress through part of the transition. */
const within = (t: number, start: number, end: number) =>
	easeInOut(Math.max(0, Math.min(1, (t - start) / (end - start))));

// One after the other, because words still fading or just come would be crossed by a row going past.
const leaveAt = (t: number) => within(t, 0, 0.3);
const moveAt = (t: number) => within(t, 0.3, 0.7);
const arriveAt = (t: number) => within(t, 0.7, 1);
// Arrows and lifelines come as the rows part, so that the room they make is never just empty.
const comeAt = (t: number) => within(t, 0.35, 0.8);
const wordsAt = (t: number) => (t < 0.5 ? 1 - leaveAt(t) : arriveAt(t));
const BEFORE_THE_SWAP = 0.5;

const sameName = (a: LaneLayout, b: LaneLayout) => a.name === b.name && a.role === b.role;

const sameWords = (a: RowLayout, b: RowLayout) =>
	a.lines.length === b.lines.length &&
	a.lines.every((line, i) => line.text === b.lines[i].text && line.anchor === b.lines[i].anchor);

function blend<T extends Visibility & { id: string }>(
	from: readonly T[],
	to: readonly T[],
	t: number,
	move: (a: T, b: T, p: number) => T,
	showing: (item: T) => number = () => 1,
	arriving: (t: number) => number = comeAt
): T[] {
	const before = new Map(from.map((item) => [item.id, item]));
	const after = new Set(to.map((item) => item.id));
	const staying = to.map((item) => {
		const previous = before.get(item.id);
		if (previous) {
			const moved = move(previous, item, moveAt(t));
			const opacity = lerp(previous.opacity, 1, moveAt(t)) * showing(item);
			return { ...moved, opacity, draw: 1, leaving: false };
		}
		const arrived = arriving(t);
		return { ...item, opacity: arrived, draw: arrived, leaving: false };
	});
	const leaving = from
		.filter((item) => !after.has(item.id))
		.map((item) => ({ ...item, opacity: item.opacity * (1 - leaveAt(t)), leaving: true }));
	return [...staying, ...leaving];
}

/**
 * The diagram at time t between two frames. A pure function, so any moment of a transition can be
 * tested, and a toggle flipped mid-transition starts from wherever the diagram is.
 */
export function interpolate(from: Frame, to: Frame, t: number): Frame {
	if (t >= 1) return to;
	const rowsBefore = new Map(from.rows.map((row) => [row.id, row]));
	const reworded = new Set(
		to.rows
			.filter((row) => {
				const before = rowsBefore.get(row.id);
				return before && !sameWords(before, row);
			})
			.map((row) => row.id)
	);
	const side = <T>(a: T, b: T) => (t < BEFORE_THE_SWAP ? a : b);
	return {
		width: to.width,
		viewX: to.viewX,
		viewWidth: to.viewWidth,
		height: lerp(from.height, to.height, moveAt(t)),
		heldWidth: to.heldWidth,
		headHeight: lerp(from.headHeight, to.headHeight, moveAt(t)),
		whole: to.whole,
		strip: to.strip,
		numberRadius: to.numberRadius,
		lanes: blend(from.lanes, to.lanes, t, (a, b, p) => ({
			...b,
			x: lerp(a.x, b.x, p),
			headWidth: lerp(a.headWidth, b.headWidth, p),
			name: side(a.name, b.name),
			nameLines: side(a.nameLines, b.nameLines),
			role: side(a.role, b.role),
			words: sameName(a, b) ? lerp(a.words, 1, p) : wordsAt(t)
		})),
		rows: blend(
			from.rows,
			to.rows.map((row) => (rowsBefore.has(row.id) ? row : { ...row, words: arriveAt(t) })),
			t,
			(a, b, p) => ({
				...b,
				y: lerp(a.y, b.y, p),
				top: lerp(a.top, b.top, p),
				band: lerp(a.band, b.band, p),
				x1: lerp(a.x1, b.x1, p),
				x2: lerp(a.x2, b.x2, p),
				label: side(a.label, b.label),
				words: reworded.has(b.id) ? wordsAt(t) : lerp(a.words, 1, p),
				lines: reworded.has(b.id)
					? side(a.lines, b.lines)
					: b.lines.map((line, i) => ({
							...line,
							x: lerp(a.lines[i].x, line.x, p),
							y: lerp(a.lines[i].y, line.y, p)
						}))
			})
		),
		chips: blend(
			from.chips,
			to.chips,
			t,
			(a, b, p) =>
				reworded.has(b.step)
					? side(a, b)
					: {
							...b,
							x: lerp(a.x, b.x, p),
							y: lerp(a.y, b.y, p)
						},
			(chip) => (reworded.has(chip.step) ? wordsAt(t) : 1),
			arriveAt
		),
		groups: blend(from.groups, to.groups, t, (a, b, p) => ({
			...b,
			x: lerp(a.x, b.x, p),
			y: lerp(a.y, b.y, p),
			width: lerp(a.width, b.width, p),
			height: lerp(a.height, b.height, p)
		}))
	};
}
