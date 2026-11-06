<script lang="ts">
	import type { Opens, Picture, PicturePart } from '#lib/pictures/index.ts';

	interface Props {
		picture: Picture;
		/** Goes to the steps a part stands for. */
		onopen?: (opens: Opens) => void;
	}

	let { picture, onopen }: Props = $props();

	const SAYS = 17;
	const MORE = 15;
	/** Where its first line goes, so that what it says sits in the middle of it. */
	const firstLine = (part: PicturePart) =>
		part.y - (part.says.length * SAYS + (part.more?.length ?? 0) * MORE) / 2 + 12;
	const diamond = (part: PicturePart) =>
		`M${part.x} ${part.y - part.h / 2} L${part.x + part.w / 2} ${part.y} L${part.x} ${part.y + part.h / 2} L${part.x - part.w / 2} ${part.y} Z`;
	const said = (part: PicturePart) => [...part.says, ...(part.more ?? [])].join(' ');

	function press(event: KeyboardEvent, part: PicturePart) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		onopen?.(part.opens);
	}
</script>

<figure class="picture" data-testid="picture" data-picture={picture.id}>
	<div class="room">
		<svg
			viewBox={`0 0 ${picture.width} ${picture.height}`}
			role="group"
			aria-label={picture.title}
			style:min-width={`${Math.round(picture.width * 0.75)}px`}
		>
			<defs>
				<marker
					id={`head-${picture.id}`}
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto-start-reverse"
				>
					<path class="head" d="M0 0 L10 5 L0 10 Z" />
				</marker>
			</defs>
			<!-- The lines first, so the parts sit on them. -->
			{#each picture.lines as line, i (i)}
				<path
					class="line"
					d={line.d}
					marker-end={line.joins ? undefined : `url(#head-${picture.id})`}
				/>
			{/each}
			{#each picture.lines as line, i (i)}
				{#if line.label}
					{#each line.label.lines as text, j (j)}
						<text
							class="label"
							x={line.label.x}
							y={line.label.y + j * 14}
							text-anchor={line.label.anchor}>{text}</text
						>
					{/each}
				{/if}
			{/each}
			{#each picture.parts as part (part.id)}
				<!-- A part opens the steps it stands for, so it is a link to them. -->
				<g
					class={`part ${part.shape}`}
					data-part={part.id}
					data-travels={part.travels}
					role="link"
					tabindex="0"
					aria-label={said(part)}
					onclick={() => onopen?.(part.opens)}
					onkeydown={(event) => press(event, part)}
				>
					{#if part.shape === 'ask'}
						<path class="shape" d={diamond(part)} />
					{:else}
						<rect
							class="shape"
							x={part.x - part.w / 2}
							y={part.y - part.h / 2}
							width={part.w}
							height={part.h}
							rx={part.shape === 'ends' ? part.h / 2 : 8}
						/>
					{/if}
					{#each part.says as text, i (i)}
						<text class="says" x={part.x} y={firstLine(part) + i * SAYS} text-anchor="middle"
							>{text}</text
						>
					{/each}
					{#each part.more ?? [] as text, i (i)}
						<text
							class="more"
							x={part.x}
							y={firstLine(part) + part.says.length * SAYS + i * MORE}
							text-anchor="middle">{text}</text
						>
					{/each}
				</g>
			{/each}
		</svg>
	</div>
</figure>

<style>
	.picture {
		margin: 0;
	}

	/* On a narrow screen it keeps a size that can be read, and moves sideways. */
	.room {
		overflow-x: auto;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		font-family: var(--sans);
	}

	.line {
		fill: none;
		stroke: var(--strong-line);
		stroke-width: 1.4;
	}

	.head {
		fill: var(--strong-line);
	}

	.label {
		fill: var(--muted);
		font-size: 12px;
		paint-order: stroke;
		stroke: var(--bg);
		stroke-width: 4px;
		stroke-linejoin: round;
	}

	.part {
		cursor: pointer;
		outline: none;
	}

	.shape {
		fill: var(--raised);
		stroke: var(--strong-line);
		stroke-width: 1.2;
	}

	.ends .shape {
		fill: var(--panel);
	}

	/* A part that is a call says how it travels, as an arrow does on the diagram (ADR-014). */
	[data-travels='direct'] .shape {
		stroke: var(--back);
		stroke-width: 1.6;
	}

	[data-travels='browser'] .shape {
		stroke: var(--front);
		stroke-width: 1.6;
	}

	.part:hover .shape,
	.part:focus-visible .shape {
		stroke: var(--accent);
		stroke-width: 2;
	}

	.says {
		fill: var(--fg);
		font-size: 13px;
	}

	.more {
		fill: var(--muted);
		font-size: 11.5px;
	}
</style>
