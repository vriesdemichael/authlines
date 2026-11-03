<script lang="ts">
	import type { Step } from '#lib/flow/model.ts';
	import type { Note } from '#lib/keycloak/notes.ts';
	import type { RecordedMessage } from '#lib/recordings/format.ts';
	import {
		artifactOf,
		jwtsIn,
		originOf,
		rawLines,
		redactedLines,
		samlIn,
		type Line,
		type RunValue
	} from '#lib/recordings/wire.ts';

	interface Props {
		step: Step;
		message: RecordedMessage;
		trace: readonly RunValue[];
		numberOf: (step: string) => number | null;
		onstep?: (step: string) => void;
		/** Notes on this step, for what in the access token each one is about. */
		notes?: readonly Note[];
		serverNamed?: boolean;
		/** Whoever this is shown as was not part of this message. */
		redacted?: boolean;
		/** Every value in full, for reading in front of a room. */
		whole?: boolean;
	}

	let {
		step,
		message,
		trace,
		numberOf,
		onstep,
		notes = [],
		serverNamed = true,
		redacted = false,
		whole = false
	}: Props = $props();

	const LONG = 40;
	const MOST_BLACKED_OUT = 44;
	const lines = $derived(
		redacted
			? redactedLines(rawLines(message, { serverNamed }))
			: rawLines(message, { serverNamed })
	);
	const jwts = $derived(jwtsIn(lines));
	const samls = $derived(samlIn(lines));
	const origin = (line: Line) => originOf(line, step.id, trace);
	let opened = $state<Record<string, boolean>>({});

	/** Which setting put what in this token: the part of it that surprises people. */
	function settingsBehind(jwt: { name: string; claims: unknown }) {
		if (jwt.name !== 'access_token') return [];
		const inToken = Object.keys(jwt.claims as object);
		return notes.flatMap((note) => {
			const claims = note.claims.filter((claim) => inToken.includes(claim));
			return claims.length ? [{ note, claims }] : [];
		});
	}

	function openNote(id: string) {
		const note = document.querySelector<HTMLDetailsElement>(`[data-note="${id}"]`);
		if (!note) return;
		note.open = true;
		note.scrollIntoView({ block: 'nearest' });
		note.querySelector('summary')?.focus();
	}
</script>

<div class="raw" data-testid="payload" tabindex="-1">
	{#each lines as line, i (i)}
		{@const from = origin(line)}
		<div class="line">
			<span data-line
				>{line.before}{#if line.hidden !== undefined}<span
						class="blacked"
						data-hidden={line.hidden}
						role="img"
						aria-label="Hidden"
						style:width={`${Math.min(line.hidden, MOST_BLACKED_OUT)}ch`}

					></span>{:else if line.value !== undefined}{#if line.value.length > LONG && !line.whole}<button
							type="button"
							class="value long"
							class:open={whole || opened[i]}
							data-artifact={artifactOf(step, line.name)}
							aria-expanded={whole || Boolean(opened[i])}
							onclick={() => (opened[i] = !opened[i])}>{line.value}</button
						>{:else}<span class="value" data-artifact={artifactOf(step, line.name)}
							>{line.value}</span
						>{/if}{/if}{line.after ?? ''}</span
			>
			{#if from && 'new' in from}
				<span class="origin new" data-new={line.name}>new</span>
			{:else if from && numberOf(from.from) !== null}
				<button
					type="button"
					class="origin from"
					data-from={from.from}
					onclick={() => onstep?.(from.from)}
				>
					from step {numberOf(from.from)}
				</button>
			{/if}
		</div>
	{/each}
</div>

{#each samls as saml (saml.name)}
	<details class="jwt" data-testid="saml">
		<summary>Inside <code>{saml.name}</code></summary>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<pre tabindex="0" aria-label={`What ${saml.name} says`}>{saml.xml}</pre>
	</details>
{/each}

{#each jwts as jwt (jwt.name)}
	<details class="jwt" data-testid="jwt">
		<summary>Inside <code>{jwt.name}</code></summary>
		<!-- Long enough to scroll, which a keyboard can only do to something it can focus. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<pre tabindex="0" aria-label={`Header of ${jwt.name}`}>{JSON.stringify(
				jwt.header,
				null,
				2
			)}</pre>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<pre tabindex="0" aria-label={`Claims of ${jwt.name}`}>{JSON.stringify(
				jwt.claims,
				null,
				2
			)}</pre>
		{#if settingsBehind(jwt).length}
			<ul class="behind" data-testid="token-settings">
				{#each settingsBehind(jwt) as { note, claims } (note.id)}
					<li>
						<code>{claims.join(', ')}</code>
						{note.claimsVerb ?? 'comes from'}
						<button
							type="button"
							class="from"
							data-open-note={note.id}
							onclick={() => openNote(note.id)}
						>
							{note.title}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</details>
{/each}

<style>
	.raw {
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--panel);
		font-family: var(--mono);
		font-size: var(--raw-size, 11.5px);
		line-height: 1.5;
	}

	.raw:focus-visible {
		outline: 2px solid var(--accent);
	}

	.line {
		min-height: 1.5em;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.blacked {
		display: inline-block;
		max-width: 100%;
		height: 0.9em;
		border-radius: 2px;
		background: var(--muted);
		vertical-align: -0.05em;
	}

	.value {
		border-radius: 3px;
		color: var(--chip, inherit);
		background: var(--chip-soft, transparent);
		font-weight: 500;
	}

	button.value {
		padding: 0;
		border: 0;
		font: inherit;
		font-weight: 500;
		text-align: left;
		word-break: break-all;
	}

	.long:not(.open) {
		display: inline-block;
		max-width: 12ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		vertical-align: bottom;
	}

	.origin {
		margin-left: 6px;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--sans);
		font-size: 11px;
		white-space: nowrap;
	}

	.new {
		color: var(--fg);
		font-weight: 600;
	}

	.from {
		color: var(--accent);
		text-decoration: underline;
	}

	.jwt {
		margin-top: 6px;
		font-size: 12.5px;
	}

	.jwt summary {
		cursor: pointer;
	}

	.behind {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
		font-size: 12px;
	}

	.behind li {
		padding: 2px 0;
	}

	.behind code {
		overflow-wrap: anywhere;
	}

	.behind .from {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
	}

	.jwt pre {
		margin: 4px 0 0;
		padding: 8px 10px;
		overflow-x: auto;
		border-radius: 6px;
		background: var(--panel);
		font-family: var(--mono);
		font-size: 11.5px;
	}
</style>
