# Authlines: links for an AI agent

Authlines draws OAuth and OpenID Connect flows as sequence diagrams, recorded from a real Keycloak 26.8.1. If you are an agent helping someone with their own system, you can link to the flow and settings that match it, open it on the step you are explaining, and put their names on the parties. They get a diagram to step through, with who has seen what, and the requests a real server sent.

Nothing here contacts their system. You describe it with a link, and the site draws its own recording with their names on it.

## The address

`https://vriesdemichael.github.io/authlines/<flow>/[setup/]?<settings and view>#v=1&<party>=<name>`

Leave out a setting to keep its default. The flow, its settings and the step are in the query, so the link opens exactly that. A setting that does not fit with the others is turned off, and the screen says why. A step these settings do not draw opens the nearest one before it that they do, and with no step it opens at the start.

## What is not drawn here

Authlines does not draw native and mobile apps, a PKCE downgrade, passkeys and WebAuthn, Kerberos, NTLM, or client certificates.

## Names for the parties

- They go after #, start with v=1, and name parties by the ids listed for each flow: #v=1&app=Payroll&idp=Entra%20ID.
- They change the names on the heads of the diagram and nothing else. Every request and answer shown stays the one recorded on the site’s own server, and the raw view says which recorded value is which named party.
- A name is plain text of at most 32 characters, in any language. No < or >, no address, nothing that looks like a token, and no characters that do not show, such as one that only changes the direction of text.
- Encode each name as a value in a query string: %20 or + for a space, %26 for &, %23 for #, and other letters as UTF-8.
- The part after # stays in the browser and never reaches a server. Anyone the link is shared with sees the names, so never put a secret in one.
- A party the flow has, but that these settings do not draw, is simply not shown. A party the flow does not have, or a name that does not fit, is left out and said, beside the diagram.

## Examples

- A web app on a server, logging people in with OpenID Connect and PKCE, at a provider that is not Keycloak. `https://vriesdemichael.github.io/authlines/authorization-code/?oidc=1&pkce=1&keycloak=off#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API`
- The same app, where the identity provider sends the code back through the browser, in advanced mode. `https://vriesdemichael.github.io/authlines/authorization-code/?mode=advanced&oidc=1&pkce=1&keycloak=off&step=redirect-with-code#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API`
- How that app gets set up with its provider. `https://vriesdemichael.github.io/authlines/authorization-code/setup/?oidc=1&pkce=1&keycloak=off#v=1&app=Payroll&idp=Entra%20ID&app-team=Payroll%20team&idp-admin=IT`
- A job with no user, calling an API with a token of its own. `https://vriesdemichael.github.io/authlines/client-credentials/#v=1&app=Nightly%20export&api=Billing%20API`
- A television app where the person logs in on their phone. `https://vriesdemichael.github.io/authlines/device/#v=1&app=Living%20room%20TV&browser=Their%20phone`
- A link with no version, which draws the site’s own names and says why. Not a link that works: `https://vriesdemichael.github.io/authlines/authorization-code/#app=Payroll`

## How it is shown

- `mode=advanced`: Raw requests and answers, which spec says so, and server notes.
- `step=<id>`: The step to open on, by the ids listed for each diagram.
- `say=specs`: The specs’ names for the parties. say=keycloak for Keycloak’s.
- `keycloak=off`: No notes about Keycloak. Use this when the person’s identity provider is something else, and give it its name with idp=. The traffic shown is still the site’s own Keycloak’s, and the raw view says so.
- `eyes=<party>`: The whole flow as one party saw it, such as eyes=browser, for a question about what one party can see. It works with step=.
- `whole=1`: Every step at once, for a room.

## Authorization code flow: `authorization-code`

An app gets access on behalf of a user, without ever seeing their password.

### Settings

Each value says what it needs with it, and what it can share a link with, worked out from the rules the screen uses, two settings at a time. A link that names two that do not go together loses one of them.

