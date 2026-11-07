// Amigos y retos con cuenta (Supabase sustituido por un doble en memoria)
import { test, expect } from '@playwright/test';
import { fakeSupabase } from './helpers.js';

const SEED = {
    users: [
        { id: 'A', username: 'Ana', total_wins: 3, total_points: 30 },
        { id: 'B', username: 'Beto', total_wins: 1, total_points: 10 },
        { id: 'C', username: 'Bea', total_wins: 0, total_points: 0 },
    ],
};

async function as(context, user) {
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    await page.goto('/html/login.html');
    await page.evaluate(u => localStorage.setItem('user', JSON.stringify(u)), user);
    await page.goto('/html/game.html');
    await page.waitForFunction(() => window.app && app.social);
    // localStorage es compartido entre pestañas: fijamos el usuario de esta pestaña
    await page.evaluate(u => { app.user = u; app.social = new Social(app); }, user);
    return page;
}

test('solicitud, aceptar y retar a un amigo', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await fakeSupabase(context);
    const seed = await context.newPage();
    await seed.goto('/html/login.html');
    await seed.evaluate(db => { localStorage.clear(); localStorage.setItem('fakedb', JSON.stringify(db)); }, SEED);
    await seed.close();

    const A = await as(context, { id: 'A', username: 'Ana' });
    const B = await as(context, { id: 'B', username: 'Beto' });

    await A.locator('#friends-btn').click();
    await A.locator('#friend-search').fill('Be');
    await A.locator('#friend-results li', { hasText: 'Beto' }).getByRole('button', { name: 'Añadir' }).click();

    await expect(B.locator('#friends-badge')).toHaveText('1');
    await B.locator('#friends-btn').click();
    await B.locator('#friend-incoming').getByRole('button', { name: 'Aceptar' }).click();
    await B.keyboard.press('Escape');
    await expect(A.locator('#toast')).toContainText('aceptó');

    await A.locator('#friend-list').getByRole('button', { name: 'Retar' }).click();
    await expect(B.locator('.invite')).toBeVisible();
    await B.locator('.invite').getByRole('button', { name: 'Jugar' }).click();
    for (const p of [A, B]) {
        await p.waitForFunction(() => app.mp && app.mp.gameId && app.started && !document.getElementById('arena').hidden, null, { timeout: 10_000 });
    }
    expect(await A.evaluate(() => app.mp.names)).toEqual({ red: 'Ana', yellow: 'Beto' });
    await context.close();
});
