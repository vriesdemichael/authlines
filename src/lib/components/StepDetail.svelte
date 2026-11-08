<script lang="ts">
	import type { Snippet } from 'svelte';
	import KeycloakNote from '#lib/components/KeycloakNote.svelte';
	import Worded from '#lib/components/Worded.svelte';
	import { markTerms } from '#lib/flow/glossary.ts';
	import type { Lifeline, Step, ViewDiff } from '#lib/flow/model.ts';
	import { settingDefs, whyItIsHere, type Reset, type SettingId } from '#lib/flow/settings.ts';
	import { channels, whyOf, type Mode, type ShotId } from '#lib/flow/vocabulary.ts';
	import { DEFAULT_WORDING, nameIn, type Wording } from '#lib/flow/wording.ts';
	import type { Note } from '#lib/keycloak/notes.ts';
	import { recordedIndex, type Known } from '#lib/recordings/known.ts';
	import { refLabel, type SourceRef } from '#lib/sources/sources.ts';

	/** A link the route has already resolved. */
	interface Link {
		text: string;
		href: string;
	}

	interface Props {
		/** On a phone, folded until someone opens it, so a step is not a long scroll (#15). */
		folded?: boolean;
		step: Step;
		lifelines: readonly Lifeline[];
		/** Whose words to name them in, when someone chose. */
		wording?: Wording;
		mode?: Mode;
		/** Where someone new starts, shown on the first step. */
		intro?: string | null;
		/** Why this part of the flow is here, on the step that starts it. */
		partWhy?: string | null;
		/** Who this is being shown as, when they were not part of this step. */
		unseenBy?: string | null;
		/** The app may be running in the browser that is said not to have seen this. */
		unseenButInThePage?: boolean;
		change?: ViewDiff | null;
		resets?: readonly Reset[];
		links?: readonly Link[];
		/** A setting changed nothing in this diagram, but did in the other one. */
		elsewhere?: Link | null;
		/** The setting that was just changed, because a change alone does not say why it exists. */
		changed?: SettingId | null;
		/** What it was changed to, because an option can have a reason of its own. */
		changedTo?: unknown;
		/** Someone asked what a word means. */
		onterm?: (id: string) => void;
		/** What this step looks like on the wire, ahead of what each part of it is for. */
		wire?: Snippet;
		/** Someone wants all of what steps say is left to them, in one list. */
		onlist?: () => void;
		/** Someone wants to read what this step cites. */
		oncite?: (ref: SourceRef) => void;
		/** What the person sees in their browser at this step. */
		inTheBrowser?: Snippet;
		/** Where the picture of a page is. None without the server's notes (ADR-015). */
		pageImage?: ((shot: ShotId) => string) | null;
		/** What one server has to say about this step, and whether to name that server at all. */
		notes?: readonly Note[];
		serverNamed?: boolean;
		/** How we know this message looks the way it does. */
		known?: Known | null;
		/** How the step before this one travelled, because the channel is only news when it changes. */
		previousChannel?: Step['channel'] | null;
		/** This is the last step, so say where to go from here. */
		atEnd?: boolean;
		onward?: { title: string; summary: string; href: string; label?: string } | null;
		mapHref?: string | null;
	}

	let {
		step,
		lifelines,
		mode = 'advanced',
		wording = DEFAULT_WORDING,
		inTheBrowser,
		onlist,
		oncite,
		pageImage = null,
		intro = null,
		partWhy = null,
		unseenBy = null,
		unseenButInThePage = false,
		change = null,
		resets = [],
		links = [],
		elsewhere = null,
		changed = null,
		changedTo,
		onterm,
		wire,
		notes = [],
		serverNamed = true,
		known = null,
		previousChannel = null,
		atEnd = false,
		onward = null,
		mapHref = null,
		folded = false
	}: Props = $props();

	const simple = $derived(mode === 'simple');
	// In reading order, so a word is marked where someone first meets it on this step.
	const worded = $derived(
		markTerms(
			[intro ?? '', step.concept, step.inPractice ?? '', step.pitfall?.text ?? '', partWhy ?? ''],
			{ serverNamed }
		)
	);
	// A message from the server is what the header and the raw view already say. What needs saying on
	// a step is anything else, and to someone new only that nobody recorded it.
	const showKnown = $derived(
		known &&
			!(known.kind === 'recorded' && known.by === 'server') &&
			(!simple || known.kind === 'spec')
	);
	const wordsOf = (text: string) => text.toLowerCase().replace(/\b(an|a|the)\b|\s+/g, '');
	const sayPlainly = $derived(!simple && wordsOf(step.plain) !== wordsOf(step.label));
	const server = $derived(serverNamed ? 'Keycloak' : 'the server');
	const nameOf = (id: string) => {
		const line = lifelines.find((candidate) => candidate.id === id);
		return line ? nameIn(line, wording) : id;
	};
	const labelOf = (id: SettingId) =>
		simple ? (settingDefs[id].simple?.label ?? settingDefs[id].label) : settingDefs[id].label;
	const places: Record<string, string> = {
		query: 'query',
		fragment: 'after the #',
		header: 'header',
		body: 'body',
		token: 'in the token',
		setting: 'setting',
		path: 'path',
		memory: 'in memory'
	};

	const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
	const summary = $derived.by(() => {
		if (!change) return [];
		const lines = [
			change.addedLifelines.length && `${count(change.addedLifelines.length, 'lifeline')} added`,
			change.removedLifelines.length &&
				`${count(change.removedLifelines.length, 'lifeline')} removed`,
			!simple &&
				change.renamedLifelines.length &&
				`${count(change.renamedLifelines.length, 'lifeline')} with a new role`,
			change.addedSteps.length && `${count(change.addedSteps.length, 'step')} added`,
			change.removedSteps.length && `${count(change.removedSteps.length, 'step')} removed`,
			!simple &&
				change.addedFields.length &&
				`${count(change.addedFields.length, 'field')} added to existing messages`,
			!simple &&
				change.removedFields.length &&
				`${count(change.removedFields.length, 'field')} removed from existing messages`,
			!simple &&
				change.rewordedSteps.length &&
				`${count(change.rewordedSteps.length, 'message')} changed`
		];
		return lines.filter((line): line is string => Boolean(line));
	});
	const showChange = $derived(summary.length > 0 || elsewhere !== null || change !== null);
