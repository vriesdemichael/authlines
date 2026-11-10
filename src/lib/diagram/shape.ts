/**
 * What gets passed around has a shape of its own, a tag with its corners cut, so that it is never
 * taken for something to press or for a label in any dashboard (#231). As deep as `--cut` in
 * src/app.css, which a test holds it to.
 */
export const CUT = 4;

/** The points of a tag, for an SVG polygon. */
export function tag(x: number, y: number, width: number, height: number): string {
	const cut = Math.max(0, Math.min(CUT, width / 2, height / 2));
	return [
		[x + cut, y],
		[x + width - cut, y],
		[x + width, y + cut],
		[x + width, y + height - cut],
		[x + width - cut, y + height],
		[x + cut, y + height],
		[x, y + height - cut],
		[x, y + cut]
	]
		.map(([across, down]) => `${round(across)},${round(down)}`)
		.join(' ');
}

const round = (value: number) => Math.round(value * 100) / 100;
