# ADR-013: A flow is one ordered list of conditional steps

A flow is data: one ordered list of steps, each with an optional condition, and each with fields that can have conditions of their own. Lifelines and groups can be conditional too. Evaluating a flow against the settings gives the diagram, so a setting can add, remove or reword, but it can never reorder. A condition is data rather than a function, so the application can say which setting caused what. Adding a setting means a line in `Settings`, a definition in `settingDefs`, and conditions in the flow.

What a setting needs is a requirement on the setting or on one of its options, with the reason to show when it fails. When a change takes away what another setting needs, that setting falls back to its default and the application says why. Each valid combination has to build a coherent diagram. The unit tests check every one of them, through the model, the layout and the address, and a browser opens each once (ADR-006).

A step is usually a message, a person passing something on, or something inside one system. It can also be time passing, where nothing is sent, which is drawn as a gap in every line and not as an arrow, because a refresh token only makes sense once time has gone by. A step can also end something, such as a session, which then goes from under every name that held it.

A field that differs from the base flow is shown on the message itself, and so is a field that carries a credential or token. Every other field is only in the step detail. So what is on the diagram is what the settings changed and what is being handed over.

A base flow has two diagrams, the user flow and its setup, and each is one such list on the same engine. Setup is apart because no user does it: the people who do are lifelines on its diagram, and no user or browser is. Settings apply to both. Back and Next stay inside a diagram, switching between them does not animate, and a step can link to a related step in the other.

OIDC, DPoP with a nonce retry, brokering with its nested flow, and stored upstream tokens with two API versions all fit this model without special cases. So did PKCE, the first setting added after the model settled, and so have the settings added since. Most of those are only offered in the plain case, so the valid combinations grow slowly while the ones to try at least double with each setting, which is why the list is worked out once. The order is what makes it work: because the list is fixed, a step that disappears has a nearest earlier step to fall back to, and a transition never has to move a row past another. If a later toggle needs to reorder steps, this record has to change first.

This also held for another base flow. Client credentials has no browser and no user, and it is the same kind of data on the same renderer. A base flow says which settings it has, and why the others are not there. Step ids stay unique across flows, so an id only ever means one thing.

A step can be the last one, when a server stops the flow there, so that a refusal does not need a condition on everything after it. A lifeline can join another, when one runs inside the other, so that every arrow moves with it and what they carry ends up there, with no second version of each step.

## Not chosen

- **`alt` frames or a tree of branches**: DPoP touches several steps and has no single place to branch.
- **A separate list of steps per variant**: Stable step IDs would have nothing to hold them together, and the variants would drift.
- **Conditions as functions**: They read well, but the application could not say which setting caused a step.
- **Setup at the top of the user flow's diagram**: It reads as something the user does, and the people who do it would have no lifeline.