- `oidc=1`: OpenID Connect, off by default. `oidc=1` does not go with `register=dcr`, `thief=1`, `checks=bearer`, `directory=1`, `companies=1`, `speaks=saml`, `leaves=1`, `send=none`, `send=expired`, `send=changed`, `send=elsewhere`, `send=noscope`, `link=1`, `linkends=cancelled`, or `runs=bff`.
- `consent=1`: Ask for consent, off by default. `consent=1` goes only with `oidc=1`, `client=public`, `register=cimd`, `pkce=1`, `par=1`, `attacker=1`, `uses=real-app`, `binding=dpop`, `nonce=1`, `broker=1`, `upstream=v1`, `upstream=v2`, `reads=api`, `reads=refused`, `exchange=1`, `trade=refresh`, `refresh=1`, and `reuse=ends` among the other settings, so leave the rest out.
- `client=confidential | public`: Client type, confidential by default. `client=public` does not go with `register=dcr`, `thief=1`, `checks=bearer`, `uses=real-app`, `directory=1`, `companies=1`, `speaks=saml`, `leaves=1`, `upstream=v2`, `link=1`, `linkends=cancelled`, or `runs=bff`.
- `register=manual | dcr | cimd`: How the provider learns about the app, manual by default. `register=cimd` needs `consent=1&client=public&pkce=1` with it. `register=dcr` goes with none of the other settings yet, so leave them out. `register=cimd` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, and `broker=1` among the other settings, so leave the rest out.
- `pkce=1`: PKCE, off by default. `pkce=1` does not go with `register=dcr`, `thief=1`, `checks=bearer`, `directory=1`, `companies=1`, `speaks=saml`, `leaves=1`, `link=1`, or `linkends=cancelled`.
- `par=1`: PAR, off by default. Drawn so far with nothing else on but OpenID Connect, consent and PKCE, with either kind of client and the app on a server. `par=1` goes only with `oidc=1`, `consent=1`, `client=public`, and `pkce=1` among the other settings, so leave the rest out.
- `attacker=1`: An attacker, off by default. The attacker only shows the plain case, with a Bearer token and no other provider. `attacker=1` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `uses=real-app`, `gets=link`, and `registered=any` among the other settings, so leave the rest out.
- `thief=1`: Show someone using a stolen token, off by default. Only with a DPoP token, in the plain case so far. `thief=1` needs `binding=dpop` with it. `thief=1` goes only with `checks=bearer` and `binding=dpop` among the other settings, so leave the rest out.
- `checks=proof | bearer`: What the API checks, proof by default. Only someone using a stolen token asks this. `checks=bearer` needs `thief=1&binding=dpop` with it. `checks=bearer` goes only with `thief=1` and `binding=dpop` among the other settings, so leave the rest out.
- `uses=themselves | real-app`: What they do with it, themselves by default. Only an app with a secret needs this, and only for a copied code. With no secret, they can just trade it. `uses=real-app` needs `attacker=1` with it. `uses=real-app` goes only with `oidc=1`, `consent=1`, `pkce=1`, and `attacker=1` among the other settings, so leave the rest out.
- `gets=copy | link`: How they get the code, copy by default. Only in the plain case so far, with the app on a server. `gets=link` needs `attacker=1` with it. `gets=link` goes only with `oidc=1`, `client=public`, `pkce=1`, `attacker=1`, and `registered=any` among the other settings, so leave the rest out.
- `registered=exact | any`: What the app registered, exact by default. Only a link of theirs asks this. `registered=any` needs `attacker=1&gets=link` with it. `registered=any` goes only with `oidc=1`, `client=public`, `pkce=1`, `attacker=1`, and `gets=link` among the other settings, so leave the rest out.
- `binding=bearer | dpop`: Token type, bearer by default. `binding=dpop` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `thief=1`, `checks=bearer`, `nonce=1`, `broker=1`, and `upstream=v1` among the other settings, so leave the rest out.
- `nonce=1`: Server requires a nonce, off by default. A DPoP nonce only applies to DPoP tokens. `nonce=1` needs `binding=dpop` with it. `nonce=1` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `binding=dpop`, `broker=1`, and `upstream=v1` among the other settings, so leave the rest out.
- `broker=1`: External IdP, off by default. `broker=1` goes only with `oidc=1`, `consent=1`, `client=public`, `register=cimd`, `pkce=1`, `binding=dpop`, `nonce=1`, `companies=1`, `speaks=saml`, `leaves=1`, `upstream=v1`, `upstream=v2`, `reads=api`, `reads=refused`, `exchange=1`, `refresh=1`, and `sso=1` among the other settings, so leave the rest out.
- `directory=1`: Users in a directory, off by default. Only drawn in the plain case so far. `directory=1` goes with none of the other settings yet, so leave them out.
- `companies=1`: Each customer has a provider, off by default. Only with another provider, in the plain case so far. `companies=1` needs `broker=1` with it. `companies=1` goes only with `broker=1`, `speaks=saml`, and `leaves=1` among the other settings, so leave the rest out.
- `speaks=oidc | saml`: What their provider speaks, oidc by default. Only a customer's own provider is asked this. `speaks=saml` needs `broker=1&companies=1` with it. `speaks=saml` goes only with `broker=1`, `companies=1`, and `leaves=1` among the other settings, so leave the rest out.
- `leaves=1`: Someone leaves the company, off by default. Only someone at a customer with a provider of their own leaves it. `leaves=1` needs `broker=1&companies=1` with it. `leaves=1` goes only with `broker=1`, `companies=1`, and `speaks=saml` among the other settings, so leave the rest out.
- `upstream=off | v1 | v2`: Stored upstream tokens, off by default. Upstream tokens only exist when another IdP handles the login. `upstream=v1` needs `broker=1` with it. `upstream=v2` needs `broker=1` with it. `upstream=v1` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `binding=dpop`, `nonce=1`, and `broker=1` among the other settings, so leave the rest out. `upstream=v2` goes only with `oidc=1`, `consent=1`, `pkce=1`, `broker=1`, `reads=api`, and `reads=refused` among the other settings, so leave the rest out.
- `reads=app | api | refused`: Who reads it, app by default. This is drawn with API V2, where whoever reads the token proves who it is. `reads=api` needs `broker=1&upstream=v2` with it. `reads=refused` needs `broker=1&upstream=v2` with it. `reads=api` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `broker=1`, and `upstream=v2` among the other settings, so leave the rest out. `reads=refused` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `broker=1`, and `upstream=v2` among the other settings, so leave the rest out.
- `send=good | none | expired | changed | elsewhere | noscope`: What the API is sent, good by default. This shows the plain case, so other settings do not get in the way of the answer. `send=none` goes only with `client=public` and `pkce=1` among the other settings, so leave the rest out. `send=expired` goes only with `client=public` and `pkce=1` among the other settings, so leave the rest out. `send=changed` goes only with `client=public` and `pkce=1` among the other settings, so leave the rest out. `send=elsewhere` goes only with `client=public` and `pkce=1` among the other settings, so leave the rest out. `send=noscope` goes only with `client=public` and `pkce=1` among the other settings, so leave the rest out.
- `exchange=1`: Token exchange, off by default. Drawn so far with nothing else on but OpenID Connect, consent, PKCE and another provider, with either kind of client and the app on a server. `exchange=1` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `broker=1`, and `trade=refresh` among the other settings, so leave the rest out.
- `trade=token | refresh`: What the trade gives back, token by default. There is nothing to trade until token exchange is on. `trade=refresh` needs `exchange=1` with it. `trade=refresh` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, and `exchange=1` among the other settings, so leave the rest out.
- `link=1`: Account linking, off by default. Drawn so far only on the plain flow, for an app with a secret and nothing else on. `link=1` goes only with `linkends=cancelled` among the other settings, so leave the rest out.
- `linkends=linked | cancelled`: How the link ends, linked by default. There is no link to end until account linking is on. `linkends=cancelled` needs `link=1` with it. `linkends=cancelled` goes only with `link=1` among the other settings, so leave the rest out.
- `refresh=1`: When the token runs out, off by default. This shows the plain case, so other settings do not get in the way of the answer. `refresh=1` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, `broker=1`, and `reuse=ends` among the other settings, so leave the rest out.
- `reuse=keeps | ends`: Using a refresh token twice, keeps by default. There is no second use until the token runs out and the first has happened. `reuse=ends` needs `refresh=1` with it. `reuse=ends` goes only with `oidc=1`, `consent=1`, `client=public`, `pkce=1`, and `refresh=1` among the other settings, so leave the rest out.
- `sso=1`: A second app, off by default. This shows the plain case, so other settings do not get in the way of the answer. `sso=1` goes only with `oidc=1`, `client=public`, `pkce=1`, `broker=1`, `second=insists`, `second=fresh`, and `logout=1` among the other settings, so leave the rest out.
- `second=remembered | insists | fresh`: What happens at the second app, remembered by default. There is no second app until it has been brought on. `second=insists` needs `oidc=1&sso=1` with it. `second=fresh` needs `oidc=1&sso=1` with it. `second=insists` goes only with `oidc=1`, `client=public`, `pkce=1`, and `sso=1` among the other settings, so leave the rest out. `second=fresh` goes only with `oidc=1`, `client=public`, `pkce=1`, and `sso=1` among the other settings, so leave the rest out.
- `logout=1`: Log out, off by default. It is part of OpenID Connect. `logout=1` needs `oidc=1` with it. `logout=1` goes only with `oidc=1`, `client=public`, `pkce=1`, and `sso=1` among the other settings, so leave the rest out.
- `runs=server | page | bff`: Where the app runs, server by default. `runs=page` needs `client=public` with it. `runs=bff` needs `pkce=1` with it. `runs=page` goes only with `oidc=1`, `client=public`, and `pkce=1` among the other settings, so leave the rest out. `runs=bff` goes only with `pkce=1` among the other settings, so leave the rest out.
- `address=registered | other`: The address the app asks for, registered by default. It stops before any of those would matter. `address=other` goes only with `oidc=1`, `client=public`, and `pkce=1` among the other settings, so leave the rest out.

