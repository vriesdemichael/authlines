import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, keyAt, markAt, opensAt, opensIn, textAt } from './build.ts';
import {
	SIZE,
	widthOf,
	type MarkKind,
	type Opens,
	type Picture,
	type PictureLine,
	type PicturePart
} from './model.ts';

/**
 * What the access token and the ID token said in one recorded run with OpenID Connect on, the
 * `oidc` preset, last recorded on Keycloak 26.8.2. A test holds these to the recording, so a re-recording that
 * changes them shows here.
 */
export const RECORDED = {
	access: {
		exp: 1793558983,
		iat: 1793558683,
		auth_time: 1793558683,
		jti: 'onrtac:821dd5a4-1d56-9ede-701a-cdd7d6cc0a8f',
		iss: 'http://localhost:18080/realms/demo',
		aud: 'account',
		sub: '534bd5a1-8f27-4cd2-a0f8-fffff01809d0',
		typ: 'Bearer',
		azp: 'demo-app',
		sid: 'jypnex3-bZ9Jcp1HQ6Kj0C9a',
		acr: '1',
		'allowed-origins': ['http://localhost:9100'],
		realm_access: { roles: ['offline_access', 'default-roles-demo', 'uma_authorization'] },
		resource_access: {
			account: { roles: ['manage-account', 'manage-account-links', 'view-profile'] }
		},
		scope: 'openid profile email',
		email_verified: true,
		name: 'Alice Example',
		preferred_username: 'alice',
		given_name: 'Alice',
		family_name: 'Example',
		email: 'alice@example.test'
	},
	id: {
		exp: 1793558983,
		iat: 1793558683,
		auth_time: 1793558683,
		jti: '7a743fe6-cb0d-1313-6858-5ed4f07b4d90',
		iss: 'http://localhost:18080/realms/demo',
		aud: 'demo-app',
		sub: '534bd5a1-8f27-4cd2-a0f8-fffff01809d0',
		typ: 'ID',
		azp: 'demo-app',
		nonce: 'QtpaJUKNswGwann_V6XX-Q',
		sid: 'jypnex3-bZ9Jcp1HQ6Kj0C9a',
		at_hash: 'Cmtvcpd4DShaVZfwdHRHaQ',
		acr: '1',
		email_verified: true,
		name: 'Alice Example',
		preferred_username: 'alice',
		given_name: 'Alice',
		family_name: 'Example',
		email: 'alice@example.test'
	},
	/** The access token an app got for itself, in the `as-itself` preset of client credentials. */
	service: {
		exp: 1794148781,
		iat: 1794148481,
		jti: 'trrtcc:2d462bc9-1f47-4b23-68e7-4af256545248',
		iss: 'http://localhost:18080/realms/demo',
		aud: 'account',
		sub: 'db5791ce-b988-41cc-a241-d4e4cb766ff2',
		typ: 'Bearer',
		azp: 'demo-service',
		acr: '1',
		'allowed-origins': ['http://localhost:9100'],
		realm_access: { roles: ['offline_access', 'default-roles-demo', 'uma_authorization'] },
		resource_access: {
			account: { roles: ['manage-account', 'manage-account-links', 'view-profile'] }
		},
		scope: 'profile email',
		clientHost: '172.16.0.1',
		email_verified: false,
		preferred_username: 'service-account-demo-service',
		clientAddress: '172.16.0.1',
		client_id: 'demo-service'
	}
} as const;

type Token = keyof typeof RECORDED;

interface ClaimRow {
	id: string;
	/** The names, as they are in the token. */
	names: readonly string[];
	is: string;
	opens: Opens;
	/** Kept in simple mode, which has to look much emptier, and named there in plain words if need be. */
	simple?: string;
	/** What it says beside a token an app got for itself, where that differs. */
	forItself?: string;
}

const at = (step: string) => opensAt('flow', step, 'oidc', { oidc: true });

/**
 * Every claim in the two recorded tokens, a row each, except that what is about the user is one row,
 * and so is what this server adds of its own. A test checks that no claim is left out.
 */
