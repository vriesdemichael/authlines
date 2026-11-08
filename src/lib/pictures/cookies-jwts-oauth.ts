import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, opensAt, partyBox, textAt } from './build.ts';
import type { Picture, PicturePart, PictureRow } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

/**
 * Cookies, JWTs or OAuth (#200), which people weigh against each other as if they were one choice.
 * Each answers a different question, and one login here has all three, so each row opens where the
 * recorded run has it: the identity provider's session cookie, the tokens as JWTs, and the flow that
 * gets them.
 */
export function cookiesJwtsOauth(say: Say, keep: Keep = keepAll): Picture {
	const W = 800;
	const BOX_W = 250;
	const lead = textAt(
		'lead',
		10,
		8,
		780,
		say(
			'Three answers to three different questions, often weighed against each other as if they were one choice.'
		),
		{ size: 'more' }
	);
	const boxes: { id: string; title: string; says: string; rows: PictureRow[] }[] = [
		{
			id: 'cookie',
			title: 'A cookie',
			says: 'Answers where a login lives in a browser. The browser sends it back by itself to the site that set it.',
			rows: [
				{
					id: 'session',
					says: 'The login session',
					more: 'Kept by the identity provider',
					opens: opensAt('flow', 'redirect-with-code', 'oauth')
				},
				{
					id: 'page',
					says: 'In place of tokens',
					more: 'From a server behind the page',
					opens: opensAt('flow', 'set-session', 'behind-the-page', {
						appRuns: 'bff',
						clientType: 'confidential',
						pkce: true
					})
				}
			]
		},
		{
			id: 'jwt',
			title: 'A JWT',
			says: 'Answers what a token looks like: claims anyone can read, signed so nobody can change them unseen.',
			rows: [
				{
					id: 'access',
					says: 'The access token here',
					more: 'Signed by the identity provider',
					opens: opensAt('flow', 'api-check-token', 'oauth')
				},
				{
					id: 'id',
					says: 'The ID token',
					more: 'Always a JWT, for the app',
					opens: opensAt('flow', 'validate-id-token', 'oidc', { oidc: true })
				}
			]
		},
		{
			id: 'oauth',
			title: 'OAuth',
			says: 'Answers how an app gets access for someone, without ever having their password.',
			rows: [
				{
					id: 'logs-in',
					says: 'The user logs in',
					more: 'Never at the app',
					opens: opensAt('flow', 'redirect-to-idp', 'oauth')
				},
				{
					id: 'token',
					says: 'The app gets a token',
					more: 'A JWT here, though it need not be',
					opens: opensAt('flow', 'token-response', 'oauth')
				}
			]
		}
	];
	const top = bottomOf(lead) + 14;
	const drawn = boxes.map((box, i) =>
		partyBox(box.id, 10 + i * (BOX_W + 15), top, BOX_W, say(box.title), say(box.says), {
			rows: box.rows
				.filter((row) => keep(row.opens))
				.map((row) => ({ ...row, says: say(row.says), more: say(row.more) }))
		})
	);
	// The same height, so the three read as one row of answers.
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
			'So a login is not one or the other. One login here has all three: OAuth gets the app its tokens, those tokens are JWTs, and the identity provider remembers the browser with a cookie.'
		),
		{ size: 'more' }
	);
	parts.push(note);
	return {
		id: 'cookies-jwts-oauth',
		title: say('Cookies, JWTs and OAuth'),
		width: W,
		height: bottomOf(note) + 12,
		parts,
		lines: []
	};
}
