# Authlines

**Flip one thing. Watch the login change.**

An interactive explainer of OAuth and OpenID Connect: one diagram you can change, with its messages recorded from a real login server, Keycloak. It is for anyone who has to add a login, fix one or explain one, and it starts from the basics. Pick a question and follow it, one message at a time.

**[Open Authlines](https://vriesdemichael.github.io/authlines/)**

<picture>
  <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="docs/readme/flip-dark-still.png">
  <source media="(prefers-reduced-motion: reduce)" srcset="docs/readme/flip-light-still.png">
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/flip-dark.png">
  <img src="docs/readme/flip-light.png" width="100%" alt="A sequence diagram of a login with an attacker on it. With an app that has no secret, the attacker copied the one-time code and is given tokens for it. The switch 'Protect against a stolen code' turns on: the same diagram changes, and the attacker's same request is now refused.">
</picture>

With an app that has no secret, someone who copied the one-time code gets the tokens. Turn on "Protect against a stolen code", which is PKCE, and the same request is refused. Both answers are what a real server said. [Try it](https://vriesdemichael.github.io/authlines/authorization-code/?mode=simple&attacker=1&client=public&step=attacker-token-response).

## What it does

- **Starts from your question.** The home screen lists questions, with "Start here" for someone new. Search takes your own words, and a pasted Keycloak error goes to the step where it happens.
- **One diagram, many settings.** It covers the authorization code, device and client credentials flows. Turn on PKCE, show an attacker or add another provider, and the diagram you are looking at changes, instead of another page opening.
- **Who has seen what.** Under each party on the diagram is what it has seen so far, so you can see that the browser saw the code and never the tokens, as long as the app runs on a server.
- **What you have to do.** How the app and the login server get to know each other has a diagram of its own, and one list gathers what has to be done and what can go wrong.
- **As much detail as you want.** Simple mode says what happens and why. Advanced mode adds the raw requests and answers and, where there is one, which spec says so and the Keycloak setting behind it.
- **Made to be shown.** The address holds the flow, settings and step, so a link opens exactly what you are looking at. Advanced mode can show every row at once, or the raw traffic large, for a room.
- **A server you can run yourself.** [A page on the site](https://vriesdemichael.github.io/authlines/run-it-yourself/) gives the commands to run Keycloak at home with Docker, for a real login and real tokens with the settings you came from.

## What this is not

- **A library.** It shows how a login works and what you have to do, and it will not add one for you.
- **A debugger for your own server.** Nothing here talks to your server, or to any other: it replays what was recorded.
- **A comparison of vendors.** The protocol is explained neutrally, and what is Keycloak's own is a layer on top ([why](docs/adr/015-keycloak-is-an-overlay-on-a-neutral-protocol.md)). It is recorded from Keycloak because anyone can run that, and the rest applies to other login servers too.
- **An article.** You operate it: pick a question, change settings and step through it.
- **Ready for phones.** Desktop comes first ([why](docs/adr/008-desktop-first-without-ruling-out-phones.md)).

Something wrong, or a question missing? [Say what is wrong](https://github.com/vriesdemichael/authlines/issues/new?template=something-is-wrong.yml) or [suggest a question](https://github.com/vriesdemichael/authlines/issues/new?template=suggest-a-question.yml).

## How far to trust it

**What a server said is recorded.** The requests and answers in advanced mode come from recorded runs against a real Keycloak and a small demo app and API, and nobody wrote them. A message from the demo app or API says so, as does a step only the spec describes, and settings with no recording show no payload ([the rule](docs/adr/005-payloads-are-recorded-never-invented.md)).

**The words are written.** An AI agent, Claude, writes the explanations, the words on the diagram and the code here. The maintainer decides what it should be and judges it once it is live ([how](docs/adr/001-an-agent-builds-and-the-maintainer-reviews.md)). A step that names a spec cites it, and [a test](src/lib/flow/citations.test.ts) checks that each cited RFC section contains a phrase chosen from it, not that the sentence is right. So check what you will rely on against the specs it links to.

**Who has tried it.** The maintainer, and AI agents given a role and the address. As far as anyone knows, nobody else yet, so whether it works for people is still open.

### Where the recordings are

In [`static/recordings/`](static/recordings/), with a folder for each flow and a JSON file for each set of settings recorded. `pages/` has pictures of the pages a person gets.

### How the recordings are made

`pnpm record` ([`scripts/record/`](scripts/record/)) starts a throwaway Keycloak in a container, on its defaults unless the setting being shown changes them, and has a headless browser log in through the demo app and API. Each recording is one real run, so the code returned in one step is the code sent in the next. The demo app and API do the checks the steps say they do, such as the API checking a token's audience ([`checks.ts`](scripts/record/checks.ts)), and a run stops if one fails.

### How the recordings are checked

- **On every change,** [tests](src/lib/recordings/recordings.test.ts) compare what the diagram draws with the recordings. On the authorization code flow they also check the other way, that a recording holds nothing the diagram leaves out, apart from a listed few. A browser then compares advanced mode with the files, at every step of that flow's recorded settings, and spot-checks the other flows.
- **Every week,** [a workflow](.github/workflows/recordings.yml) records against the latest Keycloak, compares that with what is committed, and opens an issue if it differs. Codes and tokens change on every run, so it compares which steps happened and what they carried. The same workflow runs the commands on the run-it-yourself page, on the version recorded.
- **By you.** With Keycloak running from [that page](https://vriesdemichael.github.io/authlines/run-it-yourself/), you can do a real login yourself. In advanced mode, a recorded request can be copied as a command, to try on that server with a code of your own.

## Run the site locally

You only need this to work on it, because [the site](https://vriesdemichael.github.io/authlines/) is hosted. You need the Node version in [`.node-version`](.node-version), and pnpm at the version in `package.json`. `corepack enable pnpm` gets pnpm if you have none. It replaces one you already have, so skip it if you do.

```bash
git clone --depth 1 https://github.com/vriesdemichael/authlines.git
cd authlines
pnpm install
pnpm dev
```

Then open the address it prints. `pnpm storybook` opens the components.

`pnpm verify` runs what CI runs, in one browser. Install that browser first, with `pnpm exec playwright install chromium`. `pnpm test:browsers` runs all three browsers CI uses, and the screenshots, in CI's image with Docker.

## Record it again

You also need Docker, and the browser from the step above.

```bash
pnpm record
```

That writes every recording again, on the version of Keycloak pinned in [`scripts/record/index.ts`](scripts/record/index.ts). `pnpm record --check` writes nothing and says what no longer holds, and `--keycloak` takes another version.

## Working on it

The site and [its Storybook](https://vriesdemichael.github.io/authlines/storybook/) update on every merge to `main`, and a pull request from a branch here gets a preview of both.

- [Premise](docs/premise.md): what this is, why, the nuances, and what happens next
- [Target states](https://github.com/vriesdemichael/authlines/issues?q=is%3Aissue+label%3A%22target+state%22): where it is going, with acceptance criteria and deliverables
- [Original brief](docs/original-brief.md): the idea in the maintainer's own words
- [Decision records](docs/adr/index.md): the rules for how it is built and worked on
- [Research](docs/research/README.md): what already exists, what is left open, and how far to trust that

### Where things live

- `src/lib/flow/`: what a base flow is, the data of each one, and what is on screen in a given state. Nothing about a view.
- `src/lib/diagram/`: the geometry and the motion of the diagram, as pure functions.
- `src/lib/recordings/`: what was recorded of each flow, how a message is known, and how a new run is compared with it.
- `src/lib/keycloak/`: what is specific to one product: its notes, flags and words (ADR-015).
- `src/lib/map/`: the questions on the home screen.
- `src/lib/search/`: search, including what it knows about errors.
- `src/lib/sources/`: the specs and docs that the settings and steps name.
- `src/lib/components/`: the view, with stories for its states (ADR-007).
- `scripts/record/`: the real Keycloak, the demo app and API, and what gets tried on them (ADR-005).
- `scripts/readme-clip.ts`: the picture at the top of this page, which `pnpm build`, then `pnpm clip`, makes again.

Adding a setting is mostly data in `flow/`, a recording and tests. A second base flow gets its own diagrams, settings, recordings and notes, and `flow/second-flow.fixture.ts` is a small one that keeps that true.

## Licence

Code is under [Apache-2.0](LICENSE) and content is under [CC BY 4.0](LICENSE-CONTENT), so you can reuse and modify both with attribution. [NOTICE](NOTICE) says what to credit and lists what comes under other terms, and [ADR-009](docs/adr/009-code-is-apache-and-content-is-cc-by.md) says what counts as which.
