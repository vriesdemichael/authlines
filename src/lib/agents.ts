import { flows } from '#lib/flow/index.ts';
import { evaluate, type BaseFlow, type DiagramId } from '#lib/flow/model.ts';
import { LONGEST_NAME, NAMES_VERSION } from '#lib/flow/names.ts';
import {
	allValidSettings,
	defaultSettings,
	normalize,
	settingDefs,
	settingIds,
	type SettingId,
	type Settings
} from '#lib/flow/settings.ts';
import { recordedIndex } from '#lib/recordings/known.ts';
import { SITE_NAME, SITE_URL } from '#lib/site-url.ts';

/**
 * What an AI agent needs to write a link to someone's own case, made from the flow data, so the page
 * that says it cannot drift from what the site draws (#168, ADR-017).
 */
export interface GuideParty {
	id: string;
	/** What it is, in plain words. */
	kind: string;
	role: string;
	/** When the diagram has it, if not with the defaults. */
	when?: string;
}

export interface GuideDiagram {
	id: DiagramId;
	title: string;
	/** The address of this diagram, before the query. */
	address: string;
	parties: readonly GuideParty[];
	steps: readonly { id: string; says: string; when?: string }[];
}

export interface GuideSetting {
	param: string;
	label: string;
	/** What it is, in a line, as the settings panel says it. */
	summary: string;
	values: readonly string[];
	byDefault: string;
	/** When it is on offer, if not always. */
	only?: string;
	/** Values that need another setting with them, which a link names on its own in vain. */
	needs: readonly string[];
	/** Values that others turn off, when a link names both. */
	rulesOut: readonly string[];
	/** Two that go together only with a third, which a check of two at a time would call ruled out. */
	withThird: readonly string[];
}

export interface GuideFlow {
	id: string;
	title: string;
	summary: string;
	diagrams: readonly GuideDiagram[];
	settings: readonly GuideSetting[];
}

export interface Example {
	says: string;
	/** The address after the site's own, as an agent would write it. */
	path: string;
	/** Not a link that works, but what a link that does not fit gets back. */
	broken?: boolean;
}

const addressOf = (base: BaseFlow, diagram: DiagramId) =>
	`${SITE_URL}/${base.id}/${diagram === 'setup' ? 'setup/' : ''}`;

const TICK = '`';
const inCode = (text: string) => TICK + text + TICK;

/** One setting's value, as a link writes it. */
function paramOf(id: SettingId, value: unknown): string {
	const def = settingDefs[id];
	return `${def.param}=${def.kind === 'toggle' ? '1' : String(value)}`;
}

/** A combination the site accepts, and what a link has to say to get it. */
interface Combination {
	settings: Readonly<Settings>;
	/** What differs from the defaults, as a link writes it. */
	params: readonly string[];
}

/** Every combination a link can ask for, which leaves out what is not on offer. */
function combinationsOf(base: BaseFlow): Combination[] {
	const offered = base.settings.filter((id) => !settingDefs[id].notOnOffer);
	return allValidSettings(base.settings)
		.filter((settings) =>
			base.settings.every((id) => offered.includes(id) || settings[id] === defaultSettings[id])
		)
		.map((settings) => ({
			settings,
			params: offered
				.filter((id) => settings[id] !== defaultSettings[id])
				.map((id) => paramOf(id, settings[id]))
		}));
}

/** The fewest settings that give this, because a setting a link names on its own may need others. */
function smallest<T extends Combination>(combinations: readonly T[], has: (found: T) => boolean) {
	const found = combinations.filter(has);
	const least = Math.min(...found.map((combination) => combination.params.length));
	return found.filter((combination) => combination.params.length === least);
}

const MOST = 3;
const orList = (said: readonly string[]) =>
	said.length > MOST ? `${said.slice(0, MOST).join(' or ')}, among others` : said.join(' or ');
const queryOf = (combination: Combination) => inCode(combination.params.join('&'));

