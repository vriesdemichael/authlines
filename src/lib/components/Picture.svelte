<script lang="ts">
	import type { Opens, Picture, PicturePart, PictureRow } from '#lib/pictures/index.ts';

	interface Props {
		picture: Picture;
		/** Goes to the steps a part stands for. */
		onopen?: (opens: Opens) => void;
	}

	let { picture, onopen }: Props = $props();

	const SAYS = 17;
	const MORE = 15;
	const LINE = { title: 18, says: 17, more: 15, code: 26 } as const;
	/** Where its first line goes, so that what it says sits in the middle of it. */
	const firstLine = (part: PicturePart) =>
		part.y - (part.says.length * SAYS + (part.more?.length ?? 0) * MORE) / 2 + 12;
	const diamond = (part: PicturePart) =>
		`M${part.x} ${part.y - part.h / 2} L${part.x + part.w / 2} ${part.y} L${part.x} ${part.y + part.h / 2} L${part.x - part.w / 2} ${part.y} Z`;
	// A part's lines are separate elements, so each ends in a space, which SVG does not draw. Otherwise
	// what is seen runs together, and does not match what is read out (WCAG 2.5.3, label in name).
	const said = (part: PicturePart) =>
		[...(part.title ?? []), part.sub ?? '', ...part.says, ...(part.more ?? [])]
			.filter(Boolean)
			.join(' ');
	const rowSaid = (row: PictureRow) => `${row.says}: ${row.more}`;

	// A party is laid out from its top, as the picture worked out its height.
	const PAD = 14;
	const ROW = 50;
	const topOf = (part: PicturePart) => part.y - part.h / 2;
	const leftOf = (part: PicturePart) => part.x - part.w / 2;
	const titled = (part: PicturePart) => (part.title?.length ?? 0) * 18;
	const subY = (part: PicturePart) => topOf(part) + PAD + titled(part) + 11;
	const saysY = (part: PicturePart) => topOf(part) + PAD + titled(part) + (part.sub ? 16 : 0) + 11;
	const rowsY = (part: PicturePart) =>
		topOf(part) + PAD + titled(part) + (part.sub ? 16 : 0) + part.says.length * 15 + 2;

	/** A text's lines, from the side it is set to and with its middle where the part is. */
	const textX = (part: PicturePart) =>
		part.align === 'start' ? leftOf(part) : part.align === 'end' ? part.x + part.w / 2 : part.x;
	const textY = (part: PicturePart, i: number) => {
		const step = LINE[part.size ?? 'says'];
		return part.y - (part.says.length * step) / 2 + step * 0.72 + i * step;
	};
	const anchor = (part: PicturePart) => part.align ?? 'middle';
	const radius = (part: PicturePart) => Math.min(part.w, part.h) / 2 - 1;
	const half = (part: PicturePart) => {
		const r = radius(part);
		return `M${part.x} ${part.y - r} A${r} ${r} 0 0 0 ${part.x} ${part.y + r} Z`;
	};

	// Only what goes somewhere is a link, and takes the focus.
	const back = (part: PicturePart) => part.shape === 'zone';
	const behind = $derived(picture.parts.filter(back));
	const front = $derived(picture.parts.filter((part) => !back(part)));

	function press(event: KeyboardEvent, opens: Opens) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		onopen?.(opens);
	}
</script>

