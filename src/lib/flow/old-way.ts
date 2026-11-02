import type { DiagramDef, PartDef, StepDef } from '#lib/flow/model.ts';
import { all, is, not, type Condition } from '#lib/flow/settings.ts';

const oldWay = is('oldWay', true);
const unlessOldWay = (when?: Condition) => (when ? all(not(oldWay), when) : not(oldWay));

/**
 * What came before, on the same diagram, so that turning it off is the transition the rest of this
 * application is about. It is the way in for someone who has heard of none of this (#150), and the
 * problem RFC 6749 opens with. Its messages are the demo app's and API's, and no identity provider has
 * any part in it, which is what the footer says.
 */
const flowSteps: readonly StepDef[] = [
	{
		id: 'old-way-form',
		from: 'browser',
		to: 'app',
		kind: 'request',
		plain: 'The user gives the app their password',
		label: 'POST /login',
		concept:
			'The app wants something from another service, drawn here as the API, such as your calendar. So it asks for the username and password of your account there, on a form of its own, and you have to trust it with them.',
		inPractice:
			'Do not build this for an account at another service. It is here to show what most of this is for.',
		fields: [{ name: 'username and password', place: 'body', artifact: 'password' }]
	},
	{
		id: 'old-way-keep',
		from: 'app',
		to: 'app',
		kind: 'internal',
		plain: 'The app keeps the password',
		label: 'Store the password',
		concept:
			'It needs the password again for every call, so it has to keep it in a form it can read. If the app is broken into, your password goes with it.',
		cites: [
			{
				source: 'rfc6749',
				section: '1',
				why: 'Section 1 opens with this: a third party has to store the password for later use, typically in clear text.'
			}
		]
	},
	{
		id: 'old-way-call',
		from: 'app',
		to: 'api',
		kind: 'request',
		plain: 'The app sends the password to the API',
		label: 'GET /resource',
		concept:
			'The username and password go along with the call, and with every call after it. The API cannot tell the app from you, so the app can do anything you can.',
		cites: [
			{
				source: 'rfc7617',
				section: '2',
				why: 'Section 2 is this scheme: the username and password joined with a colon, in Base64. Section 4 calls that cleartext.'
			},
			{
				source: 'rfc6749',
				section: '1',
				why: 'Section 1 says a third party gets overly broad access this way, with no way to limit how long or what.'
			}
		],
		fields: [
			{
				name: 'Authorization: Basic',
				place: 'header',
				note: 'The username and password, joined with a colon and Base64-encoded, which is not encryption',
				artifact: 'password'
			}
		]
	},
	{
		id: 'old-way-answer',
		from: 'api',
		to: 'app',
		kind: 'response',
		plain: 'The API answers',
		label: '200 with the resource',
		concept:
			'It works, which is why it was common. But you cannot limit what the app does, and the only way to stop it is to change your password, which stops every other app that has it too.',
		cites: [
			{
				source: 'rfc6749',
				section: '1',
				why: 'Section 1 says access cannot be revoked from one third party without revoking it from all, by changing the password.'
			}
		],
		fields: [{ name: 'resource', place: 'body', note: 'What the app came for' }]
	}
];

const setupSteps: readonly StepDef[] = [
	{
		id: 'old-way-nothing-to-set-up',
		from: 'app',
		to: 'app',
		kind: 'internal',
		plain: 'Nothing to set up',
		label: 'Nothing to set up',
		concept:
			'Nobody has to introduce the app to anyone, because it logs in as you, with your password. That is part of why it was easy, and part of what is wrong with it.'
	}
];

function withTheOldWay(
	flow: DiagramDef,
	steps: readonly StepDef[],
	part: PartDef,
	intro: string,
	gone: readonly string[],
	/** What a party is here, where what it is otherwise would deny what is on the diagram. */
	concepts: Readonly<Record<string, string>>
): DiagramDef {
	return {
		...flow,
		intro: [{ when: oldWay, text: intro }, { text: flow.intro as string }],
		lifelines: flow.lifelines.map((line) => ({
			...line,
			when: gone.includes(line.id) ? unlessOldWay(line.when) : line.when,
			concept: concepts[line.id]
				? [
						{ when: oldWay, text: concepts[line.id] },
						...(typeof line.concept === 'string' ? [{ text: line.concept }] : line.concept)
					]
				: line.concept,
			startsWith: line.startsWith?.map((held) => ({ ...held, when: unlessOldWay(held.when) }))
		})),
		parts: [part, ...flow.parts],
		steps: [
			...steps.map((step) => ({ ...step, when: oldWay })),
			...flow.steps.map((step) => ({ ...step, when: unlessOldWay(step.when) }))
		]
	};
}

export const withTheOldWayInTheFlow = (flow: DiagramDef) =>
	withTheOldWay(
		flow,
		flowSteps,
		{
			label: 'The old way',
			why: 'The app logs in as the user, so it needs their password, and it needs it every time.',
			from: 'old-way-form'
		},
		'An app wants to do something for a user, such as read their calendar. Before there was anything better, it asked for the password. Press Next to follow it, one message at a time.',
		['idp'],
		{
			app: "The application the user wants to use. Here it is given the user's password.",
			api: 'What the app wants to call on behalf of the user. Here it decides from the password.'
		}
	);

export const withTheOldWayInTheSetup = (flow: DiagramDef) =>
	withTheOldWay(
		flow,
		setupSteps,
		{
			label: 'Nothing',
			why: 'An app that logs in as the user has nobody to be introduced to.',
			from: 'old-way-nothing-to-set-up'
		},
		'With the old way there is no setup to speak of, which is part of why it was common.',
		['idp', 'idp-admin', 'api'],
		{
			app: 'The application. Here there is nothing to set up, because it logs in as the user.'
		}
	);
