import type { DiagramId } from '#lib/flow/model.ts';
import type { Settings } from '#lib/flow/settings.ts';

/**
 * A picture that explains a concept where words would take a paragraph, such as what an app does
 * when its token runs out (#167). It opens in the concept's explanation, beside the arrows and not in
 * place of them, and every part of it opens the steps it stands for.
 */
export interface Picture {
	id: PictureId;
	/** Said to a screen reader, and above the picture. */
	title: string;
	width: number;
	height: number;
	parts: readonly PicturePart[];
	lines: readonly PictureLine[];
}

export type PictureId = 'refresh';

/** Where something starts or ends, a step, or a question with more than one way on. */
export type PartShape = 'ends' | 'step' | 'ask';

export interface PicturePart {
	id: string;
	shape: PartShape;
	/** Its centre, and its size. */
	x: number;
	y: number;
	w: number;
	h: number;
	says: readonly string[];
	/** Under what it says, smaller. */
	more?: readonly string[];
	/** How a call travels, when it is one, in the colours the arrows use (ADR-014). */
	travels?: 'direct' | 'browser';
	opens: Opens;
}

/** The steps a part stands for: the first of them, on a diagram, with the settings that draw it. */
export interface Opens {
	diagram: DiagramId;
	step: string;
	/** Added to the settings on screen. */
	settings: Partial<Settings>;
	/** A recorded preset that draws the step, for when the settings on screen cannot have it. */
	preset: string;
}

export interface PictureLine {
	/** An SVG path, in the picture's own units. */
	d: string;
	/** A line that joins another ends without a head. */
	joins?: boolean;
	label?: Label;
}

export interface Label {
	lines: readonly string[];
	x: number;
	y: number;
	anchor: 'start' | 'middle' | 'end';
}

/** The height of a part that says these lines, at the sizes the picture is drawn in. */
export const heightFor = (says: number, more = 0) => 26 + says * 17 + more * 15;