{#snippet drawn(part: PicturePart)}
	{#if part.shape === 'zone'}
		<rect
			class="zone-box"
			class:current={part.current}
			x={leftOf(part)}
			y={topOf(part)}
			width={part.w}
			height={part.h}
			rx="12"
		/>
		{#each part.title ?? [] as text, i (i)}
			<text class="zone-title" x={leftOf(part) + 12} y={topOf(part) + 18 + i * 15}
				>{`${text} `}</text
			>
		{/each}
	{:else if part.shape === 'text'}
		{#if part.opens}
			<!-- Where the focus shows, since words alone have no edge to light up. -->
			<rect
				class="hit"
				x={leftOf(part) - 4}
				y={topOf(part) - 2}
				width={part.w + 8}
				height={part.h + 4}
				rx="4"
			/>
		{/if}
		{#each part.says as text, i (i)}
			<text
				class={part.size ?? 'says'}
				x={textX(part)}
				y={textY(part, i)}
				text-anchor={anchor(part)}>{`${text} `}</text
			>
		{/each}
	{:else if part.shape === 'mark'}
		<!-- What a cell means is read out, and shown by how full it is. -->
		<rect class="hit" x={leftOf(part)} y={topOf(part)} width={part.w} height={part.h} />
		{#if part.mark === 'full'}
			<circle class="mark full" cx={part.x} cy={part.y} r={radius(part)} />
		{:else if part.mark === 'half'}
			<circle class="mark empty" cx={part.x} cy={part.y} r={radius(part)} />
			<path class="mark full" d={half(part)} />
		{:else if part.mark === 'empty'}
			<circle class="mark empty" cx={part.x} cy={part.y} r={radius(part)} />
		{:else if part.mark === 'dot'}
			<circle class="mark dot" cx={part.x} cy={part.y} r="2.5" />
		{:else}
			<line class="mark none" x1={part.x - 5} y1={part.y} x2={part.x + 5} y2={part.y} />
		{/if}
	{:else if part.shape === 'bar'}
		<rect
			class={`bar ${part.tone ?? 'solid'}`}
			x={leftOf(part)}
			y={topOf(part)}
			width={part.w}
			height={part.h}
			rx="3"
		/>
	{:else if part.shape === 'char'}
		<!-- A box of a field, as a page draws one, with its character or the cursor. -->
		<rect
			class="shape"
			class:current={part.current}
			x={leftOf(part)}
			y={topOf(part)}
			width={part.w}
			height={part.h}
			rx="6"
		/>
		{#if part.says[0]}
			<text class="char" x={part.x} y={part.y + 7} text-anchor="middle">{`${part.says[0]} `}</text>
		{:else if part.current}
			<line class="caret" x1={part.x} y1={part.y - 11} x2={part.x} y2={part.y + 11} />
		{/if}
	{:else if part.shape === 'party'}
		<rect
			class="shape"
			class:current={part.current}
			x={leftOf(part)}
			y={topOf(part)}
			width={part.w}
			height={part.h}
			rx="8"
		/>
		{#each part.title ?? [] as text, i (i)}
			<text class="title" x={leftOf(part) + PAD} y={topOf(part) + PAD + 13 + i * 18}
				>{`${text} `}</text
			>
		{/each}
		{#if part.sub}
			<text class="sub" x={leftOf(part) + PAD} y={subY(part)}>{`${part.sub} `}</text>
		{/if}
		{#each part.says as text, i (i)}
			<text class="more" x={leftOf(part) + PAD} y={saysY(part) + i * 15}>{`${text} `}</text>
		{/each}
	{:else}
		{#if part.shape === 'ask'}
			<path class="shape" d={diamond(part)} />
		{:else}
			<rect
				class="shape"
				x={leftOf(part)}
				y={topOf(part)}
				width={part.w}
				height={part.h}
				rx={part.shape === 'ends' ? part.h / 2 : 8}
			/>
		{/if}
		{#each part.says as text, i (i)}
			<text class="says" x={part.x} y={firstLine(part) + i * SAYS} text-anchor="middle"
				>{`${text} `}</text
			>
		{/each}
		{#each part.more ?? [] as text, i (i)}
			<text
				class="more"
				x={part.x}
				y={firstLine(part) + part.says.length * SAYS + i * MORE}
				text-anchor="middle">{`${text} `}</text
			>
		{/each}
	{/if}
{/snippet}

{#snippet placed(part: PicturePart)}
	{#if part.opens}
		{@const opens = part.opens}
		<!-- A part opens the steps it stands for, so it is a link to them. -->
		<g
			class={`part ${part.shape} link`}
			data-part={part.id}
			data-travels={part.travels}
			role="link"
			tabindex="0"
			aria-label={part.shape === 'mark' || part.shape === 'bar' ? part.says.join(' ') : said(part)}
			onclick={() => onopen?.(opens)}
			onkeydown={(event) => press(event, opens)}
		>
			{@render drawn(part)}
		</g>
	{:else}
		<g class={`part ${part.shape}`} data-part={part.id} data-travels={part.travels}>
			{#if part.shape === 'mark' || part.shape === 'bar'}
				<title>{part.says.join(' ')}</title>
			{/if}
			{@render drawn(part)}
		</g>
	{/if}
	<!-- What a party holds, each beside the party's own link and not in it. -->
	{#each part.rows ?? [] as row, i (row.id)}
		<g
			class="part row link"
			data-part={`${part.id}.${row.id}`}
			role="link"
			tabindex="0"
			aria-label={rowSaid(row)}
			onclick={() => onopen?.(row.opens)}
			onkeydown={(event) => press(event, row.opens)}
		>
			<rect
				class="shape"
				x={leftOf(part) + 12}
				y={rowsY(part) + i * ROW}
				width={part.w - 24}
				height={ROW - 8}
				rx="5"
			/>
			<text class="row-says" x={leftOf(part) + 22} y={rowsY(part) + i * ROW + 17}
				>{`${row.says} `}</text
			>
			<text class="row-more" x={leftOf(part) + 22} y={rowsY(part) + i * ROW + 33}
				>{`${row.more} `}</text
			>
		</g>
	{/each}
{/snippet}

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
			<!-- Zones first, then the lines, so everything else sits on them. -->
			{#each behind as part (part.id)}
				{@render placed(part)}
			{/each}
			{#each picture.lines as line, i (i)}
				<path
					class="line"
					class:dashed={line.dashed}
					class:faint={line.faint}
					d={line.d}
					marker-end={line.bare ? undefined : `url(#head-${picture.id})`}
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
			{#each front as part (part.id)}
				{@render placed(part)}
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

	.line.dashed {
		stroke-dasharray: 5 4;
	}

	.line.faint {
		stroke: var(--line);
		stroke-width: 1;
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

	.link {
		cursor: pointer;
		outline: none;
	}

	.shape {
		fill: var(--raised);
		stroke: var(--strong-line);
		stroke-width: 1.2;
	}

	.ends .shape,
	.party .shape {
		fill: var(--panel);
	}

	.row .shape {
		fill: var(--raised);
		stroke: var(--line);
	}

	.zone-box {
		fill: none;
		stroke: var(--line);
		stroke-width: 1.4;
		stroke-dasharray: 6 4;
	}

	.zone-title {
		fill: var(--muted);
		font-size: 12px;
		letter-spacing: 0.03em;
	}

	/* Where you are, of several side by side, in the colour that always means that. */
	.shape.current,
	.zone-box.current {
		stroke: var(--accent);
		stroke-width: 2;
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

	.link:hover .shape,
	.link:focus-visible .shape,
	.link:hover .mark.empty,
	.link:focus-visible .mark.empty,
	.link:hover .bar,
	.link:focus-visible .bar {
		stroke: var(--accent);
		stroke-width: 2;
	}

	.link:focus-visible .hit {
		stroke: var(--accent);
		stroke-width: 2;
	}

	/* A text that goes somewhere looks it, when the mouse or the focus is on it. */
	.text.link:hover text,
	.text.link:focus-visible text {
		fill: var(--accent);
		text-decoration: underline;
	}

	.hit {
		fill: transparent;
	}

	.mark.full {
		fill: var(--fg);
	}

	.mark.empty {
		fill: none;
		stroke: var(--fg);
		stroke-width: 1.4;
	}

	.mark.dot {
		fill: var(--muted);
	}

	.mark.none {
		stroke: var(--muted);
		stroke-width: 1.4;
	}

	.bar.solid {
		fill: var(--strong-line);
	}

	.bar.light {
		fill: var(--line);
	}

	.bar.open {
		fill: var(--panel);
		stroke: var(--strong-line);
		stroke-dasharray: 4 3;
	}

	.title {
		fill: var(--fg);
		font-size: 14px;
		font-weight: 600;
	}

	.sub {
		fill: var(--muted);
		font-family: var(--mono);
		font-size: 11px;
	}

	.says {
		fill: var(--fg);
		font-size: 13px;
	}

	.more {
		fill: var(--muted);
		font-size: 11.5px;
	}

	/* A code as someone reads it off a screen, in the font of a value on the wire. */
	.code,
	.char {
		fill: var(--fg);
		font-family: var(--mono);
		font-size: 20px;
	}

	.code {
		letter-spacing: 0.18em;
	}

	.caret {
		stroke: var(--fg);
		stroke-width: 1.5;
	}

	.row-says {
		fill: var(--fg);
		font-size: 12.5px;
	}

	.row-more {
		fill: var(--muted);
		font-size: 11px;
	}
</style>
