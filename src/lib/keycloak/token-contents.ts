import { bottomOf, opensAt, partyBox, textAt, zone } from '#lib/pictures/build.ts';
import type { Picture, PictureLine, PictureRow } from '#lib/pictures/model.ts';

const ROW = 50;

/**
 * What decides what is in an access token on Keycloak: the realm holds the client, the client has
 * client scopes, and each scope puts claims in. Only about this one server, so it lives with the rest
 * of the overlay and shows only where its notes do (ADR-015). Each claim is in a recorded token, and
 * which scope it comes from is what the notes on client scopes and the audience found by changing it.
 */
export function whatIsInATokenHere(): Picture {
	const W = 800;
	const scopes: PictureRow[] = [
		{
			id: 'profile',
			says: 'profile',
			more: 'A default client scope',
			opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
		},
		{
			id: 'email',
			says: 'email',
			more: 'A default client scope',
			opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
		},
		{
			id: 'roles',
			says: 'roles',
			more: 'A default client scope',
			opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
		},
		{
			id: 'dedicated',
			says: 'Its dedicated scope',
			more: 'With an Audience mapper you add',
			opens: opensAt('flow', 'api-check-token', 'exchange', { exchange: true })
		}
	];
	const client = partyBox(
		'client',
		30,
		52,
		400,
		'Client demo-app',
		'Its client scopes decide what its access token says about the user, whether or not the app asked for openid.',
		{ rows: scopes, opens: opensAt('setup', 'create-client', 'oauth') }
	);
	const realm = zone('realm', 10, 20, 440, bottomOf(client) + 20 - 20, 'Realm demo');
	// The token's rows line up with the scopes that put them there.
	const scopesTop =
		client.y - client.h / 2 + 14 + client.title!.length * 18 + client.says.length * 15 + 2;
	const claims: PictureRow[] = [
		{
			id: 'profile',
			says: 'name, preferred_username',
			more: 'given_name, family_name',
			opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
		},
		{
			id: 'email',
			says: 'email, email_verified',
			more: 'The email address',
			opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
		},
		{
			id: 'roles',
			says: 'aud: account',
			more: 'Not your API',
			opens: opensAt('flow', 'api-check-token', 'oauth')
		},
		{
			id: 'dedicated',
			says: 'aud: your API',
			more: 'Only with that mapper',
			opens: opensAt('flow', 'api-check-token', 'exchange', { exchange: true })
		}
	];
	const token = partyBox('token', 560, scopesTop - 34, 230, 'The access token', '', {
		rows: claims,
		opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
	});
	const lines: PictureLine[] = scopes.map((_, i) => ({
		// From the client's edge to the token's, so neither box covers the head.
		d: `M${30 + 400} ${scopesTop + i * ROW + 21} H${560}`,
		label:
			i === 0
				? { lines: ['puts in'], x: 495, y: scopesTop + 13, anchor: 'middle' as const }
				: undefined
	}));
	const note = textAt(
		'note',
		10,
		Math.max(bottomOf(realm), bottomOf(token)) + 16,
		780,
		'A new client has profile and email among its default client scopes, so its token already has a name and an email address. Take those two off, and they are gone. With no roles scope, there is no audience at all.',
		{ size: 'more' }
	);
	return {
		id: 'what-is-in-a-token-here',
		title: 'What decides what is in a token, on Keycloak',
		width: W,
		height: bottomOf(note) + 12,
		parts: [realm, client, token, note],
		lines
	};
}
