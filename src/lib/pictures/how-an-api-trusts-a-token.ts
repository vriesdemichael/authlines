import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, opensAsRecorded, opensAt, partyBox, textAt, topOf } from './build.ts';
import type { Picture, PictureLine, PictureRow } from './model.ts';

const ROW = 50;

/**
 * How an API can trust a token from someone it never called: from the issuer it was told, to the
 * keys that check the signature, to what in the token it compares with what it was told. A chain of
 * what vouches for what, which the setup and the API's check each draw half of.
 */
export function howAnApiTrustsAToken(say: Say, realm: string): Picture {
	const W = 800;
	const LEFT = { left: 10, w: 250 };
	const RIGHT = { left: 470, w: 320 };
	const GAP = 52;

	const issuer = partyBox(
		'issuer',
		LEFT.left,
		20,
		LEFT.w,
		say('The issuer'),
		say('An address that names the identity provider. Everything below is found from it.'),
		{ sub: `…/realms/${realm}`, opens: opensAt('setup', 'configure-api', 'oauth') }
	);
	const discovery = partyBox(
		'discovery',
		LEFT.left,
		bottomOf(issuer) + GAP,
		LEFT.w,
		say('Its discovery document'),
		say('Says where everything is, the keys included, and names the issuer again.'),
		{ sub: '/.well-known/…', opens: opensAt('setup', 'discovery-document', 'oauth') }
	);
	const keys = partyBox(
		'keys',
		LEFT.left,
		bottomOf(discovery) + GAP,
		LEFT.w,
		say('Its signing keys'),
		say('Public, so anyone can check a signature with them, and nobody can make one.'),
		{ opens: opensAt('setup', 'keys', 'oauth') }
	);

	const told = partyBox(
		'told',
		RIGHT.left,
		20,
		RIGHT.w,
		say('What the API is told'),
		say('The issuer, and its own name, which a token for it has as its audience.'),
		{ opens: opensAt('setup', 'configure-api', 'oauth') }
	);
	const checks: PictureRow[] = [
		{
			id: 'signature',
			says: say('signature'),
			more: say('One of those keys checks it'),
			opens: opensAt('flow', 'api-check-token', 'oauth')
		},
		{
			id: 'iss',
			says: 'iss',
			more: say('The issuer the API was told'),
			opens: opensAt('flow', 'api-check-token', 'oauth')
		},
		{
			id: 'aud',
			says: 'aud',
			more: say('The name the API was told'),
			opens: opensAsRecorded('flow', 'api-check-token', 'api-elsewhere', { apiToken: 'elsewhere' })
		},
		{
			id: 'exp',
			says: 'exp',
			more: say('A time that has not passed'),
			opens: opensAsRecorded('flow', 'api-check-token', 'api-expired', { apiToken: 'expired' })
		}
	];
	const token = partyBox(
		'token',
		RIGHT.left,
		bottomOf(told) + GAP,
		RIGHT.w,
		say('A token, as the API checks it'),
		'',
		{ rows: checks, opens: opensAt('flow', 'api-check-token', 'oauth') }
	);
	const opaque = textAt(
		'opaque',
		RIGHT.left,
		bottomOf(token) + 14,
		RIGHT.w,
		say('A token it cannot read, it asks the identity provider about instead.'),
		{ size: 'more', opens: opensAt('flow', 'introspect', 'logout', { oidc: true, logout: true }) }
	);

	// Where each of the token's rows is, as the component lays a party's rows out.
	const rowY = (i: number) => topOf(token) + 14 + token.title!.length * 18 + 2 + i * ROW + 21;
	const lines: PictureLine[] = [
		{
			d: `M${LEFT.left + LEFT.w / 2} ${bottomOf(issuer)} V${topOf(discovery)}`,
			label: {
				lines: [say('found at a known path')],
				x: LEFT.left + LEFT.w / 2 + 10,
				y: bottomOf(issuer) + 30,
				anchor: 'start'
			}
		},
		{
			d: `M${LEFT.left + LEFT.w / 2} ${bottomOf(discovery)} V${topOf(keys)}`,
			label: {
				lines: [say('it says where they are')],
				x: LEFT.left + LEFT.w / 2 + 10,
				y: bottomOf(discovery) + 30,
				anchor: 'start'
			}
		},
		{
			d: `M${RIGHT.left} ${told.y} H${LEFT.left + LEFT.w}`,
			label: {
				lines: [say('starts from')],
				x: (RIGHT.left + LEFT.left + LEFT.w) / 2,
				y: told.y - 8,
				anchor: 'middle'
			}
		},
		{
			d: `M${LEFT.left + LEFT.w} ${keys.y} H${(RIGHT.left + LEFT.left + LEFT.w) / 2} V${rowY(0)} H${RIGHT.left}`,
			label: {
				lines: [say('check')],
				x: (RIGHT.left + LEFT.left + LEFT.w) / 2 + 30,
				y: rowY(0) - 8,
				anchor: 'middle'
			}
		},
		{
			d: `M${RIGHT.left + RIGHT.w - 30} ${bottomOf(told)} V${topOf(token)}`,
			label: {
				lines: [say('compared with iss and aud')],
				x: RIGHT.left + RIGHT.w - 40,
				y: bottomOf(told) + 30,
				anchor: 'end'
			}
		}
	];
	const parts = [issuer, discovery, keys, told, token, opaque];
	return {
		id: 'how-an-api-trusts-a-token',
		title: say('How an API trusts a token'),
		width: W,
		height: Math.max(bottomOf(keys), bottomOf(opaque)) + 16,
		parts,
		lines
	};
}
