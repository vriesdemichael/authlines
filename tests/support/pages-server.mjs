// Serves a build folder the way GitHub Pages serves a project site: plain files under a subfolder
// with no rewrite rules. A directory serves its index.html, and anything else serves 404.html.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [, , folder, base, port] = process.argv;
if (!base?.startsWith('/')) {
	// Git Bash rewrites /authlines into a folder of its own, and everything would then be a 404.
	throw new Error(`The base has to start with a slash, and got: ${base}`);
}
const types = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain',
	'.md': 'text/markdown',
	'.zip': 'application/zip'
};

const server = createServer((request, response) => {
	const url = new URL(request.url, 'http://localhost');
	const send = (status, file) => {
		response.writeHead(status, {
			'content-type': types[extname(file)] ?? 'application/octet-stream'
		});
		response.end(readFileSync(file));
	};
	const notFound = () => send(404, join(folder, '404.html'));

	if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return notFound();
	const relative = normalize(decodeURIComponent(url.pathname.slice(base.length)));
	if (relative.includes('..')) return notFound();
	const file = join(folder, relative);

	if (existsSync(file) && statSync(file).isDirectory()) {
		if (!url.pathname.endsWith('/')) {
			response.writeHead(301, { location: `${url.pathname}/${url.search}` });
			return response.end();
		}
		const index = join(file, 'index.html');
		return existsSync(index) ? send(200, index) : notFound();
	}
	if (existsSync(file)) return send(200, file);
	return notFound();
});

server.listen(Number(port), '127.0.0.1', () => {
	console.log(`Serving ${folder} at http://127.0.0.1:${port}${base}/`);
});
