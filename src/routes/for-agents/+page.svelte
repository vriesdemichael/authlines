<script lang="ts">
	import { resolve } from '$app/paths';
	import CopyBlock from '#lib/components/CopyBlock.svelte';
	import Mark from '#lib/components/Mark.svelte';
	import {
		aboutTheAddress,
		addressFormat,
		codeParts,
		claudeCodeInstall,
		claudeSkillsFolder,
		drawnShorter,
		exampleAddress,
		examples,
		forAnAgent,
		guide,
		nameRules,
		notDrawnSaid,
		pasteInstruction,
		SETTING_NOTES,
		sharedSkillsFolder,
		viewSwitches
	} from '#lib/agents.ts';
	import { sharingTags, SITE_NAME } from '#lib/site.ts';

	const zipHref = resolve('/for-agents/authlines-skill.zip');
	const markdownHref = resolve('/for-agents/index.html.md');

	const title = 'Use it with your AI agent';
	const description =
		'Set up your AI agent to link to the recorded flow that matches your system, on the step it is explaining, with your names on the parties.';
</script>

{#snippet withCode(text: string)}
	{#each codeParts(text) as part, index (index)}
		{#if index % 2}<code>{part}</code>{:else}{part}{/if}
	{/each}
{/snippet}

<svelte:head>
	<title>{title}: {SITE_NAME}</title>
	<meta name="description" content={description} />
	<!-- The part for an agent, as Markdown, where llms.txt says to look for it (llmstxt.org). -->
	<link rel="alternate" type="text/markdown" href={markdownHref} />
	{#each sharingTags( { title, description, path: '/for-agents/' } ) as tag (tag.property ?? tag.name)}
		<meta {...tag} />
	{/each}
</svelte:head>

<main data-testid="for-agents">
	<p class="brand"><a href={resolve('/')}><Mark /> {SITE_NAME}</a></p>
	<h1>{title}</h1>
	<p>
		An AI agent helping you with your own system can link here: to the flow that matches it, on the
		step it is explaining, with your names on the parties. You get a diagram to step through beside
		its answer, and the requests a real server sent. The names go after the # in the link, so they
		stay in your browser and never reach this site's server.
	</p>

	<h2>Set it up</h2>
	<section data-testid="set-up">
		<h3>Claude Code</h3>
		<p>Add it as a plugin, in a Claude Code session:</p>
		<CopyBlock text={claudeCodeInstall} label="the two commands" />

		<h3>Claude on the web and in the desktop app</h3>
		<p>
			<a href={zipHref} download data-testid="skill-zip">Download the skill</a>, then upload it
			under Customize, Skills. It needs code execution on.
		</p>

		<h3>Codex, GitHub Copilot, Cursor and Gemini CLI</h3>
		<p>
			Unzip the same download into <code>{sharedSkillsFolder}</code>, so that it is
			<code>{sharedSkillsFolder}authlines/SKILL.md</code>. Claude Code reads
			<code>{claudeSkillsFolder}</code> the same way, if you would rather not use the plugin.
		</p>

		<h3>Any other agent</h3>
		<p>Add this to its instructions:</p>
		<CopyBlock text={pasteInstruction} label="the instruction" />
	</section>
	<p>Then ask it how your own app logs people in. If it does not link here by itself, ask it to.</p>

	<h2>For the agent</h2>
	<p>
		The rest of this page is what the skill tells an agent, and it is also
		<a href={markdownHref} data-testid="reference-md">one Markdown file</a>.
	</p>
	{#each forAnAgent as said (said)}
		<p>{said}</p>
	{/each}

	<h2>The address</h2>
	<pre><code>{addressFormat}</code></pre>
	<p>{aboutTheAddress}</p>

	<h2>What is not drawn here</h2>
	<p>{SITE_NAME} does not draw {notDrawnSaid}.</p>
	<p>{@render withCode(drawnShorter)}</p>

	<h2>Names for the parties</h2>
	<ul>
		{#each nameRules as rule (rule)}
			<li>{rule}</li>
		{/each}
	</ul>

	<h2>Examples</h2>
	<ul data-testid="examples">
		{#each examples as example (example.path)}
			<li>
				{example.says}
				<br />
				{#if example.broken}
					<code data-testid="example-broken">{exampleAddress(example)}</code>
				{:else}
					<!-- The whole address to copy, and a link that opens it on this copy of the site. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved at the start -->
					<a href={`${resolve('/')}${example.path}`} rel="external" data-testid="example"
						><code>{exampleAddress(example)}</code></a
					>
				{/if}
			</li>
		{/each}
	</ul>

	<h2>How it is shown</h2>
	<ul>
		{#each viewSwitches as view (view.param)}
			<li><code>{view.param}</code>: {view.says}</li>
		{/each}
	</ul>

	{#each guide as flow (flow.id)}
		<section data-flow={flow.id}>
			<h2>{flow.title}: <code>{flow.id}</code></h2>
			<p>{flow.summary}</p>
			<h3>Settings</h3>
			<p>{SETTING_NOTES}</p>
			<ul>
				{#each flow.settings as setting (setting.param)}
					<li>
						<code>{setting.param}={setting.values.join(' | ')}</code>: {setting.label}, {setting.byDefault}
						by default. {setting.summary}{setting.only ? ` ${setting.only}` : ''}
						{#each [...setting.needs, ...setting.rulesOut, ...setting.withThird] as said (said)}
							{@render withCode(said)}
						{/each}
					</li>
				{/each}
			</ul>
			{#each flow.diagrams as diagram (diagram.id)}
				<h3>{diagram.title}: <code>{diagram.address}</code></h3>
				<p>Parties:</p>
				<ul>
					{#each diagram.parties as party (party.id)}
						<li>
							<code>{party.id}</code>: {party.kind}, {party.role.toLowerCase()}.
							{#if party.when}{@render withCode(party.when)}{/if}
						</li>
					{/each}
				</ul>
				<details>
					<summary>Steps, for step=</summary>
					<ul>
						{#each diagram.steps as step (step.id)}
							<li>
								<code>{step.id}</code>: {step.says}.
								{#if step.when}{@render withCode(step.when)}{/if}
							</li>
						{/each}
					</ul>
				</details>
			{/each}
		</section>
	{/each}
</main>

<style>
	main {
		max-width: 760px;
		margin: 24px auto;
		padding: 0 24px 40px;
	}

	.brand {
		color: var(--muted);
		font-size: 13px;
	}

	h1 {
		margin: 12px 0;
		font-size: 22px;
	}

	h2 {
		margin: 24px 0 6px;
		font-size: 15px;
	}

	h3 {
		margin: 16px 0 4px;
		font-size: 13.5px;
	}

	p,
	li {
		margin: 0 0 6px;
		line-height: 1.5;
	}

	code,
	pre {
		font-family: var(--mono);
		font-size: 0.9em;
		overflow-wrap: anywhere;
	}

	pre {
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--panel);
		white-space: pre-wrap;
	}
</style>