interface Value {
	id: SettingId;
	value: unknown;
	param: string;
	/** The fewest settings that give this value, with it among them. */
	least: readonly Combination[];
}

/** Each value a link can give a setting, with the fewest settings that give it. */
function valuesOf(base: BaseFlow, combinations: readonly Combination[]): Value[] {
	return base.settings.flatMap((id) => {
		const def = settingDefs[id];
		if (def.notOnOffer) return [];
		const values =
			def.kind === 'toggle'
				? [true]
				: def.options.map((option) => option.value).filter((value) => value !== def.default);
		return values.map((value) => ({
			id,
			value,
			param: paramOf(id, value),
			least: smallest(combinations, (found) => found.settings[id] === value)
		}));
	});
}

/** When a step or a party is drawn, said only where it is not drawn with the defaults. */
function whenDrawn(
	combinations: readonly Combination[],
	values: readonly Value[],
	drawn: (settings: Readonly<Settings>) => boolean
): string | undefined {
	const atDefaults = combinations.find((combination) => combination.params.length === 0);
	if (atDefaults && drawn(atDefaults.settings)) {
		const away = values.filter((value) => value.least[0] && !drawn(value.least[0].settings));
		// All of them, because an agent needs to know whether the one it is about to write is there.
		return away.length
			? `Not with ${away.map((value) => inCode(value.param)).join(' or ')}.`
			: undefined;
	}
	const found = smallest(combinations, (combination) => drawn(combination.settings));
	return found.length ? `Only with ${orList(found.map(queryOf))}.` : undefined;
}

function diagramOf(
	base: BaseFlow,
	id: DiagramId,
	combinations: readonly Combination[]
): GuideDiagram {
	const diagram = base.diagrams[id];
	const values = valuesOf(base, combinations);
	// What each combination draws, worked out once.
	const drawnWith = new Map(
		combinations.map((combination) => {
			const view = evaluate(diagram, combination.settings);
			return [
				combination.settings,
				{
					steps: view.steps,
					stepIds: new Set(view.steps.map((step) => step.id)),
					lines: new Set(view.lifelines.map((line) => line.id)),
					nameOf: new Map(view.lifelines.map((line) => [line.id, line.plainName]))
				}
			];
		})
	);
	const view = (settings: Readonly<Settings>) => drawnWith.get(settings)!;
	const parties = new Map<string, GuideParty>();
	for (const line of diagram.lifelines) {
		if (parties.has(line.id)) continue;
		if (!combinations.some((found) => view(found.settings).lines.has(line.id))) continue;
		// A setting can make one party two, such as the browser and an app that runs in it.
		const atDefaults = combinations.find((combination) => combination.params.length === 0);
		const usual = (atDefaults && view(atDefaults.settings).nameOf.get(line.id)) ?? line.plainName;
		const becomes = new Map<string, string[]>();
		for (const value of values) {
			const name = value.least[0] && view(value.least[0].settings).nameOf.get(line.id);
			if (name && name !== usual) becomes.set(name, [...(becomes.get(name) ?? []), value.param]);
		}
		const as = [...becomes].map(
			([name, params]) => `With ${params.map(inCode).join(' or ')} it is drawn as ${name}.`
		);
		parties.set(line.id, {
			id: line.id,
			kind: usual,
			role: line.plainRole,
			when:
				[whenDrawn(combinations, values, (settings) => view(settings).lines.has(line.id)), ...as]
					.filter(Boolean)
					.join(' ') || undefined
		});
	}
	// Every step this diagram can draw, with what simple mode calls it the first time it is there.
	const steps = new Map<string, string>();
	for (const found of combinations) {
		for (const step of view(found.settings).steps) {
			if (!steps.has(step.id)) steps.set(step.id, step.plain);
		}
	}
	return {
		id,
		title: diagram.title,
		address: addressOf(base, id),
		parties: [...parties.values()],
		steps: [...steps].map(([stepId, says]) => ({
			id: stepId,
			says,
			when: whenDrawn(combinations, values, (settings) => view(settings).stepIds.has(stepId))
		}))
	};
}

