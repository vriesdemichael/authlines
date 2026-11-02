import type { DiagramView, Lifeline } from '#lib/flow/model.ts';
import { KEYCLOAK_PHRASES, keycloakName } from '#lib/keycloak/words.ts';

/** Whose words the diagram is in. A view of the same steps, so it changes no flow (ADR-004). */
export type Wording = 'plain' | 'specs' | 'keycloak';

export const wordings: readonly Wording[] = ['plain', 'specs', 'keycloak'];

export const wordingNames: Readonly<Record<Wording, string>> = {
	plain: 'plain words',
	specs: 'the specs’ words',
	keycloak: 'Keycloak’s words'
};

/** Plain for someone new, and for someone who asked for the detail, what the docs will call it. */
/** What it says until someone chooses, because asking for more detail is not asking for new names. */
export const DEFAULT_WORDING: Wording = 'plain';

type Named = Pick<Lifeline, 'id' | 'plainName' | 'plainRole' | 'name' | 'role'>;

export function nameIn(line: Named, wording: Wording): string {
	if (wording === 'plain') return line.plainName;
	const theirs = wording === 'keycloak' ? keycloakName(line.id) : undefined;
	return theirs?.name ?? line.name;
}

export function roleIn(line: Named, wording: Wording): string {
	if (wording === 'plain') return line.plainRole;
	const theirs = wording === 'keycloak' ? keycloakName(line.id) : undefined;
	return theirs?.role ?? line.role;
}

/** Some words for a party, and what is around them that makes them mean something else. */
interface Party {
	phrases: Readonly<Record<string, string>>;
	/** "The demo app" is the one in the recording, whatever anyone calls the role it plays. */
	notAfter?: readonly string[];
	/** "API V2" is a version of a product, and "the app team" are people. */
	notBefore?: readonly string[];
}

const capital = (text: string) => text[0].toUpperCase() + text.slice(1);

// A person opens an app, whichever role it plays once they have.
const THE_APP_ITSELF = [
	'demo',
	'web',
	'Open the',
	'open the',
	'opens the',
	'opens a second',
	'opens another'
];

const theApp: Party = {
	notAfter: THE_APP_ITSELF,
	notBefore: ['team'],
	phrases: { 'an app': 'a client', app: 'client', apps: 'clients' }
};

// OpenID Connect Core says Client and Authorization Server 449 times, and Relying Party and OpenID
// Provider 112, because "the Client is called Relying Party (RP) in this case". So this stays the
// same when OpenID Connect goes on, and the head of a lifeline shows both.
const inTheSpecs: readonly Party[] = [
	theApp,
	{
		notAfter: ['demo', 'stored-token'],
		notBefore: ['V1', 'V2'],
		phrases: {
			'an API': 'a resource server',
			API: 'resource server',
			APIs: 'resource servers'
		}
	},
	{
		// The specs have no word that tells those apart from the one on the diagram.
		notAfter: ['upstream', 'External', 'external'],
		phrases: {
			'identity provider': 'authorization server',
			'identity providers': 'authorization servers',
			IdP: 'authorization server'
		}
	},
	{ phrases: { 'upstream IdP': 'upstream provider' } }
];

const inKeycloak: readonly Party[] = [theApp, { phrases: KEYCLOAK_PHRASES }];

const escaped = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(parties: readonly Party[]) {
	const table = new Map<string, string>();
	const pattern = parties
		.map(({ phrases, notAfter, notBefore }) => {
			const found = Object.entries(phrases).flatMap(([from, to]) => {
				table.set(capital(from), capital(to));
				// After that, because a name that starts with a capital is just itself.
				table.set(from, to);
				return [from, capital(from)];
			});
			const after = notAfter?.length ? `(?<!\\b(?:${notAfter.map(escaped).join('|')}) )` : '';
			const before = notBefore?.length ? `(?! (?:${notBefore.join('|')})\\b)` : '';
			// Longest first, so that "an app" is taken whole, for the sake of its article.
			const words = [...new Set(found)].sort((a, b) => b.length - a.length).map(escaped);
			return `${after}(?<![\\w/.-])(?:${words.join('|')})(?![\\w/-])${before}`;
		})
		.join('|');
	const words = new RegExp(pattern, 'g');
	return (text: string) =>
		text.replace(words, (found, at: number) => {
			const to = table.get(found) ?? found;
			// "API" looks the same at the start of a sentence as anywhere else.
			const starts = at === 0 || /[.?!]\s$/.test(text.slice(0, at));
			return starts && found === capital(found) ? capital(to) : to;
		});
}

export type Say = (text: string) => string;

// The same function each time, so that moving to another step does not look like a change of words.
const saying: Readonly<Record<Wording, Say>> = {
	plain: (text) => text,
	specs: compile(inTheSpecs),
	keycloak: compile(inKeycloak)
};

/**
 * Text in whichever words were chosen, wherever it names a party. Text is written in plain words, so
 * nothing has to be written three times, and a test walks the outcome. What explains a word, such as
 * the glossary, says what it means in plain words and does not go through this.
 */
export const sayer = (wording: Wording): Say => saying[wording];

/** A diagram with what it says in those words. Everything that is not words stays as it is. */
export function speak(view: DiagramView, say: Say): DiagramView {
	return {
		...view,
		steps: view.steps.map((step) => ({
			...step,
			plain: say(step.plain),
			label: say(step.label),
			concept: say(step.concept),
			inPractice: step.inPractice && say(step.inPractice),
			largerJob: step.largerJob && say(step.largerJob),
			pitfall: step.pitfall && {
				...step.pitfall,
				title: say(step.pitfall.title),
				text: say(step.pitfall.text),
				shows: step.pitfall.shows && say(step.pitfall.shows)
			},
			page: step.page && { ...step.page, shows: say(step.page.shows) },
			specOnly: step.specOnly && say(step.specOnly),
			recordedAs: step.recordedAs && say(step.recordedAs),
			links: step.links.map((link) => ({ ...link, text: say(link.text) })),
			practice: step.practice.map((example) => ({ ...example, text: say(example.text) })),
			fields: step.fields.map((field) => ({ ...field, note: field.note && say(field.note) }))
		})),
		groups: view.groups.map((group) => ({
			...group,
			plain: say(group.plain),
			label: say(group.label)
		})),
		parts: view.parts.map((part) => ({ ...part, why: say(part.why) }))
	};
}
