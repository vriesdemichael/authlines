import type { Settings } from '#lib/flow/settings.ts';
import type { Say } from '#lib/flow/wording.ts';
import { markAt, opensAsRecorded, textAt } from './build.ts';
import type { MarkKind, Opens, Picture, PictureLine, PicturePart } from './model.ts';

type Attack = 'trade' | 'handed' | 'link' | 'token' | 'csrf';
interface Cell {
	mark: MarkKind;
	says: string;
	opens?: Opens;
}

const at = (step: string, preset: string, settings: Partial<Settings>) =>
	opensAsRecorded('flow', step, preset, settings);

/**
 * Which protection stops which attack, as the recordings have it. A filled cell opens the recording
 * where it stops one, an open one where it does not, and a half one where it is only partly. A dot is
 * what the specs say and nothing here draws, and a blank is what nothing here shows either way. The
 * answers to a dozen questions are each one cell of this.
 */
export function whatStopsWhat(say: Say): Picture {
	const attacks: readonly { id: Attack; name: string; opens?: Opens }[] = [
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
	const protections: readonly { id: string; name: string; cells: Record<Attack, Cell> }[] = [
		{
			id: 'secret',
			name: 'A client secret',
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

	const W = 800;
	const NAME = { left: 10, w: 200 };
	const COLUMNS = { left: 220, right: 790 };
	const column = (COLUMNS.right - COLUMNS.left) / attacks.length;
	const HEAD = 64;
	const ROW = 40;
	const TOP = 10;
	const parts: PicturePart[] = [];
	const lines: PictureLine[] = [];
	attacks.forEach((attack, i) => {
		parts.push(
			textAt(
				`head-${attack.id}`,
				COLUMNS.left + i * column + 4,
				TOP,
				column - 8,
				say(attack.name),
				{
					size: 'more',
					align: 'middle',
					opens: attack.opens
				}
			)
		);
	});
	protections.forEach((protection, r) => {
		const y = TOP + HEAD + r * ROW + ROW / 2;
		lines.push({ d: `M10 ${y - ROW / 2} H${W - 10}`, bare: true, faint: true });
		parts.push(textAt(`name-${protection.id}`, NAME.left, y - 9, NAME.w, say(protection.name)));
		attacks.forEach((attack, i) => {
			const cell = protection.cells[attack.id];
			const x = COLUMNS.left + i * column + column / 2;
			parts.push(
				markAt(
					`${protection.id}.${attack.id}`,
					x,
					y,
					cell.mark,
					`${say(protection.name)}, against ${say(attack.name)}: ${say(cell.says)}`,
					cell.opens
				)
			);
		});
	});
	const bottom = TOP + HEAD + protections.length * ROW;
	lines.push({ d: `M10 ${bottom} H${W - 10}`, bare: true, faint: true });
	const legend = textAt(
		'legend',
		10,
		bottom + 14,
		780,
		say(
			'Filled: stops it, as recorded. Half: only partly. Open: does not stop it. A dot: the specs say it does, and nothing here draws it. A dash: not shown here.'
		),
		{ size: 'more' }
	);
	parts.push(legend);
	return {
		id: 'what-stops-what',
		title: say('Which protection stops which attack'),
		width: W,
		height: bottom + 14 + legend.h + 14,
		parts,
		lines
	};
}
