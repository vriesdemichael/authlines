import { terms, type Term } from '#lib/flow/glossary.ts';
import { authorizationCodeBase as base, flows } from '#lib/flow/index.ts';
import {
	evaluate,
	type BaseFlow,
	type DiagramId,
	type DiagramView,
	type StepDef
} from '#lib/flow/model.ts';
import {
	defaultSettings,
	normalize,
	settingDefs,
	settingIds,
	type Settings
} from '#lib/flow/settings.ts';
import { serializeState, type AppState } from '#lib/flow/state.ts';
import { artifacts } from '#lib/flow/vocabulary.ts';
import { notesFor } from '#lib/keycloak/notes.ts';
import { allNodes, mapNodes, nodeSettings } from '#lib/map/nodes.ts';
import { settingsOf } from '#lib/recordings/known.ts';
import { knownErrors, notHereYet } from '#lib/search/errors.ts';
import { resultKey } from '#lib/search/result-key.ts';

export type ResultKind = 'error' | 'question' | 'word' | 'setting' | 'step' | 'note';

/** A state on the one application screen, which is all a result ever is (ADR-003). */
export interface Result {
	kind: ResultKind;
	title: string;
	/** Why it matched, or what it means, in a line. */
	says: string;
	flow: string;
	/** A question's own address, or setup's, or nothing for the user flow. */
	view?: string;
	query: string;
}

export interface Found {
	results: Result[];
	/** Asked about something this application does not cover yet. */
	notHereYet: string | null;
	/** Nothing has all of what was typed, so these have most of it, and it should say so. */
	closest?: boolean;
}

/** All the fields, including those only some settings bring, because that is what someone looks for. */
function saidAt(step: StepDef, shown: DiagramView['steps'][number]): string {
	const fields = (step.fields ?? []).map((field) => `${field.name} ${field.note ?? ''}`).join(' ');
	const pitfall = shown.pitfall ? `${shown.pitfall.title} ${shown.pitfall.text}` : '';
	return `${shown.concept} ${shown.inPractice ?? ''} ${pitfall} ${fields}`;
}

interface Entry {
	result: Result;
	/** What counts most towards a match. */
	title: string;
	text: string;
	/** Exactly this is what it is, so it goes first. */
	exactly?: readonly string[];
}

const lower = (text: string) => text.toLowerCase();

function stateAt(
	diagram: DiagramId,
	settings: Partial<Settings>,
	step: string | null,
	mode: AppState['mode'],
	explained: AppState['explained'] = null
): AppState {
	return {
		flow: base.id,
		diagram,
		mode,
		settings: normalize({ ...defaultSettings, ...settings }).settings,
		step: step ?? base.diagrams[diagram].steps[0].id,
		source: null,
		explained,
		serverNotes: true,
		settingsHidden: false,
		eyes: null,
		follow: null,
		wording: null,
		list: false,
		whole: false,
		raw: false
	};
}

const otherFlows = Object.values(flows).filter((other) => other.id !== base.id);

const stateIn = (
	other: BaseFlow,
	diagram: DiagramId,
	settings: Settings,
	step: string
): AppState => ({
	flow: other.id,
	diagram,
	mode: 'advanced',
	settings,
	step,
	source: null,
	explained: null,
	serverNotes: true,
	settingsHidden: false,
	eyes: null,
	follow: null,
	wording: null,
	list: false,
	whole: false,
	raw: false
});

function resultAt(kind: ResultKind, title: string, says: string, state: AppState): Result {
	return {
		kind,
		title,
		says,
		flow: base.id,
		view: state.diagram === 'setup' ? 'setup' : undefined,
		query: serializeState(base, state)
	};
}

/** The settings that show a step, going by the named states, so that a recording usually has it. */
function settingsShowing(diagram: DiagramId, step: string): Settings | null {
	const candidates = [defaultSettings, ...base.presets.map(settingsOf)];
	return (
		candidates.find((settings) =>
			evaluate(base.diagrams[diagram], settings).steps.some((s) => s.id === step)
		) ?? null
	);
}

/** What the panel will say about it, because some words say it where the thing itself is defined. */
function meaningOf(term: Term) {
	if (term.artifact) return artifacts[term.artifact].explains;
	if (term.setting) return settingDefs[term.setting].why;
	return term.explains;
}

