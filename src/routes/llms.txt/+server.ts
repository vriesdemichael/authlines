import { SITE_URL } from '#lib/site-url.ts';
import { recordedIndex } from '#lib/recordings/known.ts';

export const prerender = true;

/** Where an agent starts, by a convention some of them look for (llmstxt.org, a proposal). */
export function GET() {
	const text = `# Authlines

> OAuth and OpenID Connect flows as sequence diagrams to step through, recorded from a real Keycloak ${recordedIndex.keycloak}, with who has seen what at each step.

- [Links for an AI agent](${SITE_URL}/for-agents/): how to link to the recorded flow that matches someone's setup, with their names on the parties.
- [Run it yourself](${SITE_URL}/run-it-yourself/): the same server on your own machine, with Docker.
`;
	return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
