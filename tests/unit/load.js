// Carga los scripts del navegador (IIFE que cuelgan de `window`) dentro de Node.
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';

globalThis.window = globalThis;

export function load(...files) {
    for (const f of files) runInThisContext(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'), { filename: f });
}

load('js/engine.js', 'js/net.js');

export const E = globalThis.Engine;
export const NetCodec = globalThis.NetCodec;

// Tablero a partir de un dibujo: '.' vacío, 'r' rojo, 'y' amarillo, 's' piedra (fila 0 arriba)
export function board(rows, opts = {}) {
    const s = E.createState({ rows: rows.length, cols: rows[0].length, map: 'classic', events: false, ...opts });
    let n = 0;
    rows.forEach((line, r) => [...line].forEach((ch, c) => {
        s.cells[r][c] = ch === '.' ? null
            : ch === 's' ? { id: 't' + n++, stone: true }
                : { id: 't' + n++, color: ch === 'r' ? 'red' : 'yellow' };
    }));
    return s;
}

export function draw(s) {
    return s.cells.map(row => row.map(x => (!x ? '.' : x.stone ? 's' : x.color[0])).join(''));
}

// Ninguna ficha flota: debajo de cada ficha hay otra ficha, una piedra o el suelo
export function floating(s) {
    for (let r = 0; r < s.rows - 1; r++) for (let c = 0; c < s.cols; c++) {
        const x = s.cells[r][c];
        if (x && !x.stone && !s.cells[r + 1][c]) return [r, c];
    }
    return null;
}
