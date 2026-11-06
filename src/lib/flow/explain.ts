import { pathOf } from '#lib/flow/follow.ts';
import { diagramParts, READING, terms, type Term, type TermPlace } from '#lib/flow/glossary.ts';
import type { ArtifactId } from '#lib/flow/vocabulary.ts';
import { evaluate, type BaseFlow, type DiagramView } from '#lib/flow/model.ts';
import { theKind } from '#lib/flow/names.ts';
import { normalize, settingDefs } from '#lib/flow/settings.ts';
import { wordingOf, type AppState } from '#lib/flow/state.ts';
import { artifacts } from '#lib/flow/vocabulary.ts';
import { nameIn, sayer, type Wording } from '#lib/flow/wording.ts';
import { keycloakKnownAs } from '#lib/keycloak/words.ts';
import { pictureFor, type Picture } from '#lib/pictures/index.ts';
import { isVendorSource, type SourceRef } from '#lib/sources/sources.ts';

/** What the panel says about something someone clicked, in the words of the mode they are in. */
export interface Explaining {
	title: string;
	text: string;
	seen?: readonly ArtifactId[];
	seenBy?: readonly string[];
	sources?: readonly SourceRef[];
	/** What else it is called, because docs and tools use all of them. */
	alsoCalled?: readonly string[];
	/** The parts of the diagram to choose from, for how to read it. */
	parts?: readonly Term[];
	/** It is about one server, which someone can have left out. */
	aboutTheServer?: boolean;
	/** The party this is about, whose view can be shown. */
	party?: string;
	/** What this is about, when there is a path to follow. */
	follows?: ArtifactId;
	/** A picture, where one says it better than words (#167). */
	picture?: Picture;
}

type Line = DiagramView['lifelines'][number];

/** What else a party is called, whichever is showing, and where each of those comes from. */
function namesOf(line: Line, wording: Wording, serverNotes: boolean) {
	const known = [...line.knownAs, ...(serverNotes ? keycloakKnownAs(line.id) : [])];
	const shown = nameIn(line, wording).toLowerCase();
	const words = [...new Set(known.map(({ word }) => word))]
		.filter((word) => word.toLowerCase() !== shown)
		.map((word) => {
			const by = known.filter((name) => name.word === word).map((name) => name.by);
			return `${word}, in ${by.join(' and ')}`;
		});
	const plain = line.plainName.toLowerCase() === shown ? [] : [`${line.plainName}, in plain words`];
	return {
		alsoCalled: [...plain, ...words],
		sources: [...new Map(known.map(({ source }) => [source.source, source])).values()]
	};
}

const followable = (view: DiagramView, artifact: ArtifactId) =>
	pathOf(view, artifact).length ? artifact : undefined;

export function explanationOf(
	state: AppState,
	view: DiagramView,
	holdings: Readonly<Record<string, readonly ArtifactId[]>>
): Explaining | null {
	const said = inWords(state, view, holdings);
	const picture = said && pictureFor(state, sayer(wordingOf(state)));
	return said && picture ? { ...said, picture } : said;
}

function inWords(
	state: AppState,
	view: DiagramView,
	holdings: Readonly<Record<string, readonly ArtifactId[]>>
): Explaining | null {
	const simple = state.mode === 'simple';
	const wording = wordingOf(state);
	const named = (line: Line) => nameIn(line, wording);
	const explained = state.explained;
	if (explained?.kind === 'lifeline') {
		const line = view.lifelines.find((candidate) => candidate.id === explained.id);
		if (!line) return null;
		// A name from a link says whose it is, and what the party is, before what that party does.
		return {
			title: named(line),
			text: line.given
				? `The link you opened calls it ${line.given}. Here it is ${theKind(line.plainName)}. ${line.concept}`
				: line.concept,
			...namesOf(line, wording, state.serverNotes),
			// Seen as someone else, what that one never saw stays hidden here too.
			seen: (holdings[line.id] ?? []).filter(
				(id) => !state.eyes || state.eyes === line.id || holdings[state.eyes]?.includes(id)
			),
			party: line.id
		};
	}
	if (explained?.kind === 'artifact') {
		return {
			title: artifacts[explained.id].label,
			text: artifacts[explained.id].explains,
			seenBy: view.lifelines.filter((line) => holdings[line.id]?.includes(explained.id)).map(named),
			follows: followable(view, explained.id)
		};
	}
	if (explained?.kind === 'term') {
		const term = terms[explained.id];
		if (term.vendor && !state.serverNotes) return null;
		const source = term.setting ? settingDefs[term.setting] : null;
		const reading = term === READING || term.part;
		return {
			title: term.name,
			text: term.artifact ? artifacts[term.artifact].explains : source ? source.why : term.explains,
			alsoCalled: term.alsoCalled,
			seenBy: term.artifact
				? view.lifelines.filter((line) => holdings[line.id]?.includes(term.artifact!)).map(named)
				: undefined,
			parts: reading ? diagramParts : undefined,
			aboutTheServer: term.id === 'keycloak',
			follows: term.artifact ? followable(view, term.artifact) : undefined
		};
	}
	if (explained?.kind === 'setting') {
		const def = settingDefs[explained.id];
		return {
			title: simple ? (def.simple?.label ?? def.label) : def.label,
			text: sayer(wording)(
				`${simple ? (def.simple?.summary ?? def.summary) : def.summary} ${def.why}`
			),
			sources: def.sources.filter((ref) => state.serverNotes || !isVendorSource(ref.source))
		};
	}
	return null;
}

/** What to light up on the diagram for what is being explained, when it is on screen. */
export interface Lit {
	step?: string;
	lifeline?: string;
	part?: string;
}

const placeOf = (explained: AppState['explained']): TermPlace | undefined =>
	explained?.kind === 'term' ? terms[explained.id].at : undefined;

const isThere = (place: TermPlace, view: DiagramView) =>
	(!place.step || view.steps.some((step) => step.id === place.step)) &&
	(!place.lifeline || view.lifelines.some((line) => line.id === place.lifeline));

export function litBy(state: AppState, view: DiagramView): Lit | null {
	if (state.explained?.kind !== 'term') return null;
	const term = terms[state.explained.id];
	if (term.part) return { part: term.id };
	const place = placeOf(state.explained);
	if (!place || place.diagram !== state.diagram || !isThere(place, view)) return null;
	return { step: place.step, lifeline: place.lifeline };
}

/** The state where a term can be seen, when it is not on screen as things stand. */
export function stateShowing(base: BaseFlow, state: AppState): AppState | null {
	const place = placeOf(state.explained);
	if (!place) return null;
	const diagram = base.diagrams[place.diagram];
	const here = place.diagram === state.diagram && isThere(place, evaluate(diagram, state.settings));
	if (here) return null;
	const settings = normalize({ ...state.settings, ...place.settings }).settings;
	const view = evaluate(diagram, settings);
	if (!isThere(place, view)) return null;
	return {
		...state,
		diagram: place.diagram,
		settings,
		step: place.step ?? state.step
	};
}
