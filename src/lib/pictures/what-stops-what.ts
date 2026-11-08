import type { Settings } from '#lib/flow/settings.ts';
import type { Say } from '#lib/flow/wording.ts';
import { opensAsRecorded } from './build.ts';
import { matrix, type MatrixCell } from './matrix.ts';
import type { Opens, Picture } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

type Attack = 'trade' | 'handed' | 'link' | 'token' | 'csrf';
type Cell = MatrixCell;

const at = (step: string, preset: string, settings: Partial<Settings>) =>
	opensAsRecorded('flow', step, preset, settings);

/**
 * Which protection stops which attack, as the recordings have it. A filled cell opens the recording
 * where it stops one, an open one where it does not, and a half one where it is only partly. A dot is
 * what the specs say and nothing here draws, and a blank is what nothing here shows either way. The
 * answers to a dozen questions are each one cell of this.
 */
export function whatStopsWhat(say: Say, keep: Keep = keepAll): Picture {
	const allAttacks: readonly { id: Attack; name: string; opens?: Opens }[] = [
		{
			id: 'trade',
			name: 'Someone trades a stolen code',
			opens: at('attacker-token-response', 'attack-public', {
				attacker: true,
				clientType: 'public'
			})
		},
		{
			id: 'handed',
			name: 'A stolen code handed to the real app',
			opens: at('handed-token-response', 'attack-at-the-app', {
				attacker: true,
				attackerUses: 'real-app'
			})
		},
		{
			id: 'link',
			name: 'A login link of theirs',
			opens: at('code-to-attacker', 'their-link-any', {
				attacker: true,
				attackerGets: 'link',
				registered: 'any'
			})
		},
		{
			id: 'token',
			name: 'A stolen access token',
			opens: at('thief-api-response', 'dpop-thief-bearer-only', {
				binding: 'dpop',
				tokenThief: true,
				apiChecks: 'bearer'
			})
		},
		{ id: 'csrf', name: 'A forged login, CSRF' }
	];
	const bearer: Cell = {
		mark: 'empty',
		says: 'Does not stop it: whoever holds a bearer token can use it, as RFC 6750 says'
	};
	const none: Cell = { mark: 'none', says: 'Not shown here' };
	const allProtections: readonly {
		id: string;
		name: string;
		/** What it is, for someone who has not met it before. */
		is: string;
		cells: Record<Attack, Cell>;
	}[] = [
		{
			id: 'secret',
			name: 'A client secret',
			is: 'Like a password for the app, sent when it trades the code.',
			cells: {
				trade: {
					mark: 'full',
					says: 'Stops it: they do not have the secret',
					opens: at('attacker-token-response', 'attack-confidential', { attacker: true })
				},
				handed: {
					mark: 'empty',
					says: 'Does not stop it: the app uses its own secret',
					opens: at('handed-token-response', 'attack-at-the-app', {
						attacker: true,
						attackerUses: 'real-app'
					})
				},
				link: {
					mark: 'half',
					says: 'Stops the trade, though the code still reaches them',
					opens: at('attacker-token-response', 'their-link-any', {
						attacker: true,
						attackerGets: 'link',
						registered: 'any'
					})
				},
				token: bearer,
				csrf: none
			}
		},
		{
			id: 'pkce',
			name: 'PKCE',
			is: 'A value only the app that started the login has, sent when it trades the code.',
			cells: {
				trade: {
					mark: 'full',
					says: 'Stops it: they do not have the verifier',
					opens: at('attacker-token-response', 'attack-public-pkce', {
						attacker: true,
						clientType: 'public',
						pkce: true
					})
				},
				handed: {
					mark: 'full',
					says: 'Stops it: the code was tied to another login’s challenge',
					opens: at('handed-token-response', 'attack-at-the-app-pkce', {
						attacker: true,
						attackerUses: 'real-app',
						pkce: true
					})
				},
				link: {
					mark: 'empty',
					says: 'Does not stop it: they made the challenge',
					opens: at('attacker-token-response', 'their-link-any-public-pkce', {
						attacker: true,
						attackerGets: 'link',
						registered: 'any',
						clientType: 'public',
						pkce: true
					})
				},
				token: bearer,
				csrf: { mark: 'dot', says: 'The specs say it does, and nothing here draws it' }
			}
		},
		{
			id: 'state',
			name: 'State',
			is: 'A value that ties the answer to the login this browser started.',
			cells: {
				trade: none,
				handed: {
					mark: 'empty',
					says: 'Does not stop it: they start the login in their own browser',
					opens: at('attacker-handed-answer', 'attack-at-the-app', {
						attacker: true,
						attackerUses: 'real-app'
					})
				},
				link: none,
				token: bearer,
				csrf: { mark: 'dot', says: 'The specs say it does, and nothing here draws it' }
			}
		},
		{
			id: 'nonce',
			name: 'A nonce',
			is: 'A value that ties the ID token to this one login.',
			cells: {
				trade: none,
				handed: {
					mark: 'full',
					says: 'Stops it at the app, which checks it once the tokens were handed over',
					opens: at('attacker-handed-answer', 'attack-at-the-app-oidc', {
						attacker: true,
						attackerUses: 'real-app',
						oidc: true
					})
				},
				link: none,
				token: bearer,
				csrf: { mark: 'dot', says: 'The specs say it does, and nothing here draws it' }
			}
		},
		{
			id: 'exact-address',
			name: 'An exact redirect address',
			is: 'The code is only sent to an address registered for the app.',
			cells: {
				trade: none,
				handed: none,
				link: {
					mark: 'full',
					says: 'Stops it: the address in their link is refused',
					opens: at('address-refused', 'their-link', { attacker: true, attackerGets: 'link' })
				},
				token: bearer,
				csrf: none
			}
		},
		{
			id: 'dpop',
			name: 'DPoP',
			is: 'Ties a token to a key that only the app holds.',
			cells: {
				trade: none,
				handed: none,
				link: none,
				token: {
					mark: 'half',
					says: 'At an API that checks the proof, and not at one that knows only Bearer',
					opens: at('thief-api-response', 'dpop-thief', { binding: 'dpop', tokenThief: true })
				},
				csrf: none
			}
		}
	];

	// A protection with nothing left to say about the attacks still drawn goes with them.
	// A column stays where its head or one of its cells does, so a setting on screen keeps its own.
	const attacks = allAttacks.filter(
		(attack) =>
			keep(attack.opens) ||
			allProtections.some((protection) => {
				const cell = protection.cells[attack.id];
				return cell.opens && keep(cell.opens);
			})
	);
	const protections = allProtections.filter((protection) =>
		attacks.some((attack) => protection.cells[attack.id].mark !== 'none')
	);
	const drawn = matrix({
		// The key first, drawn with the circles below, so nothing has to be matched up from words.
		key: [
			{ mark: 'full', says: say('Stops it, as recorded') },
			{ mark: 'half', says: say('Only partly') },
			{ mark: 'empty', says: say('Does not stop it') },
			{ mark: 'dot', says: say('The specs say it does, and nothing here draws it') },
			{ mark: 'none', says: say('Not shown here') }
		],
		columns: attacks.map((attack) => ({ ...attack, name: say(attack.name) })),
		rows: protections.map((protection) => ({
			id: protection.id,
			name: say(protection.name),
			is: say(protection.is),
			cells: Object.fromEntries(
				Object.entries(protection.cells).map(([attack, cell]) => [
					attack,
					{ ...cell, says: say(cell.says) }
				])
			)
		}))
	});
	return {
		id: 'what-stops-what',
		title: say('Which protection stops which attack'),
		width: 800,
		height: drawn.height,
		parts: drawn.parts,
		lines: drawn.lines
	};
}