const ROWS: readonly ClaimRow[] = [
	{
		id: 'iss',
		names: ['iss'],
		simple: 'iss',
		is: 'Who made it: the identity provider’s address. Whoever reads it takes tokens only from one it trusts.',
		opens: at('api-check-token')
	},
	{
		id: 'sub',
		names: ['sub'],
		simple: 'sub',
		is: 'Who it is about: an ID the identity provider never gives anyone else. Not their name, which can change.',
		forItself: 'Who it is about. With no user, an ID that stands for the app itself.',
		opens: at('validate-id-token')
	},
	{
		id: 'aud',
		names: ['aud'],
		simple: 'aud',
		is: 'Who it is for. Whoever reads it has to refuse it if it does not name them.',
		opens: at('api-check-token')
	},
	{
		id: 'azp',
		names: ['azp'],
		is: 'The app it was given to, by its client ID.',
		opens: at('validate-id-token')
	},
	{
		id: 'exp',
		names: ['exp'],
		simple: 'exp',
		is: 'When it runs out, in seconds since the start of 1970.',
		opens: at('api-check-token')
	},
	{
		id: 'client_id',
		names: ['client_id'],
		is: 'The app it was given to, under the name RFC 9068 gives it.',
		opens: opensIn('client-credentials', 'service-token-response', 'as-itself')
	},
	{
		id: 'iat',
		names: ['iat'],
		is: 'When it was made, in seconds since the start of 1970 too.',
		opens: at('token-response')
	},
	{
		id: 'auth_time',
		names: ['auth_time'],
		is: 'When the user logged in, which can be well before, if the identity provider remembered them.',
		opens: at('token-response')
	},
	{
		id: 'jti',
		names: ['jti'],
		is: 'An ID for this one token, so it can be told apart from every other.',
		opens: at('token-response')
	},
	{
		id: 'sid',
		names: ['sid'],
		is: 'The session at the identity provider it came from, so a logout can name it.',
		opens: at('token-response')
	},
	{
		id: 'acr',
		names: ['acr'],
		is: 'How strong the login was, as a named level. What each level means is agreed between the identity provider and the app.',
		opens: at('token-response')
	},
	{
		id: 'scope',
		names: ['scope'],
		simple: 'scope',
		is: 'What the app may do for the user.',
		forItself: 'What the app may do.',
		opens: at('api-check-token')
	},
	{
		id: 'nonce',
		names: ['nonce'],
		simple: 'nonce',
		is: 'The random value the app made for this login, which it checks came back.',
		opens: at('validate-id-token')
	},
	{
		id: 'at_hash',
		names: ['at_hash'],
		is: 'Half of a hash of the access token that came with it, so the app can tell the two belong together.',
		opens: at('token-response')
	},
	{
		id: 'user',
		names: ['name', 'preferred_username', 'given_name', 'family_name', 'email', 'email_verified'],
		simple: 'name, email and more',
		is: 'About the user, under names OpenID Connect gives them.',
		forItself:
			'About the user, under names OpenID Connect gives them. With no user, some can still be there, about the app.',
		opens: at('token-response')
	},
	{
		id: 'own',
		names: [
			'typ',
			'allowed-origins',
			'realm_access',
			'resource_access',
			'clientHost',
			'clientAddress'
		],
		is: 'The identity provider’s own. Another one would send others, or none.',
		opens: at('token-response')
	}
];

export const CLAIM_ROWS = ROWS;

const MINUTE = 60;
const COUNTED = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** A value as it can be read in a cell: whole where it fits, and its start where it does not. */
function shown(row: ClaimRow, token: Token, width: number): string | null {
	const claims = RECORDED[token] as Record<string, unknown>;
	const there = row.names.filter((name) => name in claims);
	if (!there.length) return null;
	// The names are beside the row already, so a token with all of them says so.
	if (row.names.length > 1)
		return there.length === row.names.length ? `All ${COUNTED[there.length]}` : there.join(', ');
	const value = claims[row.names[0]];
	if (row.id === 'exp' && typeof value === 'number') {
		const minutes = (value - (claims.iat as number)) / MINUTE;
		return `${value}, ${minutes} minutes after iat`;
	}
	// Measured as if bold, because digits and IDs are wider than words, as CI's screenshot showed.
	let text = String(value);
	if (widthOf(text, SIZE.more, true) <= width) return text;
	while (widthOf(`${text}…`, SIZE.more, true) > width) text = text.slice(0, -1);
	return `${text}…`;
}

/**
 * A token, part by part (#200): what each claim in a recorded access token and ID token says, in
 * plain words, beside each other. The raw view decodes them, and nothing said what they mean. Simple
 * mode shows no values, so there a circle says whether a token has it.
 */
