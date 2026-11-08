import type { Say } from '#lib/flow/wording.ts';
import { opensAt } from './build.ts';
import { matrix, type MatrixCell, type MatrixRow } from './matrix.ts';
import type { Opens, Picture } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

/**
 * What the app asked for and what it was given, in three recorded runs: the scope in the request to
 * log in, and the scope in the answer with the tokens. A test holds these to the recordings.
 */
export const SCOPES_RECORDED = {
	oauth: { asked: [], given: ['profile', 'email'] },
	oidc: { asked: ['openid'], given: ['openid', 'profile', 'email'] },
	'logout-offline': {
		asked: ['openid', 'offline_access'],
		given: ['openid', 'email', 'offline_access', 'profile']
	}
} as const satisfies Record<string, { asked: readonly string[]; given: readonly string[] }>;

type Run = keyof typeof SCOPES_RECORDED;

interface ScopeRow {
	scope: string;
	is: string;
	opens?: Opens;
}

/**
 * The scopes OpenID Connect defines, each with what it asks for, from OpenID Connect Core sections
 * 3.1.2.1, 5.4 and 11. None of these is in a token's claims by being asked for alone: the identity
 * provider decides, and its answer says what it gave.
 */
const ROWS: readonly ScopeRow[] = [
	{
		scope: 'openid',
		is: 'A switch, not a permission. It makes the login OpenID Connect, so an ID token comes back. Without it, it is plain OAuth, and the server recorded sent none.',
		opens: opensAt('flow', 'authorize', 'oidc', { oidc: true })
	},
	{
		scope: 'profile',
		is: 'Asks for claims: their name, username, picture, birthdate, locale and the like.',
		opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
	},
	{
		scope: 'email',
		is: 'Asks for claims: their email address, and whether it was checked.',
		opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
	},
	{ scope: 'address', is: 'Asks for a claim: their postal address.' },
	{ scope: 'phone', is: 'Asks for claims: their phone number, and whether it was checked.' },
	{
		scope: 'offline_access',
		is: 'Asks for a kind of token: a refresh token for when the user is not there. OpenID Connect says they have to agree to it.',
		opens: opensAt('flow', 'token-response', 'logout-offline', {
			oidc: true,
			logout: true,
			logoutKeeps: 'offline'
		})
	}
];

/**
 * What each scope asks for (#200, which the maintainer added to on 2026-11-08: "something about
 * expected scopes with oidc"), against what three recorded runs asked for and were given. An identity
 * provider can give more than was asked, and say so in the answer's scope, which OAuth requires when
 * the two differ (RFC 6749 section 3.3).
 */
export function whatEachScopeAsksFor(say: Say, keep: Keep = keepAll): Picture {
	const runs: { id: Run; name: string; opens: Opens }[] = [
		{
			id: 'oauth',
			name: say('Asking for none'),
			opens: opensAt('flow', 'token-response', 'oauth')
		},
		{
			id: 'oidc',
			name: say('Asking for openid'),
			opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
		},
		{
			id: 'logout-offline',
			name: say('Asking for openid and offline_access'),
			opens: opensAt('flow', 'token-response', 'logout-offline', {
				oidc: true,
				logout: true,
				logoutKeeps: 'offline'
			})
		}
	];
	// Simple mode leaves out what only advanced mode reaches, as the maintainer decided on 2026-11-08.
	const columns = runs.filter((run) => keep(run.opens));
	const cell = (scope: string, run: (typeof runs)[number]): MatrixCell => {
		const recorded = SCOPES_RECORDED[run.id];
		const asked = (recorded.asked as readonly string[]).includes(scope);
		const given = (recorded.given as readonly string[]).includes(scope);
		if (asked && given)
			return { mark: 'full', says: say('asked for, and given'), opens: run.opens };
		if (given) return { mark: 'empty', says: say('given without being asked'), opens: run.opens };
		if (asked) return { mark: 'half', says: say('asked for, and not given'), opens: run.opens };
		return { mark: 'none', says: say('neither') };
	};
	const rows: MatrixRow[] = ROWS.filter((row) => keep(row.opens)).map((row) => ({
		id: row.scope,
		name: row.scope,
		is: say(row.is),
		opens: row.opens,
		cells: Object.fromEntries(columns.map((run) => [run.id, cell(row.scope, run)]))
	}));
	const drawn = matrix({
		lead: say(
			'A scope is a word the app asks with, and these do different jobs. openid is a switch, most ask for claims about the user from the identity provider, and offline_access asks for a kind of token. What the app may do at your own API takes scopes defined for it, which none of these is.'
		),
		key: [
			{ mark: 'full', says: say('Asked for, and given') },
			{ mark: 'empty', says: say('Given without being asked') },
			{ mark: 'half', says: say('Asked for, and not given') },
			{ mark: 'none', says: say('Neither') }
		],
		columns: columns.map((run) => ({ id: run.id, name: run.name, opens: run.opens })),
		rows,
		note: say(
			'From recorded runs, with the scope the app asked for and the scope the answer said it was given. The identity provider gave profile and email without being asked, and the answer said so, as OAuth requires when the two differ.'
		)
	});
	return {
		id: 'what-each-scope-asks-for',
		title: say('What each scope asks for'),
		width: 800,
		height: drawn.height,
		parts: drawn.parts,
		lines: drawn.lines
	};
}
