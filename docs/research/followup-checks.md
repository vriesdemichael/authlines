# Follow-up checks

Done on 2026-10-30 and 2026-10-31, after the main research, to test points the maintainer raised in response to it. These were quick checks and not a survey.

## OAuth to OIDC on a real Keycloak

Run on 2026-10-30 against `quay.io/keycloak/keycloak:26.8.1` in `start-dev`: the authorization code flow with a public client, through the real login form. There were four runs, with and without `openid`, on a default client and on a client with `profile`, `email` and `roles` removed from its default client scopes.

| | `openid` off | `openid` on |
|---|---|---|
| `id_token` in the token response | No | Yes |
| UserInfo | 403, `insufficient_scope`, "Missing openid scope" | 200 |
| `scope` in the response, default client | `profile email` | `openid profile email` |
| Access token, default client | Has `name`, `email` and `preferred_username` | Same claims |
| Access token, stripped client | `sub` and technical claims, no `aud` | Same claims |
| ID token, stripped client | None issued | `sub` and technical claims, no name or email |

**The toggle is real, but the access token does not change.** On a default client it already says who the user is with OIDC off. Those claims come from client scopes, not from `openid`.

Also seen in these runs:

- **Wrong `redirect_uri`:** 400 with `Invalid parameter: redirect_uri` and no redirect.
- **Discovery:** 200 at `/realms/{realm}/.well-known/openid-configuration`, `/realms/{realm}/.well-known/oauth-authorization-server` and `/.well-known/oauth-authorization-server/realms/{realm}`.
- **A new client's default client scopes:** `web-origins`, `acr`, `profile`, `roles`, `basic` and `email`.

## What "token brokering" refers to

On 2026-10-31 the maintainer said it means upstream token storage. **This was read from Keycloak's 26.8.1 docs and has not been run.** The sources are the [developer guide](https://www.keycloak.org/docs/26.8.1/server_development/#_identity-brokering-apis-tokens), the [admin guide](https://www.keycloak.org/docs/latest/server_admin/index.html), the [features page](https://www.keycloak.org/server/features) and the [release notes](https://www.keycloak.org/docs/latest/release_notes/index.html). This explains the brief's "feature flags of keycloak like cimd and token brokering", because the retrieval API sits behind a flag.

| | `identity-brokering-api:v1` | `identity-brokering-api:v2` |
|---|---|---|
| Status | Deprecated, on by default, to be removed | Supported, off by default, to become the default |
| Request | `GET /realms/{realm}/broker/{alias}/token` | `POST` to the same path, with a form body |
| Authentication | The user's Keycloak access token as a bearer token | Client authentication plus the access token. Confidential clients only |
| Authorization | The user's `read-token` role on the `broker` client | Client settings: "Allow retrieve external tokens" and "Allowed Identity Providers for External Tokens" |
| Storage | "Store Tokens": in the database, per user and IdP | "Store token in session", or "Store tokens". The session is tried first, with the database as a fallback |
| Response | Format not specified | Always a JSON access token response |

Other points:

- **Defaults:** the pages read do not state the defaults of "Store Tokens" and "Stored Tokens Readable". The developer guide's wording implies they start off.
- **"Stored Tokens Readable":** assigns the `read-token` role to newly imported users.
- **History:** V2 arrived as a preview in 26.6.0, and in 26.7.0 it became supported and V1 was deprecated.
- **Whether enabling V2 turns V1 off:** the pages do not say. It does, as the next section records.

## SvelteKit as static files on GitHub Pages

Tested on 2026-10-31, because the maintainer doubted that SvelteKit hosts easily as static files. The same small app, a map, two named states and an OIDC toggle in the query string, was built on `@sveltejs/kit` 3.1.1 with `adapter-static` 4.0.1, and on plain Svelte 5.57.3 with Vite 8.3.5. A local server mimicked a Pages project site: plain files under a subpath, no rewrite rules, and `404.html` for anything else. Playwright 1.64.1 drove both in Chromium. This test did not run on real GitHub Pages. The application has since, as recorded in the next section.

| | SvelteKit | Plain Svelte on Vite |
|---|---|---|
| Output | One HTML file per state, `404.html`, and hashed JS and CSS | `index.html` and one JS file |
| Opening a named state by link | 200 | 404 |
| The same link with `?oidc=1` | Right diagram once JS has run | Blank page |
| Clicking from the map, toggling, the back button | Work | Work |
| Diagram in the raw HTML, and with JS off | Yes | No |
| Title and description per state | Yes | No |
| JS, each file gzipped and summed | 39 KB | 16 KB |
| Under `/pr-preview/pr-2/` | Works | Not tested |

Other points:

