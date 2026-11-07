// Servidor estático mínimo para desarrollo y pruebas: `npm start` → http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');

// mismas cabeceras de seguridad que en Vercel (las de "/(.*)" en vercel.json), para que
// las pruebas detecten violaciones de la CSP. En local se quita upgrade-insecure-requests.
const security = {};
try {
    const cfg = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
    for (const h of (cfg.headers || []).find(x => x.source === '/(.*)')?.headers || []) {
        if (h.key === 'Strict-Transport-Security') continue;
        security[h.key] = h.key === 'Content-Security-Policy' ? h.value.replace(/;\s*upgrade-insecure-requests/, '') : h.value;
    }
} catch { /* sin vercel.json: sin cabeceras */ }
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
        if (path === '/') path = '/html/game.html';
        if (path.endsWith('/')) path += 'index.html';
        const file = join(root, path);
        if (!file.startsWith(root)) throw new Error('fuera de la carpeta');
        await stat(file);
        res.writeHead(200, { ...security, 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(await readFile(file));
    } catch {
        // igual que Vercel: /404.html para cualquier ruta que no exista
        res.writeHead(404, { ...security, 'Content-Type': 'text/html; charset=utf-8' });
        res.end(await readFile(join(root, '404.html')).catch(() => 'No encontrado'));
    }
}).listen(port, () => console.log(`4 en Raya en http://localhost:${port}`));
