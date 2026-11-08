import type { RecordedMessage } from '#lib/recordings/format.ts';

const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/**
 * Where a new authorization code comes from, for the steps that send one. By step, because a parameter
 * can be called code and be something else, such as a server's own login session.
 */
export const CODE_FROM: Readonly<Record<string, string>> = {
	callback: 'redirect-with-code',
	'token-request': 'redirect-with-code',
	'attacker-token-request': 'redirect-with-code',
	'upstream-callback': 'upstream-redirect-back',
	'upstream-token-request': 'upstream-redirect-back',
	'second-callback': 'second-redirect-with-code',
	'second-token-request': 'second-redirect-with-code'
};

const carriesCode = (message: RecordedMessage) =>
	new URL(message.url ?? '', 'http://any').searchParams.has('code') ||
	(typeof message.body === 'object' && message.body !== null && 'code' in message.body);

function bodyArguments(message: RecordedMessage): string[] {
	const { body } = message;
	if (body === undefined) return [];
	const isForm = message.headers['content-type']?.includes('x-www-form-urlencoded');
	if (isForm && typeof body === 'object' && body !== null) {
		return Object.entries(body).map(
			([name, value]) => `--data-urlencode ${quoted(`${name}=${String(value)}`)}`
		);
	}
	return [`--data-raw ${quoted(typeof body === 'string' ? body : JSON.stringify(body))}`];
}

/**
 * A recorded request as a command that would send it, from nothing but what the recording holds
 * (ADR-005). A request with something left out of it cannot be sent again, so it has no command.
 */
export function curlFor(
	message: RecordedMessage,
	numberOf: (step: string) => number | null
): string | null {
	if (message.direction !== 'request' || !message.url || !message.method) return null;
	if (message.bodyNote || message.log || message.protocol) return null;
	const command = [
		`curl -i -X ${message.method} ${quoted(message.url)}`,
		...Object.entries(message.headers).map(([name, value]) => `-H ${quoted(`${name}: ${value}`)}`),
		...bodyArguments(message)
	].join(' \\\n  ');
	// Not every run of these steps has one: a login that was refused comes back with an error.
	const from = message.step && carriesCode(message) ? CODE_FROM[message.step] : undefined;
	const step = from ? numberOf(from) : null;
	const once = from
		? [
				`# The code in this was good once. ${step ? `A new one comes from step ${step}.` : 'It takes a new login to get another.'}`
			]
		: [];
	return [
		'# From one recorded run on one machine, with throwaway values, so its tokens have run out.',
		'# Never paste real secrets into a command like this.',
		...once,
		command
	].join('\n');
}