/**
 * Whether two values can be in one link: each with what it needs, both are still on afterwards, by the
 * same rules the screen uses (#177). Otherwise the link loses one of them, which one depending on the
 * rules, so an agent is told to leave the other out.
 */
function together(value: Value, other: Value): boolean {
	const own = value.least[0];
	const theirs = other.least[0];
	if (!own || !theirs) return false;
	const both: Settings = { ...own.settings };
	for (const id of settingIds) {
		if (theirs.settings[id] !== defaultSettings[id])
			Object.assign(both, { [id]: theirs.settings[id] });
	}
	const kept = normalize(both).settings;
	return kept[value.id] === value.value && kept[other.id] === other.value;
}

/** What one value can and cannot share a link with, among the other settings' values. */
function pairsOf(value: Value, values: readonly Value[]) {
	const others = values.filter((other) => other.id !== value.id && other.least[0]);
	return {
		goes: others.filter((other) => together(value, other)),
		not: others.filter((other) => !together(value, other))
	};
}

const andList = (said: readonly string[]) =>
	new Intl.ListFormat('en', { type: 'conjunction' }).format(said);
const andOr = (said: readonly string[]) =>
	new Intl.ListFormat('en', { type: 'disjunction' }).format(said);

function settingsOf(base: BaseFlow, combinations: readonly Combination[]): GuideSetting[] {
	const values = valuesOf(base, combinations);
	return base.settings.flatMap((id) => {
		const def = settingDefs[id];
		if (def.notOnOffer) return [];
		const all = def.kind === 'toggle' ? ['1'] : def.options.map((option) => String(option.value));
		const byDefault = def.kind === 'toggle' ? 'off' : String(def.default);
		// A value a link names on its own is turned off when it needs another, so say which.
		const needs = values
			.filter((value) => value.id === id && (value.least[0]?.params.length ?? 0) > 1)
			.map((value) => {
				const others = value.least.map((found) =>
					inCode(found.params.filter((param) => param !== value.param).join('&'))
				);
				return `${inCode(value.param)} needs ${orList(others)} with it.`;
			});
		// And what it does not go with, which a link that names both loses without a word (#177).
		const said = (some: readonly Value[]) => some.map((other) => inCode(other.param));
		const rulesOut = values
			.filter((value) => value.id === id)
			.flatMap((value) => {
				const { goes, not } = pairsOf(value, values);
				const never = not.filter((other) => !withMore(value, other, combinations).length);
				// Whichever list is shorter, because a value drawn only in the plain case goes with few.
				if (goes.length < not.length) {
					return [
						goes.length
							? `${inCode(value.param)} goes only with ${andList(said(goes))} among the other settings, so leave the rest out.`
							: `${inCode(value.param)} goes with none of the other settings yet, so leave them out.`
					];
				}
				return never.length
					? [`${inCode(value.param)} does not go with ${andOr(said(never))}.`]
					: [];
			});
		// Two that a link loses one of, unless a third is there too, which two at a time cannot see.
		const withThird = values
			.filter((value) => value.id === id)
			.flatMap((value) =>
				pairsOf(value, values).not.flatMap((other) => {
					const third = withMore(value, other, combinations);
					return third.length
						? [
								`${inCode(value.param)} goes with ${inCode(other.param)} only with ${orList(third)} as well.`
							]
						: [];
				})
			);
		return [
			{
				param: def.param,
				label: def.label,
				summary: def.summary,
				values: all,
				byDefault,
				only: def.requires?.because,
				needs,
				rulesOut,
				withThird
			}
		];
	});
}

/**
 * What else has to be in a link for two values that do not go together alone, from the smallest drawn
 * combinations that have both, as each would be written. Nothing when no combination has both.
 */
