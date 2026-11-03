import type { RecordedMessage, Recording } from '#lib/recordings/format.ts';

/** The claims inside a JWT, without their values. */
function claimNames(value: unknown): string[] | null {
	if (typeof value !== 'string' || value.split('.').length !== 3) return null;
	try {
		const payload = value.split('.')[1];
		return Object.keys(JSON.parse(Buffer.from(payload, 'base64url').toString())).sort();
	} catch {
		return null;
	}
}

function pathOf(url: string): string {
	const { pathname } = new URL(url);
	// What changes between runs: the realm's generated login action, and a generated client's ID.
	return pathname
		.replace(/\/login-actions\/[^/]+/, '/login-actions/*')
		.replace(
			/\/clients-registrations\/openid-connect\/[^/]+/,
			'/clients-registrations/openid-connect/*'
		);
}

function queryNames(url: string): string[] {
	return [...new Set(new URL(url).searchParams.keys())].sort();
}

/** Values that do not change between runs, which the diagram and the notes state word for word. */
const STATED = new Set(['error', 'error_description', 'token_type']);

function bodyShape(body: unknown): unknown {
	if (body === null || typeof body !== 'object') return typeof body;
	return Object.fromEntries(
		Object.entries(body)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, value]) => [key, STATED.has(key) ? value : (claimNames(value) ?? typeof value)])
	);
}

function messageShape(message: RecordedMessage) {
	return {
		step: message.step,
		direction: message.direction,
		method: message.method,
		path: message.url ? pathOf(message.url) : undefined,
		query: message.url ? queryNames(message.url) : undefined,
		status: message.status,
		headers: Object.keys(message.headers).sort(),
		location: message.headers.location ? pathOf(message.headers.location) : undefined,
		locationQuery: message.headers.location ? queryNames(message.headers.location) : undefined,
		body: message.body === undefined ? undefined : bodyShape(message.body),
		bodyNote: message.bodyNote
	};
}

/**
 * What stays the same between two runs: which steps happened in which order, which names they
 * carried, which claims the tokens held, and the errors and token types the screen states. Codes,
 * tokens, timestamps and signatures change every time and are left out.
 */
export function shapeOf(recording: Recording) {
	return {
		preset: recording.preset,
		messages: recording.messages.map(messageShape)
	};
}

export type RecordingShape = ReturnType<typeof shapeOf>;

/**
 * The lines that differ between two shapes, in order, so a person can read what a Keycloak release
 * changed. Order matters, because a diagram is an order, so messages that swap places count.
 */
export function shapeDifferences(before: RecordingShape, after: RecordingShape): string[] {
	const lines = (shape: RecordingShape) => shape.messages.map((message) => JSON.stringify(message));
	const [a, b] = [lines(before), lines(after)];
	// The longest run of lines they share, from each pair of positions to the end.
	const shared = Array.from({ length: a.length + 1 }, () =>
		new Array<number>(b.length + 1).fill(0)
	);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			shared[i][j] =
				a[i] === b[j] ? shared[i + 1][j + 1] + 1 : Math.max(shared[i + 1][j], shared[i][j + 1]);
		}
	}
	const differences: string[] = [];
	let [i, j] = [0, 0];
	while (i < a.length || j < b.length) {
		if (a[i] === b[j]) {
			i++;
			j++;
		} else if (j >= b.length || (i < a.length && shared[i + 1][j] >= shared[i][j + 1])) {
			differences.push(`- ${a[i++]}`);
		} else {
			differences.push(`+ ${b[j++]}`);
		}
	}
	return differences;
}
