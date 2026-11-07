import type { Say } from '#lib/flow/wording.ts';
import { matrix, type MatrixCell } from './matrix.ts';
import type { Picture } from './model.ts';

type Attack = 'guessed' | 'fake-site' | 'taken-over' | 'after-login';

/**
 * What each way of logging in proves, and what it falls to: the maintainer's point of 2026-11-07 that
 * each factor asks for a different piece of trust, and that knowing what is easily compromised is
 * what people miss. Nothing here is recorded, so every cell rests on NIST SP 800-63B revision 4 (July
 * 2025), WebAuthn Level 3 (W3C Recommendation, August 2026) or RFC 6238, checked on 2026-11-07: email
 * is in its own row because revision 4 says it shall not be used to authenticate, and an
 * authenticator app proves a secret, which revision 4 lets be copied, and not a device. The last column is why a second factor is not
 * the end of it: it is asked for at the login, and what the login hands out works without it.
 */
export function whatEachFactorProves(say: Say): Picture {
	const attacks: readonly { id: Attack; name: string }[] = [
		{ id: 'guessed', name: 'Guessed, or reused from a leak elsewhere' },
		{ id: 'fake-site', name: 'Typed into a fake site' },
		{ id: 'taken-over', name: 'Their phone number or mailbox taken over' },
		{ id: 'after-login', name: 'A session or token stolen after the login' }
	];
	const afterLogin: MatrixCell = {
		mark: 'empty',
		says: 'Falls to it: after the login a cookie or token stands in for the user, and works for whoever holds it'
	};
	const relayed: MatrixCell = {
		mark: 'empty',
		says: 'Falls to it: the fake site asks for the code too, and passes it on while it still works'
	};
	const once: MatrixCell = {
		mark: 'full',
		says: 'Resists it: each code works once, and only for a short time'
	};
	const factors: readonly {
		id: string;
		name: string;
		proves: string;
		cells: Record<Attack, MatrixCell>;
	}[] = [
		{
			id: 'password',
			name: 'A password',
			proves: 'Proves only that whoever typed it knows it.',
			cells: {
				guessed: {
					mark: 'empty',
					says: 'Falls to it: a password someone else has works for them as well'
				},
				'fake-site': {
					mark: 'empty',
					says: 'Falls to it: the fake site keeps it, or passes it on'
				},
				'taken-over': { mark: 'none', says: 'Does not apply' },
				'after-login': afterLogin
			}
		},
		{
			id: 'text-message',
			name: 'A code by text message',
			proves: 'Proves you could get a message sent to this number, on whatever phone has it now.',
			cells: {
				guessed: once,
				'fake-site': relayed,
				'taken-over': {
					mark: 'empty',
					says: 'Falls to it: whoever gets the number moved to their own phone gets the code'
				},
				'after-login': afterLogin
			}
		},
		{
			id: 'email',
			name: 'A code or link by email',
			proves:
				'Proves only that someone can read this mailbox, which may have just a password. NIST does not count it as a second factor.',
			cells: {
				guessed: {
					mark: 'half',
					says: 'Only partly: the code cannot be guessed in time, and the mailbox’s own password can'
				},
				'fake-site': relayed,
				'taken-over': {
					mark: 'empty',
					says: 'Falls to it: whoever reads the mailbox gets the code'
				},
				'after-login': afterLogin
			}
		},
		{
			id: 'authenticator-app',
			name: 'A code from an authenticator app',
			proves:
				'Proves you hold the secret shared when it was set up, usually in an app on a phone. It can be copied, and the site keeps it too.',
			cells: {
				guessed: once,
				'fake-site': relayed,
				'taken-over': {
					mark: 'full',
					says: 'Resists it: the code is made from the secret and the time, and nothing is sent'
				},
				'after-login': afterLogin
			}
		},
		{
			id: 'passkey',
			name: 'A passkey or security key',
			proves:
				'Proves you hold a key made for this site’s domain, kept on a device or a security key, or synced between yours.',
			cells: {
				guessed: {
					mark: 'full',
					says: 'Resists it: nothing is typed, and the site keeps only the public half'
				},
				'fake-site': {
					mark: 'full',
					says: 'Resists it: the browser only lets it answer the domain it was made for, and the site checks which page asked'
				},
				'taken-over': {
					mark: 'full',
					says: 'Resists it: no number or mailbox is involved'
				},
				'after-login': afterLogin
			}
		}
	];
	const drawn = matrix({
		key: [
			{ mark: 'full', says: say('Resists it') },
			{ mark: 'half', says: say('Only partly') },
			{ mark: 'empty', says: say('Falls to it') },
			{ mark: 'none', says: say('Does not apply') }
		],
		columns: attacks.map((attack) => ({ id: attack.id, name: say(attack.name) })),
		rows: factors.map((factor) => ({
			id: factor.id,
			name: say(factor.name),
			is: say(factor.proves),
			cells: Object.fromEntries(
				Object.entries(factor.cells).map(([attack, cell]) => [
					attack,
					{ ...cell, says: say(cell.says) }
				])
			)
		})),
		note: say(
			'A second factor is a second of these, of a different kind, asked for at the login. The last column is why it is not the end of it. From NIST’s guidance 800-63B, revision 4, the WebAuthn spec and RFC 6238: nothing on this one is recorded.'
		)
	});
	return {
		id: 'what-each-factor-proves',
		title: say('What each way of logging in proves'),
		width: 800,
		height: drawn.height,
		parts: drawn.parts,
		lines: drawn.lines
	};
}
