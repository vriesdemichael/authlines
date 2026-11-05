import { referenceMarkdown, SKILL_NAME, SKILL_REFERENCE, skillMarkdown } from '#lib/agents.ts';
import { zip } from '#lib/zip.ts';

export const prerender = true;

/** The skill as a folder in a zip, which is what a skill upload takes and what a skills folder holds. */
export function GET() {
	const bytes = zip([
		{ path: `${SKILL_NAME}/SKILL.md`, text: skillMarkdown() },
		{ path: `${SKILL_NAME}/${SKILL_REFERENCE}`, text: referenceMarkdown() }
	]);
	return new Response(bytes, { headers: { 'content-type': 'application/zip' } });
}
