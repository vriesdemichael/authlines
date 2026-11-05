---
name: authlines
description: "Links to Authlines, OAuth and OpenID Connect flows drawn as sequence diagrams and recorded from a real Keycloak, opened on the flow, settings and step that match the user's own system, with their names on the parties. Use when explaining how login, tokens, PKCE, redirects, consent, single sign-on, an identity provider's setup, a service calling an API with its own token, or logging in on another device works for their app, or why a step is there."
license: CC-BY-4.0
---

# Linking to Authlines

Authlines draws OAuth and OpenID Connect flows as sequence diagrams, recorded from a real Keycloak 26.8.1. If you are an agent helping someone with their own system, you can link to the flow and settings that match it, open it on the step you are explaining, and put their names on the parties. They get a diagram to step through, with who has seen what, and the requests a real server sent.

When you explain one of these flows for the user’s own system, add one link that opens the matching flow on the step you are explaining, with their names on the parties. Say once in the conversation that the names on the diagram are theirs, and that what it shows was recorded on the site’s own server, not on theirs.

## Writing the link

`https://vriesdemichael.github.io/authlines/<flow>/[setup/]?<settings and view>#v=1&<party>=<name>`

1. Pick the flow:
   - `authorization-code`: An app gets access on behalf of a user, without ever seeing their password. How it is set up, before anyone logs in, is at `authorization-code/setup/`.
   - `client-credentials`: An app gets access for itself, with no user and no browser. How it is set up, before anyone logs in, is at `client-credentials/setup/`.
   - `device`: An app with no good way to log anyone in, and a user who does that on another device. How it is set up, before anyone logs in, is at `device/setup/`.
2. Add the settings that match their system, and leave the rest out. Add `oidc=1` when the app logs people in to know who they are, because without it the flow only gets access to an API. Some settings need another with them, and some do not go with others. A link loses what does not fit, so check the reference for each value you add.
3. Add `step=<id>` for the step you are explaining, and leave it out for a question about the whole flow. The reference says which settings each step needs.
4. Add their names after #, starting with `v=1`, by the party ids the reference lists. It says which settings draw each party, and a name for one that is not drawn does not show.
5. If their identity provider is not Keycloak, or they do not say which it is, add `keycloak=off`, and name it with `idp=` if you know it. If it is Keycloak, keep the notes about it, and you can still give it their name for it.
6. Match what they told you. Where they did not say, pick what current advice has, such as `pkce=1` for an app with no secret, and say that you did.
7. Add `mode=advanced` when they ask what is sent, which parameters, or which spec says so. Leave it out for how and why.

Leave out a setting to keep its default. The flow, its settings and the step are in the query, so the link opens exactly that. A setting that does not fit with the others is turned off, and the screen says why. A step these settings do not draw opens the nearest one before it that they do, and with no step it opens at the start.

## What is not drawn here

Do not link to something near it. Say that Authlines does not draw apps on a phone, a PKCE downgrade, passkeys and WebAuthn, Kerberos, NTLM, or client certificates.

## Names for the parties

- They go after #, start with v=1, and name parties by the ids listed for each flow: #v=1&app=Payroll&idp=Entra%20ID.
- They change the names on the heads of the diagram and nothing else. Every request and answer shown stays the one recorded on the site’s own server, and the raw view says which recorded value is which named party.
- A name is plain text of at most 32 characters, in any language. No < or >, no address, nothing that looks like a token, and no characters that do not show, such as one that only changes the direction of text.
- Encode each name as a value in a query string: %20 or + for a space, %26 for &, %23 for #, and other letters as UTF-8.
- The part after # stays in the browser and never reaches a server. Anyone the link is shared with sees the names, so never put a secret in one.
- A party the flow has, but that these settings do not draw, is simply not shown. A party the flow does not have, or a name that does not fit, is left out and said, beside the diagram.

## How it is shown

- `mode=advanced`: Raw requests and answers, which spec says so, and server notes.
- `step=<id>`: The step to open on, by the ids listed for each diagram.
- `say=specs`: The specs’ names for the parties. say=keycloak for Keycloak’s.
- `keycloak=off`: No notes about Keycloak. Use this when the person’s identity provider is something else, and give it its name with idp=. The traffic shown is still the site’s own Keycloak’s, and the raw view says so.
- `eyes=<party>`: The whole flow as one party saw it, such as eyes=browser, for a question about what one party can see. It works with step=.
- `whole=1`: Every step at once, for a room.

## Examples

- A web app on a server, logging people in with OpenID Connect and PKCE, at a provider that is not Keycloak. `https://vriesdemichael.github.io/authlines/authorization-code/?oidc=1&pkce=1&keycloak=off#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API`
- The same app, where the identity provider sends the code back through the browser, in advanced mode. `https://vriesdemichael.github.io/authlines/authorization-code/?mode=advanced&oidc=1&pkce=1&keycloak=off&step=redirect-with-code#v=1&app=Payroll&idp=Entra%20ID&api=HR%20API`
- How that app gets set up with its provider. `https://vriesdemichael.github.io/authlines/authorization-code/setup/?oidc=1&pkce=1&keycloak=off#v=1&app=Payroll&idp=Entra%20ID&app-team=Payroll%20team&idp-admin=IT`
- A job with no user, calling an API with a token of its own. `https://vriesdemichael.github.io/authlines/client-credentials/#v=1&app=Nightly%20export&api=Billing%20API`
- A television app where the person logs in on their phone. `https://vriesdemichael.github.io/authlines/device/#v=1&app=Living%20room%20TV&browser=Their%20phone`

## The reference

[The reference](references/reference.md) lists every flow’s settings, parties and steps. The site keeps a current copy at https://vriesdemichael.github.io/authlines/for-agents/index.html.md. If a link you write does not open what you meant, the site may have changed since this copy, so read that one.
