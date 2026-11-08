import { bottomOf, keyAt, markAt, textAt, type KeyEntry } from './build.ts';
import type { MarkKind, Opens, PictureLine, PicturePart } from './model.ts';

export interface MatrixCell {
	mark: MarkKind;
	says: string;
	opens?: Opens;
}

export interface MatrixRow {
	id: string;
	name: string;
	/** What it is, for someone who has not met it before. */
	is: string;
	opens?: Opens;
	cells: Readonly<Record<string, MatrixCell>>;
}

/**
 * Rows against columns, with a mark in each cell: a key drawn with the same marks first, so nothing
 * has to be matched up from words, then a head over each column, and each row with what it is. Every
 * string comes in already said, in the wording on screen.
 */
export function matrix(options: {
	key: readonly KeyEntry[];
	columns: readonly { id: string; name: string; opens?: Opens }[];
	rows: readonly MatrixRow[];
	note?: string;
}): { parts: PicturePart[]; lines: PictureLine[]; height: number } {
	const W = 800;
	const NAME = { left: 10, w: 230 };
	const COLUMNS = { left: 250, right: 790 };
	const column = (COLUMNS.right - COLUMNS.left) / options.columns.length;
	// A key says only what is drawn, so a column simple mode leaves out takes its marks with it.
	const used = new Set(
		options.rows.flatMap((row) => options.columns.map((head) => row.cells[head.id]?.mark))
	);
	const key = keyAt(
		'key',
		10,
		8,
		780,
		options.key.filter((entry) => !entry.mark || used.has(entry.mark))
	);
	const parts: PicturePart[] = [...key.parts];
	const lines: PictureLine[] = [];
	const headTop = 8 + key.h + 12;
	const heads = options.columns.map((head, i) =>
		textAt(`head-${head.id}`, COLUMNS.left + i * column + 4, headTop, column - 8, head.name, {
			size: 'more',
			align: 'middle',
			opens: head.opens
		})
	);
	parts.push(...heads);
	let top = Math.max(...heads.map(bottomOf)) + 10;
	lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	for (const row of options.rows) {
		const name = textAt(`name-${row.id}`, NAME.left, top + 8, NAME.w, row.name, {
			opens: row.opens
		});
		const is = textAt(`is-${row.id}`, NAME.left, bottomOf(name) + 2, NAME.w, row.is, {
			size: 'more'
		});
		const height = bottomOf(is) - top + 10;
		const y = top + height / 2;
		parts.push(name, is);
		options.columns.forEach((head, i) => {
			const cell = row.cells[head.id];
			if (!cell) throw new Error(`${row.id} has nothing for ${head.id}`);
			parts.push(
				markAt(
					`${row.id}.${head.id}`,
					COLUMNS.left + i * column + column / 2,
					y,
					cell.mark,
					`${row.name}, against ${head.name}: ${cell.says}`,
					cell.opens
				)
			);
		});
		top += height;
		lines.push({ d: `M10 ${top} H${W - 10}`, bare: true, faint: true });
	}
	if (!options.note) return { parts, lines, height: top + 12 };
	const note = textAt('note', 10, top + 12, 780, options.note, { size: 'more' });
	parts.push(note);
	return { parts, lines, height: bottomOf(note) + 12 };
}
