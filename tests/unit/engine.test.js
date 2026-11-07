import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { E, NetCodec, board, draw, floating } from './load.js';

describe('física', () => {
    test('las fichas se apilan desde abajo', () => {
        const s = E.createState({ rows: 6, cols: 7, events: false });
        assert.equal(E.place(s, 3, 'red'), 5);
        assert.equal(E.place(s, 3, 'yellow'), 4);
        assert.equal(s.cells[5][3].color, 'red');
    });

    test('una columna llena no admite más fichas', () => {
        const s = board(['r', 'y', 'r']);
        assert.equal(E.dropRow(s, 0), null);
        assert.equal(E.canDrop(s, 0), false);
    });

    test('las piedras hacen de suelo', () => {
        const s = board(['.', '.', 's', '.']);
        assert.equal(E.place(s, 0, 'red'), 1);
    });

    test('settle respeta las piedras', () => {
        const s = board(['r', '.', 's', 'y', '.']);
        E.settle(s);
        assert.deepEqual(draw(s), ['.', 'r', 's', '.', 'y']);
    });

    test('las columnas congeladas no admiten tiradas', () => {
        const s = E.createState({ rows: 6, cols: 7, events: false });
        s.frozen[2] = 1;
        assert.ok(!E.legalCols(s).includes(2));
    });
});

describe('victoria', () => {
    test('detecta horizontal, vertical y diagonales', () => {
        assert.ok(E.findLine(board(['....', 'rrrr']), 'red'));
        assert.ok(E.findLine(board(['y', 'y', 'y', 'y']), 'yellow'));
        assert.ok(E.findLine(board(['r...', '.r..', '..r.', '...r']), 'red'));
        assert.ok(E.findLine(board(['...y', '..y.', '.y..', 'y...']), 'yellow'));
        assert.equal(E.findLine(board(['rrr.']), 'red'), null);
    });

    test('cuatro en raya de los dos a la vez es empate doble', () => {
        const s = board(['rrrr', 'yyyy']);
        assert.ok(E.resolve(s));
        assert.equal(s.result, 'double');
        assert.equal(s.winner, null);
    });

    test('tablero lleno sin línea es empate', () => {
        const s = board(['ryry', 'ryry', 'yryr', 'yryr']);
        assert.ok(E.resolve(s));
        assert.equal(s.result, 'draw');
    });
});

describe('turnos y poderes', () => {
    test('cada turno da una carga, con tope', () => {
        const s = E.createState({ rows: 6, cols: 7, events: false });
        s.charges.yellow = E.MAX_CHARGE;
        E.endTurn(s);
        assert.equal(s.turn, 'yellow');
        assert.equal(s.charges.yellow, E.MAX_CHARGE);
    });

    test('la bomba solo acepta fichas rivales y hace caer las de encima', () => {
        const s = board(['.', 'r', 'y', 'r']);
        s.turn = 'red';
        s.charges.red = 6;
        assert.ok(E.powerTargetError(s, 'bomb', 1, 0));
        assert.equal(E.powerTargetError(s, 'bomb', 2, 0), null);
        E.applyPower(s, 'bomb', 2, 0);
        assert.deepEqual(draw(s), ['.', '.', 'r', 'r']);
        assert.equal(s.charges.red, 6 - E.POWERS.bomb.cost);
        assert.ok(s.powerUsedThisTurn);
    });

    test('el hielo dura el turno del rival y se derrite después', () => {
        const s = E.createState({ rows: 6, cols: 7, events: false });
        s.charges.red = 6;
        E.applyPower(s, 'freeze', 0, 3);
        E.endTurn(s); // turno amarillo
        assert.ok(!E.canDrop(s, 3));
        E.endTurn(s); // vuelve rojo
        assert.ok(E.canDrop(s, 3));
    });

    test('la ola invierte el orden de una columna', () => {
        const s = board(['.', 'r', 'r', 'y']);
        s.charges.red = 6;
        E.applyPower(s, 'flip', 0, 0);
        assert.deepEqual(draw(s), ['.', 'y', 'r', 'r']);
    });
});

describe('eventos de caos', () => {
    test('el próximo evento no se conoce de antemano y la espera es aleatoria', () => {
        const gaps = new Set();
        for (let i = 0; i < 200; i++) {
            const s = E.createState({ rows: 6, cols: 7, map: 'classic', events: true });
            assert.equal(s.nextEvent, null);
            assert.ok(s.nextEventAt >= 3 && s.nextEventAt <= 10);
            gaps.add(s.nextEventAt);
        }
        assert.ok(gaps.size > 3);
    });

    test('el sorteo no repite el evento anterior', () => {
        const s = E.createState({ rows: 6, cols: 7, events: true });
        for (let i = 0; i < 100; i++) {
            const last = s.lastEvent && s.lastEvent.id;
            const id = E.rollEvent(s);
            assert.notEqual(id, last);
            s.lastEvent = { id };
        }
    });

    for (const id of Object.keys(E.EVENTS)) {
        test(`${id} deja todas las fichas apoyadas`, () => {
            for (let k = 0; k < 40; k++) {
                const s = E.createState({ rows: 7, cols: 8, map: k % 2 ? 'obstacles' : 'classic', events: false });
                for (let m = 0; m < 25; m++) {
                    const cols = E.legalCols(s);
                    if (!cols.length) break;
                    E.place(s, cols[Math.floor(Math.random() * cols.length)], m % 2 ? 'red' : 'yellow');
                }
                const before = s.cells.flat().filter(x => x && !x.stone).length;
                const info = E.applyEvent(s, id);
                assert.equal(floating(s), null, draw(s).join('\n'));
                const after = s.cells.flat().filter(x => x && !x.stone).length;
                if (!['meteor', 'gift'].includes(id)) assert.equal(after, before);
                if (id === 'meteor') assert.equal(after, before - info.removed.length);
            }
        });
    }
});

describe('IA', () => {
    test('gana cuando puede', () => {
        const s = board(['......', '......', '......', 'yyy...']);
        s.turn = 'yellow';
        for (const level of ['easy', 'normal', 'hard']) assert.equal(E.aiDecide(s, level).col, 3);
    });

    test('bloquea una amenaza directa', () => {
        for (const col of [0, 6]) {
            const s = E.createState({ rows: 6, cols: 7, events: false });
            E.place(s, col, 'red'); E.place(s, 3, 'yellow');
            E.place(s, col, 'red'); E.place(s, 4, 'yellow');
            E.place(s, col, 'red');
            s.turn = 'yellow';
            for (const level of ['normal', 'hard']) {
                const d = E.aiDecide(s, level);
                assert.ok(d.power || d.col === col, `${level} no bloqueó la columna ${col}`);
            }
        }
    });
});

describe('estado online comprimido', () => {
    test('ida y vuelta sin pérdidas y por debajo de 4 KiB', () => {
        const s = E.createState({ rows: 9, cols: 10, map: 'obstacles', events: true });
        for (let m = 0; m < 200; m++) {
            const cols = E.legalCols(s);
            if (!cols.length) break;
            E.place(s, cols[m % cols.length], m % 2 ? 'red' : 'yellow');
        }
        s.frozen = { 2: 1 };
        const enc = NetCodec.encode(s);
        assert.ok(JSON.stringify(enc).length < 4000);
        const dec = NetCodec.decode(JSON.parse(JSON.stringify(enc)));
        assert.deepEqual(dec.cells, s.cells);
        assert.deepEqual(dec.frozen, s.frozen);
        assert.equal(dec.nextEventAt, s.nextEventAt);
    });
});
