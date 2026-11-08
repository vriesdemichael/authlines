// A real Kerberos KDC (MIT Kerberos, as Alpine packages it) and a browser on Linux that holds a ticket,
// both in containers, so that logging in with no password is recorded and not drawn from the docs.
// Kerberos is not HTTP, so what crosses to the KDC is caught on the wire in the browser's container and
// read by its spec (kerberos-der.ts). A 401 that the browser answers by itself never reaches its own
// events, so the HTTP heads to the identity provider are caught there too. Nothing here is a real
// credential, and this is not Active Directory, which the screen says.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';
import type { RecordedMessage } from '#lib/recordings/format.ts';
import { decodeKerberos, decodeNegotiate, messageType } from './kerberos-der.ts';
import { APP, KEYCLOAK_PORT, PASSWORD, USERNAME } from './keycloak.ts';

const NETWORK = 'authlines-kerberos';
const KDC = 'authlines-kdc';
const BROWSER = 'authlines-kerberos-browser';
const KDC_IMAGE = 'alpine:3.20';
/** In capitals, as Kerberos realms are written. Not a Keycloak realm, which the screen says. */
export const KERBEROS_REALM = 'EXAMPLE.TEST';
/** What the browser asks a ticket for: HTTP, and the host name in the address it goes to. */
export const SERVICE_PRINCIPAL = `HTTP/localhost@${KERBEROS_REALM}`;
/** Where the browser's container takes what it sends the KDC, to write it down on the way. */
const KDC_TAP_PORT = 1088;
const TOLD_PORT = 3999;
const NOT_TOLD_PORT = 3998;

const docker = (args: readonly string[], input?: string | Buffer) =>
	execFileSync('docker', args, { input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 2 ** 26 });
const logs = (container: string) => {
	const { stdout, stderr } = spawnSync('docker', ['logs', container], {
		encoding: 'utf8',
		maxBuffer: 2 ** 26
	});
	return `${stdout}${stderr}`;
};

async function until(what: string, container: string, done: () => boolean, tries = 120) {
	for (let i = 0; i < tries; i++) {
		if (done()) return;
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
	throw new Error(`${what} did not start:\n${logs(container).slice(-2000)}`);
}

export function stopKerberos() {
	spawnSync('docker', ['rm', '-f', KDC, BROWSER], { stdio: 'ignore' });
	spawnSync('docker', ['network', 'rm', NETWORK], { stdio: 'ignore' });
}

// The user must prove they know the password before the KDC answers, which RFC 4120 section 10
// strongly encourages, and MIT Kerberos asks only when a principal is made with requires_preauth.
const kdcScript = `set -e
apk add --no-cache krb5-server krb5 >/dev/null
cat > /etc/krb5.conf <<EOF
[libdefaults]
	default_realm = ${KERBEROS_REALM}
[realms]
	${KERBEROS_REALM} = {
		kdc = localhost
	}
EOF
cat > /etc/kdc.conf <<EOF
[kdcdefaults]
	kdc_ports = 88
	kdc_tcp_ports = 88
[realms]
	${KERBEROS_REALM} = {
		database_name = /var/lib/krb5kdc/principal
		key_stash_file = /var/lib/krb5kdc/stash
	}
[logging]
	kdc = STDERR
EOF
mkdir -p /var/lib/krb5kdc
export KRB5_KDC_PROFILE=/etc/kdc.conf
kdb5_util create -s -r ${KERBEROS_REALM} -P throwaway-master >/dev/null
kadmin.local -q "addprinc +requires_preauth -pw ${PASSWORD} ${USERNAME}" >/dev/null
kadmin.local -q "addprinc -randkey ${SERVICE_PRINCIPAL}" >/dev/null
kadmin.local -q "ktadd -k /tmp/service.keytab ${SERVICE_PRINCIPAL}" >/dev/null
echo READY >&2
exec krb5kdc -n`;

// What a computer in the realm knows: where the KDC is, here a pass-through to it, over TCP.
const clientConfig = `[libdefaults]
	default_realm = ${KERBEROS_REALM}
	dns_lookup_kdc = false
	dns_lookup_realm = false
	udp_preference_limit = 1
[realms]
	${KERBEROS_REALM} = {
		kdc = 127.0.0.1:${KDC_TAP_PORT}
	}
[domain_realm]
	localhost = ${KERBEROS_REALM}`;

/** The image CI runs in, whose Playwright is the one the recorder drives it with. */
const browserImage = () => {
	const image = readFileSync('.github/workflows/ci.yml', 'utf8').match(/container: (\S+)/)?.[1];
	if (!image) throw new Error('No container image in ci.yml');
	return image;
};
const playwrightVersion = () =>
	(
		JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8')) as {
			version: string;
		}
	).version;

export interface WireEntry {
	at: number;
	connection: number;
	from: 'browser' | 'server';
	kind: 'http' | 'kerberos';
	head?: string;
	bytes?: string;
}

