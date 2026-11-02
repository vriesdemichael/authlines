// Says where each changed screenshot differs from the committed one, as a box of pixels, so that a change
// to one panel can be told from a change everywhere, without reading every image.
//
//   pnpm test:visual:where
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decode(png) {
	const chunks = [];
	let width = 0;
	let height = 0;
	let bytes = 4;
	for (let at = 8; at < png.length; at += 12 + png.readUInt32BE(at)) {
		const data = png.subarray(at + 8, at + 8 + png.readUInt32BE(at));
		const type = png.toString('ascii', at + 4, at + 8);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bytes = data[9] === 6 ? 4 : 3;
		}
		if (type === 'IDAT') chunks.push(data);
	}
	const raw = inflateSync(Buffer.concat(chunks));
	const stride = width * bytes;
	const pixels = Buffer.alloc(height * stride);
	for (let y = 0, from = 0; y < height; y++) {
		const filter = raw[from++];
		for (let x = 0; x < stride; x++, from++) {
			const left = x >= bytes ? pixels[y * stride + x - bytes] : 0;
			const up = y ? pixels[(y - 1) * stride + x] : 0;
			const corner = x >= bytes && y ? pixels[(y - 1) * stride + x - bytes] : 0;
			const near = left + up - corner;
			const paeth =
				Math.abs(near - left) <= Math.abs(near - up) &&
				Math.abs(near - left) <= Math.abs(near - corner)
					? left
					: Math.abs(near - up) <= Math.abs(near - corner)
						? up
						: corner;
			const add = [0, left, up, (left + up) >> 1, paeth][filter];
			pixels[y * stride + x] = (raw[from] + add) & 255;
		}
	}
	return { width, height, stride, bytes, pixels };
}

const changed = execFileSync('git', ['status', '--short', '--', 'tests/e2e'], { encoding: 'utf8' })
	.split('\n')
	.filter((line) => line.startsWith(' M') && line.endsWith('.png'))
	.map((line) => line.slice(3));

for (const file of changed) {
	const before = decode(execFileSync('git', ['show', `HEAD:${file}`], { maxBuffer: 2 ** 28 }));
	const after = decode(readFileSync(file));
	const name = file.split('/').pop().replace('-chromium-linux.png', '');
	if (before.width !== after.width || before.height !== after.height) {
		console.log(`${name}: the size changed`);
		continue;
	}
	let [left, right, top, bottom] = [Infinity, -1, Infinity, -1];
	for (let at = 0; at < after.pixels.length; at++) {
		if (before.pixels[at] === after.pixels[at]) continue;
		const y = Math.floor(at / after.stride);
		const x = Math.floor((at % after.stride) / after.bytes);
		[left, right, top, bottom] = [Math.min(left, x), Math.max(right, x), Math.min(top, y), y];
	}
	console.log(`${name}: x ${left} to ${right}, y ${top} to ${bottom}`);
}
