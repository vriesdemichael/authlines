/**
 * A zip of a few text files, stored without compression, which every unzip and every skill upload
 * reads. Small enough to write here, so the site needs no package for it, and the date is fixed so
 * the same files always give the same bytes.
 */
export interface ZipEntry {
	path: string;
	text: string;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

// 1 January 1980, the first day a zip can say.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
// Names are UTF-8.
const UTF8 = 0x0800;

export function zip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
	const encoder = new TextEncoder();
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;
	for (const entry of entries) {
		const name = encoder.encode(entry.path);
		const data = encoder.encode(entry.text);
		const crc = crc32(data);

		const local = new Uint8Array(30 + name.length + data.length);
		const l = new DataView(local.buffer);
		l.setUint32(0, 0x04034b50, true);
		l.setUint16(4, 20, true);
		l.setUint16(6, UTF8, true);
		l.setUint16(8, 0, true);
		l.setUint16(10, DOS_TIME, true);
		l.setUint16(12, DOS_DATE, true);
		l.setUint32(14, crc, true);
		l.setUint32(18, data.length, true);
		l.setUint32(22, data.length, true);
		l.setUint16(26, name.length, true);
		l.setUint16(28, 0, true);
		local.set(name, 30);
		local.set(data, 30 + name.length);

		const central = new Uint8Array(46 + name.length);
		const c = new DataView(central.buffer);
		c.setUint32(0, 0x02014b50, true);
		c.setUint16(4, 20, true);
		c.setUint16(6, 20, true);
		c.setUint16(8, UTF8, true);
		c.setUint16(10, 0, true);
		c.setUint16(12, DOS_TIME, true);
		c.setUint16(14, DOS_DATE, true);
		c.setUint32(16, crc, true);
		c.setUint32(20, data.length, true);
		c.setUint32(24, data.length, true);
		c.setUint16(28, name.length, true);
		// Extra, comment, disk, internal and external attributes are all zero.
		c.setUint32(42, offset, true);
		central.set(name, 46);

		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}
	const directorySize = centrals.reduce((sum, part) => sum + part.length, 0);
	const end = new Uint8Array(22);
	const e = new DataView(end.buffer);
	e.setUint32(0, 0x06054b50, true);
	e.setUint16(8, entries.length, true);
	e.setUint16(10, entries.length, true);
	e.setUint32(12, directorySize, true);
	e.setUint32(16, offset, true);

	const out = new Uint8Array(offset + directorySize + end.length);
	let at = 0;
	for (const part of [...locals, ...centrals, end]) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}
