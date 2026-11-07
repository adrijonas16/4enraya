// Calidad del sitio: accesibilidad y contraste, metadatos, enlaces, 404, cookies y formularios
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { offline, openGame } from './helpers.js';

const PAGES = ['/html/game.html', '/html/login.html', '/html/privacidad.html', '/html/terminos.html', '/404.html'];

test.beforeEach(async ({ context }) => offline(context));

for (const path of PAGES) {
    test(`accesibilidad y contraste sin fallos: ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForTimeout(400);
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .exclude('.scene').exclude('#fx').exclude('.home-demo')
            .analyze();
        const summary = results.violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
        expect(summary).toEqual([]);
    });

    test(`metadatos para buscadores y vista previa: ${path}`, async ({ page }) => {
        await page.goto(path);
        const meta = await page.evaluate(() => {
            const m = n => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content || '';
            return {
                lang: document.documentElement.lang,
                title: document.title,
                description: m('description'),
                ogTitle: m('og:title'), ogImage: m('og:image'), twitter: m('twitter:card'),
                canonical: document.querySelector('link[rel="canonical"]')?.href || '',
                icon: document.querySelector('link[rel="icon"]')?.href || '',
            };
        });
        expect(meta.lang).toBe('es');
        expect(meta.title.length).toBeGreaterThan(5);
        expect(meta.title.length).toBeLessThanOrEqual(60);
        expect(meta.description.length).toBeGreaterThan(50);
        expect(meta.description.length).toBeLessThanOrEqual(160);
        expect(meta.ogTitle).toBeTruthy();
        expect(meta.ogImage).toMatch(/^https:\/\/.+\.jpg$/);
        expect(meta.twitter).toBe('summary_large_image');
        expect(meta.canonical).toMatch(/^https:\/\//);
        expect(meta.icon).toBeTruthy();
    });

    test(`sin desplazamiento horizontal en móvil: ${path}`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await page.goto(path);
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
}

for (const [name, open] of [
    ['nueva partida', p => p.evaluate(() => app.openSetup())],
    ['cómo se juega', p => p.locator('#home-help').click()],
    ['estilo del tablero', p => p.locator('#home-skins').click()],
    ['jugar online', p => p.getByRole('button', { name: 'Online con un amigo' }).click()],
    ['partida en curso', p => p.getByRole('button', { name: 'Jugar ahora' }).click()],
]) {
    test(`accesibilidad y contraste con ${name} abierto`, async ({ page }) => {
        await openGame(page);
        await open(page);
        await page.waitForTimeout(500);
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .exclude('.scene').exclude('#fx').exclude('.home-demo')
            .analyze();
        expect(results.violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
}

test('los botones principales tienen texto legible en todas las páginas', async ({ page }) => {
    for (const path of PAGES) {
        await page.goto(path);
        const bad = await page.evaluate(() => [...document.querySelectorAll('.btn-primary')]
            .filter(b => b.offsetParent && getComputedStyle(b).color === getComputedStyle(b).backgroundColor)
            .map(b => b.textContent.trim()));
        expect(bad, path).toEqual([]);
        const underlined = await page.evaluate(() => [...document.querySelectorAll('a.btn')]
            .filter(a => getComputedStyle(a).textDecorationLine.includes('underline')).map(a => a.textContent.trim()));
        expect(underlined, path).toEqual([]);
    }
});

test('ningún enlace ni recurso interno está roto', async ({ page, request }) => {
    const seen = new Set();
    const broken = [];
    for (const path of PAGES) {
        await page.goto(path);
        const urls = await page.evaluate(() => [
            ...[...document.querySelectorAll('a[href]')].map(a => a.href),
            ...[...document.querySelectorAll('link[href]')].map(l => l.href),
            ...[...document.querySelectorAll('script[src]')].map(s => s.src),
            ...[...document.querySelectorAll('img[src]')].map(i => i.src),
        ]);
        for (const raw of urls) {
            const url = new URL(raw);
            if (url.origin !== new URL(page.url()).origin) continue; // los externos se revisan aparte
            url.hash = '';
            if (seen.has(url.href)) continue;
            seen.add(url.href);
            const res = await request.get(url.href);
            if (res.status() !== 200) broken.push(`${path} → ${url.pathname} (${res.status()})`);
        }
    }
    // recursos que los metadatos piden por URL absoluta del sitio publicado
    for (const file of ['/img/og-image.jpg', '/img/favicon.svg', '/img/apple-touch-icon.png', '/site.webmanifest', '/robots.txt', '/sitemap.xml']) {
        const res = await request.get(file);
        if (res.status() !== 200) broken.push(`${file} (${res.status()})`);
    }
    expect(broken).toEqual([]);
});

test('el sitemap solo lista páginas que existen', async ({ request }) => {
    const xml = readFileSync(new URL('../../sitemap.xml', import.meta.url), 'utf8');
    const paths = [...xml.matchAll(/<loc>https:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(m => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect((await request.get(p)).status(), p).toBe(200);
});

test('una ruta que no existe muestra la página 404 personalizada', async ({ page }) => {
    const res = await page.goto('/no-existe/para-nada');
    expect(res.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Aquí falta una ficha' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver a jugar' }).click();
    await expect(page).toHaveURL(/game\.html/);
});

test('sin sesión se entra directo al juego como invitado, con CTA claro', async ({ page }) => {
    await page.goto('/html/game.html');
    await expect(page.getByRole('button', { name: 'Jugar ahora' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
    await page.getByRole('button', { name: 'Jugar ahora' }).click();
    await expect(page.locator('#arena')).toBeVisible();
    expect(await page.evaluate(() => app.settings.mode)).toBe('ai');
});

test.describe('cookies y analítica', () => {
    test.beforeEach(async ({ context }) => {
        // activa GA con un ID de prueba y bloquea la red de Google
        await context.route('**/js/config.js', async route => {
            const res = await route.fetch();
            route.fulfill({ response: res, body: (await res.text()).replace("gaMeasurementId: ''", "gaMeasurementId: 'G-TEST123'") });
        });
        await context.route(/googletagmanager\.com|google-analytics\.com/, r => r.fulfill({ status: 204, body: '' }));
    });

    test('no se carga analítica hasta aceptar, y se recuerda la elección', async ({ page }) => {
        await page.goto('/html/game.html');
        const banner = page.getByRole('dialog', { name: '¿Nos dejas medir cómo se usa el juego?' });
        await expect(banner).toBeVisible();
        expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
        await banner.getByRole('button', { name: 'Aceptar analítica' }).click();
        await expect(banner).toBeHidden();
        await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(1);
        await page.reload();
        await expect(page.locator('#consent')).toHaveCount(0);
    });

    test('rechazar no carga nada y se puede cambiar desde el pie', async ({ page }) => {
        await page.goto('/html/privacidad.html');
        await page.getByRole('button', { name: 'Rechazar' }).click();
        await page.reload();
        await expect(page.locator('#consent')).toHaveCount(0);
        expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
        await page.getByRole('button', { name: 'Preferencias de cookies' }).click();
        await expect(page.locator('#consent')).toBeVisible();
    });
});

test.describe('formularios', () => {
    test('crear cuenta valida cada campo con mensajes claros', async ({ page }) => {
        await page.goto('/html/login.html');
        await page.getByRole('tab', { name: 'Crear cuenta' }).click();
        await page.getByRole('button', { name: 'Crear cuenta' }).click();
        await expect(page.locator('#reg-username')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#reg-username-err')).toHaveText('Escribe un nombre de usuario');

        await page.locator('#reg-username').fill('a b');
        await page.locator('#reg-email').fill('no-es-email');
        await page.locator('#reg-password').fill('corta');
        await page.getByRole('button', { name: 'Crear cuenta' }).click();
        await expect(page.locator('#reg-username-err')).toContainText('Usa solo letras');
        await expect(page.locator('#reg-email-err')).toContainText('no parece válido');
        await expect(page.locator('#reg-password-err')).toContainText('al menos 8');
        await expect(page.locator('#reg-terms-err')).toContainText('aceptar los términos');
    });

    test('el campo trampa no lo ve una persona', async ({ page }) => {
        await page.goto('/html/login.html');
        await expect(page.locator('#reg-website')).not.toBeInViewport();
        expect(await page.locator('#reg-website').getAttribute('tabindex')).toBe('-1');
    });

    test('el nombre para jugar online se valida', async ({ page }) => {
        await page.addInitScript(() => {
            window.claude = { use: async () => ({ onPeers() { return () => {}; }, presence: async () => {}, join: async () => ({}) }) };
        });
        await openGame(page);
        await page.getByRole('button', { name: 'Online con un amigo' }).click();
        await page.locator('#nick-input').fill('x');
        await page.locator('#create-room-btn').click();
        await expect(page.locator('#nick-err')).toContainText('al menos 2');
    });
});