function allEntries(): Entry[] {
	const entries: Entry[] = [];

	for (const node of mapNodes) {
		entries.push({
			result: {
				kind: 'question',
				title: node.title,
				says: node.answer,
				flow: node.flow,
				view: node.id,
				query: ''
			},
			title: node.title,
			text: `${node.summary} ${node.answer} ${node.alsoAskedAs?.join(' ') ?? ''}`,
			exactly: node.alsoAskedAs?.map(lower)
		});
	}

	for (const term of Object.values(terms)) {
		if (term.part) continue;
		const explained = { kind: 'term', id: term.id } as const;
		const place = term.at;
		const state = stateAt(
			place?.diagram ?? 'flow',
			place?.settings ?? {},
			place?.step ?? null,
			'simple',
			explained
		);
		const text = [...term.words, ...(term.alsoCalled ?? [])].join(' ');
		const elsewhere = term.opens && flows[term.opens.flow];
		const firstSettings =
			elsewhere && normalize({ ...defaultSettings, ...elsewhere.presets[0].settings }).settings;
		entries.push({
			result:
				elsewhere && firstSettings && term.opens
					? {
							kind: 'word',
							title: term.name,
							says: meaningOf(term),
							flow: elsewhere.id,
							query: serializeState(elsewhere, {
								...stateIn(elsewhere, 'flow', firstSettings, term.opens.step),
								mode: 'simple',
								explained
							})
						}
					: resultAt('word', term.name, meaningOf(term), state),
			title: `${term.name} ${text}`,
			text: term.explains,
			exactly: [term.name, ...term.words, ...(term.alsoCalled ?? [])].map(lower)
		});
	}

	for (const id of settingIds) {
		const def = settingDefs[id];
		const state = stateAt('flow', {}, null, def.simple ? 'simple' : 'advanced', {
			kind: 'setting',
			id
		});
		entries.push({
			result: resultAt('setting', def.simple?.label ?? def.label, def.summary, state),
			title: `${def.label} ${def.simple?.label ?? ''}`,
			text: `${def.summary} ${def.why}`
		});
	}

	for (const other of otherFlows) {
		const start = normalize({ ...defaultSettings, ...other.presets[0].settings }).settings;
		const first = other.diagrams.flow.steps[0].id;
		const shownFirst = evaluate(other.diagrams.flow, start).steps[0].id;
		entries.push({
			result: {
				kind: 'step',
				title: other.diagrams.flow.title,
				says: other.diagrams.flow.summary,
				flow: other.id,
				query: serializeState(other, stateIn(other, 'flow', start, shownFirst ?? first))
			},
			title: other.diagrams.flow.title,
			text: `${other.diagrams.flow.summary} ${other.diagrams.flow.intro}`
		});
		for (const diagram of ['flow', 'setup'] as const) {
			for (const step of other.diagrams[diagram].steps) {
				const settings = normalize({ ...defaultSettings, ...other.presets[0].settings }).settings;
				const shown = evaluate(other.diagrams[diagram], settings).steps.find(
					(candidate) => candidate.id === step.id
				);
				if (!shown) continue;
				const state = stateIn(other, diagram, settings, step.id);
				entries.push({
					result: {
						kind: 'step',
						title: shown.plain,
						says: other.diagrams.flow.title,
						flow: other.id,
						view: diagram === 'setup' ? 'setup' : undefined,
						query: serializeState(other, state)
					},
					title: `${shown.plain} ${shown.label}`,
					text: saidAt(step, shown)
				});
				for (const note of notesFor(other.id, step.id, settings)) {
					entries.push({
						result: {
							kind: 'note',
							title: note.title,
							says: shown.plain,
							flow: other.id,
							view: diagram === 'setup' ? 'setup' : undefined,
							query: serializeState(other, state)
						},
						title: note.title,
						text: note.text
					});
				}
			}
		}
	}

	for (const diagram of ['flow', 'setup'] as const) {
		for (const step of base.diagrams[diagram].steps) {
			const settings = settingsShowing(diagram, step.id);
			if (!settings) continue;
			const shown = evaluate(base.diagrams[diagram], settings).steps.find((s) => s.id === step.id);
			if (!shown) continue;
			const state = stateAt(diagram, settings, step.id, 'advanced');
			entries.push({
				result: resultAt('step', shown.plain, shown.label, state),
				title: `${shown.plain} ${shown.label}`,
				text: saidAt(step, shown)
			});
			for (const note of notesFor(base.id, step.id, settings)) {
				entries.push({
					result: resultAt('note', note.title, shown.plain, state),
					title: note.title,
					text: note.text
				});
			}
		}
	}

	return entries;
}