### Authorization code flow: `https://vriesdemichael.github.io/authlines/authorization-code/`

Parties, for the names after #:

- `browser`: User's browser, where the user is. With `runs=page` it is drawn as Browser and app. With `runs=bff` it is drawn as Browser and page.
- `app`: App, what the user uses. Not with `runs=page`. With `runs=bff` it is drawn as App’s server.
- `second-app`: Second app, same provider. Only with `sso=1`.
- `idp`: Identity provider, logs users in.
- `attacker`: Someone else, has no business here. Only with `attacker=1`.
- `directory`: User directory, has the users. Only with `directory=1`.
- `upstream`: Other provider, the other account. Only with `broker=1` or `link=1`. With `companies=1` or `speaks=saml` or `leaves=1` it is drawn as Their company.
- `api`: API, has the data.
- `second-api`: Second API, the api calls it. Only with `exchange=1`.

Steps, for step=:

- `open-app`: The user opens the app. Not with `gets=link` or `registered=any`.
- `redirect-to-idp`: The app sends them to log in. Not with `gets=link` or `registered=any` or `runs=page`.
- `authorize`: The browser asks to log in.
- `login-page`: The login page. Not with `gets=link` or `broker=1` or `companies=1` or `speaks=saml` or `leaves=1` or `upstream=v1` or `upstream=v2` or `reads=api` or `reads=refused` or `address=other`.
- `submit-credentials`: The user enters their password. Not with `gets=link` or `broker=1` or `companies=1` or `speaks=saml` or `leaves=1` or `upstream=v1` or `upstream=v2` or `reads=api` or `reads=refused` or `address=other`.
- `redirect-with-code`: Sent back with a one-time code. Not with `gets=link` or `address=other`.
- `callback`: The code reaches the app. Not with `gets=link` or `registered=any` or `address=other`.
- `token-request`: The app trades the code for tokens. Not with `gets=link` or `registered=any` or `address=other`.
- `token-response`: An access token. Not with `uses=real-app` or `gets=link` or `registered=any` or `address=other`.
- `api-request`: The app calls the API with the token. Not with `uses=real-app` or `gets=link` or `registered=any` or `address=other`.
- `api-check-token`: The API checks the token. Not with `uses=real-app` or `gets=link` or `registered=any` or `address=other`.
- `api-response`: The API answers. Not with `uses=real-app` or `gets=link` or `registered=any` or `address=other`.
- `validate-id-token`: The app checks the ID token. Only with `oidc=1`.
- `userinfo-request`: The app asks about the user. Only with `oidc=1`.
- `userinfo-response`: Details about the user. Only with `oidc=1`.
- `consent-page`: What the app is asking for. Only with `consent=1`.
- `consent-grant`: The user agrees. Only with `consent=1`.
- `make-verifier`: The app makes up a one-time value. Only with `pkce=1`.
- `check-verifier`: It checks the one-time value. Only with `pkce=1`.
- `push-request`: The app sends its request ahead. Only with `par=1`.
- `push-response`: A reference to it comes back. Only with `par=1`.
- `attacker-steals-code`: Someone else copies the code. Only with `attacker=1`.
- `attacker-token-request`: They try to trade it for tokens. Only with `attacker=1`.
- `attacker-token-response`: Refused: they have no secret. Only with `attacker=1`.
- `generate-key`: The app makes a key pair. Only with `binding=dpop`.
- `redirect-to-upstream`: Sent on to the other provider. Only with `broker=1`.
- `upstream-authorize`: The browser asks to log in there. Only with `broker=1`.
- `upstream-sign-in`: The user enters their password there. Only with `broker=1`.
- `upstream-redirect-back`: Sent back with a code. Only with `broker=1`.
- `upstream-callback`: The code reaches the identity provider. Only with `broker=1`.
- `upstream-token-request`: It trades the code for tokens. Only with `broker=1`.
- `upstream-token-response`: Tokens for the identity provider. Only with `broker=1`.
- `match-user`: It links this person to a user. Only with `broker=1`.
- `directory-search`: It looks the user up in the directory. Only with `directory=1`.
- `directory-found`: Who that is. Only with `directory=1`.
- `directory-bind`: It tries the password on the directory. Only with `directory=1`.
- `directory-bound`: The password is right. Only with `directory=1`.
- `exchange-request`: The API trades it for one for the second API. Only with `exchange=1`.
- `exchange-response`: A token for the second API comes back. Only with `exchange=1`.
- `second-api-request`: The API calls the second API with it. Only with `exchange=1`.
- `second-api-response`: The second API answers. Only with `exchange=1`.
- `link-start`: The user asks to link another account. Only with `link=1`.
- `link-ask`: The app sends them to the identity provider to link it. Only with `link=1`.
- `link-authorize`: The browser asks the identity provider for the link. Only with `link=1`.
- `link-confirm-page`: The identity provider asks whether to link it. Only with `link=1`.
- `link-confirm`: The user goes on. Only with `link=1`.
- `link-to-upstream`: Sent on to the other provider. Only with `link=1`.
- `link-upstream-authorize`: The browser asks to log in there. Only with `link=1`.
- `link-upstream-sign-in`: The user enters their password there. Only with `link=1`.
- `link-upstream-back`: Sent back with a code. Only with `link=1`.
- `link-upstream-callback`: The code reaches the identity provider. Only with `link=1`.
- `link-upstream-token-request`: It trades the code for tokens. Only with `link=1`.
- `link-upstream-token-response`: Tokens for the identity provider. Only with `link=1`.
- `link-store`: It keeps the link, and those tokens. Only with `link=1`.
- `link-done`: Back to the app, linked. Only with `link=1`.
- `link-callback`: The app is told how it went. Only with `link=1`.
- `token-runs-out`: Later, the access token runs out. Only with `refresh=1`.
- `api-request-again`: The app calls the API with the same token. Only with `refresh=1`.
- `api-refused`: The API refuses: the token has expired. Only with `refresh=1`.
- `refresh-request`: The app sends its refresh token. Only with `refresh=1`.
- `refresh-response`: A new access token and a new refresh token. Only with `refresh=1`.
- `api-request-new`: The app calls the API with the new token. Only with `refresh=1`.
- `api-response-new`: The API answers. Only with `refresh=1`.
- `refresh-again`: The old refresh token is sent again. Only with `refresh=1`.
- `refresh-again-response`: It still works. Only with `refresh=1`.
- `second-open-app`: The user opens a second app. Only with `sso=1`.
- `second-redirect-to-idp`: It sends them to log in. Only with `sso=1`.
- `second-authorize`: The browser asks to log in, and its session goes along. Only with `sso=1`.
- `idp-recognises`: It knows this browser, so no form. Only with `sso=1`.
- `second-redirect-with-code`: Sent back with a code, and no password. Only with `sso=1`.
- `second-callback`: The code reaches the app. Only with `sso=1`.
- `second-token-request`: The app trades the code for tokens. Only with `sso=1`.
- `second-token-response`: Its own tokens. Only with `sso=1`.
- `address-refused`: It refuses, and says so. Only with `address=other`.
- `logout-start`: The user presses log out. Only with `oidc=1&logout=1`.
- `app-forgets`: The app forgets the user. Only with `oidc=1&logout=1`.
- `logout-redirect`: It sends the browser to log out. Only with `oidc=1&logout=1`.
- `end-session`: The browser asks to log out, and its session goes along. Only with `oidc=1&logout=1`.
- `session-ended`: It ends the session. Only with `oidc=1&logout=1`.
- `logout-redirect-back`: Sent back to the app. Only with `oidc=1&logout=1`.
- `logged-out`: The user is back, and logged out. Only with `oidc=1&logout=1`.
- `token-after-logout`: The same token, at an API that only looks at it. Only with `oidc=1&logout=1`.
- `token-after-logout-response`: It still works. Only with `oidc=1&logout=1`.
- `asks-after-logout`: The same token, at an API that asks the server. Only with `oidc=1&logout=1`.
- `introspect`: The API asks the identity provider about it. Only with `oidc=1&logout=1`.
- `introspect-response`: It is no longer good. Only with `oidc=1&logout=1`.
- `asks-after-logout-response`: The API refuses. Only with `oidc=1&logout=1`.
- `refresh-after-logout`: The refresh token is tried. Only with `oidc=1&logout=1`.
- `refresh-after-logout-response`: Refused: the session is over. Only with `oidc=1&logout=1`.
- `attacker-api-request`: They call the API as the user. Only with `client=public&attacker=1`.
- `attacker-api-response`: The API answers them. Only with `client=public&attacker=1`.
- `real-app-refused`: The real app is refused. Only with `client=public&attacker=1` or `attacker=1&uses=real-app`.
- `page-goes-to-log-in`: The page sends them to log in. Only with `client=public&runs=page`.
- `page-served`: The page. Only with `pkce=1&runs=bff`.
- `session-check`: The page asks if anyone is logged in. Only with `pkce=1&runs=bff`.
- `no-session`: Nobody yet. Only with `pkce=1&runs=bff`.
- `bff-login`: The page sends the browser to its server. Only with `pkce=1&runs=bff`.
- `set-session`: The browser gets a cookie, not tokens. Only with `pkce=1&runs=bff`.
- `page-calls-api`: The page asks its server for the data. Only with `pkce=1&runs=bff`.
- `page-gets-answer`: The server hands the answer to the page. Only with `pkce=1&runs=bff`.
- `attacker-opens-app`: They open the real app themselves. Only with `attacker=1&uses=real-app`.
- `attacker-sent-to-login`: The app starts a login for them. Only with `attacker=1&uses=real-app`.
- `attacker-hands-code`: They hand it the stolen code. Only with `attacker=1&uses=real-app`.
- `handed-token-request`: The app trades the code, with its secret. Only with `attacker=1&uses=real-app`.
- `handed-token-response`: Tokens for the real user. Only with `attacker=1&uses=real-app`.
- `attacker-handed-answer`: They are logged in as the real user. Only with `attacker=1&uses=real-app`.
- `attacker-makes-link`: Someone makes a login link for the app. Only with `attacker=1&gets=link`.
- `attacker-sends-link`: They get the user to open it. Only with `attacker=1&gets=link`.
- `thief-has-token`: Someone else has the access token. Only with `thief=1&binding=dpop`.
- `thief-api-request`: They call the API with it, and no proof. Only with `thief=1&binding=dpop`.
- `thief-api-response`: Refused: it needs a proof. Only with `thief=1&binding=dpop`.
- `nonce-challenge`: The server asks for a fresh proof. Only with `binding=dpop&nonce=1`.
- `token-request-retry`: The app tries again. Only with `binding=dpop&nonce=1`.
- `email-page`: A page that asks only for an email. Only with `broker=1&companies=1`.
- `submit-email`: The user enters their email. Only with `broker=1&companies=1`.
- `find-company`: It finds their company from the email. Only with `broker=1&companies=1`.
- `store-upstream-tokens`: It keeps those tokens. Only with `broker=1&upstream=v1` or `broker=1&upstream=v2`.
- `retrieve-upstream-token`: The app asks for the other provider's token. Only with `broker=1&upstream=v1` or `broker=1&upstream=v2`.
- `upstream-token`: The identity provider hands it over. Only with `broker=1&upstream=v1` or `broker=1&upstream=v2`.
- `call-upstream`: The app calls the other provider. Only with `broker=1&upstream=v1` or `broker=1&upstream=v2`.
- `trade-runs-out`: Later, the token for the second API runs out. Only with `exchange=1&trade=refresh`.
- `trade-refresh-request`: The API sends the refresh token from the trade. Only with `exchange=1&trade=refresh`.
- `trade-refresh-response`: A new token for the second API. Only with `exchange=1&trade=refresh`.
- `refresh-newest`: The app sends its newest refresh token. Only with `refresh=1&reuse=ends`.
- `refresh-newest-response`: Refused too: the app has to start a new login. Only with `refresh=1&reuse=ends`.
- `handed-nonce-check`: The app checks the ID token, and it is for another login. Only with `oidc=1&attacker=1&uses=real-app`.
- `second-login-page`: The login page, again. Only with `oidc=1&sso=1&second=insists`.
- `second-submit-credentials`: The user enters their password again. Only with `oidc=1&sso=1&second=insists`.
- `backchannel-logout`: It tells the second app. Only with `oidc=1&sso=1&logout=1`.
- `backchannel-response`: It says it has logged them out. Only with `oidc=1&sso=1&logout=1`.
- `code-to-attacker`: The code reaches them. Only with `attacker=1&gets=link&registered=any`.
- `company-turns-off`: Their company turns their account off. Only with `broker=1&companies=1&leaves=1`.
- `left-api-request`: The app calls the API, with the same token. Only with `broker=1&companies=1&leaves=1`.
- `left-api-response`: It still answers. Only with `broker=1&companies=1&leaves=1`.
- `left-refresh`: The app asks for new tokens. Only with `broker=1&companies=1&leaves=1`.
- `left-refresh-response`: New tokens, without asking their company. Only with `broker=1&companies=1&leaves=1`.
- `login-again`: The same browser logs in again. Only with `broker=1&companies=1&leaves=1`.
- `code-again`: A code, without asking their company. Only with `broker=1&companies=1&leaves=1`.
- `api-retrieve-upstream-token`: The API asks for the user’s token at the other provider. Only with `broker=1&upstream=v2&reads=api` or `broker=1&upstream=v2&reads=refused`.
- `api-upstream-token`: The identity provider hands it to the API. Only with `broker=1&upstream=v2&reads=api`.
- `api-call-upstream`: The API calls the other provider. Only with `broker=1&upstream=v2&reads=api`.
- `api-upstream-refused`: The identity provider refuses: this API is not allowed it. Only with `broker=1&upstream=v2&reads=refused`.
- `cimd-fetch`: The identity provider fetches the app’s document. Only with `consent=1&client=public&register=cimd&pkce=1`.
- `cimd-document`: What the document says. Only with `consent=1&client=public&register=cimd&pkce=1`.

