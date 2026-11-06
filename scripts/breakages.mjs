// What scripts/break-on-purpose.mjs tries. Only what the unit tests can see, because each one runs them
// again and the click-through takes minutes. See the end of ADR-006.
const AC = 'src/lib/flow/authorization-code.ts';
const NOTES = 'src/lib/keycloak/notes.ts';
const SHAPE = 'src/lib/recordings/shape.ts';
const CHECK = 'src/lib/recordings/check.ts';
const NODES = 'src/lib/map/nodes.ts';
const LAYOUT = 'src/lib/diagram/layout.ts';
const STATE = 'src/lib/flow/state.ts';
const MODEL = 'src/lib/flow/model.ts';
const MOTION = 'src/lib/diagram/motion.ts';

const WORDING = 'src/lib/flow/wording.ts';
const ADDRESS = 'src/lib/recordings/address.ts';
const NO_USER = 'src/lib/flow/client-credentials.ts';
const LEFT = 'src/lib/flow/left-to-you.ts';
const ERRORS = 'src/lib/search/errors.ts';

export const breakages = [
	{
		name: 'stolen token: the Bearer-only API checks the binding after all',
		file: 'scripts/record/checks.ts',
		from: "if (trust.knowsOnlyBearer) return scheme === 'Bearer' ? null : 'not a Bearer token';",
		to: "if (trust.knowsOnlyBearer && !jwt.claims.cnf) return scheme === 'Bearer' ? null : 'not a Bearer token';"
	},
	{
		name: 'stolen token: the answers are the wrong way round',
		file: AC,
		from: "label: [{ when: bearerOnly, text: '200 with the resource' }, { text: '401 invalid_token' }],",
		to: "label: [{ when: bearerOnly, text: '401 invalid_token' }, { text: '200 with the resource' }],"
	},
	{
		name: 'leaving: the pitfall gives the wrong session length',
		file: AC,
		from: 'ends a session after 30 minutes unused, or 10 hours in all,',
		to: 'ends a session after 5 minutes unused, or 1 hours in all,'
	},
	{
		name: 'leaving: the session is not drawn on the second login',
		file: AC,
		from: "\t\t\t\t\tartifact: 'session',\n\t\t\t\t\tnote: 'The session from before, which is why nobody is asked'",
		to: "\t\t\t\t\tnote: 'The session from before, which is why nobody is asked'"
	},
	{
		name: 'companies: SAML trades a code out of sight after all',
		file: AC,
		from: "on a connection the browser never sees.',\n\t\t\twhen: all(broker, not(saml)),",
		to: "on a connection the browser never sees.',\n\t\t\twhen: broker,"
	},
	{
		name: 'companies: the assertion does not go through the browser',
		file: AC,
		from: "\t\t\t\t\tartifact: 'assertion',\n\t\t\t\t\tnote: 'In a response their provider signed. It was not encrypted, so whoever has it can read it',",
		to: "\t\t\t\t\tnote: 'In a response their provider signed. It was not encrypted, so whoever has it can read it',"
	},
	{
		name: 'companies: Auto redirect is said to do the opposite',
		file: NOTES,
		from: "before: { goesTo: null, buttons: ['acme'], asksForPassword: true },",
		to: "before: { goesTo: 'acme' },"
	},
	{
		name: 'behind the page: the tokens reach the browser',
		file: 'src/lib/flow/authorization-code.ts',
		from: "name: 'Set-Cookie',\n\t\t\t\t\tplace: 'header',\n\t\t\t\t\tartifact: 'app-session',",
		to: "name: 'Set-Cookie',\n\t\t\t\t\tplace: 'header',\n\t\t\t\t\tartifact: 'access-token',"
	},
	{
		name: 'directory: another provider stays on beside it',
		file: 'src/lib/flow/settings.ts',
		from: 'setsWhenOn: { broker: false },',
		to: ''
	},
	{
		name: 'directory: the password does not reach it',
		file: 'src/lib/flow/authorization-code.ts',
		from: "{ name: 'password', place: 'body', artifact: 'password' }\n\t\t\t]\n\t\t},\n\t\t{\n\t\t\tid: 'directory-bound',",
		to: "{ name: 'password', place: 'body' }\n\t\t\t]\n\t\t},\n\t\t{\n\t\t\tid: 'directory-bound',"
	},
	{
		name: 'directory: says something else when the directory is down',
		file: 'src/lib/flow/authorization-code.ts',
		from: 'Unexpected error when handling authentication request to identity provider.',
		to: 'The directory is down.'
	},
	{
		name: 'cimd: the login says the address was registered in setup',
		file: 'src/lib/flow/authorization-code.ts',
		from: "note: 'Must match what the document says',",
		to: "note: 'Must match what was registered in setup',"
	},
	// What a claims audit found in words written the same day.
	{
		name: 'old way: the app says it never sees the password it was just given',
		file: 'src/lib/flow/old-way.ts',
		from: 'app: "The application the user wants to use. Here it is given the user\'s password.",',
		to: 'app: "The application the user wants to use. It never sees the user\'s password.",'
	},
	// What a sceptical reader found.
	{
		name: 'device: the code, which reads as the other flow’s',
		file: 'src/lib/flow/device.ts',
		from: 'this one asks for the user code first.',
		to: 'this one asks for the code first.'
	},
	{
		name: 'device: the app’s part of the list goes before anything runs',
		file: 'src/lib/flow/left-to-you.ts',
		from: "if (diagram === 'setup' && step.kind === 'human') return 'before';",
		to: "if (step.kind === 'human') return 'before';"
	},
	{
		name: 'device: the browser has the password from the start',
		file: 'src/lib/flow/device.ts',
		from: 'front: true,\n\t\t\tconcept:',
		to: "front: true,\n\t\t\tstartsWith: [{ artifact: 'password' }],\n\t\t\tconcept:"
	},
	{
		name: 'device: the two codes are not followed through the run',
		file: 'src/lib/recordings/wire.ts',
		from: "\t'device_code',\n",
		to: ''
	},
	{
		name: 'device: an error goes to the step alone, and not the question that says it',
		file: 'src/lib/search/search.ts',
		from: 'view: about?.id,',
		to: 'view: undefined,'
	},
	{
		name: 'search: two results from two flows are taken for one',
		file: 'src/lib/search/result-key.ts',
		from: '`${flow}:${kind}:${title}:${query}`;',
		to: '`${kind}:${title}:${query}`;'
	},
	{
		name: 'expert: state on a logout is explained as if it were a login',
		file: AC,
		from: "concept: 'As far as the user can tell, that is the end of it.',\n\t\t\tfields: [\n\t\t\t\t{\n\t\t\t\t\tname: 'state',\n\t\t\t\t\tplace: 'query',\n\t\t\t\t\tnote: 'The app’s own value, which comes back with the user so it can pick up where it left off'\n\t\t\t\t}\n\t\t\t]",
		to: "concept: 'As far as the user can tell, that is the end of it.',\n\t\t\tfields: [{ name: 'state', place: 'query' }]"
	},
	{
		name: 'library: Auth.js is said to check a nonce it does not',
		file: AC,
		from: "example('authjs', false, 'keeps and checks a nonce only once you add it to its checks'),",
		to: "example('authjs', true, 'keeps the nonce and checks it'),"
	},
	{
		name: 'words: asking for more detail changes the names',
		file: 'src/lib/flow/wording.ts',
		from: "export const DEFAULT_WORDING: Wording = 'plain';",
		to: "export const DEFAULT_WORDING: Wording = 'specs';"
	},
	{
		name: 'search: a short word is found inside another',
		file: 'src/lib/search/search.ts',
		from: 'if (word.length > 3) return text.includes(word);',
		to: 'if (word.length > 0) return text.includes(word);'
	},
	{
		name: 'search: it does not say this is only the closest',
		file: 'src/lib/search/search.ts',
		from: 'closest: closest.length > 0',
		to: 'closest: false'
	},
	{
		name: 'search: errors go ahead of a word’s own entry',
		file: 'src/lib/search/search.ts',
		from: '...itself.map(({ entry }) => entry.result),',
		to: ''
	},
	{
		name: 'map: an everyday error opens in advanced mode again',
		file: 'src/lib/map/tracks.ts',
		from: "title: 'Why did my API say 401?',",
		to: "title: 'Why did my API say 401?',\n\t\t\t\t\tmode: 'advanced',"
	},
	{
		name: 'device: the browser gets the tokens of someone who sent the user a code',
		file: 'src/lib/flow/device.ts',
		from: "id: 'sent-token-response',\n\t\t\twhen: all(sendsCode, agrees),",
		to: "id: 'sent-token-response',\n\t\t\twhen: sendsCode,"
	},
	{
		name: 'device: someone who read the code can be said no to',
		file: 'src/lib/flow/settings.ts',
		from: "when: is('deviceEnds', 'agrees'),\n\t\t\t\t\tbecause: 'They are the one",
		to: "when: is('deviceEnds', 'says-no'),\n\t\t\t\t\tbecause: 'They are the one"
	},
	{
		name: 'model: an app in the page stays a lifeline of its own',
		file: MODEL,
		from: 'joins && holds(joins.when, settings) ?',
		to: 'joins && false ?'
	},
	{
		name: 'settings: saying where an app runs brings nothing with it',
		file: 'src/lib/flow/settings.ts',
		from: "label: 'In the page',\n\t\t\t\tsets: { clientType: 'public', pkce: true },",
		to: "label: 'In the page',"
	},
	{
		name: 'search: a result opens on the first preset that shows its step, whatever else it brings',
		file: 'src/lib/search/search.ts',
		from: '(best, settings) => (best && changed(best) <= changed(settings) ? best : settings),',
		to: '(best, settings) => best ?? settings,'
	},
	{
		name: 'agents: two values a third makes go together are said to be ruled out',
		file: 'src/lib/agents.ts',
		from: 'const never = not.filter((other) => !withMore(value, other, combinations).length);',
		to: 'const never = not;'
	},
	{
		name: 'upstream: says the server recorded sent a challenge to the other provider',
		file: AC,
		from: 'a challenge here would be the identity provider’s own setting, and the server recorded sent none.',
		to: 'a challenge here is the identity provider’s own setting, and the server recorded sent one.'
	},
	{
		name: 'question: a closed explanation opens again on the question’s own address',
		file: STATE,
		from: "if (nodeExplains && !state.explained) params.set('explain', NOTHING_EXPLAINED);",
		to: ''
	},
	{
		name: 'wire: a link to the traffic decoded opens it as sent',
		file: STATE,
		from: "decoded: params.get(DECODED_PARAM) === '1'",
		to: "decoded: params.get(DECODED_PARAM) === 'yes'"
	},
	{
		name: 'program: a program is drawn answered at the app’s own address',
		file: AC,
		from: "note: '127.0.0.1 at the port it is listening on, which need not be registered',\n\t\t\t\t\twhen: inAProgram",
		to: "note: '127.0.0.1 at the port it is listening on, which need not be registered',\n\t\t\t\t\twhen: is('appRuns', 'nowhere')"
	},
	{
		name: 'model: a flow goes on after the server stopped it',
		file: MODEL,
		from: 'const stopsAt = here.findIndex((step) => step.last);',
		to: 'const stopsAt = -1;'
	},
	{
		name: 'device: says the user said no with a different error than the server gave',
		file: 'src/lib/flow/device.ts',
		from: "label: '400 access_denied',\n\t\t\tconcept:\n\t\t\t\t'This is how the app finds out",
		to: "label: '400 expired_token',\n\t\t\tconcept:\n\t\t\t\t'This is how the app finds out"
	},
	{
		name: 'device: tokens still come after the user said no',
		file: 'src/lib/flow/device.ts',
		from: "id: 'device-token-response',\n\t\t\twhen: all(agrees, theRealApp),",
		to: "id: 'device-token-response',\n\t\t\twhen: all(someoneComes, theRealApp),"
	},
	{
		name: 'device: how it ends goes on the flows it does not belong to',
		file: 'src/lib/flow/settings.ts',
		from: "default: 'agrees',\n\t\tonlyOn: 'device',",
		to: "default: 'agrees',"
	},
	{
		name: 'device: the browser is given the code that gets the tokens',
		file: 'src/lib/flow/device.ts',
		from: "name: 'user_code',\n\t\t\t\t\tplace: 'memory',\n\t\t\t\t\tartifact: 'user-code',",
		to: "name: 'user_code',\n\t\t\t\t\tplace: 'memory',\n\t\t\t\t\tartifact: 'device-code',"
	},
	{
		name: 'device: says a different answer than the server gave',
		file: 'src/lib/flow/device.ts',
		from: "label: '400 authorization_pending',\n\t\t\tconcept:\n\t\t\t\t'On the wire",
		to: "label: '400 slow_down',\n\t\t\tconcept:\n\t\t\t\t'On the wire"
	},
	{
		name: 'device: the app and the browser are drawn as talking',
		file: 'src/lib/flow/device.ts',
		from: "from: 'app',\n\t\t\tto: 'browser',\n\t\t\tkind: 'human',",
		to: "from: 'app',\n\t\t\tto: 'browser',\n\t\t\tkind: 'request',"
	},
	{
		name: 'device: an error nobody said',
		file: 'src/lib/search/errors.ts',
		from: "text: 'slow_down',",
		to: "text: 'slowdown',"
	},
	{
		name: 'device: a note says what the server did not',
		file: NOTES,
		from: 'byDefault: { expiresIn: 600, interval: 5 },',
		to: 'byDefault: { expiresIn: 300, interval: 5 },'
	},
	{
		name: 'device: a setting vanishes without saying why',
		file: 'src/lib/flow/index.ts',
		from: "consent:\n\t\t\t'It asks here anyway.",
		to: "consenting:\n\t\t\t'It asks here anyway."
	},
	{
		name: 'device: the address after a redirect is lost',
		file: 'src/lib/recordings/address.ts',
		from: 'const own = message.url ?? message.headers.location;',
		to: 'const own = message.url;'
	},
	{
		name: 'device: a token with a nonce nobody sent is taken',
		file: 'scripts/record/checks.ts',
		from: "if ((jwt.claims.nonce ?? null) !== expected.nonce) return 'from another login';",
		to: "if (expected.nonce && jwt.claims.nonce !== expected.nonce) return 'from another login';"
	},
	{
		name: 'device: the check needs a nonce that never comes',
		file: 'scripts/record/checks.ts',
		from: "if ((jwt.claims.nonce ?? null) !== expected.nonce) return 'from another login';",
		to: "if (jwt.claims.nonce !== expected.nonce) return 'from another login';"
	},
	{
		name: 'expert: a date from another recording',
		file: 'src/lib/recordings/known.ts',
		from: 'return (preset && recordedIndex.recordedOn?.[preset.id]) ?? recordedIndex.recordedAt;',
		to: 'return recordedIndex.recordedAt;'
	},
	{
		name: 'expert: what the refusal is about is not on the arrow',
		file: LAYOUT,
		from: '.map((field) => (field.chip ? { name: field.chip, mark: true } : field));',
		to: ';'
	},
	{
		name: 'expert: their verifier passes for the real one',
		file: AC,
		from: "chip: 'their verifier',",
		to: "artifact: 'verifier',"
	},
	// A stolen code handed to the real app.
	{
		name: 'injection: says it works with PKCE on',
		file: AC,
		from: "{ when: pkce, text: 'Refused: the verifier does not match' },",
		to: "{ when: pkce, text: 'Tokens for the real user' },"
	},
	{
		name: 'injection: says the server refuses it with no PKCE',
		file: AC,
		from: "label: [{ when: pkce, text: '400 invalid_grant' }, { text: '200 with tokens' }],",
		to: "label: '400 invalid_grant',"
	},
	{
		name: 'injection: the real user goes on as if nothing happened',
		file: AC,
		from: 'const codeGone = any(codeTaken, handedToTheApp, byLink);',
		to: 'const codeGone = any(codeTaken, byLink);'
	},
	{
		name: 'injection: offered where there is no secret to get around',
		file: 'src/lib/flow/settings.ts',
		from: "is('clientType', 'confidential'), is('attackerGets', 'copy')",
		to: "is('attackerGets', 'copy')"
	},
	{
		name: 'injection: has no nonce check',
		file: AC,
		from: 'const stoppedByNonce = all(handedToTheApp, oidc, not(pkce));',
		to: 'const stoppedByNonce = all(handedToTheApp, oidc, pkce);'
	},
	// In front of a room.
	{
		name: 'whole: a row is left off the screen',
		file: LAYOUT,
		from: 'return clamp(Math.floor(shared * 10) / 10, SMALLEST_WHOLE_ROW, LARGEST_WHOLE_ROW);',
		to: 'return LARGEST_WHOLE_ROW;'
	},
	{
		name: 'whole: a number runs into the row under it',
		file: LAYOUT,
		from: 'const numberRadius = whole ? Math.min(WHOLE_NUMBER_RADIUS, rowHeight / 2) : NUMBER_RADIUS;',
		to: 'const numberRadius = NUMBER_RADIUS;'
	},
	{
		name: 'whole: words run out past their arrow',
		file: LAYOUT,
		from: 'const text = label.length > most ? ',
		to: 'const text = label.length > Infinity ? '
	},
	{
		name: 'whole: does not stay in the address',
		file: STATE,
		from: "if (state.whole) params.set(WHOLE_PARAM, '1');",
		to: ''
	},
	{
		name: 'whole: raw traffic does not stay in the address',
		file: STATE,
		from: "if (state.raw) params.set(RAW_PARAM, '1');",
		to: ''
	},
	// What a security reader looks for.
	{
		name: 'threats: a threat that is not here is not said to be',
		file: ERRORS,
		from: "	'malicious app',\n",
		to: ''
	},
	{
		name: 'threats: a flow that is here is said not to be',
		file: ERRORS,
		from: "	'malicious app',",
		to: "	'malicious app',\n	'client credentials',\n	'device flow',"
	},
	// All that is left to someone, in one list.
	{
		name: 'list: a step goes under the wrong job',
		file: LEFT,
		from: "return step.from === 'api' ? 'api' : 'app';",
		to: "return 'app';"
	},
	{
		name: 'list: people are put with the code',
		file: LEFT,
		from: "if (diagram === 'setup' && step.kind === 'human') return 'before';",
		to: ''
	},
	{
		name: 'list: leaves out what can go wrong',
		file: LEFT,
		from: 'groups.wrong.push({ ...item, title: step.pitfall.title, text: step.pitfall.text });',
		to: ''
	},
	{
		name: 'list: says the largest part twice',
		file: LEFT,
		from: "step.inPractice?.replace(step.largerJob ?? '', '').trim()",
		to: 'step.inPractice'
	},
	{
		name: 'list: ignores the words chosen',
		file: LEFT,
		from: 'const view = speak(evaluate(base.diagrams[diagram], settings), say);',
		to: 'const view = evaluate(base.diagrams[diagram], settings);'
	},
	{
		name: 'list: does not stay in the address',
		file: STATE,
		from: "if (state.list) params.set(LIST_PARAM, '1');",
		to: ''
	},
	{
		name: 'list: the largest part is not on the step any more',
		file: MODEL,
		from: '[step.inPractice && resolveText(step.inPractice, settings), step.largerJob]',
		to: '[step.inPractice && resolveText(step.inPractice, settings)]'
	},
	// What a step cites.
	{
		name: 'cite: a claim loses its source',
		file: AC,
		from: "			id: 'redirect-with-code',\n			cites: [",
		to: "			id: 'redirect-with-code',\n			cited: ["
	},
	{
		name: 'cite: a step cites the wrong section',
		file: AC,
		from: "section: '2.1.2',",
		to: "section: '2.2.2',"
	},
	{
		name: 'cite: a citation shows with settings it is not about',
		file: MODEL,
		from: 'cites: (step.cites ?? []).filter((cite) => present(cite.when, settings)),',
		to: 'cites: step.cites ?? [],'
	},
	{
		name: 'cite: a source opened from a step does not survive a reload',
		file: STATE,
		from: "if (state.source.fromStep) params.set('for', FROM_A_STEP);\n\t\telse if",
		to: 'if'
	},
	{
		name: 'cite: the second section of a spec opens as the first',
		file: STATE,
		from: 'refs.find((ref) => ref.source === source && ref.section === section) ??\n\trefs.find((ref) => ref.source === source);',
		to: 'refs.find((ref) => ref.source === source);'
	},
	// A flow with no user.
	{
		name: 'no user: says there is a refresh token',
		file: NO_USER,
		from: "{ name: 'expires_in', place: 'body' },",
		to: "{ name: 'expires_in', place: 'body' },\n\t\t\t\t{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' },"
	},
	{
		name: 'no user: a browser gets on the diagram',
		file: NO_USER,
		from: "id: 'app',\n\t\t\tplainName: 'App',",
		to: "id: 'browser',\n\t\t\tplainName: 'App',"
	},
	{
		name: 'no user: a setting neither applies nor says why',
		file: 'src/lib/flow/index.ts',
		from: "pkce: 'There is no code to protect.',",
		to: ''
	},
	{
		name: 'no user: another flow keeps what does not apply there',
		file: STATE,
		from: 'const shared = to.settings.filter((id) => from.settings.includes(id));',
		to: 'const shared = from.settings;'
	},
	{
		name: 'no user: a step id means two things',
		file: NO_USER,
		from: "id: 'service-token-request',",
		to: "id: 'token-request',"
	},
	{
		name: 'no user: another flow starts where this one was',
		file: STATE,
		from: 'step: evaluate(flow, settings).steps[0].id,\n\t\tsource: null,\n\t\texplained: null,\n\t\teyes: null,',
		to: 'step: state.step,\n\t\tsource: null,\n\t\texplained: null,\n\t\teyes: null,'
	},
	// What a person sees in their browser.
	{
		name: 'page: the address is taken from another step',
		file: ADDRESS,
		from: 'recording.messages.findIndex((candidate) => candidate.step === step)',
		to: 'recording.messages.findIndex((candidate) => candidate.step !== step)'
	},
	{
		name: 'page: nothing in an address is marked',
		file: ADDRESS,
		from: 'marked: marks.includes(name),',
		to: 'marked: false,'
	},
	{
		name: 'page: a long value is shown whole',
		file: ADDRESS,
		from: 'whole.length > LONGEST_VALUE ?',
		to: 'whole.length > Infinity ?'
	},
	{
		name: 'page: a marked part goes missing for someone new',
		file: ADDRESS,
		from: 'all.filter((part) => part.marked)',
		to: 'all.filter((part) => !part.marked)'
	},
	{
		name: 'page: a step in the browser has no window',
		file: AC,
		from: "address: 'authorize',\n\t\t\t\t\tshows: \"The identity provider's own page, asking for a username and a password.\",\n\t\t\t\t\tshot: 'login',\n\t\t\t\t\tmarks: ['redirect_uri', 'state']",
		to: "address: 'open-app',\n\t\t\t\t\tshows: 'x',\n\t\t\t\t\tshot: 'login'"
	},
	{
		name: 'page: a page that stopped appearing goes unnoticed',
		file: 'src/lib/recordings/check.ts',
		from: '.filter((shot) => !seen.includes(shot))',
		to: '.filter(() => false)'
	},
	{
		name: 'page: what a page shows names one server',
		file: AC,
		from: 'shows: "The other provider\'s own login page. The app is nowhere on it.",',
		to: 'shows: "Keycloak\'s own login page. The app is nowhere on it.",'
	},
	// Whose words the diagram is in.
	{
		name: 'wording: a name in capitals loses its small form, mid sentence',
		file: WORDING,
		from: 'table.set(capital(from), capital(to));\n\t\t\t\t// After that, because a name that starts with a capital is just itself.\n\t\t\t\ttable.set(from, to);',
		to: 'table.set(from, to);\n\t\t\t\ttable.set(capital(from), capital(to));'
	},
	{
		name: 'wording: the app team becomes the client team',
		file: WORDING,
		from: "notBefore: ['team'],",
		to: ''
	},
	{
		name: 'wording: a person opens a client',
		file: WORDING,
		from: "	'opens the',\n",
		to: ''
	},
	{
		name: 'wording: API V2 becomes a resource server',
		file: WORDING,
		from: "notBefore: ['V1', 'V2'],",
		to: ''
	},
	{
		name: 'wording: an app becomes an client',
		file: WORDING,
		from: "'an app': 'a client'",
		to: "'an app': 'an client'"
	},
	{
		name: 'wording: a choice of words moves a row',
		file: LAYOUT,
		from: 'return (strip ? [wording] : wordings).map((other) => {',
		to: 'return (strip ? [wording] : [wording]).map((other) => {'
	},
	{
		name: 'wording: Keycloak’s words stay with the notes off',
		file: STATE,
		from: "wording: !serverNotes && state.wording === 'keycloak' ? null : state.wording",
		to: 'wording: state.wording'
	},
	{
		name: 'wording: a link asks for Keycloak’s words with the notes off',
		file: STATE,
		from: "return asked === 'keycloak' && params.get(SERVER_NOTES_PARAM) === 'off' ? null : asked;",
		to: 'return asked;'
	},
	{
		name: 'wording: a source about a name opens for any source',
		file: STATE,
		from: 'const offered = setting ? settingDefs[setting].sources : nameSources;',
		to: 'const offered = setting ? settingDefs[setting].sources : settingIds.flatMap((id) => settingDefs[id].sources);'
	},
	{
		name: 'wording: a flow says Keycloak',
		file: 'src/lib/flow/parties.ts',
		from: "name: 'Resource server',",
		to: "name: 'Keycloak resource server',"
	},
	{
		name: 'wording: a name changes without going away first',
		file: MOTION,
		from: 'words: sameName(a, b) ? lerp(a.words, 1, p) : wordsAt(t)',
		to: 'words: 1'
	},
	// The attacker, in the words simple mode uses.
	{
		name: 'attacker: says they get the tokens with PKCE on',
		file: AC,
		from: "{ when: stoppedByPkce, text: 'Refused: they have no verifier' },",
		to: "{ when: stoppedByPkce, text: 'They get the tokens' },"
	},
	{
		name: 'attacker: says they get the tokens against a secret',
		file: AC,
		from: "{ text: 'Refused: they have no secret' }",
		to: "{ text: 'They get the tokens' }"
	},
	{
		name: 'attacker: their request without the verifier reads as the real app',
		file: AC,
		from: "text: 'They send the code to the identity provider, as the real app would, but without the verifier, which they never saw.'",
		to: "text: 'They send the code to the identity provider, exactly as the real app would, and nothing marks this request.'"
	},
	{
		name: 'attacker: says the real app can be used against PKCE',
		file: AC,
		from: 'gets them nothing, because the verifier does not match, though on this server it uses up the code.',
		to: 'works, which is what PKCE stops.'
	},

	// Logging out.
	{
		name: 'logout: the session stays',
		file: AC,
		from: "ends: ['session'],",
		to: ''
	},
	{
		name: 'logout: the token is said to stop working everywhere',
		file: AC,
		from: "plain: 'It still works',\n\t\t\tlabel: '200 with the resource',\n\t\t\tconcept:\n\t\t\t\t'Its signature",
		to: "plain: 'It still works',\n\t\t\tlabel: '401 invalid_token',\n\t\t\tconcept:\n\t\t\t\t'Its signature"
	},
	{
		name: 'logout: the API that asks is said to take it',
		file: AC,
		from: "label: [{ when: keepsOffline, text: '200 with the resource' }, { text: '401 invalid_token' }],",
		to: "label: [{ when: keepsOffline, text: '200 with the resource' }, { text: '200 with the resource' }],"
	},
	{
		name: 'offline: the refresh after the logout is drawn as refused',
		file: AC,
		from: "label: [{ when: keepsOffline, text: '200 with new tokens' }, { text: '400 invalid_grant' }],",
		to: "label: [{ when: keepsOffline, text: '400 invalid_grant' }, { text: '400 invalid_grant' }],"
	},
	{
		name: 'offline: the app is drawn not asking for it',
		file: AC,
		from: "name: 'scope=offline_access',",
		to: "name: 'scope=offline',"
	},
	{
		name: 'logout: the note says the other app stays logged in',
		file: NOTES,
		from: 'otherAppNextLoginSawForm: true',
		to: 'otherAppNextLoginSawForm: false'
	},

	// A second app.
	{
		name: 'sso: the app is said to have the session',
		file: AC,
		from: "concept: 'With its own client ID and secret.',\n\t\t\tfields: [\n\t\t\t\t{ name: 'grant_type=authorization_code', place: 'body' },\n\t\t\t\t{ name: 'code', place: 'body', artifact: 'code' },\n\t\t\t\t{ name: 'redirect_uri', place: 'body' },\n\t\t\t\t{\n\t\t\t\t\tname: 'Authorization: Basic',\n\t\t\t\t\tplace: 'header',\n\t\t\t\t\tnote: 'The client ID and secret',\n\t\t\t\t\tartifact: 'secret'",
		to: "concept: 'With its own client ID and secret.',\n\t\t\tfields: [\n\t\t\t\t{ name: 'grant_type=authorization_code', place: 'body' },\n\t\t\t\t{ name: 'code', place: 'body', artifact: 'code' },\n\t\t\t\t{ name: 'redirect_uri', place: 'body' },\n\t\t\t\t{\n\t\t\t\t\tname: 'Authorization: Basic',\n\t\t\t\t\tplace: 'header',\n\t\t\t\t\tnote: 'The client ID and secret',\n\t\t\t\t\tartifact: 'session'"
	},
	{
		name: 'sso: the login comes back without being asked',
		file: AC,
		from: "id: 'second-submit-credentials',\n\t\t\twhen: secondInsists,",
		to: "id: 'second-submit-credentials',\n\t\t\twhen: secondApp,"
	},
	{
		name: 'sso: login_required is said to come with a code',
		file: AC,
		from: "{ when: secondIsFresh, text: '302 error=login_required' },",
		to: "{ when: secondIsFresh, text: '302 back with a code' },"
	},
	{
		name: 'sso: the cookie goes along with no session',
		file: AC,
		from: "note: 'Sent to the identity provider, and nowhere else',\n\t\t\t\t\tartifact: 'session',\n\t\t\t\t\twhen: secondGetsACode",
		to: "note: 'Sent to the identity provider, and nowhere else',\n\t\t\t\t\tartifact: 'session'"
	},

	// The calm look.
	{
		name: 'look: a label is let run past its arrow',
		file: LAYOUT,
		from: ': Math.abs(x2 - x1) - NUMBER_ROOM * 2;',
		to: ': 10000;'
	},
	{
		name: 'look: chips are drawn over the words',
		file: LAYOUT,
		from: 'let x = start + line.textWidth + (line.text && line.chips.length ? LABEL_TO_CHIP : 0);',
		to: 'let x = start;'
	},
	{
		name: 'look: a mode switch moves rows',
		file: LAYOUT,
		from: 'return Math.max(...counts);',
		to: 'return simple ? counts[0] : counts[1];'
	},
	{
		name: 'look: another hue creeps in',
		file: 'src/app.css',
		from: '--remembers: light-dark(#5a5f52, #c5c9b8);',
		to: '--remembers: light-dark(#5a5f52, #c5c9b8);\n\t--louder: light-dark(#ff0000, #ff0000);'
	},
	{
		name: 'look: what just changed gets a colour of its own again',
		file: 'src/app.css',
		from: '--fresh: light-dark(#141720, #eceef3);',
		to: '--fresh: light-dark(#be185d, #f688bd);'
	},
	{
		name: 'look: what is ahead loses its words again',
		file: 'src/lib/components/Diagram.svelte',
		from: '\t.row.future .number text {\n\t\tfill: var(--muted);\n\t}',
		to: '\t.row.future .number text {\n\t\tfill: var(--muted);\n\t}\n\n\t.row.future .label {\n\t\topacity: 0;\n\t}'
	},
	{
		name: 'phone: the words go over the lanes in the strip',
		file: 'src/lib/diagram/layout.ts',
		from: 'const besideTheStrip = margin + (view.lifelines.length - 1) * spacing + STRIP_LOOP_ROOM;',
		to: 'const besideTheStrip = margin + STRIP_LOOP_ROOM;'
	},
	{
		name: 'phone: a long field runs off the screen',
		file: 'src/lib/diagram/layout.ts',
		from: '\tif (field.artifact || chipWidth(field) <= room) return field;',
		to: '\treturn field;'
	},
	{
		name: 'phone: a row in the strip keeps a line for another mode',
		file: 'src/lib/diagram/layout.ts',
		from: 'const counts = (strip ? [simple] : [true, false]).flatMap((plain) => {',
		to: 'const counts = [true, false].flatMap((plain) => {'
	},

	// Names from a link (#168).
	{
		name: 'names: markup in a name is let through',
		file: 'src/lib/flow/names.ts',
		from: "\tif (MARKUP.test(name)) return 'has < or >, and a name is plain text';\n",
		to: ''
	},
	{
		name: 'names: a name a link gave goes nowhere',
		file: 'src/lib/flow/wording.ts',
		from: 'return line.given ?? kindIn(line, wording);',
		to: 'return kindIn(line, wording);'
	},

	// The request pushed first.
	{
		name: 'par: the browser still carries what was pushed',
		file: AC,
		from: "{ name: 'state', place: 'query', when: all(not(byLink), not(par)) },",
		to: "{ name: 'state', place: 'query', when: not(byLink) },"
	},
	{
		name: 'par: the browser is warned about an address it no longer sends',
		file: AC,
		from: "\t\t\t\twhen: not(par),\n\t\t\t\ttitle: 'What if the address does not match?',",
		to: "\t\t\t\ttitle: 'What if the address does not match?',"
	},

	// An API that trades the token.
	{
		name: 'exchange: the second API is sent the token the app sent',
		file: AC,
		from: "artifact: 'exchanged-token',\n\t\t\t\t\tnote: 'The exchanged token, and not the one the app sent'",
		to: "artifact: 'access-token',\n\t\t\t\t\tnote: 'The exchanged token, and not the one the app sent'"
	},
	{
		name: 'exchange: a note says the status RFC 8693 asks for, not the one the server sent',
		file: NOTES,
		from: 'A token that names only account gets a 403 with access_denied',
		to: 'A token that names only account gets a 400 with access_denied'
	},
	{
		name: 'exchange: the trade is said to end with something the server never said',
		file: AC,
		from: 'Session not active. The app cannot use it either',
		to: 'Session expired. The app cannot use it either'
	},
	{
		name: 'exchange: a trade that should give a refresh token does not ask for one',
		file: AC,
		from: "name: 'requested_token_type',",
		to: "name: 'requested_token_types',"
	},
	{
		name: 'stored tokens: an API not allowed the provider is said to be refused in other words',
		file: AC,
		from: 'Client not allowed to retrieve token for the provider. A token that did not name the API',
		to: 'Client not allowed to read tokens. A token that did not name the API'
	},
	{
		name: 'stored tokens: an API that was refused is said to answer the app anyway',
		file: AC,
		from: "{ when: apiReadRefused, text: '502 with an error' },",
		to: "{ when: apiReadRefused, text: '200 with the resource' },"
	},
	{
		name: 'link: the step to the other provider says a status the server did not send',
		file: AC,
		from: "label: '303 to the other provider',",
		to: "label: '302 to the other provider',"
	},
	{
		name: 'link: the user linking it is drawn as the user cancelling',
		file: AC,
		from: "const linked = all(links, not(is('linkEnds', 'cancelled')));",
		to: "const linked = all(links, is('linkEnds', 'cancelled'));"
	},

	// A refresh token.
	{
		name: 'refresh: the old one is said to be refused on a default server',
		file: AC,
		from: "{ when: reuseEnds, text: 'Refused: this one has been used' },\n\t\t\t\t{ text: 'It still works' }",
		to: "{ text: 'Refused: this one has been used' }"
	},
	{
		name: 'refresh: the chip on the response is left out',
		file: AC,
		from: "{ name: 'refresh_token', place: 'body', artifact: 'refresh-token' },\n\t\t\t\t{ name: 'scope', place: 'body' }\n\t\t\t]\n\t\t},\n\t\t{\n\t\t\tid: 'api-request-new'",
		to: "{ name: 'refresh_token', place: 'body' },\n\t\t\t\t{ name: 'scope', place: 'body' }\n\t\t\t]\n\t\t},\n\t\t{\n\t\t\tid: 'api-request-new'"
	},
	{
		name: 'refresh: a stolen one from an app with a secret needs nothing else',
		file: AC,
		from: 'From an app with a secret they would need the secret as well, because the request has to carry it.',
		to: 'This request is all they need.'
	},
	{
		name: 'refresh: the note says revoking is on by default',
		file: NOTES,
		from: 'Off by default, so the old refresh token keeps working',
		to: 'On by default, so the old refresh token stops working'
	},

	// An API saying no.
	{
		name: 'api: a 403 is called a 401',
		file: AC,
		from: "{ when: sends('noscope'), text: '403 insufficient_scope' },",
		to: "{ when: sends('noscope'), text: '401 invalid_token' },"
	},
	{
		name: 'api: a refusal has no WWW-Authenticate',
		file: AC,
		from: "note: 'What kind of token it wants, and what was wrong with this one',\n\t\t\t\t\twhen: apiRefuses",
		to: "note: 'What kind of token it wants, and what was wrong with this one',\n\t\t\t\t\twhen: sends('good')"
	},
	{
		name: 'api: an expired token is called changed',
		file: AC,
		from: "{ when: sends('expired'), text: 'The API refuses: the token has expired' },",
		to: "{ when: sends('expired'), text: 'The API refuses: the signature is wrong' },"
	},
	{
		name: 'api: the token is sent even when it says none is',
		file: AC,
		from: "when: any(all(bearer, not(sends('none'))), bearerOnly)",
		to: 'when: any(bearer, bearerOnly)'
	},

	// DPoP, which has been wrong twice.
	{
		name: 'dpop: a gateway is said to check the proof',
		file: AC,
		from: 'An ordinary JWT library or gateway checks the token and ignores the proof',
		to: 'A library or a gateway does this'
	},
	{
		name: 'dpop: a stolen token is useless at any API',
		file: AC,
		from: 'so at an API that checks the proof a stolen token is useless without the key.',
		to: 'so a stolen token is useless without the key.'
	},
	{
		name: 'dpop: whoever has the code gets the tokens, though the login named the key',
		file: AC,
		from: 'so the identity provider refuses the code with no proof, or with a proof from any other key.',
		to: 'so whoever intercepted the code gets the tokens.'
	},
	{
		name: 'dpop: bearer words on a dpop token',
		file: AC,
		from: "text: 'The app sends the token and a new proof, which shows it holds the key the token is tied to.'",
		to: "text: 'The app sends the access token. Whoever holds a bearer token can use it.'"
	},

	// Words.
	{
		name: 'words: a sentence with no space after it',
		file: AC,
		from: 'so the app gets nothing and the user sees an error. The specs',
		to: 'so the app gets nothing and the user sees an error.The specs'
	},
	{
		name: 'words: a line about libraries names none',
		file: AC,
		from: "example('springSecurity', true, 'compares state without being asked'),",
		to: ''
	},

	// Notes.
	{
		name: 'notes: nothing behind a note',
		file: NOTES,
		from: "question: 'implicitFlow',\n\t\t\tshows: { serverLists: true, before: { allowed: false }, after: { allowed: true } }",
		to: "question: 'implicitFlow',\n\t\t\tshows: {}"
	},
	{
		name: 'notes: a status nobody saw',
		file: NOTES,
		from: 'Anything else gets a 400, and the page says',
		to: 'Anything else gets a 500, and the page says'
	},
	{
		name: 'notes: moved off its step',
		file: NOTES,
		from: "id: 'implicit-flow',\n\t\tsteps: ['redirect-with-code'],",
		to: "id: 'implicit-flow',\n\t\tsteps: ['authorize'],"
	},
	{
		name: 'notes: for the wrong client type',
		file: NOTES,
		from: 'which needs nothing here.",\n\t\twhen: not(confidential),',
		to: 'which needs nothing here.",\n\t\twhen: confidential,'
	},
	{
		name: 'notes: words swapped between PKCE on and off',
		file: NOTES,
		from: "when: all(pkce, not(confidential)),\n\t\t\t\ttext: 'Someone with only the code",
		to: "when: all(not(pkce), not(confidential)),\n\t\t\t\ttext: 'Someone with only the code"
	},
	{
		name: 'notes: a console path nobody looked for',
		file: NOTES,
		from: "'Configure a new mapper',\n\t\t\t\t'Audience'\n\t\t\t],\n\t\t\tpage: 'client-dedicated-scope',\n\t\t\topens: 'Configure a new mapper',\n\t\t\tshows: ['Audience']\n\t\t},\n\t\tbackedBy: {\n\t\t\tquestion: 'audience'",
		to: "'Configure a new mapper',\n\t\t\t\t'Audience thing'\n\t\t\t],\n\t\t\tpage: 'client-dedicated-scope',\n\t\t\topens: 'Configure a new mapper',\n\t\t\tshows: ['Audience']\n\t\t},\n\t\tbackedBy: {\n\t\t\tquestion: 'audience'"
	},

	// The weekly check itself.
	{
		name: 'check: order stops mattering',
		file: SHAPE,
		from: 'const [a, b] = [lines(before), lines(after)];',
		to: 'const [a, b] = [lines(before).sort(), lines(after).sort()];'
	},
	{
		name: 'check: an error is only a type',
		file: SHAPE,
		from: "const STATED = new Set(['error', 'error_description', 'token_type']);",
		to: "const STATED = new Set(['error_description', 'token_type']);"
	},
	{
		name: 'check: a token type is only a type',
		file: SHAPE,
		from: "const STATED = new Set(['error', 'error_description', 'token_type']);",
		to: "const STATED = new Set(['error', 'error_description']);"
	},
	{
		name: 'check: status left out',
		file: SHAPE,
		from: 'status: message.status,',
		to: ''
	},
	{
		name: 'check: query left out',
		file: SHAPE,
		from: 'query: message.url ? queryNames(message.url) : undefined,',
		to: ''
	},
	{
		name: 'check: headers left out',
		file: SHAPE,
		from: 'headers: Object.keys(message.headers)\n\t\t\t.filter((name) => message.headers[name] !== undefined)\n\t\t\t.sort(),',
		to: ''
	},
	{
		name: 'check: a header holding nothing counts',
		file: SHAPE,
		from: '\t\t\t.filter((name) => message.headers[name] !== undefined)\n',
		to: ''
	},
	{
		name: 'check: claims left out',
		file: SHAPE,
		from: 'STATED.has(key) ? value : (claimNames(value) ?? typeof value)',
		to: 'STATED.has(key) ? value : typeof value'
	},
	{
		name: 'check: the console is not looked at',
		file: CHECK,
		from: '(label) => `${note.id}: the admin console no longer shows "${label}"`',
		to: '() => ""'
	},
	{
		name: 'check: flags are not compared',
		file: CHECK,
		from: 'sorted(flags.committed) === sorted(flags.now)',
		to: 'true'
	},
	{
		name: 'check: evidence is not compared',
		file: CHECK,
		from: '...evidenceDifferences(answers)\n',
		to: '\n'
	},

	// The check that lets a change merge and go live.
	{
		name: 'ci: the required check is skipped when a job before it fails',
		file: '.github/workflows/ci.yml',
		from: 'if: always()',
		to: 'if: success()'
	},
	{
		name: 'ci: the required check passes whatever came before it',
		file: '.github/workflows/ci.yml',
		from: 'test "$RESULTS" = "success success"',
		to: 'test -n "$RESULTS"'
	},
	{
		name: 'ci: the required check does not wait for the browsers',
		file: '.github/workflows/ci.yml',
		from: 'needs: [checks, click-through]',
		to: 'needs: [checks]'
	},
	{
		name: 'ci: a deploy does not wait for the required check',
		file: '.github/workflows/ci.yml',
		from: 'needs: complete',
		to: 'needs: checks'
	},

	// How it moves.
	{
		name: 'motion: new words and chips arrive while rows still move',
		file: MOTION,
		from: 'const arriveAt = (t: number) => within(t, 0.7, 1);',
		to: 'const arriveAt = (t: number) => within(t, 0.4, 1);'
	},
	{
		name: 'motion: rows move while old chips are still going',
		file: MOTION,
		from: 'const moveAt = (t: number) => within(t, 0.3, 0.7);',
		to: 'const moveAt = (t: number) => within(t, 0.05, 0.7);'
	},
	{
		name: 'motion: words that change are swapped in plain sight',
		file: MOTION,
		from: 'const wordsAt = (t: number) => (t < 0.5 ? 1 - leaveAt(t) : arriveAt(t));',
		to: 'const wordsAt = (t: number) => (t < 0.5 ? 1 : 1);'
	},
	{
		name: 'motion: a line that changes its anchor slides across a chip',
		file: MOTION,
		from: ' && line.anchor === b.lines[i].anchor',
		to: ''
	},
	{
		name: 'motion: the room new rows need stays empty until the end',
		file: MOTION,
		from: 'const comeAt = (t: number) => within(t, 0.35, 0.8);',
		to: 'const comeAt = (t: number) => within(t, 0.7, 1);'
	},
	{
		name: 'play: waits for ever on a long step',
		file: MOTION,
		from: 'Math.max(QUICKEST_STEP_MS, Math.min(SLOWEST_STEP_MS, words * MS_PER_WORD))',
		to: 'Math.max(QUICKEST_STEP_MS, words * MS_PER_WORD)'
	},
	{
		name: 'play: rushes a short step',
		file: MOTION,
		from: 'Math.max(QUICKEST_STEP_MS, Math.min(SLOWEST_STEP_MS, words * MS_PER_WORD))',
		to: 'Math.min(SLOWEST_STEP_MS, words * MS_PER_WORD)'
	},
	{
		name: 'parts: one starts from a step that does not exist',
		file: AC,
		from: "from: 'token-runs-out'",
		to: "from: 'token-runs-outt'"
	},
	{
		name: 'parts: one holds steps that are not there',
		file: MODEL,
		from: 'if (here.has(step.id)) parts[parts.length - 1]',
		to: 'parts[parts.length - 1]'
	},
	{
		name: 'parts: an empty one is left on the timeline',
		file: MODEL,
		from: 'return parts.filter((part) => part.steps.length);',
		to: 'return parts;'
	},
	{
		name: 'parts: a reason too long to read in passing',
		file: AC,
		from: "why: 'The app does not handle the password, so it sends the user off to log in elsewhere.',",
		to: "why: 'The app does not handle the password at all and never should, because that is the whole point of all this, so it sends the user to whoever does.',"
	},
	{
		name: 'landing: what someone had already seen lands again',
		file: MODEL,
		from: 'held.filter((artifact) => !before[line].includes(artifact))',
		to: 'held'
	},

	// Through one party's eyes.
	{
		name: 'eyes: a redacted message keeps its values',
		file: 'src/lib/recordings/wire.ts',
		from: 'return { before: line.before, hidden: line.value.length, after: line.after };',
		to: 'return line;'
	},
	{
		name: 'eyes: what a party saw comes with what it did not',
		file: 'src/lib/recordings/wire.ts',
		from: 'step !== null && seesStep(step) && soFar(step)',
		to: 'step !== null && soFar(step)'
	},
	{
		name: 'eyes: a party sees messages it was not part of',
		file: 'src/lib/flow/eyes.ts',
		from: "step.kind === 'time' || step.from === party || step.to === party",
		to: 'true'
	},
	{
		name: 'eyes: a party is kept when a setting takes it off the diagram',
		file: 'src/lib/flow/state.ts',
		from: '\t\t\teyes: onTheDiagram(view, state.eyes),\n\t\t\tfollow: onTheWay(view, state.follow)\n',
		to: '\t\t\tfollow: onTheWay(view, state.follow)\n'
	},
	{
		name: 'eyes: a question is still answered as someone else',
		file: 'src/lib/map/nodes.ts',
		from: '(of.eyes ?? null) === state.eyes &&\n',
		to: ''
	},

	// The list of combinations.
	{
		name: 'combinations: the list is worked out again for each test',
		file: 'src/lib/flow/settings.ts',
		from: 'everyValid ??= Object.freeze(',
		to: 'everyValid = Object.freeze('
	},
	{
		name: 'combinations: a test can change what the others are given',
		file: 'src/lib/flow/settings.ts',
		from: 'validCombinations(ids).map((settings) => Object.freeze(settings))',
		to: 'validCombinations(ids)'
	},

	// Following one thing.
	{
		name: 'follow: a step on the way is left out',
		file: 'src/lib/flow/follow.ts',
		from: 'const here = forms.filter((form) => step.fields.some((field) => field.artifact === form));',
		to: 'const here = forms.filter((form) => step.kind === "response" && step.fields.some((field) => field.artifact === form));'
	},
	{
		name: 'follow: two forms of one thing go their own ways',
		file: 'src/lib/flow/follow.ts',
		from: "verifier: ['verifier', 'challenge'],\n\tchallenge: ['verifier', 'challenge']",
		to: "verifier: ['verifier'],\n\tchallenge: ['challenge']"
	},
	{
		name: 'follow: used up is said of a step no recording backs',
		file: 'src/lib/flow/follow.ts',
		from: "code: { step: 'real-app-refused',",
		to: "code: { step: 'token-response',"
	},
	{
		name: 'follow: something a setting took away is still followed',
		file: 'src/lib/flow/state.ts',
		from: '\t\t\teyes: onTheDiagram(view, state.eyes),\n\t\t\tfollow: onTheWay(view, state.follow)\n',
		to: '\t\t\teyes: onTheDiagram(view, state.eyes)\n'
	},

	// A request as a command.
	{
		name: 'curl: a quote ends the argument early',
		file: 'src/lib/recordings/curl.ts',
		from: 'text.replaceAll("\'", "\'\\\\\'\'")',
		to: 'text'
	},
	{
		name: 'curl: a request is sent without its headers',
		file: 'src/lib/recordings/curl.ts',
		from: '...Object.entries(message.headers).map(([name, value]) => `-H ${quoted(`${name}: ${value}`)}`),',
		to: ''
	},
	{
		name: 'curl: a code reads as if it could be used again',
		file: 'src/lib/recordings/curl.ts',
		from: "'token-request': 'redirect-with-code',",
		to: ''
	},
	{
		name: 'curl: nothing says the values are throwaway',
		file: 'src/lib/recordings/curl.ts',
		from: "'# Never paste real secrets into a command like this.',",
		to: ''
	},

	// Running it at home.
	{
		name: 'run it yourself: the verifier is left out with PKCE on',
		file: 'src/lib/recordings/run-yourself.ts',
		from: "...(settings.pkce ? [`--data-urlencode 'code_verifier=${VERIFIER}'`] : [])",
		to: ''
	},
	{
		name: 'run it yourself: an app with no secret is given one',
		file: 'src/lib/recordings/run-yourself.ts',
		from: "...(settings.clientType === 'public' ? { publicClient: true } : withSecret),",
		to: '...withSecret,'
	},
	{
		name: 'run it yourself: others can reach the server',
		file: 'src/lib/recordings/run-yourself.ts',
		from: '-p 127.0.0.1:${KEYCLOAK_PORT}:8080',
		to: '-p ${KEYCLOAK_PORT}:8080'
	},
	{
		name: 'run it yourself: a token at home has no roles and no audience',
		file: 'src/lib/recordings/run-yourself.ts',
		from: 'users: [{ ...demoUser, realmRoles: [`default-roles-${LOCAL_REALM}`] }],',
		to: 'users: [{ ...demoUser, realmRoles: [] }],'
	},
	{
		name: 'curl: a step is told its code came from the wrong place',
		file: 'src/lib/recordings/curl.ts',
		from: "'second-token-request': 'second-redirect-with-code'",
		to: "'second-token-request': 'redirect-with-code'"
	},
	{
		name: 'run it yourself: the secret is not the one recorded',
		file: 'src/lib/recordings/run-yourself.ts',
		from: "export const CLIENT_SECRET = 'throwaway-client-secret';",
		to: "export const CLIENT_SECRET = 'another-secret';"
	},
	{
		name: 'run it yourself: the challenge is not of that verifier',
		file: 'src/lib/recordings/run-yourself.ts',
		from: "export const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';",
		to: "export const CHALLENGE = 'not-the-challenge';"
	},

	// Search.
	{
		name: 'search: a word says only that it is a word',
		file: 'src/lib/search/search.ts',
		from: 'if (term.artifact) return artifacts[term.artifact].explains;',
		to: ''
	},
	{
		name: 'search: a pasted error goes past the question about it',
		file: 'src/lib/search/search.ts',
		from: 'return about ? { ...result, view: about.id } : result;',
		to: 'return result;'
	},
	{
		name: 'search: a field only some settings bring cannot be found',
		file: 'src/lib/search/search.ts',
		from: 'const fields = (step.fields ?? [])',
		to: 'const fields = shown.fields'
	},

	{
		name: 'search: a pitfall cannot be found',
		file: 'src/lib/search/search.ts',
		from: "const pitfall = shown.pitfall ? `${shown.pitfall.title} ${shown.pitfall.text}` : '';",
		to: "const pitfall = '';"
	},

	// What the screen says after moving.
	{
		name: 'changes: Back is explained with the setting flipped before it',
		file: 'src/lib/flow/changes.ts',
		from: 'return move.byFlip ? { ...last, diff: move.diff } : { ...NOTHING_CHANGED, diff: move.diff };',
		to: 'return { ...last, diff: move.diff };'
	},
	{
		name: 'changes: what changed stays while stepping',
		file: 'src/lib/flow/changes.ts',
		from: 'if (move.diagramChanged || (nothing && move.stepChanged)) return NOTHING_CHANGED;',
		to: 'if (move.diagramChanged) return NOTHING_CHANGED;'
	},
	{
		name: 'changes: a switch for the other diagram is offered anyway',
		file: 'src/lib/flow/changes.ts',
		from: '!possible.some((flipped) => changesInPlainWords(here, settings, flipped)) &&',
		to: 'false &&'
	},

	// Names every object has.
	{
		name: 'state: an explanation of constructor opens',
		file: STATE,
		from: "if (kind === 'artifact' && Object.hasOwn(artifacts, id)) return { kind, id: id as ArtifactId };",
		to: "if (kind === 'artifact' && id in artifacts) return { kind, id: id as ArtifactId };"
	},

	// Words.
	{
		name: 'words: a word used on screen has no explanation',
		file: 'src/lib/flow/glossary.ts',
		from: "words: ['issuer', 'issuers'],",
		to: 'words: [],'
	},
	{
		name: 'words: every use is marked',
		file: 'src/lib/flow/glossary.ts',
		from: 'if (!term || marked.has(term.id) || (term.vendor && !serverNamed)) continue;',
		to: 'if (!term || (term.vendor && !serverNamed)) continue;'
	},
	{
		name: 'words: one server is named with its notes off',
		file: 'src/lib/flow/glossary.ts',
		from: 'if (!term || marked.has(term.id) || (term.vendor && !serverNamed)) continue;',
		to: 'if (!term || marked.has(term.id)) continue;'
	},
	{
		name: 'words: a term points at something that is not there',
		file: 'src/lib/flow/glossary.ts',
		from: "at: flowAt('consent-page', { consent: true })\n\t},\n\t{\n\t\tid: 'consent',",
		to: "at: flowAt('consent-page')\n\t},\n\t{\n\t\tid: 'consent',"
	},

	// Search.
	{
		name: 'search: an error stops being found in a pasted line',
		file: 'src/lib/search/search.ts',
		from: 'const pasted = errors.filter((error) => phrase.includes(lower(error.title)));',
		to: 'const pasted = errors.filter((error) => phrase === lower(error.title));'
	},
	{
		name: 'search: something not here yet is guessed around',
		file: 'src/lib/search/search.ts',
		from: 'if (missing && !pasted.length) return { results: [], notHereYet: missing };',
		to: ''
	},
	{
		name: 'search: an error opens the wrong step',
		file: 'src/lib/search/errors.ts',
		from: "because that is where a real server said it.',\n\t\tstep: 'real-app-refused',",
		to: "because that is where a real server said it.',\n\t\tstep: 'open-app',"
	},

	// Answers.
	{
		name: 'map: a question opens away from its answer, with no reason',
		file: 'src/lib/map/tracks.ts',
		from: "preset: 'broker',\n\t\t\t\t\tstep: 'redirect-to-upstream'",
		to: "preset: 'broker'"
	},
	{
		name: 'map: a question from another mode is where someone is',
		file: NODES,
		from: 'candidate.mode === state.mode &&',
		to: ''
	},

	// The map.
	{
		name: 'map: the next question skips one',
		file: NODES,
		from: 'mapNodes[mapNodes.indexOf(of) + 1] ?? null;',
		to: 'mapNodes[mapNodes.indexOf(of) + 2] ?? null;'
	},
	{
		name: 'map: a question ignores the diagram',
		file: NODES,
		from: 'state.flow === of.flow &&\n\tstate.diagram === of.diagram &&\n',
		to: 'state.flow === of.flow &&\n'
	},

	// The diagram and the state.
	{
		name: 'layout: a head runs off the side',
		file: LAYOUT,
		from: 'Math.max(TIGHT_MARGIN, headFor(TIGHT_MARGIN) / 2 + 4)',
		to: 'TIGHT_MARGIN'
	},
	{
		name: 'layout: scales up past what can be followed',
		file: LAYOUT,
		from: 'clamp(room?.width ?? WIDTH, MIN_WIDTH, MAX_WIDTH)',
		to: 'Math.max(room?.width ?? WIDTH, MIN_WIDTH)'
	},
	{
		name: 'layout: rows ignore the height there is',
		file: LAYOUT,
		from: 'if (height === undefined) return ROW_HEIGHT;',
		to: 'return ROW_HEIGHT;'
	},
	{
		name: 'state: an explanation does not survive a link',
		file: STATE,
		from: "if (state.explained) params.set('explain', `${state.explained.kind}.${state.explained.id}`);",
		to: ''
	},
	{
		name: 'model: a field leaves out what brought it',
		file: MODEL,
		from: 'causes: causes(field.when, settings),',
		to: 'causes: [],'
	},

	// What an agent is told, and the skill someone installs.
	{
		name: 'agents: a value that is turned off on its own is said to need nothing',
		file: 'src/lib/agents.ts',
		from: '(value.least[0]?.params.length ?? 0) > 1)',
		to: '(value.least[0]?.params.length ?? 0) > 99)'
	},
	{
		name: 'agents: the zip says a file is shorter than it is',
		file: 'src/lib/zip.ts',
		from: 'l.setUint32(22, data.length, true);',
		to: 'l.setUint32(22, data.length - 1, true);'
	},
	{
		name: 'agents: two values are said to go together when the link loses one',
		file: 'src/lib/agents.ts',
		from: 'return kept[value.id] === value.value && kept[other.id] === other.value;',
		to: 'return kept[value.id] === value.value || kept[other.id] === other.value;'
	},
	{
		name: 'links: a setting the link asked for is turned off without a word',
		file: STATE,
		from: '!params.has(param) || settings[setting] === requested[setting]',
		to: '!params.has(param) || settings[setting] !== requested[setting]'
	}
];
