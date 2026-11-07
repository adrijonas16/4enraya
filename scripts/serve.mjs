// Servidor estático mínimo para desarrollo y pruebas: `npm start` → http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 8080);
const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
    try {
        let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (path.endsWith('/')) path += 'index.html';
        const file = join(root, path);
        if (!file.startsWith(root)) throw new Error('fuera de la carpeta');
        await stat(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(await readFile(file));
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('No encontrado');
    }
}).listen(port, () => console.log(`4 en Raya en http://localhost:${port}`));
