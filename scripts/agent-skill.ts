// Writes the skill and the plugin that holds it, which are committed so that Claude Code can install
// them from this repository. They are made from the flow data, and a unit test fails when what is
// committed is not what this makes, so run it after the flows change.
//
//   pnpm agent-skill
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pluginFiles } from '#lib/agents.ts';

for (const file of pluginFiles()) {
	mkdirSync(dirname(file.path), { recursive: true });
	writeFileSync(file.path, file.text);
	console.log(`Wrote ${file.path}`);
}