### Setting up the authorization code flow: `https://vriesdemichael.github.io/authlines/authorization-code/setup/`

Parties, for the names after #:

- `app-team`: You, the app team.
- `app`: App, the one being set up.
- `idp`: Identity provider, will log users in.
- `idp-admin`: Admin, runs the provider.
- `upstream`: Other provider, the other account. Only with `broker=1` or `link=1`. With `companies=1` or `speaks=saml` or `leaves=1` it is drawn as Their company.
- `customer-admins`: Their admins, at the customer. Only with `broker=1&companies=1`.
- `api`: API, will check tokens.
- `second-api`: Second API, checks tokens too. Only with `exchange=1`.

Steps, for step=:

- `register-client`: Ask to register the app. Not with `register=dcr` or `register=cimd`.
- `create-client`: Create the client. Not with `register=dcr` or `register=cimd`.
- `hand-over-credentials`: Hand over the client ID and secret. Not with `register=dcr` or `register=cimd`.
- `configure-app`: Configure the app.
- `discover`: The app looks up the provider's addresses.
- `discovery-document`: Where everything is.
- `configure-api`: You tell the API who to trust.
- `fetch-keys`: The API gets the keys.
- `keys`: The keys that check tokens.
- `dcr-make-token`: Create a token for registering. Only with `register=dcr`.
- `dcr-hand-token`: Hand over the token. Only with `register=dcr`.
- `dcr-request`: The app asks to be registered. Only with `register=dcr`.
- `dcr-response`: Its client ID and secret. Only with `register=dcr`.
- `register-with-upstream`: Register with the other provider. Only with `broker=1` or `link=1`.
- `connect-directory`: Connect the directory. Only with `directory=1`.
- `allow-exchange`: Let the API trade tokens. Only with `exchange=1`.
- `configure-second-api`: You tell the second API who to trust. Only with `exchange=1`.
- `add-provider-for-linking`: Add the other provider, to link accounts with. Only with `link=1`.
- `send-our-details`: Send them our provider's details. Only with `broker=1&companies=1`.
- `customer-registers-us`: They register our provider. Only with `broker=1&companies=1`.
- `send-their-details`: They send their provider's details. Only with `broker=1&companies=1`.
- `add-organization`: Add them as a customer, with their domain. Only with `broker=1&companies=1`.
- `enable-token-storage`: Allow keeping its tokens. Only with `broker=1&upstream=v1` or `broker=1&upstream=v2`.
- `cimd-allow`: Allow apps to point at a document. Only with `consent=1&client=public&register=cimd&pkce=1`.
- `cimd-host`: Host a document about the app. Only with `consent=1&client=public&register=cimd&pkce=1`.

