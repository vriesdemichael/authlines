import type { Say } from '#lib/flow/wording.ts';
import { opensAt, opensIn } from './build.ts';
import { matrix, type MatrixCell } from './matrix.ts';
import type { Opens, Picture } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

/**
 * Passwords and API keys, against tokens (#200), because habits from the first two do not carry
 * over, as one trainer the research found put it. Each row is something the site records: the user's
 * password sent to the API the old way, the app's own secret, which is what an API key is like, and
 * an access token. Each column is a question someone used to the first two would not think to ask.
 */
export function passwordsKeysTokens(say: Say, keep: Keep = keepAll): Picture {
	const oldWay = (step: string) => opensAt('flow', step, 'the-old-way', { oldWay: true });
	const plain = (step: string) => opensAt('flow', step, 'oauth');
	const itself = (step: string) => opensIn('client-credentials', step, 'as-itself');
	const yes = (says: string, opens?: Opens): MatrixCell => ({
		mark: 'full',
		says: say(says),
		opens
	});
	const no = (says: string, opens?: Opens): MatrixCell => ({
		mark: 'empty',
		says: say(says),
		opens
	});
	const notHere = (says: string): MatrixCell => ({ mark: 'none', says: say(says) });

	const rows = [
		{
			id: 'password',
			name: say('The user’s password, the old way'),
			is: say('Given to the app, which sends it to the API with every call.'),
			opens: oldWay('old-way-call'),
			cells: {
				'to-the-api': yes('yes, with every call', oldWay('old-way-call')),
				'runs-out': no('no, it lasts until someone changes it'),
				'who-for': no('no, it works anywhere the user logs in with it'),
				allowed: no('no, the app can do all the user can', oldWay('old-way-answer'))
			}
		},
		{
			id: 'secret',
			name: say('The app’s own secret'),
			is: say(
				'What an API key is like: the app’s, and long-lived. Here it goes only to the identity provider.'
			),
			opens: itself('service-token-request'),
			cells: {
				'to-the-api': no(
					'no, only to the identity provider, for a token',
					itself('service-token-request')
				),
				'runs-out': no('no, it lasts until someone changes it'),
				'who-for': notHere('does not apply, the API never sees it'),
				allowed: notHere('does not apply, it only asks for tokens')
			}
		},
		{
			id: 'token',
			name: say('An access token'),
			is: say('What the API is sent here, in place of either.'),
			opens: plain('api-request'),
			cells: {
				'to-the-api': yes('yes, in place of a password', plain('api-request')),
				'runs-out': yes('yes, after five minutes here', plain('token-response')),
				'who-for': yes('yes, in its audience, which the API checks', plain('api-check-token')),
				allowed: yes('yes, its scope, which the API checks', plain('api-check-token'))
			}
		}
	].filter((row) => keep(row.opens));

	const drawn = matrix({
		lead: say(
			'Habits from passwords and API keys do not carry over. Those are secrets that last, sent wherever they are needed. Here a secret goes only to the identity provider, and the API gets a token instead.'
		),
		key: [
			{ mark: 'full', says: say('It does') },
			{ mark: 'empty', says: say('It does not') },
			{ mark: 'none', says: say('Does not apply') }
		],
		columns: [
			{ id: 'to-the-api', name: say('Goes to the API') },
			{ id: 'runs-out', name: say('Runs out by itself') },
			{ id: 'who-for', name: say('Says who it is for') },
			{ id: 'allowed', name: say('Allows only what was agreed') }
		],
		rows,
		note: say(
			'An API key differs from the secret here in where it goes: to the API itself, with each call, like the password. Nothing here records one.'
		)
	});
	return {
		id: 'passwords-keys-tokens',
		title: say('Passwords and API keys, against tokens'),
		width: 800,
		height: drawn.height,
		parts: drawn.parts,
		lines: drawn.lines
	};
}
