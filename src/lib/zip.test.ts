import { describe, expect, it } from 'vitest';
import { crc32, zip } from '#lib/zip.ts';

/** Reads a zip back from its central directory, the way an unzip does. */
function unzip(bytes: Uint8Array) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const decoder = new TextDecoder();
	const end = bytes.length - 22;
	expect(view.getUint32(end, true)).toBe(0x06054b50);
	const count = view.getUint16(end + 10, true);
	let at = view.getUint32(end + 16, true);
	const files: { path: string; text: string; crc: number }[] = [];
	for (let n = 0; n < count; n++) {
		expect(view.getUint32(at, true)).toBe(0x02014b50);
		const crc = view.getUint32(at + 16, true);
		const size = view.getUint32(at + 24, true);
		const nameLength = view.getUint16(at + 28, true);
		const local = view.getUint32(at + 42, true);
		const path = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
		expect(view.getUint32(local, true)).toBe(0x04034b50);
		expect(view.getUint16(local + 8, true), 'stored').toBe(0);
		// What the file's own header says has to agree with the directory, as a strict unzip checks.
		expect(view.getUint32(local + 14, true), `${path} crc`).toBe(crc);
		expect(view.getUint32(local + 18, true), `${path} size`).toBe(size);
		expect(view.getUint32(local + 22, true), `${path} size`).toBe(size);
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const data = bytes.subarray(start, start + size);
		expect(crc32(data), path).toBe(crc);
		files.push({ path, text: decoder.decode(data), crc });
		at += 46 + nameLength;
	}
	return files;
}

describe('the zip', () => {
	it('has a CRC-32 that matches the standard check value', () => {
		expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
	});

	it('reads back as the files that went in, with names that are not ASCII', () => {
		const entries = [
			{ path: 'skill/SKILL.md', text: '# A skill\n' },
			{ path: 'skill/notes – café.md', text: 'The site’s own.' }
		];
		expect(unzip(zip(entries)).map(({ path, text }) => ({ path, text }))).toEqual(entries);
	});

	it('gives the same bytes for the same files', () => {
		const entries = [{ path: 'a.md', text: 'a' }];
		expect(zip(entries)).toEqual(zip(entries));
	});
});
