// Online sin base de datos: salas en tiempo real de la página publicada (js/net.js)
import { test, expect } from '@playwright/test';
import { FAKE_ROOM, offline, openGame, drop, boardSignature } from './helpers.js';

test('dos jugadores se encuentran, juegan sincronizados y se avisa al salir', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await offline(context);
    await context.addInitScript(FAKE_ROOM);
    const settings = { mode: 'pvp', level: 'normal', rows: 6, cols: 7, map: 'classic', events: true };
    const A = await context.newPage();
    const B = await context.newPage();
    await openGame(A, { settings });
    await openGame(B, { settings });

    // A abre sala
    await A.getByRole('button', { name: 'Online con un amigo' }).click();
    await A.locator('#create-room-btn').click();
    await expect(A.locator('#room-code')).toHaveText(/^[A-Z0-9]{6}$/);

    // B ve a A en la lista y se une
    await B.getByRole('button', { name: 'Online con un amigo' }).click();
    await B.locator('#lobby-list button', { hasText: 'Unirme' }).click();
    for (const p of [A, B]) {
        await p.waitForFunction(() => app.mp && app.mp.gameId && !document.getElementById('arena').hidden, null, { timeout: 10_000 });
    }
    expect(await A.evaluate(() => app.mp.myColor)).toBe('red');
    expect(await B.evaluate(() => app.mp.myColor)).toBe('yellow');

    const moves = [3, 3, 2, 4, 1, 5];
    for (let i = 0; i < moves.length; i++) {
        const [me, other] = i % 2 ? [B, A] : [A, B];
        if (await me.evaluate(() => app.state.over)) break;
        await drop(me, moves[i]);
        const seq = await me.evaluate(() => app.state.seq);
        await other.waitForFunction(s => app.state.seq >= s && !app.busy, seq, { timeout: 10_000 });
    }
    expect(await boardSignature(A)).toBe(await boardSignature(B));

    await B.evaluate(() => app.leaveRoom(true));
    await A.waitForFunction(() => !app.mp, null, { timeout: 10_000 });
    await expect(A.locator('#toast')).toContainText('salido');
    await context.close();
});
