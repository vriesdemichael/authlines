import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, opensAsRecorded, opensAt, partyBox, textAt } from './build.ts';
import type { Picture, PicturePart, PictureRow } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

/**
 * Who someone is, or what they may do (#200's gaps 1 and 2). Authentication is one question, answered
 * at the login. Authorization is several, each answered somewhere else: what the app may do for the
 * user, by scope, what the user may do, by role, and whether this record is theirs, which no token
 * here says. Each row opens the recorded step where its answer is.
 */
export function whoOrWhat(say: Say, keep: Keep = keepAll): Picture {
	const W = 800;
	const BOX_W = 187;
	const GAP = 7;
	const lead = textAt(
		'lead',
		10,
		8,
		780,
		say(
			'Two questions are under all of this: who someone is, and what they may do. The first is answered once, at the login. The second is several questions, each answered somewhere else.'
		),
		{ size: 'more' }
	);
	const boxes: { id: string; title: string; says: string; rows: PictureRow[] }[] = [
		{
			id: 'who',
			title: 'Who is this?',
			says: 'Authentication. The identity provider, or another it trusts, finds out at the login. The app hears in an ID token, and the API from the access token.',
			rows: [
				{
					id: 'logs-in',
					says: 'They log in',
					more: 'Not at the app',
					opens: opensAt('flow', 'submit-credentials', 'oauth')
				},
				{
					id: 'id-token',
					says: 'An ID token',
					more: 'Says who, to the app',
					opens: opensAt('flow', 'token-response', 'oidc', { oidc: true })
				}
			]
		},
		{
			id: 'app',
			title: 'What may this app do for them?',
			says: 'Authorization by scope. The app asks, the identity provider decides what it gets, sometimes by asking the user, and the API should check the token allows the call.',
			rows: [
				{
					id: 'agrees',
					says: 'The user agrees',
					more: 'To what is listed',
					opens: opensAt('flow', 'consent-page', 'consent', { consent: true })
				},
				{
					id: 'scope-refused',
					says: 'Checked at each call',
					more: 'Refused (403) if not',
					opens: opensAsRecorded('flow', 'api-response', 'api-no-scope', { apiToken: 'noscope' })
				}
			]
		},
		{
			id: 'user',
			title: 'What may this user do?',
			says: 'Authorization by role. The identity provider says which roles the user has, and the API decides what each allows.',
			rows: [
				{
					id: 'role',
					says: 'A role in the token',
					more: 'Such as reads-orders',
					opens: opensAt('flow', 'token-response', 'broker-groups', {
						broker: true,
						groupRoles: true
					})
				},
				{
					id: 'api-decides',
					says: 'Not in the token',
					more: 'What the role allows',
					opens: opensAt('flow', 'api-check-token', 'broker-groups', {
						broker: true,
						groupRoles: true
					})
				}
			]
		},
		{
			id: 'owner',
			title: 'May they see this one?',
			says: 'Authorization by record. The API knows from its own data whose record this is. No token here says it.',
			rows: [
				{
					id: 'own-code',
					says: 'Your own code',
					more: 'After the token checks',
					opens: opensAt('flow', 'api-check-token', 'oauth')
				}
			]
		}
	];
	const top = bottomOf(lead) + 14;
	const drawn = boxes.map((box, i) =>
		partyBox(box.id, 10 + i * (BOX_W + GAP), top, BOX_W, say(box.title), say(box.says), {
			rows: box.rows
				.filter((row) => keep(row.opens))
				.map((row) => ({ ...row, says: say(row.says), more: say(row.more) }))
		})
	);
	// The same height, so the four read as one row of questions.
	const tallest = Math.max(...drawn.map((box) => box.h));
	const parts: PicturePart[] = [
		lead,
		...drawn.map((box) => ({ ...box, h: tallest, y: top + tallest / 2 }))
	];
	const note = textAt(
		'note',
		10,
		top + tallest + 14,
		780,
		say(
			'So the tokens answer the first question, the ID token for the app and the access token for the API, and carry what the API needs for the next two. Here the last is the API’s own code to answer.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'who-or-what',
		title: say('Who you are, or what you may do'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines: []
	};
}