## Client credentials flow: `client-credentials`

An app gets access for itself, with no user and no browser.

### Settings

Each value says what it needs with it, and what it can share a link with, worked out from the rules the screen uses, two settings at a time. A link that names two that do not go together loses one of them.

- `binding=bearer | dpop`: Token type, bearer by default.

### Client credentials flow: `https://vriesdemichael.github.io/authlines/client-credentials/`

Parties, for the names after #:

- `app`: App, acts for itself.
- `idp`: Identity provider, hands out tokens.
- `api`: API, has the data.

Steps, for step=:

- `service-token-request`: The app asks for a token, as itself.
- `service-token-response`: An access token.
- `service-api-request`: The app calls the API with the token.
- `service-check-token`: The API checks the token.
- `service-api-response`: The API answers.
- `service-make-key`: The app makes a key pair. Only with `binding=dpop`.

### Setting up the client credentials flow: `https://vriesdemichael.github.io/authlines/client-credentials/setup/`

Parties, for the names after #:

- `app-team`: You, the app team.
- `app`: App, the one being set up.
- `idp`: Identity provider, will hand out tokens.
- `idp-admin`: Admin, runs the provider.
- `api`: API, will check tokens.

Steps, for step=:

- `service-register`: Ask to register the app.
- `service-create-client`: Create the client.
- `service-hand-over`: Hand over the client ID and secret.
- `service-configure`: Configure the app.
- `service-discover`: The app looks up the provider's addresses.
- `service-discovery-document`: Where everything is.
- `service-configure-api`: You tell the API who to trust.
- `service-fetch-keys`: The API gets the keys.
- `service-keys`: The keys that check tokens.

