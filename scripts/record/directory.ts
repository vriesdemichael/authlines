// A real LDAP server in a container, so that user federation is recorded and not drawn from the docs.
// LDAP is not HTTP, so what it was asked comes from its own log, and a pass-through on the connection
// shows that the password really crosses it, which the log leaves out. Nothing here is a real credential.
import { execFileSync, spawnSync } from 'node:child_process';
import { connect, createServer, type Server } from 'node:net';
import type { RecordedMessage } from '#lib/recordings/format.ts';
import { PASSWORD, USERNAME } from './keycloak.ts';

const CONTAINER = 'authlines-directory';
const IMAGE = 'bitnamilegacy/openldap:2.6';
const LDAP_PORT = 18389;
const PASS_THROUGH_PORT = 18390;
const BASE_DN = 'dc=example,dc=org';
export const USERS_DN = `ou=users,${BASE_DN}`;
export const SERVICE_DN = `cn=admin,${BASE_DN}`;
export const SERVICE_PASSWORD = 'throwaway-directory-admin';
/** Where the identity provider finds it, from inside its own container. */
export const DIRECTORY_URL = `ldap://host.docker.internal:${PASS_THROUGH_PORT}`;

const docker = (args: readonly string[], input?: string) =>
	execFileSync('docker', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });

export function stopDirectory() {
	spawnSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
}

/** The same person as the one in the identity provider's own realm, so the two can be compared. */
const person = `dn: cn=${USERNAME},${USERS_DN}
changetype: modify
replace: mail
mail: ${USERNAME}@example.test
-
replace: givenName
givenName: Alice
-
replace: sn
sn: Example
`;

export async function startDirectory() {
	stopDirectory();
	docker([
		'run',
		'--detach',
		'--name',
		CONTAINER,
		'--publish',
		`${LDAP_PORT}:1389`,
		'--env',
		`LDAP_ROOT=${BASE_DN}`,
		'--env',
		'LDAP_ADMIN_USERNAME=admin',
		'--env',
		`LDAP_ADMIN_PASSWORD=${SERVICE_PASSWORD}`,
		'--env',
		`LDAP_USERS=${USERNAME}`,
		'--env',
		`LDAP_PASSWORDS=${PASSWORD}`,
		'--env',
		'LDAP_LOGLEVEL=256',
		IMAGE
	]);
	for (let i = 0; i < 45; i++) {
		try {
			docker(
				[
					'exec',
					'-i',
					CONTAINER,
					'ldapmodify',
					'-x',
					'-H',
					'ldap://localhost:1389',
					'-D',
					SERVICE_DN,
					'-w',
					SERVICE_PASSWORD
				],
				person
			);
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
	throw new Error(`The directory did not start:\n${logLines().slice(-20).join('\n')}`);
}

/** It logs to stderr. */
function logLines(): string[] {
	const { stderr, stdout } = spawnSync('docker', ['logs', CONTAINER], {
		encoding: 'utf8',
		maxBuffer: 2 ** 26
	});
	return `${stdout}${stderr}`.split('\n');
}

/** Everything passes through this on its way to the directory, and it only looks for one thing. */
export function passThrough() {
	let sawPassword = false;
	const server: Server = createServer((from) => {
		const to = connect(LDAP_PORT, '127.0.0.1');
		from.on('data', (data) => {
			if (data.includes(PASSWORD)) sawPassword = true;
			to.write(data);
		});
		to.pipe(from);
		from.on('end', () => to.end());
		from.on('error', () => to.destroy());
		to.on('error', () => from.destroy());
	});
	server.listen(PASS_THROUGH_PORT, '0.0.0.0');
	return {
		sawPassword: () => sawPassword,
		stop: () => {
			server.close();
		}
	};
}

const match = (lines: readonly string[], pattern: RegExp, what: string) => {
	for (const line of lines) {
		const found = line.match(pattern);
		if (found) return found;
	}
	throw new Error(`The directory's log has no ${what}:\n${lines.slice(-20).join('\n')}`);
};

/** How many lines there are now, so that a run only reads what it caused. */
export const directoryLogLength = () => logLines().length;

/** How many times, since then, a password was tried on the directory. */
export const directoryBindsSince = (since: number) =>
	logLines()
		.slice(since)
		.filter((line) => line.includes(`BIND dn="cn=${USERNAME},`) && line.includes('mech=')).length;

/** What the log says one login asked, as messages, because the diagram draws them as messages. */
export function messagesFromTheLog(since: number, sawPassword: boolean): RecordedMessage[] {
	if (!sawPassword) throw new Error('The password never crossed the connection to the directory.');
	const lines = logLines().slice(since);
	const [, base, filter] = match(
		lines,
		new RegExp(`SRCH base="([^"]*)".*filter="([^"]*uid=${USERNAME}[^"]*)"`),
		'search for the user'
	);
	const [, attributes] = match(lines, /SRCH attr=(.*)$/, 'list of attributes');
	const [, searched, entries] = match(
		lines,
		/SEARCH RESULT .*err=(\d+) .*nentries=(\d+)/,
		'search result'
	);
	const [, conn, dn, mechanism] = match(
		lines,
		new RegExp(`(conn=\\d+) op=\\d+ BIND dn="(cn=${USERNAME},[^"]*)" mech=(\\w+)`),
		'bind as the user'
	);
	const [, result] = match(
		lines,
		new RegExp(`${conn} op=\\d+ RESULT tag=97 err=(\\d+)`),
		'answer to the bind'
	);
	const ldap = { protocol: 'ldap', headers: {} } as const;
	return [
		{
			...ldap,
			step: 'directory-search',
			direction: 'request',
			method: 'SEARCH',
			url: `ldap://directory/${base}`,
			body: { filter, attributes: attributes.trim().split(' ') }
		},
		{
			...ldap,
			step: 'directory-found',
			direction: 'response',
			status: Number(searched),
			body: { entries: Number(entries) }
		},
		{
			...ldap,
			step: 'directory-bind',
			direction: 'request',
			method: 'BIND',
			url: `ldap://directory/${dn}`,
			body: { mechanism, password: PASSWORD }
		},
		{ ...ldap, step: 'directory-bound', direction: 'response', status: Number(result) }
	];
}
