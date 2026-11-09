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

export type PictureId =
	| 'refresh'
	| 'who-knows-whom'
	| 'trust-across-providers'
	| 'how-an-api-trusts-a-token'
	| 'which-token-is-for-whom'
	| 'how-long-each-lasts'
	| 'what-stops-what'
	| 'where-the-tokens-are'
	| 'what-each-spec-adds'
	| 'what-is-in-a-token-here'
	| 'what-each-factor-proves'
	| 'what-a-thief-can-do'
	| 'what-a-code-looks-like'
	| 'what-a-token-says'
	| 'which-flow-fits'
	| 'the-app-keeps-asking'
	| 'what-each-scope-asks-for'
	| 'cookies-jwts-oauth'
	| 'passwords-keys-tokens'
	| 'oidc-or-saml'
	| 'an-accounts-life'
	| 'what-the-api-does'
	| 'where-roles-come-from'
	| 'who-or-what'
	| 'three-ways-to-decide';

/**
 * Where something starts or ends, a step, or a question with more than one way on: those make a
 * flowchart. A party, with what it holds, makes a relation diagram, and a zone holds parties. A text
 * is a heading or a label, a mark is a cell of a matrix, and a bar is a length of time. A char is one
 * box of a field that asks for one character in each, as a page asks for a one-time code.
 */
export type PartShape =
	'ends' | 'step' | 'ask' | 'party' | 'zone' | 'text' | 'mark' | 'bar' | 'char';

/** A cell of a matrix: all, some, none, what the specs say and nothing here shows, or nothing. */
export type MarkKind = 'full' | 'half' | 'empty' | 'dot' | 'none';

export interface PicturePart {
	id: string;
	shape: PartShape;
	/** Its centre, and its size. */
	x: number;
	y: number;
	w: number;
	h: number;
	/** A party's name, in the words chosen, over everything else it says. */
	title?: readonly string[];
	/** Under the title, in the font of a value on the wire, such as an address. */
	sub?: string;
	says: readonly string[];
	/** Under what it says, smaller. */
	more?: readonly string[];
	/** What a party holds, each of which opens the steps that put it there. */
	rows?: readonly PictureRow[];
	/** How a call travels, when it is one, in the colours the arrows use (ADR-014). */
	travels?: 'direct' | 'browser';
	/** A text's words, at which size, and from which side. */
	size?: 'title' | 'says' | 'more' | 'code';
	align?: 'start' | 'middle' | 'end';
	/** A cell of a matrix, whose words are only read out. */
	mark?: MarkKind;
	/** A bar: how long it lasts unused, a lighter stretch it can last to at most, or no fixed end. */
	tone?: 'solid' | 'light' | 'open';
	/** The part is the current case, of several side by side. */
	current?: boolean;
	/** Where it goes. A heading, a zone or a bar may go nowhere. */
	opens?: Opens;
}

export interface PictureRow {
	id: string;
	says: string;
	more: string;
	opens: Opens;
}

/** The steps a part stands for: the first of them, on a diagram, with the settings that draw it. */
export interface Opens {
	/** Another base flow, for a picture about which one fits. The authorization code flow if none. */
	flow?: string;
	diagram: DiagramId;
	step: string;
	/** Added to the settings on screen. */
	settings: Partial<Settings>;
	/** A recorded preset that draws the step, for when the settings on screen cannot have it. */
	preset: string;
	/**
	 * Opens the preset just as it was recorded, whatever is on screen. For a part whose words say how
	 * something ended, because other settings on screen can change that, as a review found.
	 */
	exact?: boolean;
}

export interface PictureLine {
	/** An SVG path, in the picture's own units. */
	d: string;
	/** Without a head: a line that joins another, or a relation, which goes both ways. */
	bare?: boolean;
	/** Dashed: who trusts tokens from whom, as the legend of a relation diagram says. */
	dashed?: boolean;
	/** Faint: a rule between rows, or the axis of a chart, which only helps the eye. */
	faint?: boolean;
	label?: Label;
}

export interface Label {
	lines: readonly string[];
	x: number;
	y: number;
	anchor: 'start' | 'middle' | 'end';
}

/** The sizes a picture is drawn in, which its layout and its tests both go by. */
export const SIZE = {
	title: 14,
	says: 13,
	more: 11.5,
	/** A code as someone reads it off a screen, in the font of a value on the wire. */
	code: 20,
	label: 12,
	row: 12.5,
	rowMore: 11
} as const;

/** The height of a part that says these lines, at the sizes the picture is drawn in. */
export const heightFor = (says: number, more = 0) => 26 + says * 17 + more * 15;

/**
 * How wide a line of text is at most, at a size. IBM Plex Sans is narrower than this on average, so
 * what fits by this fits on screen, and a bold title gets a little more.
 */
export const widthOf = (text: string, size: number, bold = false) =>
	text.length * size * (bold ? 0.6 : 0.54);

/** Text in lines that each fit a width, broken between words. */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
	const lines: string[] = [];
	for (const word of text.split(' ')) {
		const last = lines.at(-1);
		if (last !== undefined && widthOf(`${last} ${word}`, size, bold) <= width) {
			lines[lines.length - 1] = `${last} ${word}`;
		} else {
			lines.push(word);
		}
	}
	return lines;
}
