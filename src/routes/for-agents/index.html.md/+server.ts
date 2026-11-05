import { referenceMarkdown } from '#lib/agents.ts';

export const prerender = true;

/** The page for agents as Markdown, which is what the skill and llms.txt point an agent at. */
export function GET() {
	return new Response(referenceMarkdown(), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
}
