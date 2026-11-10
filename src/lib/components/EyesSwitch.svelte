<script lang="ts">
	interface Props {
		/** Who can be picked, by what this mode calls them. */
		parties: readonly { id: string; name: string }[];
		current: string | null;
		onchange: (party: string | null) => void;
	}

	let { parties, current, onchange }: Props = $props();

	// Chosen with a pointer, the arrow keys and a clicker should go back to moving through the steps.
	let pointing = false;
	function choose(list: HTMLSelectElement) {
		onchange(list.value || null);
		if (pointing) list.blur();
	}
</script>

<label data-testid="eyes-switch">
	See it as
	<select
		data-testid="eyes"
		value={current ?? ''}
		onpointerdown={() => (pointing = true)}
		onkeydown={() => (pointing = false)}
		onchange={(event) => choose(event.currentTarget)}
	>
		<option value="">everyone</option>
		{#each parties as party (party.id)}
			<option value={party.id}>{party.name}</option>
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
