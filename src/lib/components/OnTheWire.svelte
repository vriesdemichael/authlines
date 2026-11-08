<script lang="ts">
	import Payload from '#lib/components/Payload.svelte';
	import RunValues from '#lib/components/RunValues.svelte';
	import type { Step } from '#lib/flow/model.ts';
	import type { Note } from '#lib/keycloak/notes.ts';
	import { curlFor } from '#lib/recordings/curl.ts';
	import type { Recording } from '#lib/recordings/format.ts';
	import { traceRun, valuesSeen } from '#lib/recordings/wire.ts';

	/** A link the route has already resolved. */
	interface Link {
		text: string;
		href: string;
	}

	interface Props {
		/** On a phone, folded until someone opens it, so a step is not a long scroll (#15). */
		folded?: boolean;
		step: Step;
		/** The one real run for these settings, once it has loaded. */
		recording: Recording | null;
		/** What it is like while there is none to show. */
		status: 'loaded' | 'loading' | 'failed' | 'none';
		/** The closest states that do have a recording, when these settings have none. */
		nearest?: readonly Link[];
		/** The step someone just executed, when this step is its answer. */
		answerTo?: string | null;
		numberOf: (step: string) => number | null;
		onstep?: (step: string) => void;
		/** Whether to name the server this was recorded from. */
		serverNamed?: boolean;
		/** What one server has to say about this step, some of it about what is in a token. */
		notes?: readonly Note[];
		/** Which steps whoever this is shown as was part of. */
		seesStep?: (step: string) => boolean;
		/** Where to run the same server at home, with the settings on screen. */
		runHref?: string | null;
		/** Someone wants to read this from the back of a room. */
		onlarge?: (() => void) | null;
		/** It is being read like that. */
		large?: boolean;
		/** Names a link gave, and which recorded value is which of them (#168). */
		seam?: string | null;
		/** Each value decoded and each token opened where it is, instead of as it was sent. */
		decoded?: boolean;
		ondecode?: ((decoded: boolean) => void) | null;
		/** Opens what explains a word, such as what the claims in a token are. */
		onterm?: (id: string) => void;
	}

	let {
		step,
		recording,
		status,
		nearest = [],
		answerTo = null,
		numberOf,
		onstep,
		serverNamed = true,
		notes = [],
		seesStep = () => true,
		runHref = null,
		onlarge = null,
		large = false,
		seam = null,
		folded = false,
		decoded = false,
		ondecode = null,
		onterm
	}: Props = $props();

	const message = $derived(recording?.messages.find((candidate) => candidate.step === step.id));
	const trace = $derived(recording ? traceRun(recording) : []);
	const here = $derived(numberOf(step.id) ?? 0);
	// Not for what whoever this is shown as was never sent, because that would hand over all of it.
	const command = $derived(message && seesStep(step.id) ? curlFor(message, numberOf) : null);
	let copied = $state<'yes' | 'no' | null>(null);
	$effect(() => {
		void command;
		copied = null;
	});
	async function copy() {
		try {
			await navigator.clipboard.writeText(command ?? '');
			copied = 'yes';
		} catch {
			copied = 'no';
		}
	}
	// Earlier steps always count as executed, so what the run has so far follows from the step alone.
	const soFar = $derived(
		recording
			? valuesSeen(recording, trace, seesStep, (id) => (numberOf(id) ?? Infinity) <= here)
			: []
	);
</script>

