# Premise

Starting point as of 2026-10-31, kept current since. The first version in section 8 is built, and what is left is the maintainer's: judging the transition and the words, and settling section 11. The way there is split into [target states](https://github.com/vriesdemichael/authlines/issues?q=is%3Aissue+label%3A%22target+state%22), each a GitHub issue with acceptance criteria and deliverables.

**This is an interactive web application, not an article.** Read section 2 first, because everything else depends on it.

Labels used throughout:

- **Decided:** the maintainer said this. Change it only with the maintainer's agreement.
- **Proposed:** a recommendation from the review with Claude. The maintainer asked for these nuances to be recorded but has not ruled on each one, so challenge them if the work shows they are wrong.
- **Open:** not decided.

The maintainer's own words are in [original-brief.md](original-brief.md). The evidence is in [research/](research/README.md). This file holds intent. The rules for how it is built and worked on are in the [decision records](adr/index.md).

## 1. The problem

The maintainer has become the local expert on Keycloak, OAuth, authn and authz in their team. They keep building presentations and struggle to explain the concepts at different levels. These concepts are hard to grasp from text, and sequence diagrams work much better.

**Decided.** The application is public, for a wide audience on the internet, in English only. There is no separate team audience to serve first.

Presentations are why the idea came up, not what is being built. The maintainer has not named a talk or a deadline.

## 2. The idea

**Decided.** An interactive web application for exploring OAuth and OIDC visually, and later wider authn/authz. It starts from the most basic concepts, such as what an identity provider and an issuer are, and one basic flow. Everything more advanced is added by switching it on in the same diagram, not by opening a separate page. It starts small and grows with more functionality over time.

In the maintainer's framing, it combines three things that no one site has together:

| Quality | Reference |
|---|---|
| Visually striking step-through | IdentiFlows |
| Advanced level, including executing a step | AuthPlayground |
| Basic explanation of the concepts themselves | Okta's illustrated guide |

The spirit is that of the visual guides to transformers, but authn/authz is a much more varied topic, which is why it suits an interactive site over a single article.

### The name

**Decided.** It is called Authlines. It is easy to remember, `auth` covers authn and authz where a name built on identity would be wrong when there is only authz, and lines are what is on screen, which holds for more than sequence diagrams. Hop by Hop and Authwalk were turned down because they sound like detours. The repository has the same name, so the site is at `vriesdemichael.github.io/authlines/`.

**Decided.** It stays on GitHub Pages until it has had some success, and only then moves to `authlines.io`. The `.com` is not needed, and someone else registered it in September 2026.

### It is an application, not an article

**Decided.** The maintainer asked for an interactive site and a web application with CI that clicks through it. People operate it. They do not read it from top to bottom.

**Proposed: what that means in practice.**

| | An article or blog post | This application |
|---|---|---|
| Main thing on screen | Text, with diagrams illustrating it | The diagram and its controls. Text appears for whatever is selected |
| How you move through it | Reading order, scrolling | Pick a flow, change settings, step forward and back, execute a step |
| Unit of work | A page or a piece | A state: base flow, diagram, settings, mode and current step |
| What growth means | Another post | Another toggle or flow in the same application |
| What finishing means | Publishing | It keeps growing, and each addition is a small change that CI validates |
| How quality is checked | Proofreading | Automated click-through, plus review of protocol claims |

So design the screens, controls, state and routing first. Explanations are content attached to steps and settings, not pages of prose. There is no fixed reading order. People choose where to go from a map (section 5.9).

## 3. What to take from existing work

### How it should work: interactive tools

These are the references for the form. **Decided:** the format of IdentiFlows is the one to match or improve upon. The maintainer found the others worse.

