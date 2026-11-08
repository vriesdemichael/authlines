import type { Say } from '#lib/flow/wording.ts';
import { opensAt } from './build.ts';
import { matrix, type MatrixCell } from './matrix.ts';
import type { Opens, Picture } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

type Attack = 'guessed' | 'fake-site' | 'taken-over' | 'after-login';

/**
 * What each way of logging in proves, and what it falls to: the maintainer's point of 2026-11-07 that
 * each factor asks for a different piece of trust, and that knowing what is easily compromised is
 * what people miss. Nothing here is recorded, so every cell rests on NIST SP 800-63B revision 4 (July
 * 2025), WebAuthn Level 3 (W3C Recommendation, August 2026) or RFC 6238, checked on 2026-11-07: email
 * is in its own row because revision 4 says it shall not be used to authenticate, and an
 * authenticator app proves a secret, which revision 4 lets be copied, and not a device. The last
 * column is why a second factor is not the end of it: it is asked for at the login, and what the login
 * hands out works without it. A fresh reader's review on the same day made the kinds visible, put
 * the reason for resisting a guess on the limit to wrong tries (section 3.2.2), let a password fall
 * to a mailbox taken over through its reset, and made a key or secret synced through an account only
 * as safe as that account (Appendix B).
 */
export function whatEachFactorProves(say: Say, keep: Keep = keepAll): Picture {
	const attacks: readonly { id: Attack; name: string }[] = [
		{ id: 'guessed', name: 'Guessed, or reused from a leak elsewhere' },
		{ id: 'fake-site', name: 'Asked for by a fake site' },
		{ id: 'taken-over', name: 'The user’s phone number or mailbox taken over' },
		{ id: 'after-login', name: 'The cookie or token from the login stolen' }
	];
	const afterLogin: MatrixCell = {
		mark: 'empty',
		says: 'Falls to it: it was asked for at the login, and the cookie or token after it works for whoever holds it'
	};
	const relayed: MatrixCell = {
		mark: 'empty',
		says: 'Falls to it: the fake site asks for the code too, and passes it on while it still works'
	};
	const once: MatrixCell = {
		mark: 'full',
		says: 'Resists it: a code works only briefly, and the site has to limit wrong tries'
	};
	const factors: readonly {
		id: string;
		name: string;
		proves: string;
		cells: Record<Attack, MatrixCell>;
		/** Where a real server was recorded asking for it, since 2026-11-08. */
		opens?: Opens;
	}[] = [
		{
			id: 'password',
			name: 'A password',
			opens: opensAt('flow', 'submit-credentials', 'oauth'),
			proves: 'Something you know. Proves only that whoever typed it knows it.',
			cells: {
				guessed: {
					mark: 'empty',
					says: 'Falls to it: a password someone else has works for them as well'
				},
				'fake-site': {
					mark: 'empty',
					says: 'Falls to it: the fake site keeps it, or passes it on'
				},
				'taken-over': {
					mark: 'empty',
					says: 'Falls to it where a forgotten password is reset through them, as it usually is'
				},
				'after-login': afterLogin
			}
		},
		{
			id: 'text-message',
			name: 'A code by text message',
			proves:
				'Something you have. Proves you could get a message sent to this number, on whatever phone has it now.',
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
			name: 'A code by email',
			proves:
				'Not counted as a second factor by NIST. Proves only that someone can read this mailbox, which may have just a password.',
			cells: {
				guessed: {
					mark: 'half',
					says: 'Only partly: the code works only briefly, and the mailbox’s own password can be guessed'
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
			opens: opensAt('flow', 'submit-otp', 'one-time-code', { secondFactor: 'code' }),
			proves:
				'Something you have. Proves you hold the secret shared when it was set up, usually in an app on a phone. It can be copied, and the site keeps it too.',
			cells: {
				guessed: once,
				'fake-site': relayed,
				'taken-over': {
					mark: 'half',
					says: 'Only partly: nothing is sent, and a secret backed up to an account is as safe as that account'
				},
				'after-login': afterLogin
			}
		},
		{
			id: 'passkey',
			name: 'A passkey or security key',
			proves:
				'Something you have, and with the PIN or fingerprint it usually asks for, both factors in one. Proves you hold a key made for this site’s domain.',
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
					mark: 'half',
					says: 'Only partly: a key on one device or a security key resists it, and one synced between devices is as safe as the account it is synced through'
				},
				'after-login': afterLogin
			}
		}
	];
	const drawn = matrix({
		key: [
			{ mark: 'full', says: say('Resists it') },
			{ mark: 'half', says: say('Only partly') },
			{ mark: 'empty', says: say('Falls to it') }
		],
		columns: attacks.map((attack) => ({ id: attack.id, name: say(attack.name) })),
		rows: factors.map((factor) => ({
			id: factor.id,
			name: say(factor.name),
			is: say(factor.proves),
			// A factor is not an advanced idea, so simple mode keeps the row and leaves out only where it goes.
			...(factor.opens && keep(factor.opens) ? { opens: factor.opens } : {}),
			cells: Object.fromEntries(
				Object.entries(factor.cells).map(([attack, cell]) => [
					attack,
					{ ...cell, says: say(cell.says) }
				])
			)
		})),
		note: say(
			'A second factor is one of a different kind from the first, asked for at the login: a password and something you have. The last column is why it is not the end of it. This is from the standards: NIST’s guidance 800-63B, revision 4, the WebAuthn spec and RFC 6238. A password and a code from an authenticator app are also recorded on a real server.'
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
