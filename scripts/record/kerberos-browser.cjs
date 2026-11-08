// Runs in the browser's own container, on Linux, where Chromium asks for Kerberos tickets through
// GSSAPI. Its localhost is the recorder's, so every address is the same as in any other run, and what
// crosses to the identity provider and the KDC is written down on the way: the browser's own events
// leave out a 401 it answers by itself, and Kerberos is not HTTP at all.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS, which node runs in the container as it is */
const { appendFileSync } = require('node:fs');
const net = require('node:net');
// Installed in the container at its start, at the version the recorder drives it with.
/** @type {typeof import('@playwright/test')} */
const { chromium } = require(['/tmp/pw/node_modules', 'playwright'].join('/'));

const WIRE = '/tmp/wire.jsonl';
let connections = 0;
/** @param {Record<string, unknown>} entry */
const write = (entry) => appendFileSync(WIRE, `${JSON.stringify({ at: Date.now(), ...entry })}\n`);

/**
 * The heads of HTTP messages as they pass, skipping each body by its length or its chunks.
 * @param {(head: string) => void} onHead
 * @returns {(data: Buffer) => void}
 */
function httpHeads(onHead) {
	let buffer = Buffer.alloc(0);
	let skip = 0;
	let chunked = false;
	return (data) => {
		buffer = Buffer.concat([buffer, data]);
		for (;;) {
			if (skip > 0) {
				const n = Math.min(skip, buffer.length);
				buffer = buffer.subarray(n);
				skip -= n;
				if (skip > 0) return;
				continue;
			}
			if (chunked) {
				const line = buffer.indexOf('\r\n');
				if (line < 0) return;
				const size = parseInt(buffer.subarray(0, line).toString('latin1'), 16);
				if (size === 0) {
					if (buffer.length < line + 4) return;
					buffer = buffer.subarray(line + 4);
					chunked = false;
					continue;
				}
				if (buffer.length < line + 2 + size + 2) return;
				buffer = buffer.subarray(line + 2 + size + 2);
				continue;
			}
			const end = buffer.indexOf('\r\n\r\n');
			if (end < 0) return;
			const head = buffer.subarray(0, end).toString('latin1');
			buffer = buffer.subarray(end + 4);
			onHead(head);
			chunked = /\r\ntransfer-encoding: *chunked/i.test(head);
			skip = Number(/\r\ncontent-length: *(\d+)/i.exec(head)?.[1] ?? 0);
		}
	};
}

/**
 * Kerberos over TCP: each message is its length in four bytes, then the message (RFC 4120 7.2.2).
 * @param {(message: Buffer) => void} onMessage
 * @returns {(data: Buffer) => void}
 */
function kerberosMessages(onMessage) {
	let buffer = Buffer.alloc(0);
	return (data) => {
		buffer = Buffer.concat([buffer, data]);
		while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32BE(0)) {
			const length = buffer.readUInt32BE(0);
			onMessage(buffer.subarray(4, 4 + length));
			buffer = buffer.subarray(4 + length);
		}
	};
}

/**
 * @param {number} listenPort
 * @param {string} toHost
 * @param {number} toPort
 * @param {((write: (entry: Record<string, unknown>) => void) => (data: Buffer) => void)} [tap]
 */
function forward(listenPort, toHost, toPort, tap) {
	net
		.createServer((from) => {
			const connection = ++connections;
			const to = net.connect(toPort, toHost);
			const sent = tap?.((entry) => write({ connection, from: 'browser', ...entry }));
			const answered = tap?.((entry) => write({ connection, from: 'server', ...entry }));
			from.on('data', (data) => {
				sent?.(data);
				to.write(data);
			});
			to.on('data', (data) => {
				answered?.(data);
				from.write(data);
			});
			from.on('end', () => to.end());
			to.on('end', () => from.end());
			from.on('error', () => to.destroy());
			to.on('error', () => from.destroy());
		})
		.listen(listenPort, '127.0.0.1');
}

const tapped = Number(process.env.TAPPED_PORT);
for (const port of (process.env.FORWARD_PORTS ?? '').split(',').map(Number)) {
	forward(
		port,
		'host.docker.internal',
		port,
		port === tapped ? (to) => httpHeads((head) => to({ kind: 'http', head })) : undefined
	);
}
forward(Number(process.env.KDC_PORT), process.env.KDC_HOST ?? '', 88, (to) =>
	kerberosMessages((message) => to({ kind: 'kerberos', bytes: message.toString('base64') }))
);

// One browser that may answer the identity provider with a ticket, as a company sets it up to, and one
// that was never told to, which is what a browser does by itself.
Promise.all([
	chromium.launchServer({
		port: 3999,
		host: '0.0.0.0',
		wsPath: '/with-a-ticket',
		args: ['--auth-server-allowlist=localhost']
	}),
	chromium.launchServer({ port: 3998, host: '0.0.0.0', wsPath: '/not-told' })
]).then(() => console.log('LISTENING'));