function withMore(value: Value, other: Value, combinations: readonly Combination[]): string[] {
	const both = smallest(
		combinations,
		(found) => found.settings[value.id] === value.value && found.settings[other.id] === other.value
	);
	const own = new Set([...(value.least[0]?.params ?? []), ...(other.least[0]?.params ?? [])]);
	return both.map((found) => inCode(found.params.filter((param) => !own.has(param)).join('&')));
}

export const guide: readonly GuideFlow[] = Object.values(flows).map((base) => {
	const combinations = combinationsOf(base);
	return {
		id: base.id,
		title: base.diagrams.flow.title,
		summary: base.diagrams.flow.summary,
		diagrams: (Object.keys(base.diagrams) as DiagramId[]).map((id) =>
			diagramOf(base, id, combinations)
		),
		settings: settingsOf(base, combinations)
	};
});

/** How the view is shown, on any flow. None of these changes the flow (ADR-004). */
export const viewSwitches: readonly { param: string; says: string }[] = [
	{
		param: 'mode=advanced',
		says: 'Raw requests and answers, which spec says so, and server notes.'
	},
	{ param: 'step=<id>', says: 'The step to open on, by the ids listed for each diagram.' },
	{ param: 'say=specs', says: 'The specs’ names for the parties. say=keycloak for Keycloak’s.' },
	{
		param: 'keycloak=off',
		says: 'No notes about Keycloak. Use this when the person’s identity provider is something else, and give it its name with idp=. When only the provider it hands logins to is something else, keep the notes and name that one with upstream=. The traffic shown is still the site’s own Keycloak’s, and the raw view says so.'
	},
	{
		param: 'eyes=<party>',
		says: 'The whole flow as one party saw it, such as eyes=browser, for a question about what one party can see. It works with step=.'
	},
	{ param: 'whole=1', says: 'Every step at once, for a room.' }
];

export const nameRules: readonly string[] = [
	`They go after #, start with v=${NAMES_VERSION}, and name parties by the ids listed for each flow: #v=${NAMES_VERSION}&app=Payroll&idp=Entra%20ID.`,
	'They change the names on the heads of the diagram and nothing else. Every request and answer shown stays the one recorded on the site’s own server, and the raw view says which recorded value is which named party.',
	`A name is plain text of at most ${LONGEST_NAME} characters, in any language. No < or >, no address, nothing that looks like a token, and no characters that do not show, such as one that only changes the direction of text.`,
	'Encode each name as a value in a query string: %20 or + for a space, %26 for &, %23 for #, and other letters as UTF-8.',
	'The part after # stays in the browser and never reaches a server. Anyone the link is shared with sees the names, so never put a secret in one.',
	'A party the flow has, but that these settings do not draw, is simply not shown. A party the flow does not have, or a name that does not fit, is left out and said, beside the diagram.'
];

export const examples: readonly Example[] = [
	{
		says: 'A web app on a server, logging people in with OpenID Connect and PKCE, at a provider that is not Keycloak.',
		path: 'authorization-code/?oidc=1&pkce=1&keycloak=off#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API'
	},
	{
		says: 'The same app, where the identity provider sends the code back through the browser, in advanced mode.',
		path: 'authorization-code/?mode=advanced&oidc=1&pkce=1&keycloak=off&step=redirect-with-code#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API'
	},
	{
		says: 'How that app gets set up with its provider.',
		path: 'authorization-code/setup/?oidc=1&pkce=1&keycloak=off#v=1&app=Payroll&idp=Entra%20ID&app-team=Payroll%20team&idp-admin=IT'
	},
	{
		says: 'A job with no user, calling an API with a token of its own.',
		path: 'client-credentials/#v=1&app=Nightly%20export&api=Billing%20API'
	},
	{
		says: 'A television app where the person logs in on their phone.',
		path: 'device/#v=1&app=Living%20room%20TV&browser=Their%20phone'
	},
	{
		says: 'A link with no version, which draws the site’s own names and says why.',
		path: 'authorization-code/#app=Payroll',
		broken: true
	}
];

