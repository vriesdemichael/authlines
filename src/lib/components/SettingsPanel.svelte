<script lang="ts">
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
		/** Someone is pointing at a value of a setting, or no longer is. */
		onpreview?: (choice: { id: SettingId; value: boolean | string } | null) => void;
		/** What the setting being pointed at would do, in words. */
		previewed?: { id: SettingId; says: string } | null;
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
		elsewhere = null,
		onpreview,
		previewed = null
	}: Props = $props();

	// So that passing over a setting on the way to another does not set the diagram off.
	const SETTLE_MS = 150;
	let settling: ReturnType<typeof setTimeout> | undefined;
	function consider(id: SettingId, value: boolean | string) {
		clearTimeout(settling);
		if (settings[id] === value || unavailable(id, value as never, settings)) return;
		settling = setTimeout(() => onpreview?.({ id, value }), SETTLE_MS);
	}
	// Flipping a setting can move the others, and something sliding under a mouse that stayed where it
	// pressed is not someone pointing at it.
	let pressedAt = { x: -1, y: -1 };
	// Going by movement and not by entering, because the page opening under a mouse that is resting
	// where it clicked enters whatever lands there, and that is nobody pointing at anything.
	let pointedRow: EventTarget | null = null;
	function pointAt(event: PointerEvent, id: SettingId, value: boolean | string) {
		if (pointedRow === event.currentTarget) return;
		if (event.clientX === pressedAt.x && event.clientY === pressedAt.y) return;
		pointedRow = event.currentTarget;
		// A finger has nothing to hover with, and a tap flips it as it always did.
		if (event.pointerType === 'mouse') consider(id, value);
	}
	function focusOn(event: FocusEvent, id: SettingId, value: boolean | string) {
		// Not after a click, which has flipped it already.
		if ((event.target as Element).matches(':focus-visible')) consider(id, value);
	}
	function letGo() {
		pointedRow = null;
		clearTimeout(settling);
		onpreview?.(null);
	}

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
	const set = (id: SettingId, value: boolean | string) => {
		clearTimeout(settling);
		onchange(id, value as never);
	};
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

<svelte:window onpointerdown={(event) => (pressedAt = { x: event.clientX, y: event.clientY })} />

{#if offered.length || !simple}
	<h2 tabindex="-1" bind:this={panelHeading}>{simple ? 'Try changing' : 'Settings'}</h2>
{/if}
{#each offered as id (id)}
	{@const def = defOf(id)}
	<section data-setting={id} class:beside-the-switch={simple} aria-describedby={`about-${id}`}>
		{#if def.kind === 'toggle'}
			{@const blocked = blockedBy(id, true)}
			<label
				class="toggle"
				class:blocked
				onpointermove={(event) => pointAt(event, id, settings[id] !== true)}
				onpointerleave={letGo}
				onfocusin={(event) => focusOn(event, id, settings[id] !== true)}
				onfocusout={letGo}
			>
				<input
					type="checkbox"
					checked={settings[id] === true}
					disabled={blocked !== undefined}
					onchange={(event) => set(id, event.currentTarget.checked)}
				/>
				{simple ? (def.simple?.label ?? def.label) : def.label}
			</label>
			{#if blocked}<p class="because" data-testid="blocked-because">{blocked}</p>{/if}
		{:else}
			<fieldset>
				<legend>{simple ? (def.simple?.label ?? def.label) : def.label}</legend>
				{#each def.options as option (option.value)}
					{@const blocked = blockedBy(id, option.value)}
					<label
						class:blocked
						title={blocked}
						onpointermove={(event) => pointAt(event, id, option.value)}
						onpointerleave={letGo}
						onfocusin={(event) => focusOn(event, id, option.value)}
						onfocusout={letGo}
					>
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
		{#if previewed?.id === id}
			<p class="would" data-testid="setting-preview">{previewed.says}</p>
		{/if}
		<p
			id={`about-${id}`}
			class="about"
			class:shown={settings[id] !== defaultSettings[id]}
			data-testid="setting-about"
		>
			{say(simple ? (def.simple?.summary ?? def.summary) : def.summary)}
		</p>
		<ul class="more">
			<li>
				<button
					type="button"
					class="link"
					data-why={id}
					aria-label={`Why ${simple ? (def.simple?.label ?? def.label) : def.label}?`}
					onclick={() => onexplain?.(id)}
				>
					{simple ? '?' : 'Why?'}
				</button>
			</li>
		</ul>
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
			<input
				type="checkbox"
				checked={serverNotes}
				onchange={(event) => onservernotes?.(event.currentTarget.checked)}
			/>
			Server notes
		</label>
		<p>
			Which setting controls each message, on the server this was recorded from. Off, the notes
			about that server go. What is left is still its run: the wording of its errors and its
			stored-token API, which no spec defines.
		</p>
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

<!-- One place that is always there, because something that appears with its words is not announced. -->
<p class="said" role="status" data-testid="preview-said">{previewed?.says ?? ''}</p>

<style>
	/* A row for each "Why?" is five more things to read, so in simple mode it is a mark beside the switch. */
	.beside-the-switch {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		column-gap: 8px;
		align-items: center;
	}

	.beside-the-switch > :global(*) {
		grid-column: 1 / -1;
	}

	.beside-the-switch > .toggle,
	.beside-the-switch > fieldset {
		grid-column: 1;
	}

	.beside-the-switch > .more {
		grid-row: 1;
		grid-column: 2;
		align-self: start;
		margin: 0;
	}

	.beside-the-switch > .more .link {
		display: block;
		width: 18px;
		height: 18px;
		border: 1px solid var(--line);
		border-radius: 50%;
		color: var(--muted);
		font-size: 11px;
		line-height: 16px;
		text-align: center;
		text-decoration: none;
	}

	.beside-the-switch > .more .link:hover {
		border-color: var(--accent);
		color: var(--accent);
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
		font-size: 12.5px;
	}

	.not-here strong {
		color: var(--fg);
		font-weight: 600;
	}

	.would {
		margin: 4px 0 0;
		font-size: 12px;
		font-weight: 600;
	}

	/* Fixed, because anywhere further down the rail it would make the whole page taller. */
	.said {
		position: fixed;
		top: 0;
		left: 0;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	h2 {
		margin: 0 0 10px;
		font-size: 13px;
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
		flex-direction: row-reverse;
		gap: 8px;
	}

	.toggle input {
		appearance: none;
		flex: none;
		position: relative;
		width: 32px;
		height: 18px;
		margin: 0;
		border-radius: 9px;
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
		border-radius: 50%;
		background: var(--bg);
		transition: transform 0.15s;
	}

	.toggle input:checked {
		background: var(--accent);
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
		accent-color: var(--accent);
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
		font-size: 11.5px;
	}

	.flag {
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	p {
		margin: 3px 0 0;
		color: var(--muted);
		font-size: 12px;
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

	.more {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		margin: 3px 0 0;
		padding: 0;
		list-style: none;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font-size: 11.5px;
		text-align: left;
		text-decoration: underline;
	}

	.also h3 {
		margin: 0 0 4px;
		font-size: 12px;
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
		border-radius: 10px;
		background: var(--raised);
		font-size: 12px;
	}

	.remove {
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--muted);
		line-height: 1;
	}
</style>
