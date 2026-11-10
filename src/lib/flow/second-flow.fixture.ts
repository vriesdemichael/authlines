import type { BaseFlow, DiagramDef } from '#lib/flow/model.ts';
import { is } from '#lib/flow/settings.ts';

const lifelines: DiagramDef['lifelines'] = [
	{
		id: 'app',
		plainName: 'App',
		plainRole: 'Acts for itself',
		name: 'App',
		role: 'OAuth client',
		concept: 'An app that needs no user to act for.'
	},
	{
		id: 'idp',
		plainName: 'Identity provider',
		plainRole: 'Issues tokens',
		name: 'IdP',
		role: 'Authorization server',
		concept: 'Issues tokens.'
	},
	{
		id: 'api',
		plainName: 'API',
		plainRole: 'Has the data',
		name: 'API',
		role: 'Resource server',
		concept: 'What the app wants to call.'
	}
];

/**
 * A second base flow, with no browser and no user, that is not shipped. It shares step ids with the
 * real one on purpose, because that is how something meant for one flow would leak into another.
 */
export const secondFlow: BaseFlow = {
	id: 'second-flow-fixture',
	settings: ['oidc'],
	presets: [],
	diagrams: {
		flow: {
			id: 'second-flow-fixture',
			title: 'A flow with no user',
			caption: 'What happens when the app needs a token.',
			summary: 'An app gets a token for itself.',
			intro: 'No user and no browser here.',
			specs: ['rfc6749'],
			lifelines,
			groups: [],
			parts: [{ label: 'Ask', why: 'An app with no user asks for itself.', from: 'token-request' }],
			steps: [
				{
					id: 'token-request',
					from: 'app',
					to: 'idp',
					kind: 'request',
					plain: 'The app asks for a token',
					label: 'POST /token',
					concept: 'The app asks for a token for itself.'
				},
				{
					id: 'token-response',
					from: 'idp',
					to: 'app',
					kind: 'response',
					plain: 'A token',
					label: 'Access token',
					concept: 'The token.',
					fields: [{ name: 'id_token', place: 'body', when: is('oidc', true) }]
				}
			]
		},
		setup: {
			id: 'second-flow-fixture-setup',
			title: 'Setting up a flow with no user',
			caption: 'What people do first.',
			summary: 'Register the app.',
			intro: 'Register the app first.',
			specs: ['rfc6749'],
			lifelines,
			groups: [],
			parts: [{ label: 'Find', why: 'The app looks up the addresses first.', from: 'discover' }],
			steps: [
				{
					id: 'discover',
					from: 'app',
					to: 'idp',
					kind: 'request',
					plain: 'The app looks up the addresses',
					label: 'GET /.well-known/…',
					concept: 'The app looks up the addresses.'
				}
			]
		}
	}
};
