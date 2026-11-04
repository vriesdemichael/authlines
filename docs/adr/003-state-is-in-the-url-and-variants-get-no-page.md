# ADR-003: The state is in the URL, and a variant gets no page of its own

Everything on the application screen follows from one state: base flow, diagram, settings, mode, current step, any open source, whatever someone asked to have explained, and whether the settings are put out of the way. All of it is in the URL, so an exact view can be opened, shared and tested. The base flow and diagram are in the path, with setup at `/{flow}/setup/`, so each diagram is prerendered. The rest is in the query, and only what differs from the defaults. Names a link gives the parties go after the `#` instead, so they never reach a server ([ADR-017](017-a-link-may-name-the-parties-and-nothing-else.md)). A variant of a flow never gets a page of its own. A different base flow or diagram can be a different view, inside the same application.

A node on the map is a question and the exact state that answers it. It has a path as well, `/{flow}/{node}/`, so it can be prerendered with its own title and be found, but that path is another way to open a state on the same screen, and a query on it adds to the state.Moving on from a node keeps its address, with the step in the query, for as long as the settings still answer its question, so a reload or a link keeps the question. Changing that goes to the usual address for where you are. A state reached by hand has an address either way, and a node is only marked as where you are when its settings match.

Steps are addressed by stable ID, not by number, because rows shift when a setting changes. When a setting removes the current step, the state moves to the nearest earlier step that remains. An ID that has shipped keeps working, so a link stays exact: `shipped-step-ids.json` holds them and a test fails if one goes. No step has been renamed yet, so the first rename also adds the alias, next to where `state.ts` reads the older forms. A link in an older form opens the same step and then replaces itself with the current form, as `?setup=1` and a setup step on the user flow's path do.

Opening a source adds a history entry and moving between its sections replaces it, so Back closes the source. A link naming a source or setting that does not exist opens nothing, like any other unknown value.

The unit of work in this application is a state, and stable IDs are also what let a toggle animate as a change instead of a redraw.

## Not chosen

- **A page per variant**: It is what this application exists to improve on, and it cannot show one diagram changing.
- **Step numbers in the URL**: A toggle renumbers the steps, so a link would open the wrong one.
- **State held only in memory**: No link could open an exact view, and a test would have to click its way to every state.
