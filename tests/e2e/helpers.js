import { readFileSync } from 'node:fs';

export const FAKE_SUPABASE = readFileSync(new URL('../fakes/fake-supabase.js', import.meta.url), 'utf8');
export const FAKE_ROOM = readFileSync(new URL('../fakes/fake-room.js', import.meta.url), 'utf8');
const CDN = /cdn\.jsdelivr\.net\/npm\/@supabase/;

/** Sin red hacia Supabase: el juego funciona como invitado. */
export async function offline(context) {
    await context.route(CDN, r => r.abort());
}

/** Sustituye la librería de Supabase por el doble en memoria.
 *  Las páginas fijan la librería con una huella de integridad (SRI); el doble no
 *  coincide con ella, así que solo en pruebas se quita ese atributo del HTML. */
export async function fakeSupabase(context) {
    await context.route(CDN, r => r.fulfill({ contentType: 'application/javascript', body: FAKE_SUPABASE }));
    await context.route(/\/html\/[^/]+\.html/, async route => {
        const res = await route.fetch();
        const body = (await res.text()).replace(/ integrity="[^"]+"/g, '');
        await route.fulfill({ response: res, body });
    });
}

/** Abre el juego ya identificado (invitado por defecto) y con ajustes concretos. */
export async function openGame(page, { user = { username: 'Invitado', guest: true }, settings, skin } = {}) {
    await page.addInitScript(({ user, settings, skin }) => {
        if (sessionStorage.getItem('__seeded')) return;
        sessionStorage.setItem('__seeded', '1');
        localStorage.setItem('user', JSON.stringify(user));
        if (settings) localStorage.setItem('4r-settings', JSON.stringify(settings));
        if (skin) localStorage.setItem('4r-skin', skin);
    }, { user, settings: settings || null, skin: skin || null });
    await page.goto('/html/game.html');
    await page.waitForFunction(() => window.app && window.app.view);
}

/** Toca una columna del tablero y espera a que terminen las animaciones. */
export async function drop(page, col) {
    await page.waitForFunction(() => app.canAct() || app.state.over);
    const box = await page.locator('#grid').boundingBox();
    const cols = await page.evaluate(() => app.state.cols);
    await page.mouse.click(box.x + (box.width / cols) * (col + 0.5), box.y + 10);
    await page.waitForFunction(() => !app.busy);
}

export const pieceCount = page => page.evaluate(() => app.state.cells.flat().filter(c => c && !c.stone).length);

export const boardSignature = page => page.evaluate(() =>
    app.state.cells.map(r => r.map(c => (!c ? '.' : c.stone ? 's' : c.color[0])).join('')).join('/') + `|${app.state.turn}|${app.state.over}`);
