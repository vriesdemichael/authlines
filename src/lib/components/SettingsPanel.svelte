<script lang="ts">
	import { firstSentence, hint } from '#lib/hint.svelte.ts';
	import { tick } from 'svelte';
	import {
		defaultSettings,
		isOffered,
		settingDefs,
		settingIds,
		simpleSettingIds,
		setsWith,
		unavailable,
		type SettingDef,
		type SettingId,
		type Settings
	} from '#lib/flow/settings.ts';
	import type { Mode } from '#lib/flow/vocabulary.ts';
	import type { Say } from '#lib/flow/wording.ts';
	import { flagStatus } from '#lib/keycloak/flags.ts';

	interface Props {
		/** Why the others are not here, because a setting that just vanishes says nothing. */
		notApplicable?: Readonly<Partial<Record<SettingId, string>>>;
		/** Puts what these say in the words someone chose. */
		say?: Say;
		settings: Settings;
		/** The settings this base flow has. */
		available?: readonly SettingId[];
		mode?: Mode;
		onchange: <K extends SettingId>(id: K, value: Settings[K]) => void;
		onexplain?: (setting: SettingId) => void;
		/** Whether to show what is specific to the server this was recorded from. */
		serverNotes?: boolean;
		onservernotes?: (on: boolean) => void;
		/** Left out of simple mode, because they change nothing that can be seen on this diagram. */
		notHere?: readonly SettingId[];
		/** Where the ones left out do change something. */
		elsewhere?: { text: string; href: string } | null;
	}

	let {
		say = (text) => text,
		notApplicable = {},
		settings,
		available = settingIds,
		mode = 'advanced',
		onchange,
		onexplain,
		serverNotes = true,
		onservernotes,
		notHere = [],
		elsewhere = null
	}: Props = $props();

	// Pointing at a setting changes nothing. The diagram moving under the mouse made the steps hard to
	// follow, so only flipping one does (the maintainer, 2026-11-03).
	const simple = $derived(mode === 'simple');
	const notOffered = $derived(simple ? [] : (Object.keys(notApplicable) as SettingId[]));
	const offered = $derived(
		(simple ? simpleSettingIds.filter((id) => !notHere.includes(id)) : settingIds).filter(
			(id) =>
				available.includes(id) &&
				isOffered(id, settings) &&
				(!defOf(id).notOnOffer || settings[id] !== defaultSettings[id])
		)
	);
	// What a choice here brought with it, which nobody has to take off again.
	const broughtAlong = $derived(
		new Set(
			simpleSettingIds
				.filter((id) => settings[id] !== defaultSettings[id])
				.flatMap((id) => Object.keys(setsWith(id, settings[id] as never)))
		)
	);
	// An advanced setting stays on in simple mode, as a chip that says so (ADR-004).
	const alsoOn = $derived(
		simple
			? settingIds.filter(
					(id) =>
						!simpleSettingIds.includes(id) &&
						settings[id] !== defaultSettings[id] &&
						!broughtAlong.has(id)
				)
			: []
	);

	const defOf = (id: SettingId): SettingDef => settingDefs[id];
	const set = (id: SettingId, value: boolean | string) => onchange(id, value as never);
	// The button goes with its chip, so the focus goes to the next one, or to what they were part of.
	let panelHeading = $state<HTMLElement>();
	async function turnOff(id: SettingId) {
		set(id, defaultSettings[id]);
		await tick();
		const next = window.document.querySelector<HTMLElement>('[data-remove]');
		(next ?? panelHeading)?.focus();
	}
	const blockedBy = (id: SettingId, value: string | boolean) =>
		unavailable(id, value as never, { ...settings, ...setsWith(id, value as never) })?.because;
	function chipText(id: SettingId) {
		const def = defOf(id);
		if (def.kind === 'toggle') return def.label;
		const option = def.options.find((candidate) => candidate.value === settings[id]);
		return option?.plainly ?? `${def.label}: ${option?.label}`;
	}
</script>