<svelte:element this={folded ? 'details' : 'section'} class="wire" data-testid="on-the-wire">
	{#if folded}
		<summary data-testid="on-the-wire-open">
			{message?.log ? 'From the log, not the wire' : 'On the wire'}
		</summary>
	{:else}
		<h3>{message?.log ? 'From the log, not the wire' : 'On the wire'}</h3>
	{/if}
	{#if onlarge && status === 'loaded' && message}
		<button type="button" class="large" data-testid="read-large" onclick={onlarge}>
			Read it large
		</button>
	{/if}
	{#if status === 'none'}
		<div data-testid="no-recording">
			<p>
				No recording of this exact combination of settings, so nothing is shown. Payloads here are
				never put together by hand.
			</p>
			{#if nearest.length}
				<p>The closest that were recorded:</p>
				<ul>
					{#each nearest as link (link.href)}
						<li>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
							<a href={link.href} data-testid="nearest-recording">{link.text}</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if status === 'loading'}
		<p data-testid="recording-loading">Loading the recording.</p>
	{:else if status === 'failed' || !recording}
		<p data-testid="recording-failed">The recording could not be loaded.</p>
	{:else if !message}
		<p data-testid="not-recorded">
			The server it was recorded from did not send this, so there is nothing to show.
		</p>
	{:else}
		{#if answerTo}
			<p class="answer" data-testid="answer-to">The answer to step {numberOf(answerTo)}.</p>
		{/if}
		{#if command}
			<p class="copy">
				<button type="button" data-testid="copy-request" onclick={copy}>Copy as curl</button>
				<span role="status">
					{#if copied === 'yes'}Copied, with throwaway values.{/if}
				</span>
			</p>
			{#if copied === 'no'}
				<!-- The browser would not let it be copied, so here it is to select by hand. -->
				<pre data-testid="copy-by-hand">{command}</pre>
			{/if}
		{/if}
		{#if seam}
			<p class="seam" data-testid="names-seam">{seam}</p>
		{/if}
		<Payload
			{step}
			{message}
			{trace}
			{numberOf}
			{onstep}
			{notes}
			{serverNamed}
			redacted={!seesStep(step.id)}
			whole={large}
			decoded={decoded && !message.log}
			ondecode={message.log ? null : ondecode}
			{onterm}
		/>
		<RunValues values={soFar} {numberOf} {onstep} />
		<p class="origin" data-testid="payload-origin">
			One real run against {serverNamed ? `Keycloak ${recording.keycloak}` : 'a real server'}, on {recording.recordedAt},
			on one machine and so over plain HTTP, with throwaway values. Anywhere else all of this has to
			be HTTPS.
			{#if message.log}
				The connection to the directory was not encrypted either, which is what ssf=0 says in the
				log, and anywhere else it needs LDAPS or StartTLS.
			{:else}
				Only the headers that matter here were kept.
			{/if}
			{#if recording.settings.clientType === 'public' && recording.settings.appRuns !== 'page'}
				What ran here was a server standing in for an app in a page, on a phone or on a device.
			{/if}
			{#if !serverNamed}
				Names such as realms, and claims such as realm_access, are that server's own, and the name
				of its session cookie is left out.
			{/if}
			{#if runHref}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
				<a href={runHref} data-testid="run-it-yourself-link">Run the same server yourself.</a>
			{/if}
		</p>
	{/if}
</svelte:element>

<style>
	.wire {
		margin-top: 12px;
	}

	.large {
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 12.5px;
		text-decoration: underline;
		cursor: pointer;
	}

	h3 {
		margin: 0 0 6px;
		font-size: 13px;
	}

	p {
		margin: 0 0 6px;
		font-size: 12.5px;
	}

	ul {
		margin: 0;
		padding-left: 16px;
		font-size: 12.5px;
	}

	.answer {
		font-weight: 600;
	}

	.copy button {
		font-size: 12px;
	}

	.copy span {
		margin-left: 6px;
		color: var(--muted);
	}

	pre {
		margin: 0 0 6px;
		overflow-x: auto;
		font-family: var(--mono);
		font-size: 11.5px;
	}

	.origin {
		margin-top: 8px;
		color: var(--muted);
		font-size: 11.5px;
	}

	/* Where the names on the diagram and the recorded values part, said once above the traffic. */
	.seam {
		margin: 0 0 8px;
		font-size: 12px;
	}
</style>
