# ADR-016: A word on screen explains itself

Every term that needs explaining has one entry in `src/lib/flow/glossary.ts`: what it means in plain words, what else it is called, and where on the diagram it is, with the settings it needs. A renderer finds those terms in step text and marks the first use on each step with a dotted underline, so nobody writes a mark by hand. Selecting one explains it and lights up its place on the diagram, or links to where it can be seen. It has an address, `explain=term.scope`, like everything else on the screen ([ADR-003](003-state-is-in-the-url-and-variants-get-no-page.md)).

A test walks all simple-mode text in every valid combination, and fails on an acronym, a name from the wire or a word on its watch list that has no entry. So a new term cannot go in without its explanation, because every round adds words and nothing else would stop the next one.

The diagram is its own language too, so "How to read this" names its parts the same way, and each one lights up as it is selected.

An explanation opens in a dialog on top of the screen, and so does a setting's "Why?" and a source. The panel beside the diagram is where the step is explained, and an explanation that opened there took the place of what someone was reading. The dialog keeps to the side away from what it lights up, so that stays in view, and where that is not on screen it offers to show it. Pressing something in it that acts on the diagram, such as seeing only what one party saw, closes it, because the point is then on the diagram.

Where a picture says it better than words, the explanation has one, and the dialog makes room for it in the middle of the screen. The maintainer asked for this on 2026-11-06, after a rough version for [#167](https://github.com/vriesdemichael/authlines/issues/167): "Some explanations which are now done with text could be so much better this way". A picture is a flowchart of what happens next, or a relation diagram of who knows whom, and never a smaller copy of the arrows. It follows the settings and the words as the diagram does. Each part of it opens the steps it stands for, so Back comes back to it. A test holds every part to a step a recording draws, keeps the parts apart and their words inside them, and the words test reads its words as it reads the steps'. A picture goes on a concept, a word or a setting's Why, and not on a party. An explanation of a party keeps clear of its column, and a picture in the middle would cover it. The identity provider is the one exception, because the maintainer asked for its relations there. Which explanation has which picture is one table in `src/lib/pictures/index.ts`.

What is only about one server is marked as such, and goes when the notes about that server do ([ADR-015](015-keycloak-is-an-overlay-on-a-neutral-protocol.md)).

Someone new has to learn these words anyway, because the docs use them. A plain alternative for every one would leave them lost the moment they open those docs, so a word can be used once it can be asked about. A review found words used and never explained, and people leaving without ever learning what Keycloak is. This application has a diagram to point at, and a glossary page would waste that.

## Not chosen

- **A glossary page**: It takes someone away from what they were reading, and cannot point at the diagram.
- **Explanations in the panel with the step**: They took its place, which the maintainer found on using it.
- **Marking every use**: The same word underlined six times on a step is noise.
- **Marks written by hand in the text**: They would be forgotten, and the flow data would stop being plain words.
- **Marks in the settings rail**: Five short descriptions repeat the same words, and a setting already has its Why.
- **Other kinds of diagram as tabs beside the user flow and the setup**: Proposed for #167. The maintainer chose the explanation instead, which is where someone already asks what a thing is.
