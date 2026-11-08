import type { Say } from '#lib/flow/wording.ts';
import { bottomOf, opensAt, partyBox, textAt } from './build.ts';
import type { Opens, Picture, PicturePart } from './model.ts';
import { keepAll, type Keep } from './simple.ts';

interface Block {
	id: string;
	name: string;
	spec: string;
	text: string;
	opens?: Opens;
}

/**
 * What each spec adds to OAuth, which is the layer they all sit on. OpenID Connect is one of them, so
 * OAuth against OpenID Connect, among the confusions people report most, is one block beside the
 * others and not a second floor. Each block opens the setting that draws what it adds, and only specs
 * a setting already cites are here.
 */
export function whatEachSpecAdds(say: Say, keep: Keep = keepAll): Picture {
	const W = 800;
	const PER_ROW = 4;
	const GAP = 10;
	const BLOCK = (780 - (PER_ROW - 1) * GAP) / PER_ROW;
	const all: readonly Block[] = [
		{
			id: 'openid-connect',
			name: 'OpenID Connect',
			spec: 'OpenID Connect Core 1.0',
			text: 'Who logged in: an ID token made for the app, with UserInfo and the nonce. Logging out has specs of its own.',
			opens: opensAt('flow', 'validate-id-token', 'oidc', { oidc: true })
		},
		{
			id: 'pkce',
			name: 'PKCE',
			spec: 'RFC 7636',
			text: 'Ties the code to the login it came from.',
			opens: opensAt('flow', 'make-verifier', 'pkce', { pkce: true })
		},
		{
			id: 'par',
			name: 'PAR',
			spec: 'RFC 9126',
			text: 'Sends the login request ahead, so the browser carries only a reference.',
			opens: opensAt('flow', 'push-request', 'par', { par: true })
		},
		{
			id: 'dpop',
			name: 'DPoP',
			spec: 'RFC 9449',
			text: 'Ties a token to a key that only the app holds.',
			opens: opensAt('flow', 'generate-key', 'dpop', { binding: 'dpop' })
		},
		{
			id: 'exchange',
			name: 'Token exchange',
			spec: 'RFC 8693',
			text: 'Trades a token for one that another API takes.',
			opens: opensAt('flow', 'exchange-request', 'exchange', { exchange: true })
		},
		{
			id: 'device',
			name: 'Device flow',
			spec: 'RFC 8628',
			text: 'A login on another device, for an app with no good way to log anyone in.'
		},
		{
			id: 'dcr',
			name: 'Registration',
			spec: 'RFC 7591',
			text: 'An app registers itself.',
			opens: opensAt('setup', 'dcr-request', 'registers-itself', { registration: 'dcr' })
		},
		{
			id: 'cimd',
			name: 'Client ID metadata',
			spec: 'a draft',
			text: 'An app points at a document about itself.',
			opens: opensAt('setup', 'cimd-host', 'points-at-a-document', {
				registration: 'cimd',
				clientType: 'public',
				pkce: true,
				consent: true
			})
		},
		{
			id: 'advice',
			name: 'Current advice',
			spec: 'RFC 9700',
			text: 'What to use, and what to stop using.',
			opens: opensAt('flow', 'attacker-token-response', 'attack-public-pkce', {
				attacker: true,
				clientType: 'public',
				pkce: true
			})
		},
		{
			id: 'browser-apps',
			name: 'Apps in a browser',
			spec: 'RFC 10017',
			text: 'Where an app in the page should keep its tokens.',
			opens: opensAt('flow', 'set-session', 'behind-the-page', {
				appRuns: 'bff',
				clientType: 'confidential',
				pkce: true
			})
		},
		{
			id: 'native',
			name: 'Apps on a device',
			spec: 'RFC 8252',
			text: "A program, and the user's own browser.",
			opens: opensAt('flow', 'program-starts', 'on-their-computer', {
				appRuns: 'program',
				clientType: 'public',
				pkce: true
			})
		}
	];
	const blocks = all.filter((block) => keep(block.opens));
	const parts: PicturePart[] = [
		textAt('adds', 10, 10, 780, say('Each of these adds to OAuth, or says how to use it'), {
			size: 'more'
		})
	];
	let top = 34;
	for (let start = 0; start < blocks.length; start += PER_ROW) {
		const row = blocks.slice(start, start + PER_ROW).map((block, i) =>
			partyBox(block.id, 10 + i * (BLOCK + GAP), top, BLOCK, say(block.name), say(block.text), {
				sub: block.spec,
				opens: block.opens
			})
		);
		// A row's blocks are as tall as its tallest, so they read as one layer.
		const tallest = Math.max(...row.map((block) => block.h));
		parts.push(...row.map((block) => ({ ...block, y: top + tallest / 2, h: tallest })));
		top += tallest + GAP;
	}
	const oauth = partyBox(
		'oauth',
		10,
		top + 8,
		780,
		say('OAuth 2.0'),
		say(
			'An app gets access for a user without their password: the code, the token request, the access token and the refresh token. And an app with no user, with only its own secret.'
		),
		{
			sub: 'RFC 6749, with Bearer tokens in RFC 6750',
			opens: opensAt('flow', 'token-request', 'oauth')
		}
	);
	parts.push(oauth);
	return {
		id: 'what-each-spec-adds',
		title: say('What each spec adds'),
		width: W,
		height: bottomOf(oauth) + 12,
		parts,
		lines: []
	};
}
