import { flows } from '#lib/flow/index.ts';
import { evaluate, type BaseFlow, type DiagramId } from '#lib/flow/model.ts';
import { LONGEST_NAME, NAMES_VERSION } from '#lib/flow/names.ts';
import { allValidSettings, settingDefs } from '#lib/flow/settings.ts';
import { SITE_URL } from '#lib/site-url.ts';

/**
 * What an AI agent needs to write a link to someone's own case, made from the flow data, so the page
 * that says it cannot drift from what the site draws (#168, ADR-017).
 */
export interface GuideParty {
	id: string;
	/** What it is, in plain words. */
	kind: string;
	role: string;
}

export interface GuideDiagram {
	id: DiagramId;
	title: string;
	/** The address of this diagram, before the query. */
	address: string;
	parties: readonly GuideParty[];
	steps: readonly { id: string; says: string }[];
}

export interface GuideSetting {
	param: string;
	label: string;
	values: readonly string[];
	byDefault: string;
	/** When it is on offer, if not always. */
	only?: string;
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

function diagramOf(base: BaseFlow, id: DiagramId): GuideDiagram {
	const diagram = base.diagrams[id];
	const parties = new Map<string, GuideParty>();
	for (const line of diagram.lifelines) {
		if (!parties.has(line.id)) {
			parties.set(line.id, { id: line.id, kind: line.plainName, role: line.plainRole });
		}
	}
	// Every step this diagram can draw, with what simple mode calls it the first time it is there.
	const steps = new Map<string, string>();
	for (const settings of allValidSettings(base.settings)) {
		for (const step of evaluate(diagram, settings).steps) {
			if (!steps.has(step.id)) steps.set(step.id, step.plain);
		}
	}
	return {
		id,
		title: diagram.title,
		address: addressOf(base, id),
		parties: [...parties.values()],
		steps: [...steps].map(([stepId, says]) => ({ id: stepId, says }))
	};
}

function settingsOf(base: BaseFlow): GuideSetting[] {
	return base.settings.flatMap((id) => {
		const def = settingDefs[id];
		if (def.notOnOffer) return [];
		const values =
			def.kind === 'toggle' ? ['1'] : def.options.map((option) => String(option.value));
		const byDefault = def.kind === 'toggle' ? 'off' : String(def.default);
		return [{ param: def.param, label: def.label, values, byDefault, only: def.requires?.because }];
	});
}

export const guide: readonly GuideFlow[] = Object.values(flows).map((base) => ({
	id: base.id,
	title: base.diagrams.flow.title,
	summary: base.diagrams.flow.summary,
	diagrams: (Object.keys(base.diagrams) as DiagramId[]).map((id) => diagramOf(base, id)),
	settings: settingsOf(base)
}));

/** How the view is shown, on any flow. None of these changes the flow (ADR-004). */
export const viewSwitches: readonly { param: string; says: string }[] = [
	{
		param: 'mode=advanced',
		says: 'Raw requests and answers, which spec says so, and server notes.'
	},
	{ param: 'step=<id>', says: 'The step to open on. Each diagram lists its steps below.' },
	{ param: 'say=specs', says: 'The specs’ names for the parties. say=keycloak for Keycloak’s.' },
	{
		param: 'keycloak=off',
		says: 'No notes about Keycloak. Use this when the person’s identity provider is something else.'
	},
	{ param: 'eyes=<party>', says: 'The whole flow as one party saw it, such as eyes=browser.' },
	{ param: 'whole=1', says: 'Every step at once, for a room.' }
];

export const nameRules: readonly string[] = [
	`They go after #, start with v=${NAMES_VERSION}, and name parties by the ids listed for each flow: #v=${NAMES_VERSION}&app=Payroll&idp=Entra%20ID.`,
	'They change the names on the heads of the diagram and nothing else. Every request and answer shown stays the one recorded on the site’s own server, and the raw view says which recorded value is which named party.',
	`A name is plain text of at most ${LONGEST_NAME} characters. No < or >, no address, nothing that looks like a token, and nothing that does not show.`,
	'The part after # stays in the browser and never reaches a server. Anyone the link is shared with sees the names, so never put a secret in one.',
	'A party the flow has, but that these settings do not draw, is simply not shown. A party the flow does not have, or a name that does not fit, is left out and said, beside the diagram.'
];

export const examples: readonly Example[] = [
	{
		says: 'A web app on a server, logging people in with OpenID Connect and PKCE, at a provider that is not Keycloak.',
		path: 'authorization-code/?oidc=1&pkce=1&keycloak=off#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API'
	},
	{
		says: 'The same app, at the step where the code comes back, in advanced mode.',
		path: 'authorization-code/?mode=advanced&oidc=1&pkce=1&keycloak=off&step=callback#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API'
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