## Device flow: `device`

An app with no good way to log anyone in, and a user who does that on another device.

### Settings

Each value says what it needs with it, and what it can share a link with, worked out from the rules the screen uses, two settings at a time. A link that names two that do not go together loses one of them.

- `oidc=1`: OpenID Connect, off by default.
- `ends=agrees | says-no | runs-out`: How it ends, agrees by default. `ends=says-no` does not go with `misuse=reads-code`. `ends=runs-out` does not go with `misuse=reads-code`.
- `misuse=nobody | sends-code | reads-code`: Someone misusing it, nobody by default. `misuse=reads-code` goes only with `oidc=1` among the other settings, so leave the rest out.

### Device flow: `https://vriesdemichael.github.io/authlines/device/`

Parties, for the names after #:

- `browser`: User's browser, on another device.
- `app`: App, on a tv, say. Not with `misuse=sends-code`.
- `attacker`: Someone else, has no business here. Only with `misuse=sends-code` or `misuse=reads-code`.
- `idp`: Identity provider, logs users in.
- `api`: API, has the data.

Steps, for step=:

- `device-request`: The app asks for a code to show. Not with `misuse=sends-code`.
- `device-response`: Two codes, and where to go. Not with `misuse=sends-code`.
- `device-show-code`: The app shows an address and a code. Not with `misuse=sends-code`.
- `device-poll`: The app asks whether the user is done. Not with `misuse=sends-code`.
- `device-pending`: Not yet. Not with `misuse=sends-code`.
- `device-open-page`: The user opens the address. Not with `ends=runs-out`.
- `device-code-page`: It asks for the user code. Not with `ends=runs-out`.
- `device-submit-code`: The user types it in. Not with `ends=runs-out`.
- `device-login-page`: The login page. Not with `ends=runs-out` or `misuse=reads-code`.
- `device-submit-credentials`: The user enters their password. Not with `ends=runs-out` or `misuse=reads-code`.
- `device-consent-page`: What the app is asking for. Not with `ends=runs-out` or `misuse=reads-code`.
- `device-consent-grant`: The user agrees. Not with `ends=says-no` or `ends=runs-out` or `misuse=reads-code`.
- `device-done-page`: Done, back to the device. Not with `ends=says-no` or `ends=runs-out` or `misuse=reads-code`.
- `device-poll-again`: The app asks again. Not with `misuse=sends-code`.
- `device-token-response`: An access token. Not with `ends=says-no` or `ends=runs-out` or `misuse=sends-code`.
- `device-api-request`: The app calls the API with the token. Not with `ends=says-no` or `ends=runs-out` or `misuse=sends-code`.
- `device-check-token`: The API checks the token. Not with `ends=says-no` or `ends=runs-out`.
- `device-api-response`: The API answers. Not with `ends=says-no` or `ends=runs-out` or `misuse=sends-code`.
- `device-check-id-token`: The app checks the ID token. Only with `oidc=1`.
- `device-consent-deny`: The user says no. Only with `ends=says-no`.
- `device-denied-page`: It says the device was not connected. Only with `ends=says-no`.
- `device-denied-response`: The user said no. Only with `ends=says-no`.
- `device-time-passes`: Later, the codes run out. Only with `ends=runs-out`.
- `device-expired-response`: Too late. Only with `ends=runs-out`.
- `sent-request`: They ask for a code, as an app would. Only with `misuse=sends-code`.
- `sent-response`: Two codes, and where to go. Only with `misuse=sends-code`.
- `sent-the-code`: They send the user the address and the user code. Only with `misuse=sends-code`.
- `sent-poll`: They ask whether the user is done. Only with `misuse=sends-code`.
- `sent-pending`: Not yet. Only with `misuse=sends-code`.
- `sent-poll-again`: They ask again. Only with `misuse=sends-code`.
- `sent-token-response`: They get the tokens. Only with `misuse=sends-code`.
- `sent-api-request`: They call the API as the user. Only with `misuse=sends-code`.
- `sent-api-response`: The API answers. Only with `misuse=sends-code`.
- `read-the-code`: Someone else reads the user code off the screen. Only with `misuse=reads-code`.
- `read-submit-code`: They enter the user code first. Only with `misuse=reads-code`.
- `read-submit-credentials`: They log in, as themselves. Only with `misuse=reads-code`.
- `read-agree`: They agree. Only with `misuse=reads-code`.
- `read-code-refused`: It says the user code is not valid. Only with `misuse=reads-code`.
- `sent-denied-response`: The user said no. Only with `ends=says-no&misuse=sends-code`.
- `sent-time-passes`: Later, the codes run out. Only with `ends=runs-out&misuse=sends-code`.
- `sent-expired-response`: Too late. Only with `ends=runs-out&misuse=sends-code`.

### Setting up the device flow: `https://vriesdemichael.github.io/authlines/device/setup/`

Parties, for the names after #:

- `app-team`: You, the app team.
- `app`: App, the one being set up.
- `idp`: Identity provider, will log users in.
- `idp-admin`: Admin, runs the provider.
- `api`: API, will check tokens.

Steps, for step=:

- `device-register`: Ask to register the app.
- `device-create-client`: Create the client.
- `device-hand-over`: Hand over the client ID.
- `device-configure`: Configure the app.
- `device-discover`: The app looks up the provider's addresses.
- `device-discovery-document`: Where everything is.
- `device-configure-api`: You tell the API who to trust.
- `device-fetch-keys`: The API gets the keys.
- `device-keys`: The keys that check tokens.
