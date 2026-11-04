<script lang="ts">
	import { resolve } from '$app/paths';
	import Mark from '#lib/components/Mark.svelte';
	import { exampleAddress, examples, guide, nameRules, viewSwitches } from '#lib/agents.ts';
	import { recordedIndex } from '#lib/recordings/known.ts';
	import { sharingTags, SITE_NAME } from '#lib/site.ts';
	import { SITE_URL } from '#lib/site-url.ts';

	const title = 'Links for an AI agent';
	const description =
		'How an agent helping someone can link to the recorded flow that matches their setup, with their own names on the parties.';
</script>

<svelte:head>
	<title>{title}: {SITE_NAME}</title>
	<meta name="description" content={description} />
	{#each sharingTags( { title, description, path: '/for-agents/' } ) as tag (tag.property ?? tag.name)}
		<meta {...tag} />
	{/each}
</svelte:head>

<main data-testid="for-agents">
	<p class="brand"><a href={resolve('/')}><Mark /> {SITE_NAME}</a></p>
	<h1>{title}</h1>
	<p>
		{SITE_NAME} draws OAuth and OpenID Connect flows as sequence diagrams, recorded from a real Keycloak
		{recordedIndex.keycloak}. If you are an agent helping someone with their own system, you can
		link to the flow and settings that match it, open it on the step you are explaining, and put
		their names on the parties. They get a diagram to step through, with who has seen what, and the
		requests a real server sent.
	</p>
	<p>
		Nothing here contacts their system. You describe it with a link, and the site draws its own
		recording with their names on it.
	</p>

	<h2>The address</h2>
	<pre><code
			>{SITE_URL}/&lt;flow&gt;/[setup/]?&lt;settings and view&gt;#v=1&amp;&lt;party&gt;=&lt;name&gt;</code
		></pre>
	<p>
		Leave out a setting to keep its default. The flow, its settings and the step are in the query,
		so the link opens exactly that. A setting that does not fit with the others is turned off, and
		the screen says why.
	</p>

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
			<ul>
				{#each flow.settings as setting (setting.param)}
					<li>
						<code>{setting.param}={setting.values.join(' | ')}</code>: {setting.label}, {setting.byDefault}
						by default.{setting.only ? ` ${setting.only}` : ''}
					</li>
				{/each}
			</ul>
			{#each flow.diagrams as diagram (diagram.id)}
				<h3>{diagram.title}: <code>{diagram.address}</code></h3>
				<p>Parties:</p>
				<ul>
					{#each diagram.parties as party (party.id)}
						<li><code>{party.id}</code>: {party.kind}, {party.role.toLowerCase()}</li>
					{/each}
				</ul>
				<details>
					<summary>Steps, for step=</summary>
					<ul>
						{#each diagram.steps as step (step.id)}
							<li><code>{step.id}</code>: {step.says}</li>
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
