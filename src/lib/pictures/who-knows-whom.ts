import type { Settings } from '#lib/flow/settings.ts';
import type { Say, Wording } from '#lib/flow/wording.ts';
import { realmHolds } from '#lib/keycloak/words.ts';
import {
	SIZE,
	wrap,
	type Opens,
	type Picture,
	type PictureLine,
	type PicturePart,
	type PictureRow
} from './model.ts';

/** What each party is called on the diagram, in the words chosen. */
export type PartyNames = Readonly<Record<'app' | 'idp' | 'api' | 'upstream' | 'directory', string>>;

const ROW = 50;
const PAD = 14;

/**
 * What each party holds about the others once setup is done, and whose tokens each trusts: the
 * relation diagram the maintainer asked for on 2026-11-06, with the realm, the client and the other
 * provider in it. The identity provider is in the middle, between the user and whoever logs them in
 * further on, and the app and the API are under it, joined by the call all of this is for.
 */
export function whoKnowsWhom(
	settings: Settings,
	say: Say,
	wording: Wording,
	names: PartyNames
): Picture {
	const secret = settings.clientType === 'confidential';
	const broker = settings.broker;
	const directory = settings.federation && !broker;
	const oidc = settings.oidc;
	// Its own words for what a realm holds, only where someone asked for those.
	const keycloak = wording === 'keycloak';
	const held = (plain: string, key: keyof typeof realmHolds) =>
		keycloak ? realmHolds[key] : say(plain);

	const opens = (
		diagram: Opens['diagram'],
		step: string,
		preset: string,
		more: Partial<Settings> = {}
	): Opens => ({
		diagram,
		step,
		settings: more,
		preset
	});
	const plainPreset = broker ? 'broker' : directory ? 'in-a-directory' : 'oauth';
	const realm = settings.companies
		? 'demo-companies'
		: broker
			? 'demo-brokered'
			: directory
				? 'in-a-directory'
				: 'demo';

	const W = 800;
	const TOP = 44;
	const L = { x: 10, w: 150 };
	const C = { x: 280, w: 260 };
	const R = { x: 650, w: 140 };

	/** A party's box, as tall as what it says, with its top left where it goes. */
	function party(
		id: string,
		column: { x: number; w: number },
		top: number,
		title: string,
		text: string,
		opensIt: Opens,
		extra: { sub?: string; rows?: readonly PictureRow[] } = {}
	): PicturePart {
		const room = column.w - 2 * PAD;
		const titled = wrap(title, room, SIZE.title, true);
		const says = text ? wrap(say(text), room, SIZE.more) : [];
		const rows = extra.rows ?? [];
		const h =
			PAD + titled.length * 18 + (extra.sub ? 16 : 0) + says.length * 15 + rows.length * ROW + 10;
		return {
			id,
			shape: 'party',
			x: column.x + column.w / 2,
			y: top + h / 2,
			w: column.w,
			h,
			title: titled,
			sub: extra.sub,
			says,
			rows,
			opens: opensIt
		};
	}
	const bottomOf = (part: PicturePart) => part.y + part.h / 2;
	const topOf = (part: PicturePart) => part.y - part.h / 2;

	const rows: PictureRow[] = [
		{
			id: 'apps',
			says: held('Apps it knows', 'apps'),
			more: `demo-app, ${secret ? 'with its secret' : 'with no secret'}`,
			opens: opens('setup', 'create-client', plainPreset)
		},
		{
			id: 'accounts',
			says: held('Accounts', 'accounts'),
			more: say(
				broker
					? 'Linked to their account elsewhere'
					: directory
						? 'Looked up in the directory'
						: 'With their passwords'
			),
			opens: broker
				? opens('flow', 'match-user', 'broker', { broker: true })
				: directory
					? opens('flow', 'directory-search', 'in-a-directory', { federation: true })
					: opens('flow', 'submit-credentials', 'oauth')
		},
		...(broker
			? [
					{
						id: 'providers',
						says: held('Other providers', 'providers'),
						more: say('Where logins can go'),
						opens: opens('setup', 'register-with-upstream', 'broker', { broker: true })
					}
				]
			: []),
		...(directory
			? [
					{
						id: 'directories',
						says: held('Directories', 'directories'),
						more: say('Its address, and an account'),
						opens: opens('setup', 'connect-directory', 'in-a-directory', { federation: true })
					}
				]
			: []),
		{
			id: 'keys',
			says: held('Signing keys', 'keys'),
			more: say('Published, to check signatures'),
			opens: opens('setup', 'keys', plainPreset)
		}
	];

	const user = party('user', L, TOP, say('User'), '', opens('flow', 'open-app', plainPreset));
	const idp = party(
		'idp',
		C,
		TOP,
		names.idp,
		'',
		opens('setup', 'discovery-document', plainPreset),
		{
			sub: `…/realms/${realm}`,
			rows
		}
	);
	const side = broker
		? party(
				'upstream',
				R,
				TOP,
				names.upstream,
				'Knows the identity provider as one client, for every app behind it',
				opens('flow', 'upstream-authorize', 'broker', { broker: true }),
				{ sub: '…/realms/upstream' }
			)
		: directory
			? party(
					'directory',
					R,
					TOP,
					names.directory,
					'Where the accounts are. OpenLDAP, here',
					opens('flow', 'directory-bind', 'in-a-directory', { federation: true })
				)
			: null;
	const idpBottom = bottomOf(idp);
	// Room under the identity provider for the lines up to it, and for their words.
	const lowY = Math.max(idpBottom + 96, side ? bottomOf(side) + 40 : 0);
	const app = party(
		'app',
		L,
		lowY,
		names.app,
		`Holds the issuer, its client ID ${secret ? 'and its secret' : 'and no secret'}`,
		opens('setup', 'configure-app', plainPreset)
	);
	const api = party(
		'api',
		R,
		lowY,
		names.api,
		'Holds the issuer, and who tokens have to be for',
		opens('setup', 'configure-api', plainPreset)
	);
	const callY = lowY + 30;

	const registered = say(wording === 'specs' ? 'is a client of' : 'is registered at');
	const label = (
		lines: readonly string[],
		x: number,
		y: number,
		anchor: 'start' | 'middle' | 'end' = 'middle'
	) => ({
		lines: lines.map(say),
		x,
		y,
		anchor
	});
	const userY = topOf(user) + 30;
	const lines: PictureLine[] = [
		// The user, and the app they use.
		{
			d: `M90 ${bottomOf(user)} V${lowY}`,
			bare: true,
			label: label(['uses'], 98, (bottomOf(user) + lowY) / 2, 'start')
		},
		...(broker
			? [
					{
						d: `M90 ${TOP} V18 H${R.x + R.w / 2} V${TOP}`,
						bare: true,
						label: label(['has an account at'], (90 + R.x + R.w / 2) / 2, 12)
					}
				]
			: [
					{
						d: `M${L.x + L.w} ${userY} H${C.x}`,
						bare: true,
						label: label(
							[directory ? 'logs in at' : 'has an account at'],
							(L.x + L.w + C.x) / 2,
							userY - 8
						)
					}
				]),
		// What is behind the identity provider.
		...(broker
			? [
					{
						d: `M${C.x + C.w} ${TOP + 30} H${R.x}`,
						bare: true,
						label: {
							lines: [registered],
							x: (C.x + C.w + R.x) / 2,
							y: TOP + 22,
							anchor: 'middle' as const
						}
					},
					...(oidc
						? [
								{
									d: `M${C.x + C.w} ${TOP + 76} H${R.x}`,
									bare: true,
									dashed: true,
									label: label(['trusts', 'tokens from'], (C.x + C.w + R.x) / 2, TOP + 54)
								}
							]
						: [])
				]
			: []),
		...(directory
			? [
					{
						d: `M${C.x + C.w} ${TOP + 40} H${R.x}`,
						bare: true,
						label: label(['looks up users', 'and passwords in'], (C.x + C.w + R.x) / 2, TOP + 18)
					}
				]
			: []),
		// The app, registered there and trusting what it says about who logged in.
		{
			d: `M130 ${lowY} V${idpBottom + 30} H${C.x + 50} V${idpBottom}`,
			bare: true,
			label: { lines: [registered], x: 220, y: idpBottom + 22, anchor: 'middle' }
		},
		...(oidc
			? [
					{
						d: `M155 ${lowY} V${idpBottom + 62} H${C.x + 90} V${idpBottom}`,
						bare: true,
						dashed: true,
						label: label(['trusts ID tokens from'], 260, idpBottom + 54)
					}
				]
			: []),
		// The API, which only has to trust the identity provider.
		{
			d: `M${R.x + R.w / 2} ${lowY} V${idpBottom + 30} H${C.x + C.w - 50} V${idpBottom}`,
			bare: true,
			dashed: true,
			label: label(['trusts tokens from'], (C.x + C.w - 50 + R.x + R.w / 2) / 2, idpBottom + 22)
		},
		// What all of it is for.
		{
			d: `M${L.x + L.w} ${callY} H${R.x}`,
			bare: false,
			label: label(['calls, with an access token'], (L.x + L.w + R.x) / 2, callY - 8)
		}
	];
	const parts = [user, idp, ...(side ? [side] : []), app, api];
	const height = Math.max(...parts.map(bottomOf)) + 16;
	return { id: 'who-knows-whom', title: say('Who knows whom'), width: W, height, parts, lines };
}
