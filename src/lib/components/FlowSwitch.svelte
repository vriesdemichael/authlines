<script lang="ts">
	interface Props {
		flows: readonly { id: string; title: string }[];
		current: string;
		onchange: (flow: string) => void;
	}

	let { flows, current, onchange }: Props = $props();
</script>

<label data-testid="flow-switch">
	Which flow
	<select
		data-testid="flow"
		value={current}
		onchange={(event) => onchange(event.currentTarget.value)}
	>
		{#each flows as flow (flow.id)}
			<option value={flow.id}>{flow.title}</option>
		{/each}
	</select>
</label>

<style>
	label {
		display: block;
		margin-bottom: 14px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: var(--size-small);
	}

	select {
		display: block;
		width: 100%;
		margin-top: 3px;
		padding: 3px 4px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--fg);
		font-size: var(--size-ui);
	}
</style>