export const exampleAddress = (example: Example) => `${SITE_URL}/${example.path}`;

/** Text with Markdown's backticks, in parts, so that a page can show the code in it as code. */
export const codeParts = (text: string) => text.split('`');

/** What the page tells an agent first, here so that the page and the Markdown say the same. */
export const forAnAgent: readonly string[] = [
	`${SITE_NAME} draws OAuth and OpenID Connect flows as sequence diagrams, recorded from a real Keycloak ${recordedIndex.keycloak}. If you are an agent helping someone with their own system, you can link to the flow and settings that match it, open it on the step you are explaining, and put their names on the parties. They get a diagram to step through, with who has seen what, and the requests a real server sent.`,
	'Nothing here contacts their system. You describe it with a link, and the site draws its own recording with their names on it.'
];

export const addressFormat = `${SITE_URL}/<flow>/[setup/]?<settings and view>#v=${NAMES_VERSION}&<party>=<name>`;

export const aboutTheAddress =
	'Leave out a setting to keep its default. The flow, its settings and the step are in the query, so the link opens exactly that. A setting that does not fit with the others is turned off, and the screen says why. A step these settings do not draw opens the nearest one before it that they do, and with no step it opens at the start.';

/** What a setting's own note means, which is written for someone looking at the screen. */
export const SETTING_NOTES =
	'Each value says what it needs with it, and what it can share a link with, worked out from the rules the screen uses, two settings at a time. A link that names two that do not go together loses one of them.';

/**
 * What people bring that the site does not draw, so that an agent says so instead of linking to
 * something near it. Each is a term the search says is not here yet, and a test holds it to that.
 */
export const notDrawn: readonly { says: string; term: string }[] = [
	// A program on the user's computer is drawn (#178), and an app on a phone is not.
	{
		says: 'apps on a phone',
		term: 'mobile app'
	},
	{ says: 'a PKCE downgrade', term: 'pkce downgrade' },
	{ says: 'NTLM', term: 'ntlm' },
	{ says: 'client certificates', term: 'client certificate' }
];

/** Drawn shorter than it can be, so that an agent links to it and says what is left out (#181). */
export const drawnShorter =
	'A login the other provider hands on again, to a provider behind it, is drawn as one hop, and `broker=1&step=upstream-authorize` says why.';

/** The list, as a sentence says it. */
export const notDrawnSaid = new Intl.ListFormat('en', { type: 'disjunction' }).format(
	notDrawn.map((item) => item.says)
);

/** Where the agent's own copies are, on the site. */
// A page's Markdown copy is at index.html.md beside it, as llms.txt proposes (llmstxt.org, v2).
export const REFERENCE_PATH = 'for-agents/index.html.md';
/** Where the reference goes inside the skill, by the Agent Skills layout (agentskills.io). */
export const SKILL_REFERENCE = 'references/reference.md';
export const SKILL_PATH = 'for-agents/authlines-skill.zip';
export const SKILL_NAME = 'authlines';

const NL = String.fromCharCode(10);
const list = (items: readonly string[]) => items.map((item) => `- ${item}`).join(NL);
const code = (text: string) => `\`${text}\``;