- **Kit 3 is new.** 3.0.0 was published on 2026-10-01. `svelte.config.js` is gone, `$lib` became `#lib`, and `$app/environment` became `$app/env`. The [docs](https://svelte.dev/docs/kit/adapter-static) have a GitHub Pages section with a workflow.
- **Storybook 10.6.5 on Kit 3, through `@storybook/sveltekit`:** a plain component renders. A component importing `$app/state`, `$app/env` and `$app/paths` fails with `__SVELTEKIT_PAYLOAD__ is not defined`. Which import causes it was not isolated.
- **The query string is not available while prerendering.** A link with non-default settings shows the default state until JS runs. This flash was not measured.
- **Windows paths:** in a folder that made paths exceed 260 characters, Kit's config failed to load with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. A shorter folder with `node-linker=hoisted` fixed it. Nothing suggests this is specific to Kit.
- **Previews on a sub page:** the `preview` input of `actions/deploy-pages` is marked alpha and not public. [pr-preview-action](https://github.com/rossjrw/pr-preview-action) (MIT, 448 stars, pushed 2026-10-27) deploys to a branch, so Pages has to deploy from that branch. Jekyll would then be expected to skip Kit's `_app` folder unless the site has a `.nojekyll` file. The next section records how this went.

## The application on real GitHub Pages

On 2026-10-31, when the repository went public and the first deploys ran, in pull requests 16 and 17. The click-through, 50 tests on Playwright 1.64.1 in Chromium, ran against the live addresses through `LIVE_URL`. The local server imitating Pages held up, apart from the differences listed here.

| | Result |
|---|---|
| Production | 50 of 50 |
| A preview, before production existed | 48 of 50. One test named the production path, which is now fixed. The other needs the site's own `404.html`, which did not exist yet |
| A preview, with production in place | 50 of 50 |
| A folder without its trailing slash | 301, as the local server does |
| From merge to live | 2 min 18 s: 1 min 29 s of checks, then 40 s of deploying, about 30 s of that waiting for Pages |

What the local server does not show:

- **A bad link in a preview gets production's error page.** Pages only looks for `404.html` at the site root, so a preview's own copy goes unused. The status is still 404.
- **Pages caches for ten minutes.** It sends `Cache-Control: max-age=600`, so a returning browser can show the old page for that long after a deploy.
- **`.nojekyll` outlives a preview.** The deploy action never deletes it, so closing pull request 16 left two empty files under `pr-preview/pr-16`, one from the site and one from the Storybook. The preview workflow now deletes them before deploying.
- **Pages turns itself on.** Creating a `gh-pages` branch on a public repository enabled Pages from that branch, and the API call to enable it then returned 409.

How far production and previews were shown to leave each other alone:

- Deploying a preview left production serving the same commit, with its files in place.
- A production redeploy with the preview of pull request 17 open ran `rsync --delete` with `pr-preview/` protected and found nothing to commit, and the preview's tree was unchanged. It had nothing to push, so a deploy that pushes while a preview is open has not been seen.
- No two pushes have collided yet, so the rebase that `force: false` asks for has not been exercised.

**Not exercised:** a commit failing CI on `main`. Deploy needs the checks and protection on `main` keeps such a commit out, so this rests on the job order.

## Showing RFCs inside the application

Checked on 2026-10-31, because the maintainer asked for an RFC to open in the application when it is just text.

- **Format:** every RFC has a plain text version on rfc-editor.org. RFC 9449 is 92 KB, RFC 6749 is 163 KB and RFC 6750 is 39 KB. The structured XML version only exists for newer RFCs, and RFC 6749 has none, so plain text is the one format they all share. Older ones keep their page headers and form feeds.
- **Licence:** [IETF Trust Legal Provisions 5.0](https://trustee.ietf.org/documents/trust-legal-provisions/tlp-5/), section 3.c, allows anyone "to copy, publish, display and distribute" them "in full and without modification". This is a reading of the text and not legal advice.
- **Loading:** rfc-editor.org sends `Access-Control-Allow-Origin: *`, so a browser could fetch the text directly. The application copies the files instead ([ADR-009](../adr/009-code-is-apache-and-content-is-cc-by.md)).
- **Byte-order mark:** RFC 9449 starts with one, and browsers drop it when they decode a file. The file itself stays as published, and nothing visible changes.
- **Sections:** a heading starts at the left margin and the table of contents is indented, so the sections can be found without touching the text. RFC 6749 has appendices numbered `A.1`, and RFC pages on rfc-editor.org have an anchor like `#section-8`.
- **Other sources:** [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html) is 427 KB of HTML whose notice allows reproduction for developing and implementing specifications. That does not obviously cover this, so it gets a summary and a link, as the Keycloak docs do.

## What a real Keycloak does

Recorded on 2026-11-01 with `pnpm record`, against `quay.io/keycloak/keycloak:26.8.1` in `start-dev`, with real logins through a headless browser. The answers are in `static/recordings/authorization-code/questions.json`, and each one came from a real request.

| Question | Answer |
|---|---|
| Does Keycloak ask for a DPoP nonce? | No. A token request with a proof and no nonce got a 200 and a `DPoP` token, with no `DPoP-Nonce` header. So the retry is marked as from the spec only |
| Does a client need a setting to use DPoP? | No. A default client that sends a proof gets a bound token, and `dpop_jkt` on the authorization request is accepted |
| Does UserInfo take a DPoP-bound token? | Yes, as `Authorization: DPoP` with a proof tied to that token. Without the proof, or as `Bearer`, it answers 401 |
| Does API V1 take a DPoP-bound token? | Yes, as `Authorization: DPoP` with a proof. As `Bearer` it answers 400 `Invalid token`. **The prototype was wrong here** |
| Does API V2 take a DPoP-bound token? | No. It answers 400 `invalid_token` with a proof and without one. **The prototype offered this, so the application no longer does** |
| Does enabling API V2 turn V1 off? | Yes. V1 then answers 400 `Identity Brokering API feature not enabled`, which the docs do not say |
| What does each API version hand over? | V1 hands over everything stored, including the upstream's ID and refresh tokens. V2 hands over only the access token, with `expires_in` and `issued_token_type` |
| Is a public client without PKCE accepted? | Yes, by default. With `pkce.code.challenge.method` set to `S256` on the client, the app gets an error back at its redirect URI: `Missing parameter: code_challenge_method` |
| Is PKCE tied to the client type? | No. Keycloak applies it to any client that sends a challenge, and insists on it only when **Require PKCE** is on for the client, which is `pkce.code.challenge.method` in the admin API. So the two settings are independent |
| What can someone do with a code they intercepted? | On a public client without PKCE, get the tokens, and the real app then gets 400 `Code not valid`. With PKCE, nothing: no verifier gets 400 `PKCE code verifier not specified`, and a wrong one 400 `PKCE verification failed: Code mismatch`, with or without the secret. On a confidential client without PKCE, no secret gets 401 `unauthorized_client` |
| Does a refused try use up the code? | It depends where it was refused. When the PKCE check fails the code is gone, and the real app gets `Code not valid`, so someone with only the code can still spoil a login that PKCE protects. When client authentication fails the code survives, and the real app still got its tokens |
| What does a server say about the feature flags the settings name? | `dpop` and `identity-brokering-api:v1` are `DEFAULT` and on, and `identity-brokering-api:v2` is `DISABLED_BY_DEFAULT` and off, from `/admin/serverinfo`. The server does not call V1 deprecated, and the 26.8.1 docs do, so a badge says which is which. `pnpm record --check` fails when these change |
| What does a wrong redirect URI do? | 400 with `Invalid parameter: redirect_uri`, and no redirect |
| What does a wildcard in Valid redirect URIs let through? | `http://app/*` takes any path on that site, and refuses another site with a 400. `http://app*` also refuses an address that only starts the same. `*` alone takes any site at all |
| Do stolen tokens survive the real app trying the same code? | Keycloak cancels what the code got, as RFC 6749 section 4.1.2 advises: UserInfo goes from 200 to 401, and the refresh token gets 400 `invalid_grant`. An API that only checks the signature still answers 200, until the token expires |
| Is the implicit flow still there? | The discovery document lists `token` under `response_types_supported`, but a new client asking for it gets redirected with an error. With **Implicit flow** on, under Capability config, it gets the login page |
| What does Web origins do? | On a public client with the list empty, a token request from the page is blocked as a CORS error, and the same code still gets a 200 afterwards, so nothing was issued. With the app's origin listed, it gets a 200. A client created through the admin API with no list copies it from its redirect URIs, so this has to start from an empty one |
| Does Consent required change what is in the token? | Turned on afterwards, as someone does in the console, no: the token has the same audience and roles. Set when a client is created through the admin API, it also turns off Full scope allowed, and the token then has no roles and no audience. **The recorder did this until 2026-11-01, and nothing noticed, because the demo API did not check the audience** |

What changing a setting on a real server does, each one a real login before and after. These are what the Keycloak notes rest on, and the admin console was walked on the same version to see that each setting is where a note says.

| Setting, and where | Before | After |
|---|---|---|
| **Valid redirect URIs**, Settings, Access settings | Address not listed: 400, `Invalid parameter: redirect_uri` | Listed: 200 and the login page |
| **Client authentication**, Settings, Capability config | On, no secret: 401 `unauthorized_client` | Off: 200 and tokens |
| **Require PKCE**, Settings, Capability config | Off, no challenge: a code | On: no code, and the error `Missing parameter: code_challenge_method` |
| **Require DPoP bound tokens**, Settings, Capability config | Off, no proof: 200 and a Bearer token | On: 400 `invalid_request` |
| Default **Client scopes** | `profile` and `email` on: the token has a name and an email address | Both off: neither, and `scope` is empty |
| **Audience** mapper, in the client's dedicated scope | `aud` is `account` | `aud` is `["my-api", "account"]` |
| **Access Token Lifespan**, Advanced, Advanced settings | `expires_in` 300 | Set to 60: `expires_in` 60 |
| **Store tokens**, on the identity provider | On: the app gets the token | Off: 400 `does not support this operation` |
| **Stored tokens readable**, on the identity provider | On: the app gets the token | Off, for a new user: 403 `not authorized to retrieve tokens` |
| **Allow retrieve external tokens**, Settings, Capability config, only with API V2 on | On: 200 | Off: 403 `Client not allowed to retrieve token for the provider` |
| A default provider on the **Identity Provider Redirector** | Set: 303 straight on to the other provider | Unset: 200 and Keycloak's own login page |

Reading the real console also corrected two things written from memory. The switch is called **Require PKCE**, because "PKCE Method" is only in the messages file, and **Require DPoP bound tokens** is under Capability config, not Advanced.

What else the recordings changed or showed:

- **The token response carries more than the diagram said:** `expires_in`, `refresh_token` and `scope` are there on a default client, so the diagram has them now. `refresh_expires_in`, `not-before-policy` and `session_state` are Keycloak's own, so the protocol layer leaves them out.
- **The redirects carry `iss`,** which the diagram left out. `session_state` is Keycloak's own again.
- **Who sees what holds.** Tokens never went through the browser in any named state, and the password only went to whichever server did the login. A test now holds every token chip to the recordings.
- **Keycloak adds hops the diagram does not draw:** `/broker/{alias}/login` before the redirect to the upstream, and `first-broker-login` and `after-first-broker-login` after a first brokered login. They are in the recordings with no step, because they say nothing about the protocol.
- **A default client's access token names `account` as its audience,** not the API it is going to be sent to. So an API that checks the audience refuses it until someone adds an Audience mapper, which a Keycloak note now says.
- **A brokered login sends the browser straight to the upstream only because the recorder sets that up,** with the identity provider redirector. By default, Keycloak shows its own login page with a button for the upstream. The diagram shows the first, because that is the case where the app really does not notice.

## What the content has and has not been checked against

- **Recorded on Keycloak 26.8.1:** every message the identity provider takes part in, in all eighteen named states, apart from the nonce retry.
- **From the demo app and API:** every message between the browser, the app and the API, in the same runs. They do the checks the steps say they do, in `scripts/record/checks.ts`, and a run stops if one fails, so a success in a recording means they looked. `theDemoChecks` in `questions.json` shows them refusing. That proves the check works once someone writes it, and says nothing about a server.
- **A stand-in:** the app that runs in the browser is recorded from a server. The messages are the same, and where they come from is not. A real call from a page is in `webOrigins`, for what the browser adds.
- **Read in RFC 9449, not seen on Keycloak:** the nonce retry with `use_dpop_nonce` and `DPoP-Nonce`. The nonce is the server's choice, so it is a setting and not part of DPoP itself, and the application marks these messages.
- **Not on the wire, so not recorded:** what people do in setup, which the recorder does through the admin API instead. So a note's "changed this" means through that API, and the console was only checked to have the label on that page.
- **General knowledge, not checked against anything here:** the "In practice" lines, about what a library usually does and what is left to your code. They say what is common, and no library is named.
- **Audited once, not held by a test:** the concept texts. A reader who had not seen the project compared them with the RFCs and the recordings on 2026-11-01, and the corrections are in pull requests 34 and 35. OpenID Connect Core is not in the repository, so what rests on it is from memory.

## The entry and the format

Looked at on 2026-10-31, because the maintainer named both as the references to follow.

- **roadmap.sh:** the home page has a search box, category chips and cards for 96 roadmaps. A roadmap is a node map on one long page, with a spine, branches, a legend, and progress marks on the nodes. It also carries accounts, ads and an AI tutor. Seen in screenshots of the home page and `/frontend`. What opening a node does was not confirmed.
- **IdentiFlows:** the home page has a search and a category filter over flow cards. A flow page has a description and tags, then the diagram, with five lifelines and 18 messages on code + PKCE, then links to specs. Interactive Mode adds Previous and Next, and the theme can be auto, light or dark. This check read the page text and DOM only, because the browser pane was hidden. The rendering itself was seen only in the earlier research.

## Keycloak feature flags

Sources: the [features page](https://www.keycloak.org/server/features) and [specifications page](https://www.keycloak.org/securing-apps/specifications). Neither states which version it describes. Their release switcher reads Nightly, 26.8.1, 26.7.5 and 26.6.4, and the admin guide's links carry 26.8.1.

| Flag | Description on the page | Status as stated |
|---|---|---|
| `cimd[:v1]` | None. Appears only in the option lists | No status on the features page. The specifications page lists "OAuth Client ID Metadata Document" as Experimental |
| `token-exchange-standard:v2` | Standard Token Exchange version 2 | Supported, enabled by default |
| `token-exchange:v1` | Token Exchange Service | Preview, disabled by default |
| `token-exchange-delegation:v1` | Token Exchange Delegation | Preview, disabled by default |
| `identity-brokering-api:v1` | Identity Brokering API V1 | Supported, enabled by default |
| `identity-brokering-api:v2` | Identity Brokering API V2 | Supported, disabled by default |
| `twitter-broker:v1` | Twitter Identity Broker | Supported, enabled by default |
| `instagram-broker:v1` | Instagram Identity Broker | Deprecated, disabled by default |
| `client-auth-federated:v1` | Authenticates client based on assertions issued by identity provider | Supported, enabled by default |
| `jwt-authorization-grant:v1` | JWT Profile for OAuth 2.0 Authorization Grant | Supported, enabled by default |
| `kubernetes-service-accounts:v1` | Kubernetes service accounts trust relationship provider | Supported, enabled by default |
| `spiffe:v1` | SPIFFE trust relationship provider | Preview |

Other points:

- **Core identity brokering is not listed as a flag.** Neither page says whether it needs one, and the brokering docs mention none.
- **Token exchange direction:** the specifications page says "Token exchange V2 only supports the internal to internal use-case", so RFC 8693 support is partial. Neither page says which feature enables external-to-internal or internal-to-external exchange.
- **Names listed with no description or status:** `client-auth-abca`, `identity-assertion-jwt`, `ipa-tuura-federation`. The page does not say whether these relate.
- **Not read:** the [token exchange guide](https://www.keycloak.org/securing-apps/token-exchange), the [MCP authorization server page](https://www.keycloak.org/securing-apps/mcp-authz-server) and the [chaining page](https://www.keycloak.org/securing-apps/oauth-identity-authorization-chaining-across-domains). Read these before writing content on those topics.

Release notes found by search add that [Keycloak 26.6.0](https://www.keycloak.org/2026/04/keycloak-2660-released) added experimental CIMD so Keycloak can act as an authorization server for MCP, and promoted federated client authentication and JWT Authorization Grant to supported. This comes from a search summary and was not read in full.

## User federation vs identity brokering

Source: the [Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/index.html). "User Federation" is the admin console's menu label, and the guide's section is called "Using external storage". Brokering is under "Integrating identity providers".

- **User federation:** user records stay in existing external stores. Keycloak supports LDAP and Active Directory, and the User Storage SPI allows custom databases. At login Keycloak searches that storage and maps the record into its own user model. The intro describes a server-side lookup and does not mention sending the browser elsewhere.
- **Identity brokering:** the guide describes an intermediary connecting service providers with identity providers, typically over SAML 2.0, OpenID Connect or OAuth 2.0. Its overview says Keycloak redirects the user to the identity provider's login page. Accounts can be linked to external identities or created from them. Client applications never contact the external provider.

## Is application setup explained visually anywhere?

One search for visual explainers of client registration from the application's point of view found only text: a [MojoAuth glossary](https://mojoauth.com/glossary/client-id), [Thales setup docs](https://thalesdocs.com/oip/idaas-core/idaas-core-tulip/oauth-openid/oauth-oidc-setup/index.html), the [OpenID Connect registration spec](https://openid.net/specs/openid-connect-registration-1_0-12.html) and vendor docs. **This supports the maintainer's point but is a weak test.** It would not catch vendor quickstarts with diagrams, which are the most likely counterexamples, or a setup section inside a course. Note that IdentiFlows does have an OIDC Discovery flow, so part of this is covered as a separate flow.

## Are external IdPs explained interactively anywhere?

One search found no interactive explainer. The closest material is [Authlete's tutorial on integration with external IdPs](https://www.authlete.com/developers/tutorial/idp), which has a federation flow illustration, and [Red Hat's identity broker docs](https://access.redhat.com/documentation/vi-vn/red_hat_single_sign-on/7.4/html/server_administration_guide/identity_broker). The earlier research also found one `identity_broker_flow` figure in Keycloak's guide. **Also a weak test.**

## Confirming the headline tools

Separate searches confirmed the two closest tools and what they are for:

- **IdentiFlows:** [Auth0's announcement](https://auth0.com/blog/introducing-identiflows-a-visual-reference-for-identity-flows/) describes per-flow pages with an intro, a sequence diagram and a step-by-step breakdown. It calls this an early release and asks for feedback. An earlier copy of the post said Client Credentials, Device Authorization and WebAuthn were coming soon. The first two have since shipped, so WebAuthn may be next.
- **AuthPlayground:** [Ping's docs](https://developer.pingidentity.com/identity-for-ai/protocols/authplayground-cimd.html) confirm it is a simulated environment with no external IdP. Ping also describes a "Full Cross-Domain Access" flow that chains PAR, RAR, PKCE, DPoP and token exchange across seven steps. **That is the nearest thing to composition found**, but it is a fixed chain the reader cannot change.

## What a stolen code gets with DPoP, and other corrections

Tried on Keycloak 26.8.1 on 2026-11-01, because a claims audit doubted what the screen said. The answers are in `questions.json`, and a test holds the words to them.

- **Public client, no PKCE, a login that named the key with `dpop_jkt`:** no proof gets a 400 "DPoP Proof missing", another key's proof a 400 "DPoP Proof public key thumbprint does not match dpop_jkt", and the right key a 200. So "whoever intercepted the code gets the tokens" was false here.
- **The same, with no `dpop_jkt`:** no proof gets a 200 and a Bearer token, and the thief's own key a 200 and a DPoP token.
- **The same, with Require DPoP bound tokens on:** no proof gets a 400, and the thief's own key still gets a 200. So that setting alone does not protect a code.
- **Consent required on a public client:** remembered just as on a confidential one. Asked again only for a new scope, listing only that scope, and then not again.
- **Require PKCE on a client with a secret:** a login with no challenge gets no code, with "Missing parameter: code_challenge_method".
- **A default client's audience:** without the default `roles` client scope the access token has no `aud` at all, so `account` comes from that scope and not from an Audience mapper.
- **API V2, what has to be on for the app to get the stored token:** neither Store tokens nor Store token in session gets a 400, and either one or both gets a 200.
- **`kc_idp_hint`:** with no default provider set on the Identity Provider Redirector, this still goes straight to the other provider.

What libraries do was read at their source the same day, and the claims and links are in `src/lib/flow/libraries.ts` and on the steps. Worth knowing: passport-oauth2 only compares `state` with `state: true`, and throws if PKCE is on without it. Auth.js has PKCE on by default and checks `state` only when configured to. Spring Security compares `state` unasked. oauth4webapi leaves the ID token's signature to a separate call, because OIDC Core allows skipping it for a token that came straight over TLS. AWS API Gateway's JWT authorizer lists no proof among what it checks, so a DPoP token sent as Bearer would pass its checks.

## The device flow on a real server

Asked of Keycloak 26.8.1 on 2026-11-02, against RFC 8628 (August 2019). The answers are in `static/recordings/device/questions.json`, and a test holds what the screen says to them.

- **The grant is off on a new client.** The first request gets 400 `unauthorized_client`, saying the flow is disabled for the client.
- **Ten minutes and 5 seconds, unless set.** `expires_in` is 600 and `interval` is 5. A client's own attributes change both. The console has them under the realm's token settings.
- **Asking too soon gets `slow_down`,** straight after `authorization_pending`. Waiting the interval gets `authorization_pending` again.
- **The order is code, then login, then the page that asks.** The RFC's figure has the login first, and section 3.3 leaves the order to the server.
- **It always asks.** The page appeared with Consent required off and on, and again for someone who had agreed before. It names the client and what it would get. It does not ask whether the device is theirs, or say which, as section 5.4 recommends. The page before it says Device Login, but the full address skips that one.
- **The full address skips the code.** Opening `verification_uri_complete` goes straight to the login, and the code is neither asked for nor shown. Section 3.3.1 says a server should show it.
- **The session cookie comes after agreeing.** Saying no leaves no `KEYCLOAK_IDENTITY` in the browser.
- **A device code works once, for one client.** A second try and another client both get `invalid_grant`, and another client trying does not use it up.
- **With a secret, both requests need it.** Either one without gets 401 `unauthorized_client`.
- **An ID token here has no nonce,** because the request does not send one.

- **It takes PKCE, which the RFC does not include.** A `code_challenge` on the first request gets a 200, and asking with no verifier gets `invalid_grant` with `PKCE code verifier not specified`.
- **A used device code and one never given out get the same answer,** `invalid_grant` with `Device code not valid`. Another client gets `invalid_grant` with `unauthorized client`.

What was not tried on this flow: DPoP, a refresh, and whether a server limits tries at the user code, which section 5.1 recommends.

## Two things a sceptical reader raised

Asked of Keycloak 26.8.1 on 2026-11-02.

- **Where discovery is.** RFC 8414 section 3.1 puts `/.well-known/oauth-authorization-server` ahead of the issuer's path. This server answers there with a 200, and also after the realm, which is where the recordings asked. For `openid-configuration` only the address after the realm answers, with a 404 ahead of it, which is what OpenID Connect Discovery says.
- **What using a refresh token twice ends.** With Revoke Refresh Token on, the old one gets `Maximum allowed refresh token reuse exceeded` and the newest then gets `Session doesn't have required client`. A new login in the same browser asks for no password: it goes straight back to the app with a code, and that code gets tokens. So this ends the app's session, and not the user's at the identity provider. The site used to say it ended the login, and that the user had to go through it again.

The second is not in a recording or in `questions.json`, so nothing checks it again by itself.

## DCR and CIMD on a real server

Tried on Keycloak 26.8.1 on 2026-11-02. The two successful runs are recorded (`registers-itself` and `points-at-a-document`). The refusals, the second use of a token, the caching and the missing audience were tried by hand in a throwaway container, so nothing checks them again until someone does.

**DCR is on with no flag.** With nothing, the registration endpoint answers 403, "Policy 'Trusted Hosts' rejected request to client-registration service". With an initial access token it answers 201, with a client ID, a secret and a registration access token. A token made with `count: 1` used again is 401, "No remaining count on initial access token". Login and the API work as they do for a client an admin made, with no consent page.

**CIMD takes `--features=cimd` and a client policy.** The flag alone leaves "Client not found", with nothing fetched. The policy is the `client-id-metadata-document` executor. In the order it happens:

- Plain HTTP without `cimd-allow-http-scheme`: "Invalid Client ID: invalid scheme", and nothing fetched.
- A client ID on a domain not in `cimd-allow-permitted-domains`: "Invalid Client ID: domain not allowed", and nothing fetched.
- A client ID allowed and a `redirect_uri` in the document on a domain that is not: the document is fetched, and then the same message.
- Both allowed: the login form. A client with that ID now exists in the realm. Asked again at once, nothing is fetched.

An audit of the source said it caches for 300 seconds, which was not tried past the second ask.

**Three things nobody asked for, which the diagram now says:**

- The user is asked, with "Grant Access to Demo app", where a default client is not.
- No refresh token comes, because the document's `grant_types` has only `authorization_code`.
- The token has no audience, and the demo API answered "not for this API". Putting an audience mapper in the `basic` client scope gave it `aud: account`, and the API answered.

The recording turned on plain HTTP, because the demo app has no certificate, and a real one has to be HTTPS. The draft was at -03 that day.

## User federation on a real server

Asked of Keycloak 26.8.1 with OpenLDAP 2.6 (`bitnamilegacy/openldap`) on 2026-11-02, and asked again by the recorder from then on, in `questions.json`. A claims audit by an AI agent asked for most of these, and it was right about most of what it doubted.

- **What can be seen of it.** LDAP is not HTTP, so the recorder has no proxy on it, and it has no text form to show. The directory's own log (`LDAP_LOGLEVEL=256`) has each search and bind, and the screen shows those lines as they are. It leaves the password out, so a pass-through on the connection checks that the password's bytes really cross it. `ssf=0` in the log says the connection was not encrypted.
- **What one login asks.** A bind as the provider's own account, a search, then a bind as the user with the password they typed. A first login searches by username, and a second by the `entryUUID` it kept. Both try the password on the directory.
- **What it keeps.** With Import Users on, a copy of the user, linked to the directory, with a password credential that only points there. With it off the server still answers, and `sub` becomes `f:<provider>:alice`, which was tried once by hand.
- **The tokens.** Same claim names as the provider's own user and as a brokered one, across the three recordings, and a test holds that. One value differs: `email_verified` is false, and Trust Email on the provider turns it true. With a proper full name in `cn`, the default mappers give `given_name` and `family_name`. An earlier test entry with one word there had no first name, which was the test data and not the server.
- **A wrong password** gets the login page again, with a 200, and the log shows `err=49`.
- **The directory down.** For someone in the directory, the login page answers 400, "Unexpected error when handling authentication request to identity provider.", including someone who logged in before, and the token endpoint answers 500 with `unknown_error`. Someone with a session is not asked to log in, a refresh token still works, and a user kept in the provider can still log in.

Active Directory was not tried. It speaks LDAP, and Keycloak has a vendor setting for it, so its defaults differ.

## A server behind the page, in a real browser

Recorded on 2026-11-03 from Keycloak 26.8.1, a page and a small server of the demo app's own, and Playwright's Chromium, following RFC 10017 (BCP 212, August 2026) section 6.1. The recorder asks the page what a script in it can do each time it runs, in `questions.json`.

- **The server is the client.** It is a confidential client with PKCE. The page asks it whether anyone is logged in, and when nobody is, sends the browser to the server's `/login`, which starts the login. The server makes the token request itself, so the browser carries the code back to it, as with an app on a server, and never a token. The server answers that with a move straight on to the page, so no page is shown at the address with the code.
- **The cookie** is `__Host-Http-session`, with `Path=/; Secure; HttpOnly; SameSite=Strict`, which is what section 6.1.3.2 lists. This server keeps the tokens itself, so the cookie only names a session there. Section 6.1.2.3 also allows putting them in the cookie, signed and encrypted, and recommends keeping them on the server only for small deployments, so the screen says the page never has a token, not that the browser never does. Chromium keeps a `Secure` cookie on `http://localhost`, so the run needs no certificate. Other browsers were not tried.
- **What a script in the page can do,** asked of the real page after a login: `document.cookie` does not have the cookie, nothing in `localStorage` or `sessionStorage` looks like a token, and `fetch('/api/resource')` gets a 200 through the server. That last one is what section 5.1.4 calls proxying requests, and section 6.1.4.1 says nothing but stopping the script prevents it.
- **One thing only the recorder needs.** The page waits half a second before it leaves for the login, because Playwright could not read the answer to its question once the page had gone.

Not tried: a server that keeps the tokens in an encrypted cookie, refreshing a token from the server, which is not drawn with this choice yet, and whether a script could finish a login started from somewhere else and so act for the user after the page has closed. A claims audit by an AI agent raised that last one, so the screen does not say how long a script can act.

## Many customers, each with a provider, on a real server

Tried on Keycloak 26.8.1 on 2026-11-03 with throwaway scripts, not the recorder yet. One server with three realms: ours (`app`, with Organizations on), a customer on SAML (`acme`, another Keycloak realm acting as the SAML provider) and a customer on OpenID Connect (`globex`). A real Chromium logged in.

- **Organizations is on in the server and off in each realm.** The feature is listed as default and enabled, and a new realm has `organizationsEnabled: false`. Switched on, the browser flow gains an Organization step with "Organization Identity-First Login", and the first page asks only for a username or email.
- **How a user reaches their company, in 26.8.1.** Each of an organization's domains names a provider (`identityProviderAlias`) and whether to send people there (`autoRedirect`). The older settings on the provider itself (`kc.org.domain`, `kc.org.broker.redirect.mode.email-matches`) are accepted with a 204 and not kept. Without the redirect, typing `ann@acme.test` gives a password page with only Acme's button. With it, the browser goes straight to Acme. `kc_idp_hint=globex` skips our page altogether.
- **Domains.** An exact `acme.test` did not match `dan@eu.acme.test`, who got the ordinary page with every button. `*.acme.test` matched both `acme.test` and `eu.acme.test`.
- **Someone with a password here is not sent to their company.** `bob@acme.test` had an account of ours with a password and was not a member of the organization: he got the password page with every button, logged in with our password, and his token had no organization. So an account with a password of its own gets round the company's provider.
- **An email address we already know.** `cat@acme.test` had an account of ours with no password. After Acme's login: "Account already exists. User with email cat@acme.test already exists. How do you want to continue?", with "Review profile" and "Add to existing account". Not followed further.
- **A first login with the attributes mapped** asked nothing: the provider created the account and went on.
- **SAML through the browser.** Our provider sent a signed `AuthnRequest` by an auto-submitting form (HTTP-POST binding) asking for an email address as the NameID, with its broker endpoint as where to answer. Acme's answer came back the same way: a `SAMLResponse` of 6,483 characters of XML, the response signed and the assertion inside not signed on its own, not encrypted, with the NameID `ann@acme.test`, attributes `email`, `firstName`, `lastName` and six `Role` values from Acme's defaults, our provider's entity ID as the audience, valid for one minute, and a session of ten hours. The certificate is in it.
- **The app's side stays OpenID Connect.** The token comes from our provider, and with `scope=organization` it has `organization: ["acme"]`.
- **Someone leaving.** Acme disabled Ann. Then, at our provider: her old access token still worked at userinfo (200), her refresh token gave new tokens (200), and a login on the same browser got a code straight away without asking Acme. Only a browser with no session got as far as Acme, whose page said "Account is disabled, contact your administrator.", and our provider never heard back. Her account here stayed enabled. With the defaults, our session lasts up to 10 hours (idle 30 minutes, renewed when used), the access token 5 minutes.

Not tried: Acme ending the session itself (SAML single logout), what "Add to existing account" asks for, a customer on Entra ID or another real SAML product, and the app connecting to each customer directly instead.

**Recorded since, and asked by the recorder each run** (`companies` and `companies-saml`, and the answers `autoRedirect`, `companyDomains` and `passwordHere` in `questions.json`). The two recordings have 30 messages each, in the order the diagram draws them, and the tokens have the same claim names as with one other provider, with `organization` added because the app asked for that scope. In the 26.8.1 admin console the setting is under Organizations, the organization, Domains, as Auto redirect beside the identity provider, and the recorder checks it is there. The server guide says the same of credentials: someone who has one here is "not automatically redirected but asked to authenticate".

**Someone leaving, recorded since** (`companies-leaves` with SAML and `companies-oidc-leaves`, and the answer `whenSomeoneLeaves`): the same as the trial, with either kind of customer. After their company turned the account off, the API took the old token, a refresh gave new tokens, and the same browser got a code with no request to their company. Asked each run in a real browser with no session: their company's page says "Account is disabled, contact your administrator.", the account in the middle stays enabled, and the realm's session lasts 30 minutes unused and 10 hours in all. Not tried: what ends it sooner, such as an admin ending the session, or the company telling the provider by back-channel logout.

## A stolen DPoP token

Recorded on Keycloak 26.8.1 on 2026-11-03 (`dpop-thief` and `dpop-thief-bearer-only`). Keycloak issued a DPoP-bound access token, with the key's thumbprint in `cnf.jkt`, and someone else sent that same token as plain Bearer, with no proof. The demo API that checks the binding answered 401 with `invalid_token`. The same demo API with the binding not checked, standing in for an API written before DPoP, answered 200, and the app's own call there went as plain Bearer too, which section 7.2 allows. A real API that knows only Bearer could still refuse it for saying `typ` DPoP, which the stand-in does not. That second API is ours, not a product, and it is what RFC 9449 section 7.2 expects of one that knows only Bearer. Keycloak's own userinfo endpoint refuses such a token sent as Bearer, with a 401, which the recorder already asks (`userinfoWithDpopToken.asBearer`).

Not tried: an API behind a gateway that strips or rewrites the scheme, and mTLS, the other way of tying a token.

## A login link of theirs

Recorded on Keycloak 26.8.1 on 2026-11-03 (`their-link`, `their-link-any`, `their-link-any-public` and `their-link-any-public-pkce`), after a throwaway trial the same day with `site/*` as well. Someone else made the login link, for the real client ID, with `redirect_uri` at a site of their own, and a real Chromium opened it and logged in. With the client's exact address registered, Keycloak answered the link with 400 and Invalid parameter: redirect_uri, before any login page. With `*` registered, the user logged in as usual and the 302 went to their site with the code. An app with no secret then got tokens for them, 200, with or without PKCE, because they sent the challenge in their link and the verifier in the trade. The trial got the same with Require PKCE on. An app with a secret got 401 `unauthorized_client`, and the code still went to them. With `site/*`, the trial sent the code to another page on the same site, and refused another site.

Not tried: handing that code to the real app with a secret, which RFC 9700 section 4.1.1 says can be done by the injection in section 4.5. The code was issued for their address, so the real app's own trade would have to send that address too, and the demo app does not. Not tried either: a wildcard inside a host name.

## Pushed authorization requests on a real server

Tried on Keycloak 26.8.1 on 2026-11-04 in two throwaway trials, then recorded the same day (`par` and `par-public-pkce`), against RFC 9126 (Proposed Standard, September 2021). PAR needs no feature flag there. Discovery lists `pushed_authorization_request_endpoint`, at `/protocol/openid-connect/ext/par/request`, and says `require_pushed_authorization_requests` false, which it still said with one client that has to push.

- A confidential client's push, with its secret in Basic or in the body, got 201 with a `request_uri` of the form `urn:ietf:params:oauth:request_uri:` and a UUID, and `expires_in` 60. With no secret it got 401 `invalid_request`. A public client with PKCE got 201 with no secret.
- A push with an address the client does not have got 400 with Invalid parameter: redirect_uri. Once the client had that address, the same push got 201.
- The browser's request with only `client_id` and `request_uri` got a login, and the code came back with the `state` from the push. Values added to that request, a different `scope` and `state`, were ignored: the code still came back with the pushed `state`. The same `request_uri` a second time, and a made-up one, got Keycloak's error page with Invalid Request.
- Keycloak answers the browser's request with a 302 to its own login form, which the plain flow does not do. That hop is not drawn, and the login page's window shows the form's address, which has nothing the app asked for in it.
- With Pushed authorization request required on the client (`require.pushed.authorization.requests`), an ordinary link got a 302 back to the app with `error=invalid_request` and Pushed Authorization Request is only allowed. In the console it is under Clients, the client, Advanced, Advanced settings. How long a reference lasts is the realm's `parRequestUriLifespan`, under Realm settings, Tokens, as Lifetime of the Request URI for Pushed Authorization Request: set to 30, a push got `expires_in` 30.
- The token request was the usual one, with `redirect_uri` in it, and got tokens.

Not tried: a reference that has run out, which RFC 9126 section 4 says must be refused, PAR with DPoP or another provider, and signed request objects.
