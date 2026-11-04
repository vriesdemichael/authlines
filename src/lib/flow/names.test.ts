import { describe, expect, it } from 'vitest';
import { flows } from '#lib/flow/index.ts';
import { evaluate } from '#lib/flow/model.ts';
import {
	namesHash,
	parseNames,
	partiesOf,
	recordedAs,
	seamOf,
	withNames
} from '#lib/flow/names.ts';
import { defaultSettings } from '#lib/flow/settings.ts';
import { kindIn, nameIn, roleIn } from '#lib/flow/wording.ts';
import type { Recording } from '#lib/recordings/format.ts';
import oauth from '../../../static/recordings/authorization-code/oauth.json';

const code = flows['authorization-code'];
const view = () => evaluate(code.diagrams.flow, defaultSettings);

// #168: an agent names the parties of someone's own setup, and the site draws its recorded flow.
describe('names in a link', () => {
	it('reads the names after #, for parties the flow has', () => {
		expect(parseNames('#v=1&app=Payroll&idp=Entra+ID&api=HR%20API', code)).toEqual({
			names: { app: 'Payroll', idp: 'Entra ID', api: 'HR API' },
			problems: []
		});
		expect(parseNames('', code)).toEqual({ names: {}, problems: [] });
		expect(parseNames('#', code)).toEqual({ names: {}, problems: [] });
	});

	it('reads nothing without the version, and says so', () => {
		expect(parseNames('#app=Payroll', code)).toEqual({
			names: {},
			problems: ['The names have no version. They start with v=1.']
		});
		expect(parseNames('#v=2&app=Payroll', code).names).toEqual({});
	});

	it('draws no party the link made up, and says which there are', () => {
		const { names, problems } = parseNames('#v=1&app=Payroll&gateway=Kong', code);
		expect(names).toEqual({ app: 'Payroll' });
		expect(problems).toEqual([
			`This flow has no party called gateway. It has ${partiesOf(code).join(', ')}.`
		]);
	});

	it('takes a party drawn on the other diagram, or with other settings, without a word', () => {
		expect(parseNames('#v=1&idp-admin=Platform+team&upstream=Google', code).problems).toEqual([]);
	});

	// Anyone can write a link, and it makes the site show their words at its address.
	it('takes only plain text, short, with nothing hidden and nothing to follow', () => {
		const refused = (name: string) => parseNames(`#v=1&app=${encodeURIComponent(name)}`, code);
		for (const [name, why] of [
			['<script>alert(1)</script>', 'has < or >'],
			['<a href=x>Log in</a>', 'has < or >'],
			['https://evil.example', 'looks like an address'],
			['www.evil.example', 'looks like an address'],
			['eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0', 'looks like a token'],
			['Pay\u202eroll', 'do not show'],
			['Pay\u0000roll', 'do not show'],
			['x'.repeat(33), 'longer than 32'],
			['   ', 'is empty']
		]) {
			const { names, problems } = refused(name);
			expect(names, name).toEqual({});
			expect(problems.join(' '), name).toContain(why);
		}
		expect(refused('Payroll (old one) & co').names).toEqual({ app: 'Payroll (old one) & co' });
	});

	it('uses the first of two names for one party', () => {
		const { names, problems } = parseNames('#v=1&app=One&app=Two', code);
		expect(names).toEqual({ app: 'One' });
		expect(problems).toEqual(['app is named twice, so the first is used.']);
	});

	it('writes a link that reads back the same', () => {
		const names = { app: 'Payroll', idp: 'Entra ID' };
		expect(parseNames(namesHash(names), code).names).toEqual(names);
		expect(namesHash({})).toBe('');
	});
});

describe('a named party on the diagram', () => {
	it('has the name from the link in every wording, with what it is under it', () => {
		const app = withNames(view(), { app: 'Payroll' }).lifelines.find((l) => l.id === 'app')!;
		for (const wording of ['plain', 'specs', 'keycloak'] as const) {
			expect(nameIn(app, wording)).toBe('Payroll');
			expect(roleIn(app, wording)).toBe(kindIn(app, wording));
		}
		expect(roleIn(app, 'plain')).toBe('App');
	});

	it('changes nothing but the names, and nothing at all with none', () => {
		const plain = view();
		expect(withNames(plain, {})).toBe(plain);
		const named = withNames(plain, { app: 'Payroll' });
		expect(named.steps).toBe(plain.steps);
		expect(named.lifelines.map((l) => l.id)).toEqual(plain.lifelines.map((l) => l.id));
		expect(named.lifelines.filter((l) => l.given).map((l) => l.id)).toEqual(['app']);
	});
});

// The recording keeps the site's own names, so the raw view says which value is whose.
describe('the recording, beside the names', () => {
	const recording = oauth as unknown as Recording;

	it('finds what each named party is in the traffic', () => {
		expect(recordedAs(recording, 'app')).toBe('demo-app');
		expect(recordedAs(recording, 'idp')).toBe('demo');
		expect(recordedAs(recording, 'api')).toBe('localhost:9101');
		expect(recordedAs(recording, 'browser')).toBeUndefined();
	});

	it('says the traffic is the site’s own, and which value is which name', () => {
		const named = withNames(view(), { app: 'Payroll', idp: 'Entra ID', browser: 'Edge' });
		expect(seamOf(recording, named, true)).toBe(
			"Recorded on the site's own Keycloak. The names from the link are on the diagram only: here Payroll is demo-app and Entra ID is the Keycloak realm demo."
		);
		expect(seamOf(recording, named, false)).toBe(
			"Recorded on the site's own server. The names from the link are on the diagram only: here Payroll is demo-app and Entra ID is demo."
		);
		expect(seamOf(recording, withNames(view(), { browser: 'Edge' }), true)).toBe(
			"Recorded on the site's own Keycloak. The names from the link are on the diagram only."
		);
	});
});