{#if offered.length || !simple}
	<h2 tabindex="-1" bind:this={panelHeading}>{simple ? 'Try changing' : 'Settings'}</h2>
{/if}
{#each offered as id (id)}
	{@const def = defOf(id)}
	{@const label = simple ? (def.simple?.label ?? def.label) : def.label}
	{@const summary = say(simple ? (def.simple?.summary ?? def.summary) : def.summary)}
	{#snippet named()}
		<button
			type="button"
			class="name"
			id={`name-${id}`}
			data-why={id}
			use:hint={firstSentence(summary)}
			onclick={() => onexplain?.(id)}>{label}</button
		>
	{/snippet}
	<section data-setting={id} aria-describedby={`about-${id}`}>
		{#if def.kind === 'toggle'}
			{@const blocked = blockedBy(id, true)}
			<div class="toggle" class:blocked>
				{@render named()}
				<input
					type="checkbox"
					aria-labelledby={`name-${id}`}
					checked={settings[id] === true}
					disabled={blocked !== undefined}
					onchange={(event) => set(id, event.currentTarget.checked)}
				/>
			</div>
			{#if blocked}<p class="because" data-testid="blocked-because">{blocked}</p>{/if}
		{:else}
			<fieldset>
				<legend>{@render named()}</legend>
				{#each def.options.filter((option) => !simple || !option.advanced || settings[id] === option.value) as option (option.value)}
					{@const blocked = blockedBy(id, option.value)}
					<label class:blocked use:hint={blocked}>
						<input
							type="radio"
							name={id}
							value={option.value}
							checked={settings[id] === option.value}
							disabled={blocked !== undefined}
							onchange={() => set(id, option.value)}
							onclick={(event) => {
								// A click has made the choice, so the arrow keys go back to moving through the steps.
								if (event.detail > 0) event.currentTarget.blur();
							}}
						/>
						{option.label}
						{#if blocked}<small>{blocked}</small>{/if}
						{#if !simple && serverNotes && option.flag}
							<small class="flag" data-flag={option.flag.name}>
								Keycloak flag <code>{option.flag.name}</code>: {flagStatus(option.flag)}
							</small>
						{/if}
					</label>
				{/each}
			</fieldset>
		{/if}
		<p
			id={`about-${id}`}
			class="about"
			class:shown={settings[id] !== defaultSettings[id]}
			data-testid="setting-about"
		>
			{summary}
		</p>
	</section>
{/each}

{#if notHere.length && elsewhere}
	<p class="elsewhere" data-testid="settings-elsewhere">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route resolves it -->
		The others change the <a href={elsewhere.href}>{elsewhere.text}</a>, not this diagram.
	</p>
{/if}

{#if notOffered.length}
	<section class="not-here" data-testid="not-here">
		<h2>Not here</h2>
		<ul>
			{#each notOffered as id (id)}
				{@const def = defOf(id)}
				<li data-not-here={id}>
					<strong>{simple ? (def.simple?.label ?? def.label) : def.label}.</strong>
					{say(notApplicable[id] ?? '')}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if !simple}
	<section data-testid="server-notes">
		<label class="toggle">
			Server notes
			<input
				type="checkbox"
				checked={serverNotes}
				onchange={(event) => onservernotes?.(event.currentTarget.checked)}
			/>
		</label>
		<p>Which setting controls each message.</p>
	</section>
{/if}

{#if alsoOn.length}
	<section class="also" data-testid="also-on">
		<h3>Also on, from advanced</h3>
		<ul>
			{#each alsoOn as id (id)}
				<li>
					{chipText(id)}
					<button
						type="button"
						class="remove"
						data-remove={id}
						aria-label={`Remove: ${chipText(id)}`}
						onclick={() => turnOff(id)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	/* Its name says what it is for, as a word in the text does, so it needs no mark beside it (#231). */
	.name {
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
		text-align: left;
		text-decoration: underline dotted var(--strong-line);
		text-underline-offset: 3px;
		cursor: help;
	}

	.name:hover {
		text-decoration-color: var(--here);
	}

	/* Nothing comes before it when no setting is on offer, so it needs no line to set it apart. */
	.not-here {
		border-top: 0;
	}

	.not-here h2 {
		margin: 0 0 6px;
	}

	.not-here ul {
		margin: 0 0 14px;
		padding: 0;
		list-style: none;
	}

	.not-here li {
		margin-bottom: 8px;
		color: var(--muted);
		font-size: var(--size-ui);
	}

	.not-here strong {
		color: var(--fg);
		font-weight: 600;
	}

	h2 {
		margin: 0 0 10px;
		font-size: var(--size-ui);
		font-weight: 600;
		color: var(--muted);
	}

	section {
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}

	label {
		display: block;
		cursor: pointer;
	}

	.toggle,
	legend {
		font-weight: 600;
	}

	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.toggle input {
		appearance: none;
		flex: none;
		position: relative;
		width: 32px;
		height: 18px;
		margin: 0;
		border-radius: var(--radius);
		background: var(--strong-line);
		cursor: pointer;
		transition: background 0.15s;
	}

	.toggle input::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: var(--radius);
		background: var(--bg);
		transition: transform 0.15s;
	}

	.toggle input:checked {
		background: var(--here);
	}

	.toggle input:checked::after {
		transform: translateX(14px);
	}

	/* Forced colours flatten the background that says on or off. */
	@media (forced-colors: active) {
		.toggle input {
			border: 1px solid ButtonText;
			background: ButtonFace;
			forced-color-adjust: none;
		}

		.toggle input::after {
			background: ButtonText;
			forced-color-adjust: none;
		}

		.toggle input:checked {
			background: Highlight;
		}

		.toggle input:checked::after {
			background: HighlightText;
		}
	}

	input[type='radio'] {
		accent-color: var(--here);
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle input,
		.toggle input::after {
			transition: none;
		}
	}

	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}

	/* A choice that wraps carries on under its own words, not under the button. */
	fieldset label {
		padding-left: 24px;
		text-indent: -24px;
	}

	legend {
		padding: 0;
	}

	.blocked {
		color: var(--muted);
		cursor: default;
	}

	.toggle input:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.because {
		color: var(--fg);
	}

	.elsewhere {
		padding-top: 10px;
		border-top: 1px solid var(--line);
	}

	small {
		display: block;
		text-indent: 0;
		font-size: var(--size-small);
	}

	.flag {
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	p {
		margin: 3px 0 0;
		color: var(--muted);
		font-size: var(--size-small);
	}

	/* What never changes stays out of the way: on when the setting is, or while someone is on it. Its
	   Why says the same and more. */
	.about {
		display: none;
	}

	.about.shown,
	section:has(input:focus-visible) .about {
		display: block;
	}

	.also h3 {
		margin: 0 0 4px;
		font-size: var(--size-small);
		font-weight: 600;
		color: var(--muted);
	}

	.also ul {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.also li {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 1px 4px 1px 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--raised);
		font-size: var(--size-small);
	}

	.remove {
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--muted);
		line-height: 1;
	}
</style>
