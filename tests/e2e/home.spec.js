import { test, expect } from '@playwright/test';
import { offline, openGame, drop } from './helpers.js';

test.beforeEach(async ({ context }) => offline(context));

test('la portada muestra los modos y el tablero de demostración', async ({ page }) => {
    await openGame(page);
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#arena')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Normal' })).toBeVisible();
    await expect(page.locator('#demo-pieces .piece').first()).toBeVisible({ timeout: 5000 });
});

test('jugar contra la IA desde la portada', async ({ page }) => {
    await openGame(page);
    await page.getByRole('button', { name: 'Fácil' }).click();
    await expect(page.locator('#arena')).toBeVisible();
    await expect(page).toHaveURL(/#jugar$/);
    await drop(page, 3);
    await page.waitForFunction(() => app.state.moves >= 2, null, { timeout: 10_000 });
    expect(await page.evaluate(() => app.settings.level)).toBe('easy');
});

test('volver atrás regresa a la portada y ofrece continuar', async ({ page }) => {
    await openGame(page);
    await page.getByRole('button', { name: 'Dos jugadores aquí' }).click();
    await drop(page, 2);
    await page.goBack();
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#home-continue')).toBeVisible();
    await page.locator('#home-continue').click();
    await expect(page.locator('#arena')).toBeVisible();
});

test('el estilo de tablero se aplica y se recuerda', async ({ page }) => {
    await openGame(page);
    await page.locator('#home-skins').click();
    await page.locator('[data-skin-id="lava"]').click();
    await expect(page.locator('#machine')).toHaveAttribute('data-skin', 'lava');
    await page.reload();
    await expect(page.locator('#machine')).toHaveAttribute('data-skin', 'lava');
});

test('en móvil no hay desplazamiento horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openGame(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Dos jugadores aquí' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