</script>

{#if intro}
	<p class="intro" data-testid="intro"><Worded segments={worded[0]} {onterm} /></p>
{/if}

<div role="status" data-testid="change-status">
	{#if showChange}
		<section class="change" data-testid="change-summary">
			<h2>What changed</h2>
			<ul>
				{#each summary as line (line)}<li>{line}</li>{/each}
				{#each resets as reset (reset.setting)}
					<li>{labelOf(reset.setting)} was reset. {reset.because}</li>
				{/each}
				{#if elsewhere}
					<li>
						Nothing in this diagram.
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
						<a href={elsewhere.href} data-testid="changed-elsewhere">{elsewhere.text}</a>
					</li>
				{/if}
			</ul>
			{#if changed}
				<p class="why" data-testid="change-why">{whyItIsHere(changed, changedTo)}</p>
			{/if}
		</section>
	{/if}
</div>

<section data-testid="step-detail">
	<div aria-live="polite">
		{#if partWhy}
			<p class="part-why" data-testid="part-why"><Worded segments={worded[4]} {onterm} /></p>
		{/if}
		<p class="route" class:for-a-screen-reader={simple}>
			{#if step.kind === 'time'}
				Nothing is sent
			{:else if step.from === step.to}
				{nameOf(step.from)}, internally
			{:else}
				{nameOf(step.from)} to {nameOf(step.to)}
			{/if}
		</p>
		{#if unseenBy}
			<h2 class="title" data-testid="unseen">Not seen by {unseenBy}</h2>
			<p>
				{#if step.from === step.to}
					It happens inside {nameOf(step.from)}, and {unseenBy} was not sent anything.
				{:else}
					It goes between {nameOf(step.from)} and {nameOf(step.to)}, and {unseenBy} was not sent it. If
					something in it reaches {unseenBy} later, that shows on the step where it does.
				{/if}
			</p>
			{#if unseenButInThePage && step.from !== step.to}
				<p data-testid="unseen-in-the-page">
					That is for an app on a phone or a server. An app that runs in the browser is drawn apart
					from it here, and is not apart from it: this call comes from the page, and what comes back
					is in the page.
				</p>
			{/if}
		{:else}
			<h2 class="title">{simple ? step.plain : step.label}</h2>
			{#if sayPlainly}
				<p class="plain">{step.plain}</p>
			{/if}
			<p><Worded segments={worded[1]} {onterm} /></p>
			{@render inTheBrowser?.()}
			{#snippet practice()}
				<p class="practice" data-testid="step-practice">
					<strong>In practice.</strong>
					<Worded segments={worded[2]} {onterm} />
					{#if step.practice.length}
						<span class="examples" data-testid="step-practice-examples">
							For example,
							{#each step.practice as example, index (example.name)}
								{#if index}, and{/if}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- another site -->
								<a href={example.url} target="_blank" rel="noreferrer">{example.name}</a>
								{example.text}{/each}.
						</span>
					{/if}
					{#if onlist}
						<button type="button" class="to-list" data-testid="to-list" onclick={onlist}>
							All of this in one list
						</button>
					{/if}
				</p>
			{/snippet}
			{#if step.inPractice}
				{#if simple}
					<details class="pitfall" data-testid="step-what-to-do">
						<summary>What do I have to do?</summary>
						{@render practice()}
					</details>
				{:else}
					{@render practice()}
				{/if}
			{/if}
			{#if step.kind !== 'time' && !simple}
				<p class="channel" data-channel={step.channel} data-testid="step-channel">
					<strong>{channels[step.channel].label}.</strong>
					{#if step.channel !== previousChannel}
						<span data-testid="channel-why">{channels[step.channel].explains}</span>
					{/if}
				</p>
			{/if}
			{#if known && showKnown}
				<p class="known" data-known={known.kind} data-testid="step-known">
					{#if known.kind === 'recorded'}
						Recorded on {known.date} from the demo app and API the recording uses, so this one says nothing
						about {server}.
					{:else if known.kind === 'copied'}
						{known.text}
					{:else if known.kind === 'other-settings'}
						This message was recorded with other settings, not these.
					{:else if known.kind === 'spec'}
						From {known.source} only. The server it was recorded from did not do this.
					{:else}
						Not checked against a real server yet.
					{/if}
				</p>
			{/if}
			{#if step.causes.length && !simple}
				<p class="cause">Here because of: {step.causes.map(labelOf).join(', ')}</p>
			{/if}
			{#if step.pitfall}
				<details class="pitfall" data-testid="step-pitfall">
					<summary>{step.pitfall.title}</summary>
					<p><Worded segments={worded[3]} {onterm} /></p>
					{#if step.pitfall.shot && pageImage}
						<img
							loading="lazy"
							src={pageImage(step.pitfall.shot)}
							alt={step.pitfall.shows}
							width="640"
							height="480"
						/>
					{/if}
				</details>
			{/if}
			{#if step.cites.length && !simple}
				<details class="cites" data-testid="step-cites" open>
					<summary>Which spec says so?</summary>
					<p>
						{#each step.cites as ref (`${ref.source}:${ref.section}`)}
							<button
								type="button"
								data-step-source={ref.source}
								data-section={ref.section}
								onclick={() => oncite?.(ref)}
							>
								{refLabel(ref)}
							</button>
						{/each}
					</p>
				</details>
			{/if}
			{#if !simple}
				{#each notes as note (note.id)}
					<KeycloakNote {note} version={recordedIndex.keycloak} />
				{/each}
			{/if}
			{#each links as link (link.href)}
				<p>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
					<a href={link.href} data-testid="step-link">{link.text}</a>
				</p>
			{/each}
		{/if}
	</div>

	{@render wire?.()}

	{#if atEnd}
		{#if onward}
			<section class="onward" data-testid="onward">
				<h3>{onward.label ?? 'Next question'}</h3>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
				<a href={onward.href}><strong>{onward.title}</strong></a>
				<p>{onward.summary}</p>
			</section>
		{:else if mapHref}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
			<p class="onward"><a href={mapHref} data-testid="onward-map">Pick another question</a></p>
		{/if}
	{/if}

	{#if !simple && step.fields.length && !unseenBy}
		<svelte:element this={folded ? 'details' : 'div'} class="carries" data-testid="carries">
			{#if folded}
				<summary data-testid="carries-open">What it carries</summary>
			{:else}
				<h3>What it carries</h3>
			{/if}
			<ul class="fields">
				{#each step.fields as field (field.name)}
					<li class:changed={field.changed}>
						<code>{field.name}</code>
						<span class="place">{places[field.place]}</span>
						<span class="note" data-field-why>{whyOf(field)}</span>
						{#if field.changed}
							<span class="note cause">From: {field.causes.map(labelOf).join(', ')}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</svelte:element>
	{/if}
</section>

<style>
	/* The arrow on the diagram says this to anyone who can see it. */
	.for-a-screen-reader {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.to-list {
		display: block;
		margin-top: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 12.5px;
		text-decoration: underline;
		cursor: pointer;
	}

	@media print {
		.to-list {
			display: none;
		}
	}

	.cites {
		margin: 8px 0;
		color: var(--muted);
		font-size: 12.5px;
	}

	.cites summary {
		cursor: pointer;
	}

	.cites p {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		margin: 4px 0 0;
	}

	.cites button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link, var(--accent));
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	h2,
	h3 {
		margin: 0;
	}

	.change {
		margin-bottom: 16px;
		padding: 8px 10px;
		background: var(--panel);
		border-left: 3px solid var(--fresh);
	}

	.change h2 {
		font-size: 12px;
		color: var(--fresh);
	}

	.intro {
		margin: 0 0 14px;
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--panel);
		font-size: 13.5px;
	}

	.why {
		margin: 6px 0 0;
		font-size: 12.5px;
	}

	.plain {
		margin: -4px 0 8px;
		color: var(--muted);
		font-size: 12.5px;
	}

	.onward {
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px solid var(--line);
	}

	.onward h3 {
		margin: 0 0 4px;
	}

	.onward p {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 12.5px;
	}

	.practice {
		font-size: 13px;
	}

	.practice strong {
		font-weight: 600;
	}

	.pitfall {
		margin: 0 0 8px;
		padding: 6px 10px;
		border: 1px solid var(--line);
		border-radius: 6px;
		font-size: 12.5px;
	}

	.pitfall img {
		display: block;
		width: 100%;
		height: auto;
		margin-top: 6px;
		border-radius: 6px;
	}

	.pitfall summary {
		cursor: pointer;
		font-weight: 600;
	}

	.pitfall p {
		margin: 6px 0 0;
	}

	.change ul {
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
		font-size: 12.5px;
		font-weight: 600;
	}

	.part-why {
		margin: 0 0 10px;
		color: var(--muted);
		font-size: 13px;
	}

	.route {
		margin: 0;
		color: var(--muted);
		font-size: 12px;
	}

	.title {
		margin: 2px 0 8px;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.3;
	}

	.channel {
		padding: 6px 10px;
		border-left: 3px solid var(--tone);
		background: var(--panel);
		color: var(--muted);
		font-size: 12.5px;
		--tone: var(--muted);
	}

	.channel strong {
		color: var(--fg);
		font-weight: 600;
	}

	.known {
		color: var(--muted);
		font-size: 12px;
	}

	.known[data-known='spec'] {
		color: var(--fresh);
	}

	.channel[data-channel='front'] {
		--tone: var(--front);
	}

	.channel[data-channel='back'] {
		--tone: var(--back);
	}

	.channel[data-channel='people'] {
		--tone: var(--people);
	}

	p {
		margin: 0 0 8px;
	}

	.cause {
		color: var(--fresh);
		font-size: 12px;
	}

	h3 {
		margin-top: 14px;
		font-size: 12px;
		color: var(--muted);
	}

	.fields {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
	}

	.fields li {
		padding: 5px 0;
		border-top: 1px solid var(--line);
	}

	.fields li.changed code {
		color: var(--fresh);
	}

	.place {
		margin-left: 6px;
		color: var(--muted);
		font-size: 11.5px;
	}

	.note {
		display: block;
		color: var(--muted);
		font-size: 12px;
	}

	.note.cause {
		color: var(--fresh);
	}
</style>
