import type { Say, Wording } from '#lib/flow/wording.ts';
import { realmHolds } from '#lib/keycloak/words.ts';
import { bottomOf, opensAt, partyBox, textAt } from './build.ts';
import type { Picture, PictureLine, PictureRow } from './model.ts';
import type { PartyNames } from './who-knows-whom.ts';

/**
 * Who the identity provider trusts, and how: everything it hands a login to or checks a password
 * with, and what each side holds of the other. The maintainer named this one on 2026-11-07, "the
 * connections between the IDP and how the trust relates", as a concept for the whole and not for one
 * flow. The app is on the other side of it, and knows only the one provider.
 */
export function trustAcrossProviders(say: Say, wording: Wording, names: PartyNames): Picture {
	const keycloak = wording === 'keycloak';
	const held = (plain: string, key: keyof typeof realmHolds) =>
		keycloak ? realmHolds[key] : say(plain);
	const W = 800;
	const TOP = 20;
	const RIGHT = { left: 590, w: 200 };

	const others = [
		{
			id: 'other-provider',
			title: say('Another provider, over OpenID Connect'),
			text: say(
				"Where users already have an account, such as a customer's. The identity provider is one client there, with a client ID and secret."
			),
			trust: ['checks its', 'ID token'],
			opens: opensAt('flow', 'upstream-authorize', 'broker', { broker: true })
		},
		{
			id: 'saml-provider',
			title: say("A customer's provider, over SAML"),
			text: say(
				"Each side has the other's name, the address to send things to, and the certificate to check them with."
			),
			trust: ['checks its', 'signature'],
			opens: opensAt('setup', 'send-their-details', 'companies-saml', {
				broker: true,
				companies: true,
				customerSpeaks: 'saml'
			})
		},
		{
			id: 'directory',
			title: say('A directory'),
			text: say(
				'Where the accounts are. The identity provider has its address and an account to search with.'
			),
			trust: ['checks passwords', 'there'],
			opens: opensAt('flow', 'directory-bind', 'in-a-directory', { federation: true })
		}
	];
	let top = TOP;
	const right = others.map((other) => {
		const part = partyBox(other.id, RIGHT.left, top, RIGHT.w, other.title, other.text, {
			opens: other.opens
		});
		top = bottomOf(part) + 22;
		return part;
	});
	const rightBottom = bottomOf(right.at(-1)!);

	const rows: PictureRow[] = [
		{
			id: 'apps',
			says: held('Apps it knows', 'apps'),
			more: say('The app, as one client'),
			opens: opensAt('setup', 'create-client', 'oauth')
		},
		{
			id: 'providers',
			says: held('Other providers', 'providers'),
			more: say('Each, with what it was given'),
			opens: opensAt('setup', 'register-with-upstream', 'broker', { broker: true })
		},
		{
			id: 'customers',
			says: held('Customers', 'customers'),
			more: say('A domain, and its provider'),
			opens: opensAt('setup', 'add-organization', 'companies', { broker: true, companies: true })
		},
		{
			id: 'directories',
			says: held('Directories', 'directories'),
			more: say('Its address, and an account'),
			opens: opensAt('setup', 'connect-directory', 'in-a-directory', { federation: true })
		}
	];
	const idp = partyBox('idp', 250, TOP, 220, names.idp, say('The one the app knows.'), {
		rows,
		minH: rightBottom - TOP,
		opens: opensAt('setup', 'discovery-document', 'oauth')
	});
	const middle = idp.y;
	const app = partyBox(
		'app',
		10,
		middle - 50,
		140,
		names.app,
		say('Has one issuer, whoever the user logs in with'),
		{ opens: opensAt('setup', 'configure-app', 'oauth') }
	);
	const note = textAt(
		'note',
		10,
		Math.max(bottomOf(idp), rightBottom) + 18,
		780,
		say(
			'The app never talks to the others. Whoever logs the user in, its tokens come from the identity provider.'
		),
		{ size: 'more' }
	);

	const lines: PictureLine[] = [
		{
			d: `M150 ${app.y} H250`,
			label: {
				lines: ['trusts only', 'this one'].map(say),
				x: 200,
				y: app.y - 22,
				anchor: 'middle'
			}
		},
		...right.map((part, i) => ({
			d: `M470 ${part.y} H${RIGHT.left}`,
			label: {
				lines: others[i].trust.map(say),
				x: (470 + RIGHT.left) / 2,
				y: part.y - 22,
				anchor: 'middle' as const
			}
		}))
	];
	const parts = [app, idp, ...right, note];
	return {
		id: 'trust-across-providers',
		title: say('Who the identity provider trusts'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines
	};
}
