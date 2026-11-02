// Films the picture at the top of the README: one setting flipped, and the same diagram changing,
// made as `pnpm social` makes the social images, so that it can be redone when the look changes.
// An animated PNG, because a README can show one and nothing here has to be installed to make it.
//
//   pnpm build && pnpm clip
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { chromium, type Page } from '@playwright/test';
import { TRANSITION_MS } from '#lib/diagram/motion.ts';

const OUT = 'docs/readme';
const BASE = '/authlines';
const PORT = 4179;
const STATE =
	'authorization-code/?mode=simple&attacker=1&client=public&step=attacker-token-response';
const FLIPPED = '[data-setting="pkce"] input';

const VIEWPORT = { width: 1280, height: 800 };
// Without the panel, which would only say it again, and without the line saying when it was recorded,
// which would go out of date here first.
const CLIP = { x: 0, y: 47, width: 950, height: 625 };
const SCALE = 1.5;

const FRAME_MS = 50;
const HOLD_MS = 3200;

type Picture = { width: number; height: number; pixels: Buffer };
type Frame = Picture & { ms: number };

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc = (data: Buffer) => {
	let c = 0xffffffff;
	for (const byte of data) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer) => {
	const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const sum = Buffer.alloc(4);
	sum.writeUInt32BE(crc(body));
	return Buffer.concat([length, body, sum]);
};

const paeth = (a: number, b: number, c: number) => {
	const p = a + b - c;
	const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** The pixels of a PNG as a browser writes one: eight bits, not interlaced, as RGB or RGBA. */
function decode(png: Buffer): Picture {
	const width = png.readUInt32BE(16);
	const height = png.readUInt32BE(20);
	const channels = png[25] === 6 ? 4 : png[25] === 2 ? 3 : 0;
	if (png[24] !== 8 || !channels || png[28] !== 0) throw new Error('An unexpected kind of PNG');
	const parts: Buffer[] = [];
	for (let at = 8; at < png.length;) {
		const length = png.readUInt32BE(at);
		if (png.toString('latin1', at + 4, at + 8) === 'IDAT') {
			parts.push(png.subarray(at + 8, at + 8 + length));
		}
		at += length + 12;
	}
	const raw = inflateSync(Buffer.concat(parts));
	const stride = width * channels;
	const out = Buffer.alloc(width * height * 3);
	const previous = Buffer.alloc(stride);
	const line = Buffer.alloc(stride);
	for (let y = 0; y < height; y++) {
		const start = y * (stride + 1);
		const filter = raw[start];
		for (let x = 0; x < stride; x++) {
			const left = x >= channels ? line[x - channels] : 0;
			const up = previous[x];
			const corner = x >= channels ? previous[x - channels] : 0;
			const value = raw[start + 1 + x];
			line[x] =
				value +
				(filter === 1
					? left
					: filter === 2
						? up
						: filter === 3
							? (left + up) >> 1
							: filter === 4
								? paeth(left, up, corner)
								: 0);
		}
		line.copy(previous);
		for (let x = 0; x < width; x++) {
			line.copy(out, (y * width + x) * 3, x * channels, x * channels + 3);
		}
	}
	return { width, height, pixels: out };
}

/** The part of a picture that differs from the one before. */
function changedPart(before: Picture | null, after: Picture) {
	const { width, height } = after;
	if (!before) return { x: 0, y: 0, width, height };
	let [left, top, right, bottom] = [width, height, -1, -1];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const at = (y * width + x) * 3;
			if (
				before.pixels[at] !== after.pixels[at] ||
				before.pixels[at + 1] !== after.pixels[at + 1] ||
				before.pixels[at + 2] !== after.pixels[at + 2]
			) {
				left = Math.min(left, x);
				right = Math.max(right, x);
				top = Math.min(top, y);
				bottom = Math.max(bottom, y);
			}
		}
	}
	// Nothing moved: a single pixel stands in, because a frame has to have one.
	if (right < 0) return { x: 0, y: 0, width: 1, height: 1 };
	return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** One part of a picture, compressed as PNG does, trying the filter that suits each line best. */
function compress(picture: Picture, part: { x: number; y: number; width: number; height: number }) {
	const stride = part.width * 3;
	const raw = Buffer.alloc((stride + 1) * part.height);
	const previous = Buffer.alloc(stride);
	const line = Buffer.alloc(stride);
	const tries = Array.from({ length: 5 }, () => Buffer.alloc(stride));
	for (let y = 0; y < part.height; y++) {
		const from = ((part.y + y) * picture.width + part.x) * 3;
		picture.pixels.copy(line, 0, from, from + stride);
		let best = 0;
		let bestScore = Infinity;
		for (let filter = 0; filter < 5; filter++) {
			let score = 0;
			for (let x = 0; x < stride; x++) {
				const left = x >= 3 ? line[x - 3] : 0;
				const up = previous[x];
				const corner = x >= 3 ? previous[x - 3] : 0;
				const predicted =
					filter === 1
						? left
						: filter === 2
							? up
							: filter === 3
								? (left + up) >> 1
								: filter === 4
									? paeth(left, up, corner)
									: 0;
				const value = (line[x] - predicted) & 255;
				tries[filter][x] = value;
				score += value < 128 ? value : 256 - value;
			}
			if (score < bestScore) [best, bestScore] = [filter, score];
		}
		raw[y * (stride + 1)] = best;
		tries[best].copy(raw, y * (stride + 1) + 1);
		line.copy(previous);
	}
	return deflateSync(raw, { level: 9 });
}

