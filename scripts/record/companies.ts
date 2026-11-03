// Customers who each have a provider of their own (issue 118): our provider in the middle, with
// Organizations on, and two customers, one on SAML and one on OpenID Connect. Both customers are
// other realms of the same throwaway server, standing in for what a customer's IT would run.
import {
	demoClient as client,
	REDIRECT_URI,
	withSecret as confidential
} from '#lib/recordings/run-yourself.ts';
import type { Browser } from '@playwright/test';
import { Admin, KEYCLOAK, PASSWORD, PROXY_FROM_CONTAINER } from './keycloak.ts';

/** Our provider, the one the app knows. */
export const COMPANIES_REALM = 'demo-companies';
/** A customer whose provider speaks SAML. */
export const SAML_CUSTOMER = 'acme';
/** A customer whose provider speaks OpenID Connect. */
export const OIDC_CUSTOMER = 'globex';
export const CUSTOMERS = [SAML_CUSTOMER, OIDC_CUSTOMER] as const;
export type Customer = (typeof CUSTOMERS)[number];

/** Someone at each customer, who logs in with the email their company gave them. */
export const PERSON_AT: Record<Customer, { email: string; firstName: string; lastName: string }> = {
	acme: { email: 'ann@acme.test', firstName: 'Ann', lastName: 'Acme' },
	globex: { email: 'gil@globex.test', firstName: 'Gil', lastName: 'Globex' }
};
const DOMAIN_OF: Record<Customer, string> = { acme: 'acme.test', globex: 'globex.test' };
const NAME_OF: Record<Customer, string> = { acme: 'Acme', globex: 'Globex' };

/** What our provider is called at a customer on SAML, and where it wants the answer. */
export const OUR_ENTITY_ID = `${KEYCLOAK}/realms/${COMPANIES_REALM}`;
export const answerGoesTo = (customer: Customer) =>
	`${KEYCLOAK}/realms/${COMPANIES_REALM}/broker/${customer}/endpoint`;

const BROKER_CLIENT = 'our-provider';
const BROKER_SECRET = 'throwaway-customer-secret';

/** The certificate a SAML provider signs with, which is what a customer hands over in its metadata. */
async function signingCertificate(admin: Admin, realm: string) {
	const { keys } = await admin.call<{
		keys: { algorithm: string; use: string; certificate?: string }[];
	}>('GET', `/realms/${realm}/keys`);
	const key = keys.find(({ algorithm, use }) => algorithm === 'RS256' && use === 'SIG');
	if (!key?.certificate) throw new Error(`No signing certificate in ${realm}`);
	return key.certificate;
}

