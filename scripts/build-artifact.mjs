// Genera dist-artifact/: la versión para publicar como página de Claude.
// Diferencias con la web normal:
//  - sin Supabase (la página no puede conectarse a otros servidores): se juega como invitado
//  - el online usa las salas en tiempo real de la página (js/net.js)
//  - index.html abre directamente el juego
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const out = 'dist-artifact';
// la librería de Supabase (con su versión fijada) y la conexión anticipada al CDN
const CDN = /^\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^\n]*\n/m;
const PRECONNECT = /^\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"[^\n]*\n/m;
const SHIM = `    <script>
        window.__ARTIFACT = true;
        try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); }
        catch (e) {
            const m = {};
            Object.defineProperty(window, 'localStorage', { configurable: true, value: {
                getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); },
                removeItem: k => { delete m[k]; }, clear: () => { for (const k in m) delete m[k]; } } });
        }
        if (!localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify({ id: null, username: 'Invitado', guest: true }));
    </script>
`;

await rm(out, { recursive: true, force: true });
await mkdir(out);
for (const dir of ['css', 'fonts', 'js', 'html']) await cp(dir, `${out}/${dir}`, { recursive: true });

const strip = html => html.replace(CDN, '').replace(PRECONNECT, '');
const game = strip(await readFile('html/game.html', 'utf8')).replace('<head>\n', `<head>\n${SHIM}`);
await writeFile(`${out}/html/game.html`, game);
await writeFile(`${out}/index.html`, game.replaceAll('../', ''));
await writeFile(`${out}/html/login.html`, strip(await readFile('html/login.html', 'utf8')));
await mkdir(`${out}/img`, { recursive: true });
await cp('img', `${out}/img`, { recursive: true });

console.log(`Listo: ${out}/ (publícalo con todos sus archivos; index.html es la entrada)`);
