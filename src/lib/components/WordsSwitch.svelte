<script lang="ts">
	import { wordingNames, wordings, type Wording } from '#lib/flow/wording.ts';

	interface Props {
		current: Wording;
		/** Without them there is nothing here about that server, so its words go too (ADR-015). */
		serverNotes: boolean;
		onchange: (wording: Wording) => void;
	}

	let { current, serverNotes, onchange }: Props = $props();

	const offered = $derived(wordings.filter((wording) => serverNotes || wording !== 'keycloak'));

	// Chosen with a pointer, the arrow keys and a clicker should go back to moving through the steps.
	let pointing = false;
	function choose(list: HTMLSelectElement) {
		onchange(list.value as Wording);
		if (pointing) list.blur();
	}
</script>

<label data-testid="words-switch">
	Say it in
	<select
		data-testid="words"
		value={current}
		onpointerdown={() => (pointing = true)}
		onkeydown={() => (pointing = false)}
		onchange={(event) => choose(event.currentTarget)}
	>
		{#each offered as wording (wording)}
			<option value={wording}>{wordingNames[wording]}</option>
		{/each}
	</select>
</label>

<style>
	label {
		flex: none;
		color: var(--muted);
		font-size: var(--size-small);
		white-space: nowrap;
	}

	select {
		max-width: 130px;
		padding: 1px 2px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--fg);
		font-size: var(--size-small);
	}
</style>
