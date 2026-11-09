// Reads each recorded Kerberos message again from the bytes it kept, after the reading changed. The
// bytes are what crossed the wire, so this changes how they are named and never what they were.
import { readFileSync, writeFileSync } from 'node:fs';
import type { Recording } from '#lib/recordings/format.ts';
import { decodeKerberos } from './kerberos-der.ts';

for (const preset of ['kerberos', 'kerberos-no-ticket']) {
	const file = `static/recordings/authorization-code/${preset}.json`;
	const recording = JSON.parse(readFileSync(file, 'utf8')) as Recording;
	for (const message of recording.messages) {
		if (message.protocol !== 'kerberos' || !message.bytes) continue;
		message.body = decodeKerberos(Buffer.from(message.bytes, 'base64'));
	}
	writeFileSync(file, `${JSON.stringify(recording, null, '\t')}\n`);
	console.log(`${preset}: read again`);
}
