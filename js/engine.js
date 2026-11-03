/* ==========================================================
   4 en Raya — motor del juego (lógica pura, sin DOM)
   ========================================================== */
(function (global) {
    'use strict';

    const CONNECT = 4;
    const COLORS = ['red', 'yellow'];
    const NAMES = { red: 'Rojo', yellow: 'Amarillo' };
    const MAX_CHARGE = 6;

    const POWERS = {
        freeze:      { key: '1', icon: '❄️', name: 'Hielo',  cost: 2, desc: 'Congela una columna durante el próximo turno del rival.' },
        flip:        { key: '2', icon: '🌊', name: 'Ola',    cost: 3, desc: 'Da la vuelta al orden de las fichas de una columna.' },
        bomb:        { key: '3', icon: '💣', name: 'Bomba',  cost: 4, desc: 'Destruye una ficha rival. Las de encima caen.' },
        double:      { key: '4', icon: '⚡', name: 'Doble',  cost: 5, desc: 'Tu próxima tirada suelta dos fichas seguidas.' },
    };

    const EVENTS = {
        whirlwind: { icon: '🌪', name: 'Remolino',  desc: 'Todas las fichas salen volando y caen donde pueden.' },
        quake:     { icon: '🌋', name: 'Terremoto', desc: 'Las fichas se desplazan a los lados y vuelven a caer.' },
        flipAll:   { icon: '🧲', name: 'Vuelco',    desc: 'Cada columna se pone del revés.' },
        meteor:    { icon: '☄️', name: 'Meteorito', desc: 'Una ficha al azar estalla junto con sus vecinas.' },
        swap:      { icon: '🌊', name: 'Marea',     desc: 'Dos columnas vecinas se intercambian.' },
        blizzard:  { icon: '❄️', name: 'Ventisca',  desc: 'Dos columnas se congelan durante un turno.' },
        gift:      { icon: '🎁', name: 'Regalo',    desc: 'Cae una ficha extra de un color al azar.' },
    };

    const MAPS = {
        classic:   { name: 'Clásico',    desc: 'Tablero limpio. Eventos cada 5–8 tiradas.' },
        obstacles: { name: 'Obstáculos', desc: 'Piedras que hacen de suelo a mitad del tablero.' },
        frozen:    { name: 'Glaciar',    desc: 'Empiezas con columnas congeladas.' },
        chaos:     { name: 'Caos',       desc: 'Eventos cada 2–4 tiradas.' },
        random:    { name: 'Aleatorio',  desc: 'Uno de los anteriores, a sorteo.' },
    };

    let uid = 1;
    const nextId = () => 'p' + (uid++) + Math.random().toString(36).slice(2, 6);

    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = arr => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };
    const other = color => (color === 'red' ? 'yellow' : 'red');

    /* ---------- estado ---------- */

    function createState(opts) {
        const rows = opts.rows || 6;
        const cols = opts.cols || 7;
        let map = opts.map || 'classic';
        if (map === 'random') map = pick(['classic', 'obstacles', 'frozen', 'chaos']);

        const s = {
            v: 2,
            rows, cols, map,
            events: opts.events !== false,
            cells: Array.from({ length: rows }, () => Array(cols).fill(null)),
            frozen: {},
            turn: 'red',
            starter: opts.starter || 'red',
            charges: { red: 1, yellow: 1 },
            doubleArmed: { red: false, yellow: false },
            powerUsedThisTurn: false,
            moves: 0,
            nextEventAt: 0,
            nextEvent: null,
            over: false,
            winner: null,
            winLine: null,
            seq: 0,
            lastEvent: null,
            lastMove: null,
        };
        s.turn = s.starter;

        if (map === 'obstacles') placeStones(s, Math.round(rows * cols / 9));
        if (map === 'frozen') {
            const colsIdx = shuffle([...Array(cols).keys()]).slice(0, Math.max(2, Math.floor(cols / 3)));
            colsIdx.forEach(c => (s.frozen[c] = rand(2, 4)));
        }
        scheduleEvent(s);
        return s;
    }

    function placeStones(s, count) {
        // Las piedras van en la mitad inferior y nunca en la fila de abajo,
        // así que crean "suelos" a mitad de columna.
        const minRow = Math.floor(s.rows / 2);
        let tries = 0, placed = 0;
        while (placed < count && tries++ < 500) {
            const r = rand(minRow, s.rows - 2);
            const c = rand(0, s.cols - 1);
            if (s.cells[r][c]) continue;
            // nunca dos piedras en la misma columna
            if (s.cells.some(row => row[c] && row[c].stone)) continue;
            s.cells[r][c] = { id: nextId(), stone: true };
            placed++;
        }
    }

    function eventGap(s) {
        return s.map === 'chaos' ? [2, 4] : [5, 8];
    }

    function scheduleEvent(s) {
        if (!s.events) { s.nextEvent = null; s.nextEventAt = Infinity; return; }
        const [a, b] = eventGap(s);
        s.nextEventAt = s.moves + rand(a, b);
        s.nextEvent = pick(Object.keys(EVENTS));
    }

    const clone = s => JSON.parse(JSON.stringify(s, (k, v) => (v === Infinity ? 'Infinity' : v)),
        (k, v) => (v === 'Infinity' ? Infinity : v));

    /* ---------- física ---------- */

    // Fila en la que aterriza una ficha soltada por arriba (o null si la columna está llena).
    function dropRow(s, c) {
        if (s.cells[0][c]) return null;
        let r = 0;
        while (r + 1 < s.rows && !s.cells[r + 1][c]) r++;
        return r;
    }

    // Aplica la gravedad: cada tramo entre piedras se apila hacia su suelo.
    function settle(s) {
        for (let c = 0; c < s.cols; c++) {
            let floor = s.rows - 1;
            for (let r = s.rows - 1; r >= -1; r--) {
                const cell = r >= 0 ? s.cells[r][c] : { stone: true };
                if (cell && cell.stone) {
                    // tramo (r, floor]
                    const pieces = [];
                    for (let k = floor; k > r; k--) {
                        if (s.cells[k][c]) pieces.push(s.cells[k][c]);
                        s.cells[k][c] = null;
                    }
                    let k = floor;
                    pieces.forEach(p => (s.cells[k--][c] = p));
                    floor = r - 1;
                }
            }
        }
    }

    function canDrop(s, c) {
        return !(s.frozen[c] > 0) && dropRow(s, c) !== null;
    }

    function legalCols(s) {
        const out = [];
        for (let c = 0; c < s.cols; c++) if (canDrop(s, c)) out.push(c);
        return out;
    }

    function boardFull(s) {
        for (let c = 0; c < s.cols; c++) if (dropRow(s, c) !== null) return false;
        return true;
    }

    function place(s, c, color) {
        const r = dropRow(s, c);
        if (r === null) return null;
        const id = nextId();
        s.cells[r][c] = { id, color };
        s.lastMove = { r, c, color, id };
        return r;
    }

    /* ---------- victoria ---------- */

    function findLine(s, color) {
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        let best = null;
        for (let r = 0; r < s.rows; r++) {
            for (let c = 0; c < s.cols; c++) {
                const cell = s.cells[r][c];
                if (!cell || cell.color !== color) continue;
                for (const [dr, dc] of dirs) {
                    const pr = r - dr, pc = c - dc;
                    if (pr >= 0 && pr < s.rows && pc >= 0 && pc < s.cols && s.cells[pr][pc] && s.cells[pr][pc].color === color) continue;
                    const line = [];
                    let nr = r, nc = c;
                    while (nr >= 0 && nr < s.rows && nc >= 0 && nc < s.cols && s.cells[nr][nc] && s.cells[nr][nc].color === color) {
                        line.push([nr, nc]);
                        nr += dr; nc += dc;
                    }
                    if (line.length >= CONNECT && (!best || line.length > best.length)) best = line;
                }
            }
        }
        return best;
    }

    // Comprueba el resultado tras cualquier cambio. Devuelve true si la partida terminó.
    function resolve(s) {
        const red = findLine(s, 'red');
        const yellow = findLine(s, 'yellow');
        if (red && yellow) {
            s.over = true; s.winner = null; s.winLine = [red, yellow]; s.result = 'double';
            return true;
        }
        if (red || yellow) {
            s.over = true; s.winner = red ? 'red' : 'yellow'; s.winLine = [red || yellow]; s.result = 'win';
            return true;
        }
        if (boardFull(s)) {
            s.over = true; s.winner = null; s.winLine = null; s.result = 'draw';
            return true;
        }
        return false;
    }

    /* ---------- poderes ---------- */

    // Devuelve un mensaje de error o null si el objetivo es válido.
    function powerTargetError(s, power, r, c) {
        const color = s.turn;
        if (power === 'bomb') {
            const cell = s.cells[r] && s.cells[r][c];
            if (!cell || cell.stone || cell.color === color) return 'Elige una ficha de tu rival';
        }
        if (power === 'flip') {
            const n = s.cells.reduce((acc, row) => acc + (row[c] && !row[c].stone ? 1 : 0), 0);
            if (n < 2) return 'Esa columna necesita al menos dos fichas';
        }
        if (power === 'freeze' && s.frozen[c] > 0) return 'Esa columna ya está congelada';
        return null;
    }

    function applyPower(s, power, r, c) {
        const color = s.turn;
        s.charges[color] -= POWERS[power].cost;
        s.powerUsedThisTurn = true;
        const removed = [];
        if (power === 'bomb') {
            removed.push({ ...s.cells[r][c], r, c });
            s.cells[r][c] = null;
            settle(s);
        }
        if (power === 'flip') {
            // invierte cada tramo de la columna
            let segment = [];
            const flush = () => {
                const pieces = segment.map(([rr]) => s.cells[rr][c]).reverse();
                segment.forEach(([rr], i) => (s.cells[rr][c] = pieces[i]));
                segment = [];
            };
            for (let rr = 0; rr < s.rows; rr++) {
                const cell = s.cells[rr][c];
                if (cell && cell.stone) { flush(); continue; }
                if (cell) segment.push([rr]);
            }
            flush();
            settle(s);
        }
        if (power === 'freeze') s.frozen[c] = 2; // dura el turno del rival
        if (power === 'double') s.doubleArmed[color] = true;
        return { removed };
    }

    /* ---------- eventos ---------- */

    function applyEvent(s, id) {
        const info = { id, removed: [], cols: [] };
        const pieces = [];
        for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
            const cell = s.cells[r][c];
            if (cell && !cell.stone) pieces.push({ r, c, cell });
        }

        if (id === 'whirlwind') {
            const spots = [];
            for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
                if (!(s.cells[r][c] && s.cells[r][c].stone)) spots.push([r, c]);
            }
            pieces.forEach(p => (s.cells[p.r][p.c] = null));
            shuffle(spots);
            pieces.forEach((p, i) => { const [r, c] = spots[i]; s.cells[r][c] = p.cell; });
            settle(s);
        }
        if (id === 'quake') {
            for (let r = s.rows - 1; r >= 0; r--) {
                for (const c of shuffle([...Array(s.cols).keys()])) {
                    const cell = s.cells[r][c];
                    if (!cell || cell.stone || Math.random() < 0.45) continue;
                    const nc = c + (Math.random() < 0.5 ? -1 : 1);
                    if (nc < 0 || nc >= s.cols || s.cells[r][nc]) continue;
                    s.cells[r][nc] = cell; s.cells[r][c] = null;
                }
            }
            settle(s);
        }
        if (id === 'flipAll') {
            for (let c = 0; c < s.cols; c++) {
                const col = [];
                for (let r = 0; r < s.rows; r++) if (s.cells[r][c] && !s.cells[r][c].stone) col.push(r);
                const vals = col.map(r => s.cells[r][c]).reverse();
                col.forEach((r, i) => (s.cells[r][c] = vals[i]));
            }
            settle(s);
        }
        if (id === 'meteor' && pieces.length) {
            const t = pick(pieces);
            [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                const r = t.r + dr, c = t.c + dc;
                const cell = s.cells[r] && s.cells[r][c];
                if (cell && !cell.stone) { info.removed.push({ ...cell, r, c }); s.cells[r][c] = null; }
            });
            info.center = [t.r, t.c];
            settle(s);
        }
        if (id === 'swap') {
            const a = rand(0, s.cols - 2), b = a + 1;
            for (let r = 0; r < s.rows; r++) {
                const x = s.cells[r][a], y = s.cells[r][b];
                if ((x && x.stone) || (y && y.stone)) continue;
                s.cells[r][a] = y; s.cells[r][b] = x;
            }
            const fa = s.frozen[a], fb = s.frozen[b];
            delete s.frozen[a]; delete s.frozen[b];
            if (fb) s.frozen[a] = fb;
            if (fa) s.frozen[b] = fa;
            info.cols = [a, b];
            settle(s);
        }
        if (id === 'blizzard') {
            const free = shuffle([...Array(s.cols).keys()].filter(c => !s.frozen[c])).slice(0, 2);
            free.forEach(c => (s.frozen[c] = 2));
            info.cols = free;
        }
        if (id === 'gift') {
            const cols = [...Array(s.cols).keys()].filter(c => dropRow(s, c) !== null);
            if (cols.length) {
                const c = pick(cols);
                const color = pick(COLORS);
                const r = place(s, c, color);
                info.cols = [c];
                info.gift = { r, c, color };
            }
        }
        s.lastEvent = { id, at: s.seq + 1, info };
        return info;
    }

    /* ---------- turnos ---------- */

    function endTurn(s) {
        // el hielo se derrite un poco al cambiar de turno
        Object.keys(s.frozen).forEach(k => {
            s.frozen[k]--;
            if (s.frozen[k] <= 0) delete s.frozen[k];
        });
        s.turn = other(s.turn);
        s.powerUsedThisTurn = false;
        s.charges[s.turn] = Math.min(MAX_CHARGE, s.charges[s.turn] + 1);
    }

    function eventDue(s) {
        return s.events && s.moves >= s.nextEventAt;
    }

    /* ==========================================================
       IA: negamax con poda alfa-beta sobre un tablero plano
       ========================================================== */

    const EMPTY = 0, STONE = 3;

    function toGrid(s) {
        const g = new Int8Array(s.rows * s.cols);
        for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
            const cell = s.cells[r][c];
            g[r * s.cols + c] = !cell ? EMPTY : cell.stone ? STONE : cell.color === 'red' ? 1 : 2;
        }
        return g;
    }

    function makeAI(s) {
        const R = s.rows, C = s.cols;
        // precalcula todas las ventanas de 4
        const windows = [];
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of dirs) {
            const er = r + dr * 3, ec = c + dc * 3;
            if (er < 0 || er >= R || ec < 0 || ec >= C) continue;
            windows.push([0, 1, 2, 3].map(i => (r + dr * i) * C + (c + dc * i)));
        }
        const center = (C - 1) / 2;
        const order = [...Array(C).keys()].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));

        function drop(g, c) {
            if (g[c] !== EMPTY) return -1;
            let r = 0;
            while (r + 1 < R && g[(r + 1) * C + c] === EMPTY) r++;
            return r * C + c;
        }

        function wins(g, idx, p) {
            const r = Math.floor(idx / C), c = idx % C;
            for (const [dr, dc] of dirs) {
                let n = 1;
                for (const sgn of [1, -1]) {
                    let rr = r + dr * sgn, cc = c + dc * sgn;
                    while (rr >= 0 && rr < R && cc >= 0 && cc < C && g[rr * C + cc] === p) { n++; rr += dr * sgn; cc += dc * sgn; }
                }
                if (n >= 4) return true;
            }
            return false;
        }

        function evaluate(g, p) {
            const o = 3 - p;
            let score = 0;
            for (const w of windows) {
                let mine = 0, theirs = 0, blocked = false;
                for (const i of w) {
                    const v = g[i];
                    if (v === p) mine++; else if (v === o) theirs++; else if (v === STONE) blocked = true;
                }
                if (blocked || (mine && theirs)) continue;
                if (mine === 3) score += 50; else if (mine === 2) score += 6; else if (mine === 1) score += 1;
                if (theirs === 3) score -= 60; else if (theirs === 2) score -= 6;
            }
            for (let r = 0; r < R; r++) {
                const v = g[r * C + Math.round(center)];
                if (v === p) score += 4; else if (v === o) score -= 4;
            }
            return score;
        }

        let nodes = 0;
        function negamax(g, depth, alpha, beta, p, limit) {
            nodes++;
            if (depth === 0 || nodes > limit) return evaluate(g, p);
            let any = false;
            let best = -Infinity;
            for (const c of order) {
                const idx = drop(g, c);
                if (idx < 0) continue;
                any = true;
                g[idx] = p;
                let v;
                if (wins(g, idx, p)) v = 100000 + depth;
                else v = -negamax(g, depth - 1, -beta, -alpha, 3 - p, limit);
                g[idx] = EMPTY;
                if (v > best) best = v;
                if (v > alpha) alpha = v;
                if (alpha >= beta) break;
            }
            return any ? best : 0;
        }

        return {
            choose(color, maxDepth, allowed) {
                // profundidad creciente: solo se usa la última pasada completa
                const g = toGrid(s);
                const p = color === 'red' ? 1 : 2;
                const budget = 300000;
                let result = null;
                for (let depth = 1; depth <= maxDepth; depth++) {
                    nodes = 0;
                    const scores = [];
                    let aborted = false;
                    for (const c of order) {
                        if (!allowed.includes(c)) continue;
                        const idx = drop(g, c);
                        if (idx < 0) continue;
                        g[idx] = p;
                        const v = wins(g, idx, p) ? 1e6 : -negamax(g, depth - 1, -Infinity, Infinity, 3 - p, budget);
                        g[idx] = EMPTY;
                        if (nodes > budget) { aborted = true; break; }
                        scores.push({ c, v });
                    }
                    if (aborted) break;
                    result = scores;
                }
                return result || allowed.map(c => ({ c, v: 0 }));
            },
            threats(color, allowed) {
                // columnas donde 'color' gana en la próxima tirada
                const g = toGrid(s);
                const p = color === 'red' ? 1 : 2;
                return allowed.filter(c => {
                    const idx = drop(g, c);
                    if (idx < 0) return false;
                    g[idx] = p;
                    const w = wins(g, idx, p);
                    g[idx] = EMPTY;
                    return w;
                });
            },
        };
    }

    // Decide la jugada de la IA: { power?, target?, col }
    function aiDecide(s, level) {
        const me = s.turn, foe = other(me);
        const allowed = legalCols(s);
        if (!allowed.length) return null;
        const ai = makeAI(s);
        const depth = level === 'easy' ? 2 : level === 'hard' ? 6 : 4;

        // 1) gana si puede
        const myWins = ai.threats(me, allowed);
        if (myWins.length) return { col: myWins[0] };
        const mustBlock = ai.threats(foe, allowed);

        // 2) poderes (normal y difícil)
        if (level !== 'easy' && !s.powerUsedThisTurn) {
            const foeWins = ai.threats(foe, [...Array(s.cols).keys()]);
            // dos amenazas a la vez: bomba sobre una ficha clave o hielo
            if (foeWins.length >= 2 && s.charges[me] >= POWERS.bomb.cost) {
                const target = findBombTarget(s, foe);
                if (target) return { power: 'bomb', target };
            }
            if (foeWins.length >= 2 && s.charges[me] >= POWERS.freeze.cost) {
                const c = foeWins.find(col => !s.frozen[col] && !allowed.includes(col)) ?? foeWins[1];
                if (!s.frozen[c]) return { power: 'freeze', target: [0, c] };
            }
            if (level === 'hard' && s.charges[me] >= POWERS.double.cost && !s.doubleArmed[me]) {
                // ¿hay columna donde dos fichas seguidas ganan?
                for (const c of allowed) {
                    const t = clone(s);
                    place(t, c, me);
                    if (dropRow(t, c) !== null) { place(t, c, me); if (findLine(t, me)) return { power: 'double', target: [0, c], then: c }; }
                }
            }
        }

        // 3) bloqueo obligatorio de una amenaza directa
        if (mustBlock.length === 1 && (level !== 'easy' || Math.random() < 0.8)) return { col: mustBlock[0] };

        // 4) busca la mejor columna
        let scores = ai.choose(me, depth, allowed);
        scores.sort((a, b) => b.v - a.v);
        if (level === 'easy' && Math.random() < 0.35) return { col: pick(allowed) };
        const top = scores[0].v;
        const near = scores.filter(x => x.v >= top - (level === 'hard' ? 0 : 4));
        return { col: pick(near).c };
    }

    function findBombTarget(s, foe) {
        // elige la ficha rival cuya eliminación reduce más sus amenazas
        let best = null, bestN = Infinity;
        for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
            const cell = s.cells[r][c];
            if (!cell || cell.color !== foe) continue;
            const t = clone(s);
            t.cells[r][c] = null; settle(t);
            if (findLine(t, foe)) continue;
            const n = makeAI(t).threats(foe, [...Array(s.cols).keys()]).length;
            if (n < bestN) { bestN = n; best = [r, c]; }
        }
        return best;
    }

    global.Engine = {
        CONNECT, COLORS, NAMES, POWERS, EVENTS, MAPS, MAX_CHARGE,
        createState, clone, dropRow, settle, canDrop, legalCols, boardFull, place,
        findLine, resolve, powerTargetError, applyPower, applyEvent, endTurn, eventDue,
        scheduleEvent, aiDecide, other, rand,
    };
})(window);
