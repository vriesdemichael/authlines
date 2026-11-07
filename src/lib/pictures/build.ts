import type { DiagramId } from '#lib/flow/model.ts';
import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import { defaultSettings, normalize, settingIds, type Settings } from '#lib/flow/settings.ts';
import {
	SIZE,
	wrap,
	type MarkKind,
	type Opens,
	type PicturePart,
	type PictureRow
} from './model.ts';

/** The steps a part opens: a step, the preset that draws it, and what to add to the settings on screen. */
export const opensAt = (
	diagram: DiagramId,
	step: string,
	preset: string,
	settings: Partial<Settings> = {},
	exact = false
): Opens => ({ diagram, step, settings, preset, ...(exact ? { exact } : {}) });

/** The same, opening the recording just as it was made, for a part that says how something ended. */
export const opensAsRecorded = (
	diagram: DiagramId,
	step: string,
	preset: string,
	settings: Partial<Settings> = {}
): Opens => opensAt(diagram, step, preset, settings, true);

/**
 * The settings a part opens with: the ones on screen with what it adds, where those draw its step,
 * and otherwise, or where it says how something ended, its recorded preset's.
 */
export function landingSettings(opens: Opens, screen: Settings): Settings {
	const base = flows['authorization-code'];
	const preset = base.presets.find((candidate) => candidate.id === opens.preset);
	const recorded = normalize({ ...defaultSettings, ...preset?.settings }).settings;
	if (opens.exact) return recorded;
	const wanted = normalize({ ...screen, ...opens.settings }).settings;
	const draws = evaluate(base.diagrams[opens.diagram], wanted).steps.some(
		(step) => step.id === opens.step
	);
	return draws ? wanted : recorded;
}

const PAD = 14;
const ROW = 50;
const LINE = { title: 18, says: 17, more: 15 } as const;

/**
 * A party's box, as tall as what it says, from its top left. Its words break to fit, at the sizes the
 * component draws them in.
 */
export function partyBox(
	id: string,
	left: number,
	top: number,
	w: number,
	title: string,
	text: string,
	extra: {
		sub?: string;
		rows?: readonly PictureRow[];
		opens?: Opens;
		current?: boolean;
		minH?: number;
	} = {}
): PicturePart {
	const room = w - 2 * PAD;
	const titled = wrap(title, room, SIZE.title, true);
	const says = text ? wrap(text, room, SIZE.more) : [];
	const rows = extra.rows ?? [];
	const h = Math.max(
		extra.minH ?? 0,
		PAD + titled.length * 18 + (extra.sub ? 16 : 0) + says.length * 15 + rows.length * ROW + 10
	);
	return {
		id,
		shape: 'party',
		x: left + w / 2,
		y: top + h / 2,
		w,
		h,
		title: titled,
		sub: extra.sub,
		says,
		rows,
		opens: extra.opens,
		current: extra.current
	};
}

/** A region that holds other parts, named at its top left. */
export const zone = (
	id: string,
	left: number,
	top: number,
	w: number,
	h: number,
	title: string,
	current = false
): PicturePart => ({
	id,
	shape: 'zone',
	x: left + w / 2,
	y: top + h / 2,
	w,
	h,
	title: [title],
	says: [],
	current
});

/** Words on their own, broken to fit a width, from the top of where they go. */
export function textAt(
	id: string,
	left: number,
	top: number,
	w: number,
	words: string,
	options: {
		size?: 'title' | 'says' | 'more';
		align?: 'start' | 'middle' | 'end';
		opens?: Opens;
	} = {}
): PicturePart {
	const size = options.size ?? 'says';
	const says = wrap(words, w, SIZE[size], size === 'title');
	const h = says.length * LINE[size];
	return {
		id,
		shape: 'text',
		x: left + w / 2,
		y: top + h / 2,
		w,
		h,
		says,
		size,
		align: options.align ?? 'start',
		opens: options.opens
	};
}

/** A cell of a matrix, with what it means read out. */
export const markAt = (
	id: string,
	x: number,
	y: number,
	mark: MarkKind,
	says: string,
	opens?: Opens
): PicturePart => ({ id, shape: 'mark', x, y, w: 20, h: 20, mark, says: [says], opens });

/** A length of time, from its left. */
export const barAt = (
	id: string,
	left: number,
	y: number,
	w: number,
	tone: 'solid' | 'light' | 'open',
	says: string,
	opens?: Opens
): PicturePart => ({ id, shape: 'bar', x: left + w / 2, y, w, h: 14, tone, says: [says], opens });

export const bottomOf = (part: PicturePart) => part.y + part.h / 2;
export const topOf = (part: PicturePart) => part.y - part.h / 2;

/** The steps each recorded preset draws, worked out once. */
const drawnBy = new Map<string, ReadonlySet<string>>();
function stepsOf(preset: { id: string; settings: Partial<Settings> }): ReadonlySet<string> {
	if (!drawnBy.has(preset.id)) {
		const base = flows['authorization-code'];
		const settings = normalize({ ...defaultSettings, ...preset.settings }).settings;
		drawnBy.set(preset.id, new Set(evaluate(base.diagrams.flow, settings).steps.map((s) => s.id)));
	}
	return drawnBy.get(preset.id)!;
}

/**
 * The recorded preset closest to the settings on screen that draws a step of the user flow, with what
 * it has to have as well. So a part opens where it says, whatever else is switched on.
 */
export function presetDrawing(
	step: string,
	settings: Settings,
	required: Partial<Settings> = {}
): string | null {
	const base = flows['authorization-code'];
	const fits = base.presets.filter(
		(preset) =>
			Object.entries(required).every(
				([id, value]) =>
					normalize({ ...defaultSettings, ...preset.settings }).settings[id as keyof Settings] ===
					value
			) && stepsOf(preset).has(step)
	);
	const differs = (preset: { settings: Partial<Settings> }) => {
		const theirs = normalize({ ...defaultSettings, ...preset.settings }).settings;
		return settingIds.filter((id) => theirs[id] !== settings[id]).length;
	};
	if (!fits.length) return null;
	return fits.reduce((best, preset) => (differs(preset) < differs(best) ? preset : best)).id;
}