| Source | Take | Leave |
|---|---|---|
| [IdentiFlows](https://identiflows.dev/) (Auth0) | Step-through where each step shows only what is relevant at that point, in detail. **The maintainer's favourite quality.** | A separate page per variant. In depth from the first step. Auth0 branding. |
| [roadmap.sh](https://roadmap.sh/) | An entry where you navigate to what you want to learn about. | Accounts and ads. |
| [AuthPlayground](https://www.authplayground.dev/) (Ping) | `Execute`, a fake execution with raw request and response. Advanced topics. | `Execute` on every step. A static diagram that does not follow execution. No user options. |
| [ProtocolSoup](https://protocolsoup.com/) | Evidence of how much a toggle can teach: on Client Credentials, Bearer gave 12 events and DPoP gave 27, including the nonce retry. | Options change a timeline, not the lifeline diagram. |
| [MCPJam](https://docs.mcpjam.com/inspector/guided-oauth) | Proof that a function from options to diagram steps works. Its diagram depends on protocol version and registration method. | MCP only, and needs a live server. |
| [Authlete Playground](https://github.com/authlete/oauth-playground) | The widest option surface, with a live preview of the wire request. | No sequence diagram. |

### What to say and how to verify it: articles

These are references for content only, not templates for the form.

| Source | Take | Leave |
|---|---|---|
| [Okta's illustrated guide](https://developer.okta.com/blog/2019/10/21/illustrated-guide-to-oauth-and-oidc) | Basic concepts in plain language for newcomers. | Static, one depth, mostly one flow. |
| [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) | Clear explanation matters. It drew 500 Hacker News points seven years after publication. | The linear article format. |
| [Illustrated TLS](https://tls13.xargs.org/) | Every byte reproduces from a working client, server and captures in the repo. | It drifted from practice: still X25519 only. |

## 4. The gaps being aimed at

The maintainer's assessment, with how well each one is supported. "Not found" means not found in limited searching and is not proof of absence.

1. **Step-through tools skip the basics.** They are in depth immediately. Well supported: the research found no step-through tool with a concept layer, and the most reported confusion is conceptual (OAuth vs OIDC, token types, why the steps exist).
2. **Nobody shows setup from the application's point of view.** Existing tools explain how the flow works from the end user's perspective, but part of OAuth is getting the handshake between the application and the IdP in place. Plausible but lightly checked: the original research did not look at this, and one follow-up search found only glossaries and vendor docs. Stack Overflow supports it: Keycloak's invalid `redirect_uri` (505k views), endpoints (375k) and client secrets (230k) are all setup questions.
3. **External IdPs are not covered.** Plausible but lightly checked: not in IdentiFlows' 13 flows, and searching found [Authlete's tutorial](https://www.authlete.com/developers/tutorial/idp) and one static figure in Keycloak's guide, nothing interactive.
4. **Parts that could be toggles are presented as separate concepts.** Well supported: no general OAuth tool found changes one diagram as you flip options. AuthPlayground does chain PAR, RAR, PKCE, DPoP and token exchange in one fixed flow, but a visitor cannot compose it.
5. **Nothing maps protocol to Keycloak.** Well supported: no tool found maps a protocol option to the realm or client setting that controls it.

**"Not present anywhere" is still a bet.** What is unoccupied is the combination, not each part. IdentiFlows is adding flows and could add toggles, which would close gap 4 with one product decision.

## 5. Core design ideas

### 5.1 Start from OAuth and OIDC

**Decided.** The earlier research report recommended starting with the registration flow and sending people to IdentiFlows for the basics. **That recommendation is superseded**, for three reasons: toggles need a base flow to change, the original problem is explaining at different levels, and the basics are the reported confusion.

The caveat is that the basic code flow is also the most saturated area, and a wave of near-identical simulators in 2026 suggests a plain animated flow is now cheap. The first version must therefore already show what is different: the concept layer, the setup diagram and at least one working toggle.

### 5.2 One diagram, many toggles

**Decided.** Others treat toggleable parts as separate concepts. Here they are a set of toggles on one diagram, so a visitor can see that DPoP is a change to the flow they already understand, not a new flow.

**Proposed: the transition is the centrepiece.** Stable step IDs let a toggle animate as a change, with an arrow sliding in and rows shifting, instead of a redraw. No precedent found does this for general OAuth, and it is the moment the idea either lands or does not. It has to work inside a message as well as between messages: OAuth to OIDC adds at most one arrow, and most of the change is in fields. So a flip brings what it changed into view, ahead of the current step if the two do not fit together, and the next step brings the current one back.

**Proposed: stepping moves too, and only by one thing.** Next sends a message: a marker travels its arrow, and what it carries shows when it gets there ([ADR-014](adr/014-a-colour-means-one-thing-and-ahead-is-only-a-shape.md)). Back and Next are at the top of the step's text, and stay there while it scrolls. Under the diagram is a timeline of its named parts, such as Ask, Log in, Trade and Use, each with a sentence on why it is there, because why the steps exist is one of the most reported confusions. Play steps through by itself at a pace set by what there is to read, stops at any input, and writes no history.

### 5.3 Setup has its own diagram

**Decided:** the application's view of setup is in scope, and it is a diagram of its own next to the user flow ([ADR-013](adr/013-a-flow-is-one-ordered-list-of-conditional-steps.md)). The maintainer ruled out combining them, because "it makes it look like the setup is something the user does". The toggles in section 5.2 still act on one diagram at a time, and settings apply to both.

The handshake runs in both directions:

| Side | What it must learn |
|---|---|
| The IdP learns about the app | Client ID, client type, redirect URIs, allowed scopes |
| The app learns about the IdP | Issuer URL, endpoints via discovery, signing keys via JWKS |

Three things follow:

- **Registration is the setup.** Manual registration, DCR and CIMD are three answers to one question: how does the IdP get to know this app? So the CIMD toggle lives in the setup diagram and fits the story rather than being an advanced extra.
- **Setup and login are linked.** The redirect URI registered in setup is checked during login, and those two steps link to each other. That explains the most-viewed Keycloak error, and a choice in advanced mode draws it: an address that was not registered, where the flow stops with what a real server said.
- **It says what is left to you.** **Proposed:** in simple mode the people on it are "You", the app team, and an admin. Steps your app or API takes part in have a line saying which part a library does and which part is your code, because someone told to add login mostly wants to know what they have to do. That is general knowledge, not recorded, and the map has that question. All of it is also one list, grouped by whose job it is, with the pitfalls, which follows the settings and prints ([#102](https://github.com/vriesdemichael/authlines/issues/102)). Nothing in it is written for it, so it can only say what the steps do. It is a view of the state, with an address, and it stays in the application.
- **The setup diagram differs from runtime.** Manual setup is mostly people, an application team and an IdP admin copying values between consoles, not HTTP messages. So those people are lifelines on it, each next to the system they look after, and their hand-offs are drawn differently from HTTP. **Built, in advanced mode for the maintainer to judge:** one choice between someone registering the app, it registering itself (DCR) and it pointing at a document (CIMD), and the hand-offs turn into HTTP arrows as a transition. A real server keeps the people from leaving altogether. DCR on a default realm still takes an admin handing over one token. On the server recorded, CIMD takes an admin once, to say which domains to trust and to put the audience in a scope every client gets, and it is the one that reaches the user flow, because the document is fetched when the app first asks, and the user is asked.

### 5.4 Limited context per step

**Decided as the quality to keep.** Each step shows only what is relevant at that point, in detail. This is what the maintainer liked about IdentiFlows.

**Proposed: how the diagram does it** ([ADR-014](adr/014-a-colour-means-one-thing-and-ahead-is-only-a-shape.md)). Every message says what happens, and only those up to the current step have what they carry. What is ahead is faint, so a setting can still be seen changing it. It used to be only a numbered arrow, with a switch in advanced mode for its words ([#127](https://github.com/vriesdemichael/authlines/issues/127)). On 2026-11-03 the maintainer, who had watched people use it, found those hidden steps mysterious, more so when seeing it as one party, so the words are always there and the switch is gone. Colour separates what goes through the browser from what goes direct. Under each lifeline is what it has seen so far, so at any step you can see that the browser saw the code but never the tokens, and that the app never saw the password. No tool found shows this.

**Proposed: the whole flow through one party's eyes.** Pick the browser, and every message still says what happens, with the arrow nearly gone where the browser was not part of it. What it was never sent is a muted bar, in the diagram and in the raw view, with the value gone from the page and not just covered. "Seen" means what a party was sent or sent itself, and the screen says so: not what it could work out, or what anything else running there could read. It comes from the same fields as the chips, and it changes no flow ([ADR-004](adr/004-modes-never-change-the-flow.md)).

**Proposed: one thing followed through the flow.** Select a code, and its path lights up across the diagram and is listed by step, with the rest quiet, because the answer to "why a code and then a token" is the path it takes. Two forms of one thing, a verifier and its challenge, follow together, which is PKCE in one picture. The path comes from the fields on the steps. "Used up" is only said where a recording backs it, and a test holds it to that.

**Proposed, and built: what a person sees is there too** ([#60](https://github.com/vriesdemichael/authlines/issues/60)). At a step a person sees, a small window in the panel has the real address and a picture of the real page, so "through the browser" stops being an idea: someone can see the code sitting in their address bar. It is in the panel and not on the diagram, because the browser is the leftmost column with arrows crossing it, and a picture there would cover what the diagram is for. The address comes from the recording, and where these settings have none it says so. The pictures are taken by the recording run and are only ever of one server's look, so they go with its notes and leave an outline in words.

**Proposed, and built: another base flow has its own shape on the same screen** ([#14](https://github.com/vriesdemichael/authlines/issues/14)). Client credentials has no user and no browser, and is flow data, recordings and notes on the same model and renderer, with no change to the engine beyond a word for what its first diagram is called. A picker at the top of the settings chooses the flow, and keeps what still applies. What does not apply is listed with why, in words about this flow: "There is no code to protect." That list turned out to teach, because it is the difference between the two flows. A picker is what section 11's control model had left open about base flows, with the base flow in the path ([ADR-003](adr/003-state-is-in-the-url-and-variants-get-no-page.md)).

**Proposed, and built: a flow on two devices.** The device flow is the same screen again, with a shape neither of the others has: nothing joins the app and the browser but a person reading a code, and that is drawn as a person and not as HTTP. The app finds out by asking, and one request and its answer stand for all the asking, because one real run asks as often as it takes and how often is not the point. What each party has seen says the rest: the browser ends with no token, and the app with no password.

### 5.5 Simple mode and advanced mode

**Decided:** the application has a simple mode and an advanced mode. In the maintainer's words, the advanced mode is there "to toggle more settings", at "the advanced level as in authplayground". So this is an application-wide mode that changes which settings are on offer and how much each step shows.

**Proposed: what each mode offers.**

| | Simple mode (the default) | Advanced mode |
|---|---|---|
| On screen | The diagram, the step, and what moves it | Also the flow picker, whose words these are, seeing it as one party, the whole flow, where it was recorded and what is not here |
| Settings on offer | A few, in plain language | All of them, with Keycloak feature flags as badges |
| Each step shows | The concept and why it happens, with what someone has to do closed until they ask | Parameters and raw request and response, how it travels, which spec says so, and notes on the server |
| `Execute` | Not offered, because it shows values and simple mode shows none | Only where it adds something (section 5.6) |

- **Decided: simple has to look much emptier than advanced.** The maintainer's judgement on 2026-11-02 was "very busy and cluttered with little difference between simple and advanced mode". Each thing simple mode leaves out stays one press of Advanced away, and stays on screen if an address or a question has it on, so there is always a way back. New controls go in advanced first.
- Default to simple. A meta-analysis of 60 experiments found novices gain from high assistance (d = 0.505) and experts from low (d = −0.428), with help for novices the stronger effect. It did not test this kind of mode, so this is reasoning from adjacent evidence.
- A step can also expand for more detail within a mode. That supplements the modes and does not replace them. A pitfall works this way: at the redirect URI check, "What if the address does not match?" opens to say what happens, with Keycloak's real error.
- **Decided: simple mode offers six settings,** which is the most it should: "Know who logged in", "Ask the user to agree", "Protect against a stolen code", "Show someone stealing the code", "Log in with another provider" and "Where does your app run?". The maintainer agreed to the sixth on 2026-11-02, because that one is something someone already knows about their app. Each explains the problem it solves when turned on. On the setup, only the ones that change something you can see there are on offer, because a switch that visibly does nothing reads as broken. Everything on screen can be asked about: selecting a lifeline, a token or a setting's "Why?" explains it and says who has seen it so far, and any term in the text can be selected and points at its place on the diagram ([ADR-016](adr/016-a-word-on-screen-explains-itself.md)). The explanation opens in a dialog on top, so what someone was reading stays where it is, and the dialog keeps to the side away from what it lights up.
- **Proposed: first use.** The first step of each diagram says what it is for and to press Next, and Next is the one thing that stands out. What is ahead is faint.
- **Decided, as a first go for the maintainer to judge: a way in for someone who knows none of the words** ([#150](https://github.com/vriesdemichael/authlines/issues/150)). In the maintainer's words on 2026-11-02, the site was "still quite intimidating for people that know nothing about oauth yet". So the first screen starts from a button someone has clicked, and shows what it saved them from: the app asks for the password, keeps it, and sends it with every call. One switch sits under it. Flipped, the identity provider arrives on the same diagram, the password goes only there, and only then is it called OAuth. The old way is a setting on the flow and not a page, so it is the transition the rest of this is about, and it has an address. Nothing moves by itself any more: someone flips it.
- **Proposed: a control says whose words these are,** plain, the specs' or Keycloak's ([#62](https://github.com/vriesdemichael/authlines/issues/62)). Plain is the default in both modes, and someone's choice holds. It used to follow the mode, into the specs' words in advanced, and three of four AI agents, each reading it as someone new, were thrown by the names changing when they had only asked for more detail. No person has tried it either way. It changes the names on the same diagram and moves no row, so someone can see that the app is the client. Text is written once, in plain words, and goes through one pass, which a test walks in every combination. With OpenID Connect on, the heads say Relying party over Client and OpenID provider over Authorization server, and the text stays client and authorization server, because the spec itself mostly does (306 and 143 uses, against 32 and 80, with the abbreviations on top). The user and the browser stay "the user" and "the browser" in all three, because the specs use those too, and resource owner and user agent are explained where they are looked for. Selecting a party says what else it is called, with where that comes from. Questions on the map stay in the words someone brings them in, and a term's explanation stays in plain words, because that is what it is for. What other vendors call these things stays out: it would have to be checked against each one and would keep drifting (section 10).
- Keep **settings** (PKCE on or off) separate from the **mode**. A setting changes the flow, and the mode changes how much is exposed. Switching mode does not change which flow is on screen ([ADR-004](adr/004-modes-never-change-the-flow.md)). **Decided:** an advanced setting stays on when someone switches back to simple, as a chip they can remove, and the text drops to concept level. So DPoP can be shown simply.

### 5.6 Execute

**Decided as desirable:** the maintainer liked AuthPlayground's fake execution. **Decided:** it appears only on steps where it adds something, and it is honest: a combination with no recording says so and shows no payload ([ADR-005](adr/005-payloads-are-recorded-never-invented.md)).

**Proposed, and now built:**

- It is application behaviour, not a code sample. Executing a step produces values that later steps use, so the code returned in one step is the code sent in the next, and that state carries through the flow.
- It replays traffic recorded from a real Keycloak. That gives the same feel with real payloads and no backend to host, secure or have abused. Re-recording on each Keycloak release also catches drift. Illustrated TLS is the precedent for reproducibility, and it uses real captures.
- A recording is one real run, so values carry across steps without simulation. Earlier steps always count as executed, so a link only needs the step.
- It is on steps that send something, where what comes back is used by a later step: the sign-in, the token request and the retrieval of a stored token. Running one moves the diagram to the step with the answer, so the diagram follows execution, which is what AuthPlayground's does not do.
- Next gets to the same place. Execute says what is about to happen, marks the answer as the answer, and puts the reader on it.
- Each value in the raw view says where it came from, and every signed token can be opened.

### 5.7 Keycloak as the reference

**Decided:** tracing what Keycloak can do is the edge, because it is a universal open source product that is not sold like the other IdPs.

**Proposed refinement of the reasoning:**

- "Not sold" is only partly true, as Red Hat sells a supported build. To someone on Entra, a Keycloak-centred site can look as vendor-focused as the sites criticised here.
- Neutrality alone does not differentiate, because ProtocolSoup and oauthflows are already independent and open source.
- The stronger edge is that **anyone can run it**. Every diagram can be reproduced against a real server, and vendors have little reason to build this layer.
- So keep the **protocol layer neutral, with Keycloak as an overlay** on each message: this setting controls this behaviour. Someone on another IdP still gets the protocol explanation.

**Proposed: any request can be copied as a command,** with the run's values, labelled as throwaway, saying where a code that was good once has to come from. A test reads each command back as a shell would and compares it to the recording, so it cannot drift from what was sent. **Proposed: a page says how to run the same server at home,** with Docker, a browser and a terminal: a real login, a real code in their own address bar, and real tokens, fitting the settings someone came from. It takes its values from where the recorder does, and a scheduled job runs its own commands against that version.

**Built, with rules in [ADR-015](adr/015-keycloak-is-an-overlay-on-a-neutral-protocol.md).** Each note names a setting, where it is in the admin console, and is backed by changing that setting on a real server and seeing the behaviour change. **Proposed, for the maintainer to overrule:** one switch, Server notes, on by default, with notes in advanced mode only, closed until opened.

**Decided:** recordings use a default Keycloak client, which is what people meet. On one, the access token carries the same identity claims with or without `openid`, so the overlay has to explain client scopes. Details are in [research/followup-checks.md](research/followup-checks.md).

### 5.8 Grow from a small start

**Decided.** It starts small and builds itself up with more and more functionality, all within the same application. Growth is the point, so the first version is the start of the product and not a one-off piece.

**Proposed:** build the engine so that adding a toggle is mostly flow data, recordings and tests. If each new toggle forces changes to the engine, the model is wrong.

### 5.9 The entry and the application screen

**Decided:** the entry is more like [roadmap.sh](https://roadmap.sh/), where you navigate to what you want to learn about. Everything else happens on one application screen, with settings on the left, the diagram in the centre, step detail on the right, and step controls below. **Changed on 2026-11-03, for the maintainer to judge:** they saw people on the site look at the top half and found stepping from the bottom did not feel natural, so Back and Next moved to the top of the step detail. The timeline and Play stay below.

**Built this way, for the maintainer to overrule:**

- The map is the home screen. **Decided:** it has to be readable at a glance, after the maintainer found it "a hard to read roadmap", so one part is open at a time, and the rest say what they are about and how many questions they have.
- A node is a named state, not a page: it opens the application screen at a base flow, settings, mode and step. So variants still never get a new page, and adding a toggle adds a node.
- A node is named for a question someone brings, such as "What if someone steals the code?", not for a feature, because people arrive with a problem and the feature's name is what they are trying to learn.
- A question says its answer in a sentence or two straight away, and opens on the step where it can be seen, or says why it starts at the beginning. Someone who wants the walk can rewind with one click, and someone who flips a switch keeps a way back to the question.
- Nodes and presets are different things. A preset is a set of settings that gets a recording, and a node is a question, a mode and a step on top of one, so several questions can share a recording. A test keeps every recording reachable from a question, and another keeps the map to 53 questions, so that a new one takes one off it. A question taken off keeps its address.
- People can also search with the words they have, from anywhere, including a pasted error that goes to the step where a real server said it. Where nothing has all of what was typed, it says so and offers the closest. It loads on first use, and nothing leaves the browser.
- Planned nodes do not show. Everything on the map opens, because a greyed-out node says nothing a visitor can use.
- Beside the map is one living diagram, shown whole so that it fits. It shows the way in, or the question someone came back from, and each question no longer needs a small drawing of its own, which made 40 things look alike ([#64](https://github.com/vriesdemichael/authlines/issues/64)). It used to move once by itself after the page opened, and now it waits for the switch (section 5.5). Resting the mouse on a question used to move it there ([#126](https://github.com/vriesdemichael/authlines/issues/126)), and a setting the mouse rested on used to show what it would do. **Decided:** the maintainer turned both off on 2026-11-03, because the diagram changing under the mouse made the steps hard to follow. Only a click, a key or a switch changes what is drawn.
- The way back to the map stays one click away, and the node matching the current state is marked. The name at the top goes to the first screen, and so does a link under any question beside the map, because a person could otherwise only see it again in a new private window.
- Errors someone meets early have a part of the map of their own, "When something goes wrong", said as they are on someone's screen, and they open in simple mode ([#124](https://github.com/vriesdemichael/authlines/issues/124)).
- A state reached by flipping settings by hand still has a URL, with or without a node.

### 5.10 Sources open in the application

**Decided.** A source named on a setting opens in a dialog on top of the screen ([#119](https://github.com/vriesdemichael/authlines/issues/119), which changed this from beside the diagram, on the maintainer's request), with a summary in our own words, what it means for that setting, and a link to the original. **Proposed, and built:** a claim about a spec on a step has one too, under "Which spec says so?", closed for someone new and open in advanced mode ([#104](https://github.com/vriesdemichael/authlines/issues/104)). A test finds "the specs", "current advice" and "RFC" in what every step says in every combination, and fails where it has no source, and holds a phrase from each cited section to the RFC's text. An RFC is just text, so its full text is shown there as well, at the section that matters ([ADR-009](adr/009-code-is-apache-and-content-is-cc-by.md)). Sources that are not plain text, such as OpenID Connect Core and the Keycloak docs, get the summary and the link.

## 6. Nuances that must not get lost

### Not everything is a toggle (Proposed)

The controls need more than on/off switches:

| Kind | Examples |
|---|---|
| Base-flow picker (different shapes) | Authorization code, device, client credentials |
| On/off modifiers | OIDC, PKCE, PAR, refresh tokens |
| Exclusive choices | Pre-registered, DCR or CIMD. Bearer, DPoP or mTLS. Public or confidential client |
| Constraints | Which combinations are invalid, and why |

Variants never get a new page. A different base flow can be a different view, but it stays in the same application with its state in the URL.

Toggles cut across messages. DPoP touches several steps and PAR changes what crosses the front channel, so conditions must sit on each step and field. `alt` frames cannot express this.

### A toggle shows what changed, not why (Proposed)

Turning on PKCE adds parameters, and the learner still does not know what they are for. "Why" is the most reported confusion, so each toggle must show the problem it solves, ideally what goes wrong when it is off. Showing an attacker's path when a protection is off is one way to do this, and it is built for a stolen code: a setting brings an attacker onto the diagram, and flipping PKCE or the client type changes the answer on the same arrow, with what a real server said ([#26](https://github.com/vriesdemichael/authlines/issues/26)). A refusal travels with nothing in it and leaves nothing under the attacker, and an answer with tokens leaves them there.

It also answers what AI agents reading it kept asking, why an app with a secret needs PKCE: they can hand the stolen code to the real app, from a login of their own, and a real server gives the app the tokens. PKCE refuses it there, and a nonce stops it at the app ([#100](https://github.com/vriesdemichael/authlines/issues/100)).

### User federation and brokering are different (Proposed, and built)

- **Identity brokering:** Keycloak acts as an intermediary and redirects the browser to another IdP. The diagram gains a lifeline and a nested flow, and client applications never contact the external provider.
- **User federation** (the docs call it "Using external storage"): Keycloak looks users up in LDAP, AD or a custom store on the server side. The docs mention no redirect.

This contrast makes a good toggle: same app, same token, different middle. It is built as two switches that turn each other off, so someone can flip between them and see the transition ([#144](https://github.com/vriesdemichael/authlines/issues/144)). The token part is from real runs: the three recordings hold the same claim names, and a test keeps it so, with `email_verified` the one value that differs, which Trust Email controls. The difference someone might not expect is the password. With another provider the identity provider never sees it, and with a directory it does and passes it on, which is why the connection matters. LDAP is not HTTP and has no text form, so those four messages show the directory's own log, and say that ([ADR-005](adr/005-payloads-are-recorded-never-invented.md)). It was recorded with OpenLDAP, and Active Directory has not been tried.

### Most of this is not feature flags (Proposed)

The maintainer named "feature flags of keycloak like cimd and token brokering" as especially interesting. From the current docs:

- Core brokering is not listed as a flag. **Decided:** by "token brokering" the maintainer means upstream token storage, and that is what the `identity-brokering-api` flags govern: `v1` is deprecated and on by default, `v2` is supported and off by default. Identity brokering and token exchange remain relevant too.
- `cimd` is a flag, and the specifications page marks it experimental.
- `token-exchange-standard:v2` is supported and on by default, but handles only the internal-to-internal case. `token-exchange:v1` is preview.

So organise the site by protocol concept and show Keycloak's status as a badge. Do not organise it around flags. The maintainer agrees with a badge for now, and the details get settled during implementation. More is in [research/followup-checks.md](research/followup-checks.md).

### Scope has to be bounded (Proposed)

"Whatever Keycloak can do" has no end. A feature gets in only if it teaches a concept or answers a question people actually bring you. Otherwise the site becomes a feature tour.

### Protocols drift (Proposed)

Stamp each flow with its spec version and a last-verified date. Experimental flags will mean rework. The version skew is itself teachable: CIMD was at IETF draft -03 on 2026-11-02, MCP still links -00, and MCP's 2026-07-28 revision makes CIMD SHOULD and DCR MAY and deprecated.

### Combinations grow fast (Proposed)

Three independent toggles already give eight variants. Offer named presets as well as free toggles, encode invalid combinations as constraints, and test every valid one: all of them in the unit tests, where it takes milliseconds, and once in a browser, in Chromium. The one detailed teaching success found also fits presets: a trainer offered a menu of recommended options per use case, and why each one solved the problem.

### Presentations are one use of the application (Proposed)

The maintainer can present with it by opening an exact state, so flow, settings, mode and step all belong in the URL, which an application needs anyway. Two things make it readable from the back of a room, and both are states with an address ([#103](https://github.com/vriesdemichael/authlines/issues/103)): every row at once, which gives the diagram all the room and leaves out what would not fit, and raw traffic large, with whole values. Whether the faint arrows hold up on a weak projector has not been tried, and neither has a theme switch. The settings can be put out of the way to give the diagram the room, the page keys a clicker sends move through the steps, and a reload keeps the question. A presenter view and slide exports are not requirements. People also forget details within months, so being somewhere they return to may matter more than a one-time walkthrough.

### Felt understanding misleads (Proposed)

In Transformer Explainer's study, video viewers felt they understood as well as others despite lower quiz scores. Consider predict-the-next-message prompts in simple mode.

### Accessibility and fallback (Proposed)

Plan early for step text outside the SVG, reduced motion, keyboard control and a static render for print and search. Wide diagrams on phones are a known risk. **Decided:** desktop comes first, and phone support comes later once it is clear which functionality fits a smaller workspace. Nothing may make that impossible ([ADR-008](adr/008-desktop-first-without-ruling-out-phones.md)). **Decided, on 2026-11-04:** a phone keeps the diagram, because "you need the visuals to guide you. That's the whole premise of this app." **Built:** the lanes in a narrow strip with each message's words beside them, and a switch for the full picture, panned to the current message, as #15 found in the way code review tools turn two columns into one. The maintainer tried it on a real phone on 2026-11-04: "works natural without losing the overview".

### Competition and demand (Proposed)

- Plan for "what survives if Auth0 adds a toggle": the Keycloak overlay, flows verified against a real server, and version skew shown openly.
- Public demand is unproven. Recent interactive tool launches scored 3 to 19 Hacker News points while article explainers reach hundreds, though launch scores are noisy. A blog post may be how people first hear about it, and that belongs in the maintainer's blogs repo. It is distribution and does not change what is being built.
- LLMs are the real competitor for answers. This application must offer what a chat answer cannot: a stable visual frame and content verified against a real server. **Decided, on 2026-11-04, and built:** so an agent can link to it instead, with the person's own names on the parties of a recorded flow, after the `#` so they never reach a server ([ADR-017](adr/017-a-link-may-name-the-parties-and-nothing-else.md), [#168](https://github.com/vriesdemichael/authlines/issues/168)). The traffic stays the one recorded, and says which value is which name. **Asked for on 2026-11-05, and built:** nothing led a person there, so the home screen and a named diagram link to a page that says how to set up their own agent. It offers a skill in the Agent Skills format, which Claude Code installs as a plugin from this repository and other agents read from a folder, and an instruction to paste for an agent with no skills. The skill, its reference and `llms.txt` are made from the flow data, like the page, and the reference says what each value needs and goes with, by the rules the screen uses. A link that asks for what does not go together says on screen, in either mode, what it lost and why ([#177](https://github.com/vriesdemichael/authlines/issues/177)).

### Visual ambition is a requirement and a cost (Proposed)

"Visually striking" is part of the Decided idea, so it is not the first thing to cut. **Decided:** it does not mean loud. Shown sketches with heavy transit-style lines, a glowing dark blueprint and an illustrated one with a rubber stamp, the maintainer found them "visually distracting". What should strike someone is the diagram changing and what it shows, with one thing standing out at a time ([#63](https://github.com/vriesdemichael/authlines/issues/63), and [ADR-014](adr/014-a-colour-means-one-thing-and-ahead-is-only-a-shape.md) for the rules). Effort should go up front into the engine and visual language, with each later toggle costing much less. Transformer Explainer, the closest comparison as an interactive tool, took over a year with nine authors. There is no reliable estimate for this project, so do not plan around one.

## 7. Candidate concepts

An order for later releases. **Proposed**, and expected to change.

| Concept | Control | Effect on the diagram |
|---|---|---|
| Actors, issuer, tokens | Concept layer | Explained on the lifelines themselves, with questions for them at the start of the map |
| The old way | Modifier, off to start with, never in the settings | Takes the identity provider off the diagram and gives the app the password, with HTTP Basic to the API (RFC 7617), recorded from the demo app and API |
| Client registration, discovery | Setup diagram | Steps before any user arrives |
| Authorization code | Base flow | The main flow |
| OIDC | Modifier | Adds the `openid` scope, an ID token and UserInfo. The access token does not change on a default Keycloak client |
| An attacker | Modifier | Adds a lifeline, the theft and what they get. Only in the plain case, with a Bearer token and no other provider. In advanced mode, built ([#33](https://github.com/vriesdemichael/authlines/issues/33)), they can instead get the user to open a login link of their own, with their own address for the code, and a choice says what the app registered: its exact address, which the identity provider refuses the link for, or `*`, which sends them the code. PKCE does not stop it, because they made the challenge, and a secret stops only the trade |
| Consent and scopes | Modifier | Adds the question and the answer. Off on a default Keycloak client, which the Keycloak note explains |
| What the API is sent | Exclusive, advanced only | Changes the call to the API and its answer: no token, expired, changed, for another API, or one that does not allow this. Only in the plain case, with a Bearer token, and the setup gains the API |
| A second app (single sign-on) | Modifier, then a choice | Adds a lifeline and a login with the login missing, and the session as something the diagram tracks. The choice brings the login back, or shows what happens with no session |
| When the token runs out | Modifier, then a choice | Adds time passing, the API refusing, the refresh, and the old refresh token being tried again. The choice is whether that still works. Only with a Bearer token and no other provider |
| PKCE | Modifier, off to start with | Adds `code_challenge` and `code_verifier`, with a step where the app makes them and one where the IdP checks them. Independent of the client type, because a real Keycloak takes all four combinations |
| Public or confidential client | Exclusive | Changes setup and the token request |
| Where the app runs ([#59](https://github.com/vriesdemichael/authlines/issues/59)) | Exclusive, in simple mode, and it brings the client type along | On a server, or in the page, built, where the app joins the browser on the diagram, its calls go through the browser, and the tokens end up under it. In the page with a server behind it, built ([#145](https://github.com/vriesdemichael/authlines/issues/145)), the page joins the browser and the server does the login, so the page never has a token, as RFC 10017 section 6.1 has it: the browser gets a cookie no script can read, and the page's calls go through that server. A phone is still to come |
| Pre-registered, DCR or CIMD, built | Exclusive, advanced only, in the plain case | Changes the setup diagram. CIMD is the `cimd` flag, experimental, with a client policy, and adds the fetch and the consent to the user flow |
| External IdP (brokering) | Modifier | Adds a lifeline and a nested flow |
| Stored upstream tokens | Modifier on brokering, then API V1 or V2 | Adds a retrieval call after login. V2 needs a confidential client, unless an API reads it: built in advanced mode ([#180](https://github.com/vriesdemichael/authlines/issues/180)), the API reads the token with a client of its own, allowed this provider, and the app can have no secret. An API not allowed the provider is refused, as a real server refused it |
| User federation, built | Modifier, in advanced mode, that turns another provider off | Adds a lifeline, a search and a password check on the server, and no redirect. The setup gains an admin connecting the directory. Only in the plain case |
| PAR, built, in advanced mode ([#13](https://github.com/vriesdemichael/authlines/issues/13)) | Modifier | Adds a push from the app before the browser goes, so the browser carries only the client ID and a reference for one login, and the challenge never goes through it. The address is checked at the push. An app with no secret can push too, with nothing to show who it is. Recorded on Keycloak 26.8.1, which sends the browser on to its own login form first |
| Bearer, DPoP or mTLS | Exclusive | Cross-cutting, and DPoP adds a nonce retry. With DPoP, built in advanced mode ([#33](https://github.com/vriesdemichael/authlines/issues/33)): someone using a stolen token, with no proof. An API that checks the proof refuses it, and one that knows only Bearer takes it, as RFC 9449 section 7.2 expects, so the screen says it is up to the API and the library or gateway it uses |
| Many customers, each with a provider, and SAML | **Decided, in scope** ([#118](https://github.com/vriesdemichael/authlines/issues/118)). Built as a modifier on another provider, then a choice of OpenID Connect or SAML, in advanced mode and the plain case | **Proposed, as built:** one shape, with our provider in the middle, because then the app still knows only one provider. It asks for the email, finds the company by its domain, and sends them on. With SAML, set up as SAML's POST binding, the request and an assertion in a signed response go through the browser in forms that post themselves, nothing is traded out of sight, and the assertion opens in the raw view. The token gains which customer. The setup gains the customer's admins, with what goes each way. Connecting the app to each customer directly would make it speak SAML itself, so the step that finds the company says that, and it is not drawn. Someone leaving is a modifier on that: their company turns the account off, and on the server recorded the old token, a refresh and the same browser logging in again all still worked. The token lasts its own few minutes, and a refresh or a login works while the session in the middle lasts, because nothing was set up to tell it |
| Token exchange, built, in advanced mode ([#13](https://github.com/vriesdemichael/authlines/issues/13)) | Modifier | Adds a second API, which the first calls to answer. The first trades the token it was sent, at the identity provider and with a secret of its own, for one that names the second, and sends that on. The setup gains an admin allowing it and the second API being told who to trust. Recorded on Keycloak 26.8.1 with `token-exchange-standard:v2`, on by default, which only trades a token that names the API asking. The new token stands for the user, with no `act` claim, its `azp` the first API, and no refresh token. A choice adds one ([#185](https://github.com/vriesdemichael/authlines/issues/185)): the trade asks for a refresh token too, and later the API uses it with its own secret, with no user there. The server recorded has to be set to give one, and it stops working once the user’s session has ended, which is said with what a real server answered. Only in the plain case |
| Device, built | Base flow | A person carries a short code to another device, and the app keeps asking with a long one. How it ends is a choice in advanced mode: the user agrees, says no, or the codes run out, each recorded. A choice in simple mode too brings someone misusing it onto the diagram: sending the user a code of theirs, where how it ends decides what they get, or reading the code off the screen and getting there first |
| Client credentials, built | Base flow | No browser and no user. The token request is all there is, and there is no refresh token |
| Logging out | Modifier | Ends the session and leaves the tokens, then shows the same token getting two answers, from an API that only looks at it and one that asks the server. With a second app, that app is told. Interactive coverage looks thin elsewhere |
| FAPI 2.0, OAuth 2.1 | Later | A composition or a diff over existing toggles |
| Authz (RBAC, ABAC, ReBAC, UMA) | Later | Multiplies the content |
| Names from an agent's link, built ([#168](https://github.com/vriesdemichael/authlines/issues/168)) | Not a setting: after the `#` of any link | The heads take someone's own names, with what each party is beside them, and the raw view says which recorded value is which. A flow the agent draws itself is not built |

What an AI agent given a security engineer's job looked for, decided one by one ([#101](https://github.com/vriesdemichael/authlines/issues/101)). **Proposed.**

| Threat | Decision | Why |
|---|---|---|
| CSRF, and what `state` is for | A question, on what is drawn | People ask it, and `state` is on the diagram. The answer says it is from the specs, and that the attack is not drawn |
| `iss`, and mix-up | A question, on what is drawn, in advanced mode | `iss` is on the wire, and had no why. Drawing the attack takes a second provider that lies, so it says it is not drawn |
| A stolen code handed to the real app | To be drawn ([#100](https://github.com/vriesdemichael/authlines/issues/100)) | It fits the attacker already there, and answers why a confidential client needs PKCE |
| PKCE downgrade | Not here, and search says so | It takes an attacker who changes a request on its way, which nothing here draws |
| Native apps, custom schemes, a malicious app on the device | Not here, and search says so | They take a second app on the device and a different kind of redirect, which is a shape of its own, and the first version is about a browser |

## 8. First slice

**Proposed.**

**Step 0: test the model and the transition before polish.** The riskiest assumption is that one data model can absorb very different kinds of change. Model toggles that change the diagram in different ways:

- **OIDC:** adds a scope, a token and an endpoint.
- **DPoP:** touches several steps and adds a retry.
- **Brokering:** adds a lifeline and a nested flow.
- **Stored upstream tokens:** only valid with brokering, with an exclusive choice of API version, so it tests constraints.

Then build a rough animated prototype, because the data model alone will not show whether the transition lands. If one model handles all three, the toggle idea holds. If brokering breaks it, it is better to know now. A starting sketch is in [notes/format_benchmark.md](research/notes/format_benchmark.md), under the technical approaches section. These are test cases for the prototype, and brokering is not part of the first version.

**Result of step 0.** One model handled all of them with no special cases, across all its valid combinations ([ADR-013](adr/013-a-flow-is-one-ordered-list-of-conditional-steps.md)). Whether the transition lands is the maintainer's call and is still open. Every message has since been recorded from a real Keycloak, which corrected the flow data in several places (see [research/followup-checks.md](research/followup-checks.md)).

**Then the first version, as a working application:**

1. **Entry map:** the home screen, with a node for each question this version answers.
2. **Application shell:** the diagram, step controls, settings, simple and advanced mode, and all state in the URL.
3. **Concept layer on the diagram:** select a lifeline to learn what the user, app, IdP and API are, and what an issuer is.
4. **Setup diagram:** client registration, redirect URI and discovery.
5. **Authorization code flow:** stepped through with only what is relevant at each step.
6. **Two toggles, OAuth to OIDC and PKCE:** with the animated transition. PKCE is the review's addition, because a code flow without it teaches an out-of-date picture, and the setting for a public client has nothing honest to say without it. It starts off, because a toggle teaches by contrast and turning it on by default would change what every existing link shows. The setting says that current advice is to have it on.
7. **Advanced mode:** parameters and raw request and response for these steps, with `Execute` where it adds something.
8. **Keycloak overlay:** a first few settings, such as valid redirect URIs and client scopes.
9. **CI and Storybook from the first code commit:** build, type checks, flow model tests, the Storybook build and the automated click-through, all blocking merges.

OAuth to OIDC comes first because it takes on the most reported confusion with a single switch, where IdentiFlows uses separate pages.

## 9. Engineering requirements

**Decided:**

- This is a web application in its own proper repository.
- CI runs an **automated click-through** that validates the site through changes.
- CI blocks merges from the first code commit ([ADR-006](adr/006-ci-gates-every-change-from-the-first-commit.md)).
- **Storybook** is there from the start, to set the precedent ([ADR-007](adr/007-every-component-has-a-story.md)).
- The repository is public, with a licence that allows reuse and modification and requires attribution ([ADR-009](adr/009-code-is-apache-and-content-is-cc-by.md)).
- The site is completely static, with no state outside the visitor's browser, and on GitHub Pages for now ([ADR-010](adr/010-static-files-on-github-pages.md)).
- Tooling is whatever suits the JavaScript ecosystem, so no Taskfile ([ADR-011](adr/011-tooling-follows-the-javascript-ecosystem.md)).

**Proposed: what CI should prove**, because the toggles make this more than a generic end-to-end suite:

| Layer | Checks |
|---|---|
| Flow model | Every valid combination builds, invalid ones are rejected, step IDs stay stable |
| Component states (Storybook) | Each component renders in each of its states in isolation, such as step, field and mode |
| Click-through (Playwright) | For each named state: walk every step, flip toggles, switch mode, assert the visible steps match the model, use keyboard control, and open a fixed list of URLs that must keep showing the same state. Every valid combination is opened once, in Chromium, and the click-through runs again at a phone's size |
| Visual regression | Screenshots of key states in both themes, with animation frozen through reduced motion, and an automated accessibility check on each screen |
| Keycloak recordings | Regenerate on demand against a pinned Keycloak, 26.8.1 for now, and check weekly against new releases to detect drift ([ADR-005](adr/005-payloads-are-recorded-never-invented.md)). Not on every pull request. A test holds the flow data to the recordings on every change |

**Decided: the stack.** SvelteKit for the view, with its static adapter, and plain TypeScript for the flow model and engine ([ADR-012](adr/012-sveltekit-for-the-view-and-plain-typescript-for-the-engine.md)). The maintainer first doubted that SvelteKit hosts easily as static files, and chose it after a test on a Pages-style server, in [research/followup-checks.md](research/followup-checks.md).

A content-site setup, with prose pages and the diagram as one embedded island, is what the research suggested. It is not the default, because it treats the diagram as an illustration.

- No mature library does step-through plus composable toggles, so expect a small custom renderer. Sequence layout is simple, so this is smaller than it sounds.
- Mermaid has no sequence animation and a large bundle, so do not use it at runtime. D2 has the closest variant model but only looping playback.
- SeqShow, Cinegram and Token Journey are worth reading for ideas, but are young, small and were not run.
- Use a stepper, not scroll-driven storytelling, because a sequence diagram needs a stable spatial frame.

## 10. Not goals, for now

- An article, blog post, scrolling essay or slide deck.
- A presenter view or slide export.
- Designing for phones first (section 6).
- A debugger for your own server. oauth.tools, OAuth Debugger and others already do this.
- Comparing vendors or IdPs.
- A tour of Keycloak features.
- Authz, beyond keeping the structure open to it.
- Redrawing saturated topics for their own sake, such as JWT decoding and WebAuthn demos.

## 11. Open questions, and the next session's job

Still to settle:

- **State and routing:** the rest of the URL shape. The base flow and diagram are in the path, with the rest in the query ([ADR-003](adr/003-state-is-in-the-url-and-variants-get-no-page.md)). Named states have a path of their own so they can be prerendered. Moving between steps replaces the history entry, and changing a setting, mode or diagram adds one.
- **Control model:** settled. Modifiers, exclusive choices and constraints by [ADR-013](adr/013-a-flow-is-one-ordered-list-of-conditional-steps.md), how presets relate to nodes by section 5.9, and base flows by a picker that keeps what still applies (section 5.4).
- **Moving to `authlines.io`:** when section 2's time comes, it means changing `SITE_URL` in `src/lib/site-url.ts` the base path in `scripts/build.mjs`, `playwright.config.ts` and the `preview` script, and the links in the README and the issue form, and setting up the redirect. Whether a custom domain redirects the old `github.io` address still has to be tried.

Settled on 2026-11-03, when the maintainer took the recommendations:

- **Whether to measure use.** Section 12 wants to know whether people come back, and [ADR-010](adr/010-static-files-on-github-pages.md) keeps nothing about a visitor outside their browser. **Decided:** it starts without it, and goes by GitHub stars and what people say.
- **When to let search engines in.** **Decided:** now. The repository variable `ALLOW_INDEXING` is `true`, so production deploys can be indexed. The address gets indexed too, and it will change at least once, when the site moves to `authlines.io`.

## 12. How to know it is working

**Proposed.** No deadline has been set. Success means people use the application and it stays cheap to grow.

- The maintainer reaches for it instead of drawing a new diagram, including when presenting.
- People find it, come back to it unprompted, and can get to the settings that match their question.
- Adding a toggle is a small change of flow data, recordings and tests, and the click-through still passes. What each addition cost is in [measurements.md](measurements.md).
- If new toggles keep forcing engine changes, rethink the model before adding more.
- If IdentiFlows ships toggles first, drop the general mechanic as the differentiator and keep the Keycloak layer.