export async function setUpCompanies(admin: Admin) {
	for (const realm of [COMPANIES_REALM, ...CUSTOMERS]) {
		await admin.call('POST', '/realms', { realm, enabled: true });
	}
	for (const customer of CUSTOMERS) {
		const { email, firstName, lastName } = PERSON_AT[customer];
		await admin.call('POST', `/realms/${customer}/users`, {
			username: email,
			email,
			firstName,
			lastName,
			enabled: true,
			emailVerified: true,
			credentials: [{ type: 'password', value: PASSWORD, temporary: false }]
		});
	}

	// Acme knows our provider as a service provider: who it is, where to send the answer, and the
	// certificate our requests are signed with, which is in our metadata.
	const ours = await signingCertificate(admin, COMPANIES_REALM);
	await admin.call('POST', `/realms/${SAML_CUSTOMER}/clients`, {
		clientId: OUR_ENTITY_ID,
		protocol: 'saml',
		enabled: true,
		redirectUris: [answerGoesTo(SAML_CUSTOMER)],
		attributes: {
			saml_name_id_format: 'email',
			'saml.force.name.id.format': 'true',
			'saml.client.signature': 'true',
			'saml.signing.certificate': ours,
			saml_assertion_consumer_url_post: answerGoesTo(SAML_CUSTOMER)
		},
		protocolMappers: ['email', 'firstName', 'lastName'].map((attribute) => ({
			name: attribute,
			protocol: 'saml',
			protocolMapper: 'saml-user-property-mapper',
			config: {
				'user.attribute': attribute,
				'attribute.name': attribute,
				'attribute.nameformat': 'Basic'
			}
		}))
	});
	// Globex knows our provider as an OpenID Connect client, as the single other provider does.
	await admin.call('POST', `/realms/${OIDC_CUSTOMER}/clients`, {
		...client(BROKER_CLIENT, confidential),
		secret: BROKER_SECRET,
		redirectUris: [answerGoesTo(OIDC_CUSTOMER)]
	});

	const realm = await admin.call<object>('GET', `/realms/${COMPANIES_REALM}`);
	await admin.call('PUT', `/realms/${COMPANIES_REALM}`, { ...realm, organizationsEnabled: true });

	// What Acme's metadata says, set the way an admin would copy it in, with addresses the browser
	// can reach. Everything SAML here goes through the browser, so nothing needs the proxy.
	const saml = `${KEYCLOAK}/realms/${SAML_CUSTOMER}/protocol/saml`;
	await admin.call('POST', `/realms/${COMPANIES_REALM}/identity-provider/instances`, {
		alias: SAML_CUSTOMER,
		displayName: NAME_OF.acme,
		providerId: 'saml',
		enabled: true,
		trustEmail: true,
		config: {
			idpEntityId: `${KEYCLOAK}/realms/${SAML_CUSTOMER}`,
			entityId: OUR_ENTITY_ID,
			singleSignOnServiceUrl: saml,
			singleLogoutServiceUrl: saml,
			postBindingAuthnRequest: 'true',
			postBindingResponse: 'true',
			postBindingLogout: 'true',
			wantAuthnRequestsSigned: 'true',
			validateSignature: 'true',
			signingCertificate: await signingCertificate(admin, SAML_CUSTOMER),
			nameIDPolicyFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
			principalType: 'SUBJECT',
			syncMode: 'IMPORT'
		}
	});
	for (const attribute of ['email', 'firstName', 'lastName']) {
		await admin.call(
			'POST',
			`/realms/${COMPANIES_REALM}/identity-provider/instances/${SAML_CUSTOMER}/mappers`,
			{
				name: attribute,
				identityProviderAlias: SAML_CUSTOMER,
				identityProviderMapper: 'saml-user-attribute-idp-mapper',
				config: { syncMode: 'INHERIT', 'attribute.name': attribute, 'user.attribute': attribute }
			}
		);
	}
	const oidc = `realms/${OIDC_CUSTOMER}/protocol/openid-connect`;
	await admin.call('POST', `/realms/${COMPANIES_REALM}/identity-provider/instances`, {
		alias: OIDC_CUSTOMER,
		displayName: NAME_OF.globex,
		providerId: 'oidc',
		enabled: true,
		trustEmail: true,
		config: {
			authorizationUrl: `${KEYCLOAK}/${oidc}/auth`,
			tokenUrl: `${PROXY_FROM_CONTAINER}/${oidc}/token`,
			userInfoUrl: `${PROXY_FROM_CONTAINER}/${oidc}/userinfo`,
			jwksUrl: `${PROXY_FROM_CONTAINER}/${oidc}/certs`,
			useJwksUrl: 'true',
			validateSignature: 'true',
			issuer: `${KEYCLOAK}/realms/${OIDC_CUSTOMER}`,
			clientId: BROKER_CLIENT,
			clientSecret: BROKER_SECRET,
			clientAuthMethod: 'client_secret_post',
			defaultScope: 'openid',
			syncMode: 'IMPORT'
		}
	});

	// Each customer is an organization, and its domain says which provider its people go to. In
	// 26.8.1 that is on the domain: the older settings on the provider are accepted and not kept.
	for (const customer of CUSTOMERS) {
		const location = await admin.created('POST', `/realms/${COMPANIES_REALM}/organizations`, {
			name: NAME_OF[customer],
			alias: customer,
			enabled: true,
			domains: [{ name: DOMAIN_OF[customer] }]
		});
		const id = location.split('/').pop();
		await admin.call(
			'POST',
			`/realms/${COMPANIES_REALM}/organizations/${id}/identity-providers`,
			customer
		);
		const organization = await admin.call<object>(
			'GET',
			`/realms/${COMPANIES_REALM}/organizations/${id}`
		);
		await admin.call('PUT', `/realms/${COMPANIES_REALM}/organizations/${id}`, {
			...organization,
			domains: [{ name: DOMAIN_OF[customer], identityProviderAlias: customer, autoRedirect: true }]
		});
	}
}

/** Removes the accounts a first login made, so every run starts from one. */
export async function forgetCustomersPeople(admin: Admin) {
	const users = await admin.call<{ id: string }[]>('GET', `/realms/${COMPANIES_REALM}/users`);
	for (const user of users) {
		await admin.call('DELETE', `/realms/${COMPANIES_REALM}/users/${user.id}`);
	}
}

