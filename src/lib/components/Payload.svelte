<script lang="ts">
	import type { Step } from '#lib/flow/model.ts';
	import type { Note } from '#lib/keycloak/notes.ts';
	import type { RecordedMessage } from '#lib/recordings/format.ts';
	import {
		artifactOf,
		jwtOf,
		jwtsIn,
		originOf,
		rawLines,
		redactedLines,
		samlIn,
		samlOf,
		type DecodedJwt,
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
		/** Each value decoded and each token opened where it is, instead of as it was sent. */
		decoded?: boolean;
		/** Offered only where decoding changes something, so the switch never seems to do nothing. */
		ondecode?: ((decoded: boolean) => void) | null;
		/** Opens what explains a word: here, what each claim in a token says (#200). */
		onterm?: (id: string) => void;
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
		whole = false,
		decoded = false,
		ondecode = null,
		onterm
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
	// Whether decoding would change anything someone can see here.
	const decodable = $derived(
		lines.some(
			(line) =>
				(line.decoded !== undefined && line.decoded !== line.value) ||
				jwtOf(line) !== null ||
				samlOf(line) !== null
		)
	);
	const shownAs = (line: Line) =>
		decoded && line.decoded !== undefined ? line.decoded : line.value;
	const origin = (line: Line) => originOf(line, step.id, trace);
	let opened = $state<Record<string, boolean>>({});

	/** Which setting put what in this token: the part of it that surprises people. */
	function settingsBehind(jwt: DecodedJwt) {
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

<!-- The word explains itself, as any on screen does (ADR-016), with what each claim says. -->
{#snippet claimsHead()}
	{#if onterm}
		<button type="button" class="part term" data-term="claim" onclick={() => onterm('claim')}
			>claims</button
		>
	{:else}
		<span class="part">claims</span>
	{/if}
{/snippet}

{#snippet behind(jwt: DecodedJwt)}
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
{/snippet}

{#if decodable && ondecode && !redacted}
	<div class="as" role="group" aria-label="How the traffic is shown">
		<button
			type="button"
			aria-pressed={!decoded}
			data-testid="wire-as-sent"
			onclick={() => ondecode(false)}>As sent</button
		>
		<button
			type="button"
			aria-pressed={decoded}
			data-testid="wire-decoded"
			onclick={() => ondecode(true)}>Decoded</button
		>
	</div>
{/if}

<div class="raw" data-testid="payload" data-decoded={decoded} tabindex="-1">
	{#each lines as line, i (i)}
		{@const from = origin(line)}
		{@const token = decoded ? jwtOf(line) : null}
		{@const saml = decoded && !token ? samlOf(line) : null}
		{@const shown = shownAs(line)}
		<div class="line">
			<span data-line
				>{line.before}{#if line.hidden !== undefined}<span
						class="blacked"
						data-hidden={line.hidden}
						role="img"
						aria-label="Hidden"
						style:width={`${Math.min(line.hidden, MOST_BLACKED_OUT)}ch`}

					></span>{:else if token || saml}{:else if shown !== undefined}{#if shown.length > LONG && !line.whole}<button
							type="button"
							class="value long"
							class:open={whole || opened[i]}
							data-artifact={artifactOf(step, line.name)}
							aria-expanded={whole || Boolean(opened[i])}
							onclick={() => (opened[i] = !opened[i])}>{shown}</button
						>{:else}<span class="value" data-artifact={artifactOf(step, line.name)}>{shown}</span
						>{/if}{/if}{#if !token && !saml}{line.after ?? ''}{/if}</span
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
		{#if token}
			<!-- Opened where it was sent, which is what the maintainer asked for on 2026-11-06. -->
			<div class="opened" data-testid="opened-token" data-token={token.name}>
				<span class="part">header</span>
				<!-- Long enough to scroll, which a keyboard can only do to something it can focus. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre tabindex="0" aria-label={`Header of ${token.name}`}>{JSON.stringify(
						token.header,
						null,
						2
					)}</pre>
				{@render claimsHead()}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre tabindex="0" aria-label={`Claims of ${token.name}`}>{JSON.stringify(
						token.claims,
						null,
						2
					)}</pre>
				<span class="part">signature, as sent</span>
				<div class="line">
					<button
						type="button"
						class="value long"
						class:open={whole || opened[-1 - i]}
						aria-expanded={whole || Boolean(opened[-1 - i])}
						onclick={() => (opened[-1 - i] = !opened[-1 - i])}>{token.signature}</button
					>
				</div>
				{@render behind(token)}
			</div>
		{:else if saml}
			<div class="opened" data-testid="opened-saml" data-token={saml.name}>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<pre tabindex="0" aria-label={`What ${saml.name} says`}>{saml.xml}</pre>
			</div>
		{/if}
		{#if (token || saml) && line.after}
			<div class="line"><span data-line>{line.after}</span></div>
		{/if}
	{/each}
</div>

{#each decoded ? [] : samls as saml (saml.name)}
	<details class="jwt" data-testid="saml">
		<summary>Inside <code>{saml.name}</code></summary>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<pre tabindex="0" aria-label={`What ${saml.name} says`}>{saml.xml}</pre>
	</details>
{/each}

{#each decoded ? [] : jwts as jwt (jwt.name)}
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
		{@render behind(jwt)}
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

	.as {
		display: inline-flex;
		margin: 0 0 6px;
		border: 1px solid var(--line);
		border-radius: 6px;
		overflow: hidden;
	}

	.as button {
		padding: 2px 8px;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.as button[aria-pressed='true'] {
		background: var(--panel);
		color: var(--fg);
		font-weight: 600;
	}

	.opened {
		margin: 2px 0 4px 2ch;
		padding-left: 8px;
		border-left: 2px solid var(--line);
	}

	.part {
		display: block;
		color: var(--muted);
		font-family: var(--sans);
		font-size: 11px;
	}

	/* Quiet, as a word in a step's text is, because what is under it matters more. */
	.part.term {
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		text-decoration: underline dotted var(--strong-line);
		text-underline-offset: 3px;
		cursor: help;
	}

	.part.term:hover {
		color: var(--accent);
		text-decoration-color: var(--accent);
	}

	.opened pre {
		margin: 0 0 4px;
		overflow-x: auto;
		font: inherit;
		white-space: pre-wrap;
		word-break: break-word;
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