/** The same as the page for agents, as Markdown, for an agent that reads files rather than pages. */
export function referenceMarkdown(): string {
	const parts = [
		`# ${SITE_NAME}: links for an AI agent`,
		...forAnAgent,
		'## The address',
		code(addressFormat),
		aboutTheAddress,
		'## What is not drawn here',
		`${SITE_NAME} does not draw ${notDrawnSaid}.`,
		drawnShorter,
		'## Names for the parties',
		list(nameRules),
		'## Examples',
		list(
			examples.map(
				(example) =>
					`${example.says}${example.broken ? ' Not a link that works:' : ''} ${code(exampleAddress(example))}`
			)
		),
		'## How it is shown',
		list(viewSwitches.map((view) => `${code(view.param)}: ${view.says}`)),
		...guide.flatMap((flow) => [
			`## ${flow.title}: ${code(flow.id)}`,
			flow.summary,
			'### Settings',
			SETTING_NOTES,
			list(
				flow.settings.map((setting) =>
					[
						`${code(`${setting.param}=${setting.values.join(' | ')}`)}: ${setting.label}, ${setting.byDefault} by default. ${setting.summary}`,
						setting.only,
						...setting.needs,
						...setting.rulesOut,
						...setting.withThird
					]
						.filter(Boolean)
						.join(' ')
				)
			),
			...flow.diagrams.flatMap((diagram) => [
				`### ${diagram.title}: ${code(diagram.address)}`,
				'Parties, for the names after #:',
				list(
					diagram.parties.map(
						(party) =>
							`${code(party.id)}: ${party.kind}, ${party.role.toLowerCase()}.${party.when ? ` ${party.when}` : ''}`
					)
				),
				'Steps, for step=:',
				list(
					diagram.steps.map(
						(step) => `${code(step.id)}: ${step.says}.${step.when ? ` ${step.when}` : ''}`
					)
				)
			])
		])
	];
	return parts.join(NL + NL) + NL;
}

/** When an agent should reach for the skill, which is what it reads before anything else. */
export const skillDescription = `Links to ${SITE_NAME}, OAuth and OpenID Connect flows drawn as sequence diagrams and recorded from a real Keycloak, opened on the flow, settings and step that match the user's own system, with their names on the parties. Use when explaining how login, tokens, PKCE, redirects, consent, single sign-on, an identity provider's setup, a service calling an API with its own token, or logging in on another device works for their app, or why a step is there.`;

/** The skill an agent installs, as one file. The reference it points to goes beside it. */
export function skillMarkdown(): string {
	const flowsLine = (flow: GuideFlow) => {
		const setup = flow.diagrams.find((diagram) => diagram.id === 'setup');
		return `${code(flow.id)}: ${flow.summary}${setup ? ` How it is set up, before anyone logs in, is at ${code(`${flow.id}/setup/`)}.` : ''}`;
	};
	const parts = [
		[
			'---',
			`name: ${SKILL_NAME}`,
			// Quoted, so that no word in it can be read as YAML.
			`description: ${JSON.stringify(skillDescription)}`,
			// Words are content, under CC BY 4.0 (ADR-009).
			'license: CC-BY-4.0',
			'---'
		].join(NL),
		`# Linking to ${SITE_NAME}`,
		forAnAgent[0],
		'When you explain one of these flows for the user’s own system, add one link that opens the matching flow on the step you are explaining, with their names on the parties. Say once in the conversation that the names on the diagram are theirs, and that what it shows was recorded on the site’s own server, not on theirs.',
		'## Writing the link',
		code(addressFormat),
		[
			`1. Pick the flow:${NL}${guide.map((flow) => `   - ${flowsLine(flow)}`).join(NL)}`,
			'2. Add the settings that match their system, and leave the rest out. Add `oidc=1` when the app logs people in to know who they are, because without it the flow only gets access to an API. Some settings need another with them, and some do not go with others. A link loses what does not fit, so check the reference for each value you add.',
			'3. Add `step=<id>` for the step you are explaining, and leave it out for a question about the whole flow. The reference says which settings each step needs.',
			`4. Add their names after #, starting with ${code(`v=${NAMES_VERSION}`)}, by the party ids the reference lists. It says which settings draw each party, and a name for one that is not drawn does not show.`,
			'5. If their identity provider is not Keycloak, or they do not say which it is, add `keycloak=off`, and name it with `idp=` if you know it. If it is Keycloak, keep the notes about it, and you can still give it their name for it.',
			'6. Match what they told you. Where they did not say, pick what current advice has, such as `pkce=1` for an app with no secret, and say that you did.',
			'7. Add `mode=advanced` when they ask what is sent, which parameters, or which spec says so. Leave it out for how and why.'
		].join(NL),
		aboutTheAddress,
		'## What is not drawn here',
		`Do not link to something near it. Say that ${SITE_NAME} does not draw ${notDrawnSaid}.`,
		drawnShorter,
		'## Names for the parties',
		list(nameRules),
		'## How it is shown',
		list(viewSwitches.map((view) => `${code(view.param)}: ${view.says}`)),
		'## Examples',
		list(
			examples
				.filter((example) => !example.broken)
				.map((example) => `${example.says} ${code(exampleAddress(example))}`)
		),
		'## The reference',
		`[The reference](${SKILL_REFERENCE}) lists every flow’s settings, parties and steps. The site keeps a current copy at ${SITE_URL}/${REFERENCE_PATH}. If a link you write does not open what you meant, the site may have changed since this copy, so read that one.`
	];
	return parts.join(NL + NL) + NL;
}

