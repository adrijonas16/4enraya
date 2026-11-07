import { test, expect } from '@playwright/test';
import { offline, openGame, drop, pieceCount } from './helpers.js';

const PVP = { mode: 'pvp', level: 'normal', rows: 6, cols: 7, map: 'classic', events: false };

test.beforeEach(async ({ context }) => offline(context));

test('cuatro en vertical gana, suma al marcador y permite revancha', async ({ page }) => {
    await openGame(page, { settings: PVP });
    await page.getByRole('button', { name: 'Dos jugadores aquí' }).click();
    for (const c of [0, 1, 0, 1, 0, 1, 0]) await drop(page, c);
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#result-title')).toHaveText('Gana Rojo');
    await expect(page.locator('#plaque-red [data-score]')).toHaveText('1');
    await page.getByRole('button', { name: 'Revancha' }).click();
    await page.waitForFunction(() => app.state.moves === 0 && !app.state.over);
    expect(await page.evaluate(() => app.state.turn)).toBe('yellow'); // empieza el otro
});

test('la bomba destruye una ficha rival', async ({ page }) => {
    await openGame(page, { settings: PVP });
    await page.getByRole('button', { name: 'Dos jugadores aquí' }).click();
    await drop(page, 3); // rojo
    await drop(page, 3); // amarillo
    await page.evaluate(() => { app.state.charges.red = 6; app.updateUI(); });
    await page.keyboard.press('3');
    await expect(page.locator('.power.armed')).toHaveCount(1);
    const box = await page.locator('#grid').boundingBox();
    const p = box.width / 7;
    await page.mouse.click(box.x + p * 3.5, box.y + p * 4.5); // ficha amarilla (fila 4)
    await page.waitForFunction(() => !app.busy);
    expect(await pieceCount(page)).toBe(1);
});

test('los eventos de caos no se anuncian', async ({ page }) => {
    await openGame(page, { settings: { ...PVP, events: true } });
    await page.getByRole('button', { name: 'Dos jugadores aquí' }).click();
    const text = await page.locator('#ticker').textContent();
    expect(text).toContain('Caos activo');
    for (const name of ['Remolino', 'Terremoto', 'Vuelco', 'Meteorito', 'Marea', 'Ventisca', 'Regalo']) {
        expect(text).not.toContain(name);
    }
    expect(await page.evaluate(() => app.state.nextEvent)).toBeNull();
});
