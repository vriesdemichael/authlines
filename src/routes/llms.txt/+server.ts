import { REFERENCE_PATH, SKILL_PATH } from '#lib/agents.ts';
import { recordedIndex } from '#lib/recordings/known.ts';
import { SITE_URL } from '#lib/site-url.ts';

export const prerender = true;

/** Where an agent starts, by the llms.txt proposal (llmstxt.org, version 2), which allows a subpath. */
export function GET() {
	const text = `# Authlines

> OAuth and OpenID Connect flows as sequence diagrams to step through, recorded from a real Keycloak ${recordedIndex.keycloak}, with who has seen what at each step.

An agent helping someone with their own system can link to the flow that matches it, on the step it is explaining, with their names on the parties. The names go after the #, so they never reach a server.

## For agents

- [Linking to a flow](${SITE_URL}/${REFERENCE_PATH}): the address, the names, and every flow's settings, parties and steps, as Markdown.
- [The skill](${SITE_URL}/${SKILL_PATH}): the same, as an Agent Skills folder in a zip.

## Optional

- [Use it with your AI agent](${SITE_URL}/for-agents/): how a person sets their agent up.
- [Run it yourself](${SITE_URL}/run-it-yourself/): the same server on your own machine, with Docker.
`;
	return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