/** Starts the KDC and the browser's container, and returns the key the identity provider is given. */
export async function startKerberos(): Promise<Buffer> {
	stopKerberos();
	docker(['network', 'create', NETWORK]);
	docker([
		'run',
		'--detach',
		'--name',
		KDC,
		'--network',
		NETWORK,
		KDC_IMAGE,
		'sh',
		'-c',
		kdcScript
	]);
	await until('The KDC', KDC, () => logs(KDC).includes('commencing operation'));
	const keytab = docker(['exec', KDC, 'cat', '/tmp/service.keytab']);
	const setUp = [
		'apt-get update -qq >/dev/null',
		'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq krb5-user >/dev/null 2>&1',
		`printf '%s\\n' "$CLIENT_CONFIG" > /etc/krb5.conf`,
		'mkdir -p /tmp/pw',
		`cd /tmp/pw && npm install --silent playwright@${playwrightVersion()} >/dev/null 2>&1`,
		'node /kerberos-browser.cjs'
	].join(' && ');
	docker([
		'run',
		'--detach',
		'--name',
		BROWSER,
		'--network',
		NETWORK,
		'--add-host=host.docker.internal:host-gateway',
		'--publish',
		`${TOLD_PORT}:${TOLD_PORT}`,
		'--publish',
		`${NOT_TOLD_PORT}:${NOT_TOLD_PORT}`,
		'--volume',
		`${process.cwd()}/scripts/record/kerberos-browser.cjs:/kerberos-browser.cjs:ro`,
		'--env',
		`CLIENT_CONFIG=${clientConfig}`,
		'--env',
		`FORWARD_PORTS=${KEYCLOAK_PORT},${new URL(APP).port}`,
		'--env',
		`TAPPED_PORT=${KEYCLOAK_PORT}`,
		'--env',
		`KDC_HOST=${KDC}`,
		'--env',
		`KDC_PORT=${KDC_TAP_PORT}`,
		'--env',
		'KRB5CCNAME=FILE:/tmp/ccache',
		browserImage(),
		'sh',
		'-c',
		setUp
	]);
	await until('The browser on Linux', BROWSER, () => logs(BROWSER).includes('LISTENING'), 150);
	return keytab;
}

/** A browser on a computer in the realm. Told, it may answer the identity provider with a ticket. */
export const browserInTheRealm = (told: boolean): Promise<Browser> =>
	chromium.connect(
		told ? `ws://localhost:${TOLD_PORT}/with-a-ticket` : `ws://localhost:${NOT_TOLD_PORT}/not-told`
	);

/** Everything caught on the wire so far, in order. */
export function wire(): WireEntry[] {
	const { stdout } = spawnSync('docker', ['exec', BROWSER, 'cat', '/tmp/wire.jsonl'], {
		encoding: 'utf8',
		maxBuffer: 2 ** 26
	});
	return stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as WireEntry);
}

/** What a failed run needs someone to see: what crossed, and what the identity provider said. */
export function whatHappened(): string {
	const crossed = wire().map(({ from, kind, head, bytes }) =>
		kind === 'http'
			? `${from}: ${head
					?.split('\r\n')
					.filter((line) => /^(GET|POST|HTTP|www-auth|authoriz)/i.test(line))
					.join(' | ')
					.slice(0, 200)}`
			: `${from}: ${messageType(Buffer.from(bytes ?? '', 'base64'))}`
	);
	const said = logs('authlines-keycloak')
		.split('\n')
		.filter((line) => /kerberos|spnego|gss|negotiat|krb|ldap|WARN|ERROR/i.test(line))
		.slice(-40);
	return [...crossed, '--- the identity provider:', ...said].join('\n');
}

/** One Kerberos message as the diagram has it, read from the wire by its spec. */
export function kerberosMessage(step: string, entry: WireEntry): RecordedMessage {
	const bytes = Buffer.from(entry.bytes ?? '', 'base64');
	return {
		step,
		direction: entry.from === 'browser' ? 'request' : 'response',
		protocol: 'kerberos',
		method: messageType(bytes),
		headers: {},
		body: decodeKerberos(bytes),
		bytes: entry.bytes
	};
}

/**
 * The user logs in to their computer, which gets a ticket-granting ticket. With no proof the KDC asks
 * for one, and then the computer sends the time, sealed with a key made from the password.
 */
export function logInToTheComputer(): RecordedMessage[] {
	const before = wire().length;
	docker(['exec', '-i', BROWSER, 'kinit', USERNAME], `${PASSWORD}\n`);
	const sent = wire()
		.slice(before)
		.filter((entry) => entry.kind === 'kerberos');
	const kinds = sent.map((entry) => messageType(Buffer.from(entry.bytes ?? '', 'base64')));
	if (kinds.join() !== 'AS-REQ,KRB-ERROR,AS-REQ,AS-REP') {
		throw new Error(`Logging in to the computer went otherwise: ${kinds.join(', ')}`);
	}
	const raw = sent.map((entry) => entry.bytes ?? '').join('');
	if (Buffer.from(raw, 'base64').includes(PASSWORD)) {
		throw new Error('The password crossed the wire to the KDC.');
	}
	return ['computer-asks', 'kdc-wants-proof', 'computer-proves', 'kdc-gives-tgt'].map((step, i) =>
		kerberosMessage(step, sent[i])
	);
}

/** An HTTP head as it crossed, split into what the recordings keep of a message. */
export function headOf(head: string) {
	const [first, ...lines] = head.split('\r\n');
	const headers = Object.fromEntries(
		lines.map((line) => {
			const at = line.indexOf(':');
			return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()];
		})
	);
	return { first, headers };
}

export { decodeNegotiate };