function header(picture: Picture) {
	const data = Buffer.alloc(13);
	data.writeUInt32BE(picture.width, 0);
	data.writeUInt32BE(picture.height, 4);
	data[8] = 8;
	data[9] = 2;
	return chunk('IHDR', data);
}

function still(picture: Picture) {
	const whole = { x: 0, y: 0, width: picture.width, height: picture.height };
	return Buffer.concat([
		SIGNATURE,
		header(picture),
		chunk('IDAT', compress(picture, whole)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/** The frames as one animated PNG that loops, each frame holding only what changed. */
function animated(frames: Frame[]) {
	const parts = [SIGNATURE, header(frames[0])];
	const control = Buffer.alloc(8);
	control.writeUInt32BE(frames.length, 0);
	parts.push(chunk('acTL', control));
	let sequence = 0;
	frames.forEach((frame, i) => {
		const part = changedPart(frames[i - 1] ?? null, frame);
		const about = Buffer.alloc(26);
		about.writeUInt32BE(sequence++, 0);
		about.writeUInt32BE(part.width, 4);
		about.writeUInt32BE(part.height, 8);
		about.writeUInt32BE(part.x, 12);
		about.writeUInt32BE(part.y, 16);
		about.writeUInt16BE(frame.ms, 20);
		about.writeUInt16BE(1000, 22);
		parts.push(chunk('fcTL', about));
		const data = compress(frame, part);
		if (i === 0) {
			parts.push(chunk('IDAT', data));
			return;
		}
		const number = Buffer.alloc(4);
		number.writeUInt32BE(sequence++);
		parts.push(chunk('fdAT', Buffer.concat([number, data])));
	});
	parts.push(chunk('IEND', Buffer.alloc(0)));
	return Buffer.concat(parts);
}

/** Moves the page on by a fixed time, its timers and its CSS alike, so that no frame is late. */
async function advance(page: Page, ms: number) {
	await page.clock.runFor(ms);
	await page.evaluate((ms) => {
		for (const animation of document.getAnimations()) {
			const at = Number(animation.id || 0) + ms;
			animation.id = String(at);
			animation.pause();
			animation.currentTime = at;
			if (at >= Number(animation.effect?.getComputedTiming().endTime)) animation.finish();
		}
	}, ms);
}

// A pointer resting on the switch, so that someone can see what is about to be pressed. A real one
// would not show in a picture, and hovering would bring up the preview of what the setting does.
const POINTER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 20 24"
	style="position:fixed;z-index:1000;pointer-events:none">
	<path d="M2 1.5v18l5-4.5 3.2 7.2 3.4-1.5-3.2-7H17z" fill="#141720" stroke="#fff" stroke-width="1.5"
		stroke-linejoin="round"/></svg>`;

async function restPointerOn(page: Page, selector: string) {
	const box = await page.locator(selector).boundingBox();
	if (!box) throw new Error(`${selector} is not on screen`);
	await page.evaluate(
		({ POINTER, x, y }) => {
			const holder = document.createElement('div');
			holder.innerHTML = POINTER;
			const pointer = holder.firstElementChild as SVGElement;
			pointer.style.left = `${x}px`;
			pointer.style.top = `${y}px`;
			document.body.append(pointer);
		},
		{ POINTER, x: box.x + box.width * 0.85, y: box.y + box.height * 0.8 }
	);
}

const picture = async (page: Page) =>
	decode(await page.screenshot({ clip: CLIP, animations: 'allow', caret: 'hide' }));

async function film(theme: 'light' | 'dark') {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: SCALE,
		colorScheme: theme,
		reducedMotion: 'no-preference'
	});
	const page = await context.newPage();
	await page.clock.install();
	await page.goto(`http://127.0.0.1:${PORT}${BASE}/${STATE}`);
	await page.locator('.workspace[data-ready="true"]').waitFor();
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(800);
	await page.clock.pauseAt(Date.now() + 60_000);
	await advance(page, 1000);
	await restPointerOn(page, FLIPPED);

	const flip = async (held: Picture) => {
		const frames: Frame[] = [{ ...held, ms: HOLD_MS }];
		await page.locator(FLIPPED).evaluate((input: HTMLInputElement) => input.click());
		for (let at = 0; at < TRANSITION_MS; at += FRAME_MS) {
			await advance(page, FRAME_MS);
			frames.push({ ...(await picture(page)), ms: FRAME_MS });
		}
		// Whatever follows a change, such as the address catching up, is over before the next hold.
		await advance(page, 400);
		return { frames, after: await picture(page) };
	};

	const first = await picture(page);
	const on = await flip(first);
	const off = await flip(on.after);
	await browser.close();
	return { frames: [...on.frames, ...off.frames], refused: on.after };
}

mkdirSync(OUT, { recursive: true });
const server = spawn('node', ['tests/support/pages-server.mjs', 'build', BASE, String(PORT)], {
	stdio: 'ignore'
});
await new Promise((resolve) => setTimeout(resolve, 800));
try {
	for (const theme of ['light', 'dark'] as const) {
		const { frames, refused } = await film(theme);
		const clip = animated(frames);
		writeFileSync(`${OUT}/flip-${theme}.png`, clip);
		writeFileSync(`${OUT}/flip-${theme}-still.png`, still(refused));
		console.log(`${theme}: ${frames.length} frames, ${Math.round(clip.length / 1024)} KB`);
	}
} finally {
	server.kill();
}
process.exit(0);