/** What the plugin says it does, where an agent's list of plugins shows it. */
export const pluginDescription = `Lets your agent link to the recorded OAuth or OpenID Connect flow on ${SITE_NAME} that matches your system, on the step it is explaining, with your names on the parties.`;

const REPOSITORY = 'https://github.com/vriesdemichael/authlines';
const AUTHOR = { name: 'Michael de Vries' };
const TAB = String.fromCharCode(9);
const json = (value: unknown) => JSON.stringify(value, null, TAB) + NL;

/** Where Claude Code finds the plugin in this repository, and the skill inside it. */
export const PLUGIN_DIR = `plugins/${SKILL_NAME}`;

/**
 * This repository as a plugin marketplace with one plugin, which holds the skill, so that
 * `/plugin marketplace add vriesdemichael/authlines` finds it. Written by `pnpm agent-skill`, and a
 * test fails when what is committed is not what this makes.
 */
export function pluginFiles(): { path: string; text: string }[] {
	const skillDir = `${PLUGIN_DIR}/skills/${SKILL_NAME}`;
	return [
		{
			path: '.claude-plugin/marketplace.json',
			text: json({
				name: SKILL_NAME,
				// No version anywhere, so that an update follows the commits (code.claude.com, plugins).
				description: pluginDescription,
				owner: AUTHOR,
				plugins: [{ name: SKILL_NAME, source: `./${PLUGIN_DIR}`, description: pluginDescription }]
			})
		},
		{
			path: `${PLUGIN_DIR}/.claude-plugin/plugin.json`,
			text: json({
				name: SKILL_NAME,
				description: pluginDescription,
				author: AUTHOR,
				homepage: `${SITE_URL}/for-agents/`,
				repository: REPOSITORY,
				license: 'CC-BY-4.0'
			})
		},
		{ path: `${skillDir}/SKILL.md`, text: skillMarkdown() },
		{ path: `${skillDir}/${SKILL_REFERENCE}`, text: referenceMarkdown() }
	];
}

/** The two commands that install the plugin in Claude Code, tried with `claude plugin` 2.1.296. */
export const claudeCodeInstall = [
	'/plugin marketplace add vriesdemichael/authlines',
	`/plugin install ${SKILL_NAME}@${SKILL_NAME}`
].join(NL);

/** For an agent with no skills, a line someone adds to its instructions. */
export const pasteInstruction = `When you explain OAuth or OpenID Connect for my own systems, read ${SITE_URL}/${REFERENCE_PATH} and link to the matching flow on ${SITE_NAME}, on the step you are explaining, with my names on the parties.`;

/** Where agents other than Claude Code read skills from, by their own docs on 2026-11-05. */
export const sharedSkillsFolder = '~/.agents/skills/';
export const claudeSkillsFolder = '~/.claude/skills/';
