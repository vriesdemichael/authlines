// A second factor for the user the recordings log in as (2026-11-08). Set up in a login that is not
// recorded, as the user would set it up once, and taken off again after, so no other recording asks.
import { createHmac } from 'node:crypto';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { type Admin, KEYCLOAK, LOCAL_REALM, PASSWORD, USERNAME } from './keycloak.ts';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function fromBase32(text: string): Buffer {
	const clean = text.replace(/[\s=]/g, '').toUpperCase();
	let bits = '';
	for (const char of clean) {
		const at = BASE32.indexOf(char);
		if (at < 0) throw new Error(`Not base32: ${char}`);
		bits += at.toString(2).padStart(5, '0');
	}
	const bytes = [];
	for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
	return Buffer.from(bytes);
}

/**
 * A code as an authenticator app makes it (RFC 6238): HMAC-SHA1 of the number of 30-second steps
 * since 1970, cut to six digits, which is what a new realm's OTP policy asks for.
 */
export function codeAt(secret: string, seconds: number, digits = 6, period = 30): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(seconds / period)));
	const hash = createHmac('sha1', fromBase32(secret)).update(counter).digest();
	const offset = hash[hash.length - 1] & 0xf;
	const value = (hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
	return String(value).padStart(digits, '0');
}

const userOf = async (admin: Admin) => {
	const [them] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${LOCAL_REALM}/users?username=${USERNAME}&exact=true`
	);
	return `/realms/${LOCAL_REALM}/users/${them.id}`;
};

/**
 * Sets up an authenticator app for the user, the way they would: Keycloak asks at their next login,
 * shows the secret, and wants one code made from it. Gives back the secret, to make the next code.
 */
export async function setUpAnAuthenticatorApp(browser: Browser, admin: Admin): Promise<string> {
	const user = await userOf(admin);
	const them = await admin.call<object>('GET', user);
	await admin.call('PUT', user, { ...them, requiredActions: ['CONFIGURE_TOTP'] });
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${KEYCLOAK}/realms/${LOCAL_REALM}/account`);
	await page.locator('#username').waitFor();
	await page.fill('#username', USERNAME);
	await page.fill('#password', PASSWORD);
	await page.click('#kc-login');
	// The secret is shown as text for someone who cannot scan the picture of it.
	await page.locator('#mode-manual, a[href*="mode=manual"]').first().click();
	const secret = (await page.locator('#kc-totp-secret-key').innerText()).trim();
	await page.fill('#totp', codeAt(secret, Date.now() / 1000));
	await page.fill('#userLabel', 'Phone');
	await page.locator('#saveTOTPBtn, input[type="submit"]').first().click();
	await page.waitForURL(/\/account/, { timeout: 30_000 });
	await context.close();
	return secret;
}

/** Takes the authenticator app off the user again, so the next recording asks for a password only. */
export async function forgetTheAuthenticatorApp(admin: Admin) {
	const user = await userOf(admin);
	for (const credential of await admin.call<{ id: string; type: string }[]>(
		'GET',
		`${user}/credentials`
	)) {
		if (credential.type === 'otp')
			await admin.call('DELETE', `${user}/credentials/${credential.id}`);
	}
}

/** What a virtual authenticator holds, as Chrome's DevTools protocol gives it and takes it back. */
export type StoredPasskey = {
	credentialId: string;
	isResidentCredential: boolean;
	rpId?: string;
	privateKey: string;
	userHandle?: string;
	signCount: number;
};

/** A device with a fingerprint reader, as the browser sees it, which says yes to every check. */
async function aDeviceWithAPasskey(
	context: BrowserContext,
	page: Page,
	keys: StoredPasskey[] = []
) {
	const devtools = await context.newCDPSession(page);
	await devtools.send('WebAuthn.enable');
	const { authenticatorId } = await devtools.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true
		}
	});
	for (const credential of keys) {
		await devtools.send('WebAuthn.addCredential', { authenticatorId, credential });
	}
	return async () =>
		(await devtools.send('WebAuthn.getCredentials', { authenticatorId }))
			.credentials as StoredPasskey[];
}

/** Turns Keycloak's passkeys on for the realm, which a new one has off, or off again. */
export async function passkeysOn(admin: Admin, on: boolean) {
	const realm = await admin.call<object>('GET', `/realms/${LOCAL_REALM}`);
	await admin.call('PUT', `/realms/${LOCAL_REALM}`, {
		...realm,
		webAuthnPolicyPasswordlessPasskeysEnabled: on
	});
}

/**
 * Makes a passkey for the user the way they would: Keycloak asks at their next login, and the device
 * makes a key for this site. Gives back what the device holds, for the recorded login's device.
 */
export async function setUpAPasskey(browser: Browser, admin: Admin): Promise<StoredPasskey[]> {
	const user = await userOf(admin);
	const them = await admin.call<object>('GET', user);
	await admin.call('PUT', user, { ...them, requiredActions: ['webauthn-register-passwordless'] });
	const context = await browser.newContext();
	const page = await context.newPage();
	const held = await aDeviceWithAPasskey(context, page);
	// It asks what to call the key, in a dialog of the browser's own.
	page.on('dialog', (dialog) => dialog.accept('Laptop'));
	await page.goto(`${KEYCLOAK}/realms/${LOCAL_REALM}/account`);
	await page.locator('#username').waitFor();
	await page.fill('#username', USERNAME);
	await page.fill('#password', PASSWORD);
	await page.click('#kc-login');
	await page.locator('#registerWebAuthn').click();
	await page.waitForURL(/\/account/, { timeout: 30_000 });
	const keys = await held();
	await context.close();
	if (!keys.length) throw new Error('No passkey was made');
	return keys;
}

/** The device for the recorded login, with the passkey made before on it. */
export const holdingThePasskey = (context: BrowserContext, page: Page, keys: StoredPasskey[]) =>
	aDeviceWithAPasskey(context, page, keys);

/** Takes the passkey off the user again, so the next recording logs in with a password. */
export async function forgetThePasskey(admin: Admin) {
	const user = await userOf(admin);
	for (const credential of await admin.call<{ id: string; type: string }[]>(
		'GET',
		`${user}/credentials`
	)) {
		if (credential.type.startsWith('webauthn'))
			await admin.call('DELETE', `${user}/credentials/${credential.id}`);
	}
}