export function whatATokenSays(say: Say, values: boolean, flow = 'authorization-code'): Picture {
	// With no user, the token an app gets for itself beside one for a user, which says the difference.
	const itself = flow === 'client-credentials';
	const TOKENS: readonly Token[] = itself ? ['access', 'service'] : ['access', 'id'];
	const W = 800;
	const NAME = { left: 10, w: 260 };
	const COLUMNS = { left: 280, right: 790 };
	const column = (COLUMNS.right - COLUMNS.left) / TOKENS.length;
	const HEADS: Record<Token, string> = {
		access: say(itself ? 'An access token for a user' : 'The access token'),
		id: say('The ID token'),
		service: say('An access token for the app itself')
	};
	const HEAD_OPENS: Record<Token, Opens> = {
		access: at('token-response'),
		id: at('token-response'),
		service: opensIn('client-credentials', 'service-token-response', 'as-itself')
	};

	const lead = textAt(
		'lead',
		10,
		8,
		780,
		say(
			'A signed JWT, as these are, is three parts joined by dots: a header, the claims, and a signature over both. These are the claims, each a name and a value.'
		),
		{ size: 'more' }
	);
	// Simple mode has to look much emptier than advanced, as the maintainer decided on 2026-11-02. It
	// keeps the rows where two tokens differ as well, which is what a token for the app itself is about.
	const has = (row: ClaimRow, token: Token) =>
		row.names.filter((name) => name in RECORDED[token]).length;
	const differs = (row: ClaimRow) => Boolean(has(row, TOKENS[0])) !== Boolean(has(row, TOKENS[1]));
	const rows = ROWS.filter(
		(row) =>
			TOKENS.some((token) => has(row, token)) && (values || row.simple || (itself && differs(row)))
	);
	const markOf = (row: ClaimRow, token: Token): MarkKind =>
		!has(row, token) ? 'none' : has(row, token) < row.names.length ? 'half' : 'full';
	const marks = new Set(rows.flatMap((row) => TOKENS.map((token) => markOf(row, token))));
	const key = keyAt(
		'key',
		10,
		bottomOf(lead) + 8,
		780,
		values
			? [{ mark: 'none', says: say('Not in it') }]
			: [
					{ mark: 'full' as const, says: say('In it') },
					{ mark: 'half' as const, says: say('Some of them') },
					{ mark: 'none' as const, says: say('Not in it') }
				].filter((entry) => marks.has(entry.mark))
	);
	const parts: PicturePart[] = [lead, ...key.parts];
	const lines: PictureLine[] = [];
	const headTop = bottomOf(lead) + 8 + key.h + 12;
	const heads = TOKENS.map((token, i) =>
		textAt(`head-${token}`, COLUMNS.left + i * column + 4, headTop, column - 8, HEADS[token], {
			size: 'more',
			align: values ? 'start' : 'middle',
			opens: HEAD_OPENS[token]
		})
	);
	parts.push(...heads);
	let top = Math.max(...heads.map(bottomOf)) + 8;
	lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });

	for (const row of rows) {
		const named = values ? row.names.join(', ') : (row.simple ?? row.names.join(', '));
		const name = textAt(`name-${row.id}`, NAME.left, top + 8, NAME.w, named, {
			opens: row.opens
		});
		const words = itself && row.forItself ? row.forItself : row.is;
		const is = textAt(`is-${row.id}`, NAME.left, bottomOf(name) + 2, NAME.w, say(words), {
			size: 'more'
		});
		const cells = TOKENS.map((token, i) => {
			const value = shown(row, token, column - 16);
			const left = COLUMNS.left + i * column;
			const whose = `${named}, in ${HEADS[token].toLowerCase()}`;
			if (value === null) return markAt(`${row.id}.${token}`, 0, 0, 'none', `${whose}: not in it`);
			if (!values) {
				const mark = markOf(row, token);
				return markAt(
					`${row.id}.${token}`,
					0,
					0,
					mark,
					`${whose}: ${mark === 'half' ? 'some of them' : 'in it'}`
				);
			}
			return textAt(`${row.id}.${token}`, left + 4, top + 10, column - 8, value, { size: 'more' });
		});
		const height = Math.max(bottomOf(is), ...cells.map(bottomOf)) - top + 10;
		const y = top + height / 2;
		parts.push(name, is);
		cells.forEach((cell, i) => {
			if (cell.shape === 'mark') {
				const x = values ? COLUMNS.left + i * column + 14 : COLUMNS.left + i * column + column / 2;
				parts.push({ ...cell, x, y });
			} else {
				parts.push(cell);
			}
		});
		top += height;
		lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	}

	const note = textAt(
		'note',
		10,
		top + 12,
		780,
		say(
			itself
				? 'Both from recorded runs, one where a user logged in, and one where an app asked for itself.' +
						(values ? ' Long values are cut short.' : '')
				: values
					? 'Both from one recorded run with OpenID Connect on, which adds the ID token. Long values are cut short.'
					: 'Both from one recorded run with OpenID Connect on, which adds the ID token. Each has more claims than these, which advanced mode shows with what was in them.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'what-a-token-says',
		title: say('What a token says, part by part'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines
	};
}
