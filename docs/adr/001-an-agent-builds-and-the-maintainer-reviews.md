# ADR-001: An agent builds, and the maintainer reviews and steers

Agents write the code, flow data and content here, and the maintainer reviews and steers. Work reaches `main` through a pull request that CI has to pass. The maintainer judges the result on the live site, and has allowed the agent to take issues from the backlog and merge its own green pull requests. So a wrong turn is corrected on what is deployed.

A larger new implementation that is not in an issue yet is discussed with the maintainer before it is built: a new part of the engine, a new base flow, a new tool, or a change to how the application is structured. Say what would be built, what is left out and what it will show, then wait for an answer. An issue in the backlog has had that discussion, and a small change inside what is already agreed needs none. A decision the maintainer has kept, such as the name, still waits for them.

Everything a contributor needs is written down where an agent finds it, because a session keeps nothing: `CLAUDE.md` for working in this repository, the premise for intent, and these records for rules. When you find a convention that is written nowhere, propose a record.

A reader is cited as what it was. An AI agent given a role is "an AI agent given the job of a product manager", and says what it had loaded, because agents here start with this project's instructions. Agents find bugs and false claims, and they know the words, so they do not stand in for a person on whether someone can follow this or wants it. An acceptance criterion about people is only met by people.

A large build that goes the wrong way costs more to review than it would have cost to discuss.

## Not chosen

- **Build first and discuss the result**: On a large change the review becomes the design discussion, after the work is done.
- **Let conventions be inferred from the code**: It is slower and inconsistent, and it copies whatever the code got wrong.