let cached: { entries: Entry[]; errors: Result[] } | null = null;
function index() {
	cached ??= {
		entries: allEntries(),
		errors: knownErrors.map((known) => {
			if (known.flow) {
				const other = flows[known.flow];
				const settings = normalize({ ...defaultSettings, ...known.settings }).settings;
				const about = allNodes.find((node) => node.id === known.question);
				return {
					kind: 'error' as const,
					title: known.text,
					says: known.means,
					flow: other.id,
					view: about?.id,
					query: serializeState(other, {
						...stateIn(other, 'flow', settings, known.step),
						mode: about?.mode ?? 'advanced'
					})
				};
			}
			const state = stateAt('flow', known.settings, known.step, 'advanced');
			const result = resultAt('error', known.text, known.means, state);
			// On the address of a question about this very error, which says at the top what it means.
			const about = mapNodes.find(
				(node) =>
					node.diagram === 'flow' &&
					node.title.includes(known.text) &&
					JSON.stringify(nodeSettings(node)) === JSON.stringify(state.settings)
			);
			return about ? { ...result, view: about.id } : result;
		})
	};
	return cached;
}

const LITTLE_WORDS = new Set(
	'a an and are at be can do does for from get how i if in is it my of on or that the this to what when why with you your could should would where which there will need about'.split(
		' '
	)
);

/** Words worth looking for. A pasted line also has timestamps, IDs and addresses around the error. */
function wordsOf(query: string): string[] {
	return lower(query)
		.split(/[\s,;:()[\]{}"'=/\\|<>]+/)
		.filter((word) => word && !LITTLE_WORDS.has(word))
		.filter((word) => !/^[\d.:tz-]+$/.test(word) || /^[1-5]\d\d$/.test(word))
		.filter((word) => word.length < 40);
}

/** A short word only counts as a word, or SPA is found in lifespan. */
function has(text: string, word: string) {
	if (word.length > 3) return text.includes(word);
	const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(^|[^a-z0-9])${safe}($|[^a-z0-9])`).test(text);
}

const scoreOf = (entry: Entry, phrase: string, words: readonly string[], needed = words.length) => {
	const title = lower(entry.title);
	const text = lower(entry.text);
	const inTitle = words.filter((word) => has(title, word)).length;
	const inText = words.filter((word) => has(text, word)).length;
	const matched = words.filter((word) => has(title, word) || has(text, word)).length;
	if (matched < needed) return 0;
	return (
		(entry.exactly?.includes(phrase) ? 100 : 0) +
		(title.includes(phrase) ? 40 : 0) +
		(text.includes(phrase) ? 20 : 0) +
		inTitle * 5 +
		inText
	);
};

const ORDER: readonly ResultKind[] = ['question', 'word', 'setting', 'step', 'note'];

/** Words nearly everything here has, which say nothing about what someone is after. */
const COMMON_WORDS = new Set(
	'app apps client code error errors flow invalid log login request response token tokens user users'.split(
		' '
	)
);
const LIMIT = 8;

/** The states that answer what someone typed, with an exact error first. */
export function search(typed: string): Found {
	const query = typed
		.trim()
		.replace(/^what(?:'s| is| are)\s+(?:an?\s+|the\s+)?/i, '')
		.replace(/\?$/, '');
	const asked = query.trim();
	const phrase = lower(asked);
	if (phrase.length < 2) return { results: [], notHereYet: null };
	const { entries, errors } = index();

	const pasted = errors.filter((error) => phrase.includes(lower(error.title)));
	const longestFirst = [...pasted].sort((a, b) => b.title.length - a.title.length);
	const partOfAnError = errors.filter(
		(error) => phrase.length >= 4 && lower(error.title).includes(phrase) && !pasted.includes(error)
	);

	const missing = notHereYet.find((topic) => phrase.includes(topic)) ?? null;
	if (missing && !pasted.length) return { results: [], notHereYet: missing };

	// A pasted line says plenty besides the error, which should not get in the way of it.
	const words = wordsOf(query);
	const ranked = (wanted: readonly string[], needed: number) =>
		entries
			.map((entry) => ({ entry, score: scoreOf(entry, phrase, wanted, needed) }))
			.filter(({ score }) => score > 0)
			.sort(
				(a, b) =>
					b.score - a.score ||
					ORDER.indexOf(a.entry.result.kind) - ORDER.indexOf(b.entry.result.kind)
			);
	const all = pasted.length || !words.length ? [] : ranked(words, words.length);
	const telling = words.filter((word) => !COMMON_WORDS.has(word));
	const closest =
		!all.length && !pasted.length && !partOfAnError.length && words.length > 1 && telling.length
			? ranked(telling, Math.ceil(telling.length / 2))
			: [];
	// A word's own entry, ahead of errors that only happen to have that word in them.
	const itself = all.filter(({ entry }) => entry.exactly?.includes(phrase));
	const others = [...all, ...closest].map(({ entry }) => entry.result);

	const seen = new Set<string>();
	const results = [
		...longestFirst,
		...itself.map(({ entry }) => entry.result),
		...partOfAnError,
		...others
	].filter((result) => {
		const key = resultKey(result);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	return {
		results: results.slice(0, LIMIT),
		notHereYet: null,
		closest: closest.length > 0
	};
}