const QUESTION_CLIENT = 'company-question';
const cookiesOf = (response: Response) =>
	response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(';')[0])
		.join('; ');

/**
 * Where typing an email on the first page sends someone: straight to a provider, or to a page with a
 * password and the buttons it offers. Without a browser, because the page is a form like any other.
 */
async function whereAnEmailGoes(email: string, password?: string) {
	const query = new URLSearchParams({
		response_type: 'code',
		client_id: QUESTION_CLIENT,
		redirect_uri: REDIRECT_URI,
		scope: 'organization'
	});
	const first = await fetch(
		`${KEYCLOAK}/realms/${COMPANIES_REALM}/protocol/openid-connect/auth?${query}`,
		{ redirect: 'manual' }
	);
	let cookie = cookiesOf(first);
	const post = async (html: string, fields: Record<string, string>) => {
		const action = html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
		if (!action) throw new Error(`No form: ${html.slice(0, 200)}`);
		const answer = await fetch(action, {
			method: 'POST',
			redirect: 'manual',
			headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		});
		cookie = [cookie, cookiesOf(answer)].filter(Boolean).join('; ');
		return answer;
	};
	const asked = await post(await first.text(), { username: email });
	const location = asked.headers.get('location') ?? '';
	const goesTo = location.match(/\/broker\/([\w-]+)\/login/)?.[1] ?? null;
	if (goesTo) return { goesTo, buttons: [], asksForPassword: false, organization: undefined };
	const page = await asked.text();
	const buttons = [...page.matchAll(/id="social-([\w-]+)"/g)].map((match) => match[1]).sort();
	const asksForPassword = /name="password"/.test(page);
	if (!password || !asksForPassword) {
		return { goesTo, buttons, asksForPassword, organization: undefined };
	}
	const signedIn = await post(page, { username: email, password });
	const code = new URL(signedIn.headers.get('location') ?? '', KEYCLOAK).searchParams.get('code');
	const tokens = (await (
		await fetch(`${KEYCLOAK}/realms/${COMPANIES_REALM}/protocol/openid-connect/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: QUESTION_CLIENT,
				code: code ?? '',
				redirect_uri: REDIRECT_URI
			})
		})
	).json()) as { access_token?: string };
	const claims = tokens.access_token
		? JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString())
		: {};
	return {
		goesTo,
		buttons,
		asksForPassword,
		loggedIn: Boolean(code),
		organization: claims.organization
	};
}

/** What decides where someone goes, asked of the real server, so the weekly run checks it. */
export async function questionsWithCompanies(admin: Admin) {
	const realm = `/realms/${COMPANIES_REALM}`;
	await forgetCustomersPeople(admin);
	await admin.call('POST', `${realm}/clients`, {
		...client(QUESTION_CLIENT, { publicClient: true })
	});
	const [acme] = await admin.call<{ id: string }[]>(
		'GET',
		`${realm}/organizations?search=${NAME_OF.acme}&exact=true`
	);
	const setDomain = async (name: string, autoRedirect: boolean) => {
		const organization = await admin.call<object>('GET', `${realm}/organizations/${acme.id}`);
		await admin.call('PUT', `${realm}/organizations/${acme.id}`, {
			...organization,
			domains: [{ name, identityProviderAlias: SAML_CUSTOMER, autoRedirect }]
		});
	};
	const ann = PERSON_AT.acme.email;
	const atASubdomain = 'dan@eu.acme.test';
	// Someone at Acme's domain with an account and a password of their own here.
	const ownPassword = 'bob@acme.test';
	const bob = await admin.created('POST', `${realm}/users`, {
		username: ownPassword,
		email: ownPassword,
		firstName: 'Bob',
		lastName: 'Acme',
		enabled: true,
		emailVerified: true,
		credentials: [{ type: 'password', value: PASSWORD, temporary: false }]
	});
	try {
		await setDomain(DOMAIN_OF.acme, false);
		const before = await whereAnEmailGoes(ann);
		await setDomain(DOMAIN_OF.acme, true);
		const after = await whereAnEmailGoes(ann);
		const exactAtASubdomain = await whereAnEmailGoes(atASubdomain);
		await setDomain(`*.${DOMAIN_OF.acme}`, true);
		const patternAtASubdomain = await whereAnEmailGoes(atASubdomain);
		const patternAtTheDomain = await whereAnEmailGoes(ann);
		await setDomain(DOMAIN_OF.acme, true);
		const withAPasswordHere = await whereAnEmailGoes(ownPassword, PASSWORD);
		return {
			autoRedirect: { before, after },
			companyDomains: {
				exact: { atASubdomain: exactAtASubdomain },
				pattern: { atASubdomain: patternAtASubdomain, atTheDomain: patternAtTheDomain }
			},
			passwordHere: withAPasswordHere
		};
	} finally {
		await setDomain(DOMAIN_OF.acme, true);
		await admin.call('DELETE', `${realm}/users/${bob.split('/').pop()}`);
		const [question] = await admin.call<{ id: string }[]>(
			'GET',
			`${realm}/clients?clientId=${QUESTION_CLIENT}`
		);
		await admin.call('DELETE', `${realm}/clients/${question.id}`);
	}
}

/** Turns someone at a customer off, or on again, as their company's admins would when they leave. */
export async function turnOff(admin: Admin, customer: Customer, off = true) {
	const { email } = PERSON_AT[customer];
	const [person] = await admin.call<{ id: string }[]>(
		'GET',
		`/realms/${customer}/users?email=${encodeURIComponent(email)}&exact=true`
	);
	const user = await admin.call<object>('GET', `/realms/${customer}/users/${person.id}`);
	await admin.call('PUT', `/realms/${customer}/users/${person.id}`, { ...user, enabled: !off });
}

const LEAVING_CLIENT = 'leaving-question';

/**
 * What a real server does once someone has left, for a browser that has no session here. In a real
 * browser, because their company's pages are forms that send themselves.
 */
export async function questionsWhenSomeoneLeaves(browser: Browser, admin: Admin) {
	const realm = `/realms/${COMPANIES_REALM}`;
	await admin.call('POST', `${realm}/clients`, client(LEAVING_CLIENT, { publicClient: true }));
	await forgetCustomersPeople(admin);
	const logIn = async (customer: Customer) => {
		const { email } = PERSON_AT[customer];
		const context = await browser.newContext();
		const page = await context.newPage();
		const query = new URLSearchParams({
			response_type: 'code',
			client_id: LEAVING_CLIENT,
			redirect_uri: REDIRECT_URI
		});
		await page.goto(`${KEYCLOAK}${realm}/protocol/openid-connect/auth?${query}`);
		await page.fill('#username', email);
		await page.click('#kc-login');
		await page.locator('#password').waitFor({ timeout: 15_000 });
		// Their company's page may not know the email: with SAML, nothing passed it on.
		await page.fill('#username', email);
		await page.fill('#password', PASSWORD);
		await page.click('#kc-login');
		await page
			.getByRole('heading', { name: 'Done' })
			.or(page.getByText(/disabled|invalid/i))
			.first()
			.waitFor({ timeout: 20_000 });
		const at = new URL(page.url());
		const body = await page.locator('body').innerText();
		await context.close();
		const loggedIn = at.href.startsWith(REDIRECT_URI);
		return {
			loggedIn,
			atTheirCompany: at.pathname.startsWith(`/realms/${customer}/`),
			says: loggedIn
				? null
				: (body
						.split(/\n+/)
						.find((line) => /disabled|invalid/i.test(line))
						?.trim() ?? null)
		};
	};
	// The same for a customer on SAML and one on OpenID Connect, so the screen can say it of either.
	const ask = async (customer: Customer) => {
		const before = await logIn(customer);
		await turnOff(admin, customer);
		const withNoSession = await logIn(customer);
		const [kept] = await admin.call<{ enabled: boolean }[]>(
			'GET',
			`${realm}/users?email=${encodeURIComponent(PERSON_AT[customer].email)}&exact=true`
		);
		return {
			before: { loggedIn: before.loggedIn },
			withNoSession,
			keptHere: { enabled: kept?.enabled ?? null }
		};
	};
	try {
		const acme = await ask(SAML_CUSTOMER);
		const globex = await ask(OIDC_CUSTOMER);
		const lengths = await admin.call<{
			ssoSessionIdleTimeout: number;
			ssoSessionMaxLifespan: number;
		}>('GET', realm);
		return {
			whenSomeoneLeaves: {
				acme,
				globex,
				session: {
					idleMinutes: lengths.ssoSessionIdleTimeout / 60,
					maxHours: lengths.ssoSessionMaxLifespan / 3600
				}
			}
		};
	} finally {
		for (const customer of CUSTOMERS) await turnOff(admin, customer, false);
		const [question] = await admin.call<{ id: string }[]>(
			'GET',
			`${realm}/clients?clientId=${LEAVING_CLIENT}`
		);
		await admin.call('DELETE', `${realm}/clients/${question.id}`);
	}
}
