# ADR-005: Payloads are recorded from a real server and never invented

Every request and response the application shows, and everything `Execute` replays, was recorded from a real server that speaks the protocol. That is Keycloak for OAuth and OpenID Connect. Fitting Keycloak is a convenience and not a limit, as the maintainer decided on 2026-11-02, and the old way is recorded from the demo app and API, where the app takes a password from a form and the API takes it over HTTP Basic, with no identity provider in it. When a combination of settings has no recording, the application says so and shows no payload. Do not assemble a payload from fragments or write one by hand.

Recordings run against a plain Keycloak container, with a client on Keycloak's defaults unless the setting under test changes it. Each recording is one real run, so the code returned in one step is the code sent in the next without any simulation. `pnpm record` makes one per named state in `static/recordings/`, with a small demo app and API driven by a headless browser, a second realm as the upstream IdP, and a proxy to capture what Keycloak sends that upstream. It also tries the things the diagram makes a claim about and writes down what happened, in `questions.json`.

The demo app and API do what the steps say they do: the app looks up its endpoints from the issuer, compares `state` and validates the ID token, and the API checks the signature, the issuer, the expiry, the audience and a DPoP proof, and on one address the scope. Those checks are in `scripts/record/checks.ts`, with tests that try to get past them, and a run stops if one fails, so a success in a recording means they looked. Each run gets a new client and provider with these settings and otherwise Keycloak's defaults, so a setting that is off really is off.

A test holds the flow data to the recordings in both directions: every message and field the diagram draws is in the recording, nothing else is there apart from what is only Keycloak's business, and each credential and token appears in exactly the messages the diagram says. When a real Keycloak does not do something the spec allows, the step says `specOnly` and the application marks it, because a message that was not recorded must not look like one that was.

The screen claims no more than that. The header says what is on screen was recorded, and from which server, and on a diagram with people on it it claims only the HTTP. The raw view says so on every message. A step adds to that only when it is an exception: it came from the demo app and API, which the server had no part in, it was recorded with other settings because this combination has no recording, or it is only from the spec. Simple mode leaves those out, because they mean nothing yet to someone new, apart from a message that is only from the spec. A note in the Keycloak overlay says what was done to back it, in its own words.

A line saying what a library or a gateway does is a claim too, and an easy one to get wrong. "A library does this" got past review twice, about `state` and then about DPoP. So `practice` on the step names one someone can go and read, one each way where they differ, and a test fails on a line without it. Those were read at their source, and they are examples of what people will meet, not advice on which to use.

A workflow records against the latest Keycloak every week and on demand, compares it with what is committed, and opens an issue when it differs, saying whether the answers differ or the run itself failed. It compares the shape, the feature flags, and whether each note's evidence and place in the console still hold. The shape is which steps happened in which order, which names they carried, which claims the tokens held, and the errors and token types the screen states, because codes, tokens and timestamps change on every run.

`Execute` appears only on steps where it adds something, in advanced mode, and each step's data says whether it does. That means a step that sends something, where a later step uses what comes back. A step with no HTTP exchange never has it. Running one moves to the step with the answer and keeps nothing else, so the URL still only needs the step, and it says that nothing is really sent.

A recording belongs to exactly one set of settings, and is never adapted to another. What the application shows is formatted from the file and nothing else, and the click-through compares the screen with the file for every step of every named state. Recordings load when first asked for, so simple mode downloads none.

What a chat answer or a vendor's simulation cannot offer is that what is on screen is what a real server did. A default client is what people meet: on one, the access token carries the same identity claims with or without `openid`, and a tidied-up demo client would hide that.

Someone can run the same server themselves. A recorded request can be copied as a command, and a test reads each command back as a shell would and compares it to the recording. A page gives the commands for a login at home, from the values the recorder uses, and a scheduled job runs those commands against the version recorded.

Pictures of the pages a person gets are recordings as well: taken by the same run, kept beside the recordings, and taken again on each release. Their pixels are not compared, and a page that stopped appearing fails the check. `pnpm record --pages` takes only those, because a whole run changes every value in every recording.

## Not chosen

- **Stitching together payloads for unrecorded combinations**: They would look real, and nothing would prove them.
- **A stripped demo client**: It tells a cleaner story that nobody meets in practice.
- **A recording per valid combination**: There are 168 and counting, while each message already appears in a named state. A combination with no recording says so.
- **`Execute` on every step**: Most steps have nothing to add, and the button would stop meaning anything.
- **A live backend**: It adds something to host, secure and have abused, for the same payloads.
- **keycloak-operator or keycloak-gitops**: They are built for Kubernetes, and the maintainer does not want this project held to them.
