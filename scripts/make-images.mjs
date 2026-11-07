// Regenera iconos e imagen de vista previa desde img/favicon.svg y scripts/assets/og.html.
// Uso: node scripts/make-images.mjs  (necesita Chromium de Playwright y Python con Pillow para comprimir)
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const browser = await chromium.launch();
const page = await browser.newPage();
const svg = await readFile('img/favicon.svg', 'utf8');

for (const [name, size, pad] of [['favicon-32.png', 32, 0], ['apple-touch-icon.png', 180, 18], ['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 64]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:${pad ? '#0b2029' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">
        <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
    await page.screenshot({ path: `img/${name}`, omitBackground: !pad });
}

await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(pathToFileURL(resolve('scripts/assets/og.html')).href);
await page.waitForTimeout(300);
await page.screenshot({ path: 'img/og-image.png' });
await browser.close();

// compresión: JPEG para la vista previa y PNG optimizados para los iconos
execFileSync('python3', ['-c', `
from PIL import Image
import glob, os
im = Image.open('img/og-image.png').convert('RGB')
im.save('img/og-image.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
os.remove('img/og-image.png')
for f in glob.glob('img/*.png'):
    im = Image.open(f).convert('RGBA')
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(f, optimize=True)
`], { stdio: 'inherit' });
console.log('Imágenes generadas en img/');
