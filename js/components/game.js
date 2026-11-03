/* ==========================================================
   4 en Raya — interfaz, animaciones y flujo de partida
   ========================================================== */
(function () {
    'use strict';

    const E = window.Engine;
    const $ = id => document.getElementById(id);
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sound = new Sound();
    const SKINS = [
        { id: 'clasico',  name: 'Clásico',     desc: 'Plástico azul de toda la vida' },
        { id: 'madera',   name: 'Madera',      desc: 'Roble barnizado con veta' },
        { id: 'neon',     name: 'Neón',        desc: 'Vidrio oscuro y aros de luz' },
        { id: 'cristal',  name: 'Cristal',     desc: 'Escarcha translúcida' },
        { id: 'oro',      name: 'Noche y oro', desc: 'Laca negra con aros dorados' },
        { id: 'lava',     name: 'Lava',        desc: 'Roca volcánica encendida' },
        { id: 'caramelo', name: 'Caramelo',    desc: 'Rosa chicle y menta' },
    ];
    const miniBoard = () => `
        <span class="skin-mini"><span class="skin-mini-grid">
            <i class="disc red" style="left:0;top:calc(var(--p)*2)"></i>
            <i class="disc yellow" style="left:var(--p);top:calc(var(--p)*2)"></i>
            <i class="disc red" style="left:var(--p);top:var(--p)"></i>
            <i class="disc yellow" style="left:calc(var(--p)*2);top:calc(var(--p)*2)"></i>
            <span class="skin-mini-plate"></span><span class="skin-mini-rims"></span>
        </span></span>`;
    const PALETTE = {
        red: ['#e5342a', '#ff8a74', '#ffb3a3', '#8f150f'],
        yellow: ['#f5b915', '#ffe58a', '#fff3c2', '#a76d00'],
    };

    /* ==========================================================
       Renderizador del tablero
       ========================================================== */
    class BoardView {
        constructor() {
            this.machine = $('machine');
            this.grid = $('grid');
            this.layer = $('pieces');
            this.overlay = $('overlay');
            this.hits = $('hits');
            this.ghost = $('ghost');
            this.winline = $('winline');
            this.els = new Map();   // id -> elemento
            this.pos = new Map();   // id -> [r, c]
            this.pitch = 64;
            this.rows = 6; this.cols = 7;
            this.glow = document.createElement('div');
            this.glow.className = 'colglow';
        }

        setup(state) {
            this.rows = state.rows; this.cols = state.cols;
            this.machine.style.setProperty('--rows', state.rows);
            this.machine.style.setProperty('--cols', state.cols);
            this.layer.innerHTML = '';
            this.overlay.innerHTML = '';
            this.overlay.appendChild(this.glow);
            this.winline.innerHTML = '';
            this.els.clear(); this.pos.clear();
            this.hits.innerHTML = '';
            for (let c = 0; c < state.cols; c++) {
                const b = document.createElement('button');
                b.className = 'hit';
                b.type = 'button';
                b.dataset.col = c;
                b.setAttribute('aria-label', `Columna ${c + 1}`);
                this.hits.appendChild(b);
            }
            this.layout();
            this.render(state, { animate: false });
        }

        // la palanca: todas las fichas caen por abajo
        drain() {
            let max = 0;
            for (const [id, el] of this.els) {
                const [r, c] = this.pos.get(id);
                const delay = (this.rows - 1 - r) * 25 + Math.random() * 60;
                const dur = 420 + Math.random() * 120;
                const fall = (this.rows + 1.5) * this.pitch;
                el.getAnimations().forEach(a => a.cancel());
                el.animate([
                    { transform: this.tf(r, c) },
                    { transform: this.tf(r, c, fall) },
                ], { duration: dur, delay, easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' });
                max = Math.max(max, delay + dur);
            }
            this.winline.innerHTML = '';
            return wait(max);
        }

        enter() {
            const m = this.machine;
            m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter');
            setTimeout(() => m.classList.remove('enter'), 900);
        }

        layout() {
            const wide = innerWidth > 1080;
            const sideW = wide ? 2 * 250 + 2 * 36 + 64 : 24;
            const availW = Math.min(innerWidth - sideW, 980);
            const top = this.machine.getBoundingClientRect().top + scrollY;
            const reserve = innerWidth <= 560 ? 90 : 120;
            const availH = Math.max(260, innerHeight - top - reserve);
            const p = Math.min(availW / (this.cols + 1), availH / (this.rows + 1.9));
            this.pitch = Math.max(30, Math.min(86, Math.floor(p)));
            this.machine.style.setProperty('--pitch', this.pitch + 'px');
            for (const [id, [r, c]] of this.pos) {
                const el = this.els.get(id);
                el.getAnimations().forEach(a => a.finish());
                el.style.transform = this.tf(r, c);
            }
        }

        tf(r, c, dy = 0) {
            return `translate(${c * this.pitch}px, ${r * this.pitch + dy}px)`;
        }

        makePiece(cell) {
            const el = document.createElement('div');
            el.className = 'piece ' + (cell.stone ? 'stone' : cell.color);
            el.dataset.id = cell.id;
            this.layer.appendChild(el);
            this.els.set(cell.id, el);
            return el;
        }

        // Pinta el estado. Las fichas nuevas caen, las movidas se deslizan,
        // las desaparecidas estallan. Devuelve una promesa al terminar.
        render(state, { animate = true, explode = null, onLand = null } = {}) {
            const seen = new Set();
            const anims = [];
            let maxDur = 0;
            const speed = reduced ? 0.25 : 1;

            for (let r = 0; r < state.rows; r++) {
                for (let c = 0; c < state.cols; c++) {
                    const cell = state.cells[r][c];
                    if (!cell) continue;
                    seen.add(cell.id);
                    let el = this.els.get(cell.id);
                    const prev = this.pos.get(cell.id);
                    const target = this.tf(r, c);

                    if (!el) {
                        el = this.makePiece(cell);
                        el.style.transform = target;
                        if (animate && !cell.stone) {
                            const dur = (240 + Math.sqrt(r + 1) * 95) * speed;
                            const from = this.tf(-1.2, c);
                            const bounce = this.tf(r, c, -this.pitch * 0.13);
                            anims.push(el.animate([
                                { transform: from, easing: 'cubic-bezier(.55,0,1,.45)' },
                                { transform: target, offset: 0.72, easing: 'cubic-bezier(.2,.8,.4,1)' },
                                { transform: bounce, offset: 0.86, easing: 'cubic-bezier(.6,0,1,1)' },
                                { transform: target },
                            ], { duration: dur }));
                            const depth = r / Math.max(1, state.rows - 1);
                            setTimeout(() => {
                                sound.play('clack', { depth });
                                this.machine.classList.remove('thump');
                                void this.machine.offsetWidth;
                                this.machine.classList.add('thump');
                                const pt = this.point(r, c);
                                window.fx.ring(pt.x, pt.y, cell.color === 'red' ? 'rgba(255,138,116,.9)' : 'rgba(255,229,138,.9)', this.pitch);
                                onLand && onLand(r, c);
                            }, dur * 0.72);
                            maxDur = Math.max(maxDur, dur);
                        }
                    } else if (prev && (prev[0] !== r || prev[1] !== c)) {
                        el.getAnimations().forEach(a => a.cancel());
                        const from = this.tf(prev[0], prev[1]);
                        el.style.transform = target;
                        if (animate) {
                            const dist = Math.hypot(r - prev[0], c - prev[1]);
                            const down = r > prev[0] && c === prev[1];
                            const dur = (down ? 200 + Math.sqrt(dist) * 110 : 380 + dist * 35) * speed;
                            const kf = down
                                ? [
                                    { transform: from, easing: 'cubic-bezier(.55,0,1,.45)' },
                                    { transform: target, offset: 0.8, easing: 'ease-out' },
                                    { transform: this.tf(r, c, -this.pitch * 0.06), offset: 0.9 },
                                    { transform: target },
                                ]
                                : [
                                    { transform: from, easing: 'cubic-bezier(.6,-0.2,.3,1.25)' },
                                    { transform: target },
                                ];
                            anims.push(el.animate(kf, { duration: dur }));
                            maxDur = Math.max(maxDur, dur);
                        }
                    }
                    el.classList.remove('win', 'target', 'dim');
                    this.pos.set(cell.id, [r, c]);
                }
            }

            // desaparecidas
            for (const [id, el] of [...this.els]) {
                if (seen.has(id)) continue;
                const [r, c] = this.pos.get(id) || [0, 0];
                this.els.delete(id); this.pos.delete(id);
                if (animate) {
                    const boom = explode && explode.has(id);
                    if (boom) {
                        const pt = this.point(r, c);
                        const color = el.classList.contains('red') ? 'red' : 'yellow';
                        window.fx.burst(pt.x, pt.y, PALETTE[color].concat(['#ff9d2e', '#fff']), 30, 1.1);
                    }
                    const a = el.animate(
                        boom
                            ? [{ transform: el.style.transform + ' scale(1)', opacity: 1 }, { transform: el.style.transform + ' scale(1.5)', opacity: 0 }]
                            : [{ opacity: 1 }, { opacity: 0 }],
                        { duration: 260 * speed, fill: 'forwards' });
                    a.onfinish = () => el.remove();
                } else el.remove();
            }

            this.renderIce(state.frozen, animate);
            if (!animate) this.winline.innerHTML = '';
            return wait(maxDur + 30);
        }

        renderIce(frozen, animate) {
            const existing = new Map([...this.overlay.querySelectorAll('.ice')].map(el => [Number(el.dataset.col), el]));
            for (let c = 0; c < this.cols; c++) {
                const n = frozen[c] || 0;
                const el = existing.get(c);
                if (n > 0) {
                    const ice = el || document.createElement('div');
                    if (!el) {
                        ice.className = 'ice';
                        ice.dataset.col = c;
                        ice.innerHTML = '<span></span>';
                        this.overlay.appendChild(ice);
                        if (animate) {
                            const pt = this.point(0, c);
                            window.fx.shards(pt.x, pt.y);
                        }
                    }
                    ice.style.left = c * this.pitch + 'px';
                    ice.querySelector('span').textContent = '❄ ' + n;
                    ice.title = `Congelada durante ${n} turno${n > 1 ? 's' : ''}`;
                } else if (el && !el.classList.contains('melt')) {
                    el.classList.add('melt');
                    setTimeout(() => el.remove(), 450);
                }
            }
        }

        markWin(lines) {
            this.winline.innerHTML = '';
            if (!lines) return;
            for (const line of lines) {
                line.forEach(([r, c]) => {
                    for (const [id, [pr, pc]] of this.pos) {
                        if (pr === r && pc === c) this.els.get(id).classList.add('win');
                    }
                });
                const [a, b] = [line[0], line[line.length - 1]];
                const p = this.pitch, h = p / 2;
                const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                ln.setAttribute('x1', a[1] * p + h); ln.setAttribute('y1', a[0] * p + h);
                ln.setAttribute('x2', b[1] * p + h); ln.setAttribute('y2', b[0] * p + h);
                const len = Math.hypot(b[1] - a[1], b[0] - a[0]) * p;
                ln.style.strokeDasharray = len;
                ln.style.strokeDashoffset = len;
                this.winline.appendChild(ln);
            }
            for (const [id, el] of this.els) {
                if (!el.classList.contains('win') && !el.classList.contains('stone')) el.classList.add('dim');
            }
        }

        markTargets(state, color) {
            for (const [id, [r, c]] of this.pos) {
                const el = this.els.get(id);
                const cell = state.cells[r][c];
                const isTarget = color && cell && !cell.stone && cell.color !== color;
                el.classList.toggle('target', !!isTarget);
            }
        }

        setGhost(col, look) {
            const g = this.ghost;
            if (col == null || !look) {
                g.classList.remove('show');
                this.glow.classList.remove('show');
                return;
            }
            g.className = 'ghost show ' + (look.power ? 'power' : look.color);
            g.textContent = look.power ? E.POWERS[look.power].icon : '';
            g.style.transform = `translateX(${col * this.pitch}px)`;
            this.glow.classList.add('show');
            this.glow.classList.toggle('blocked', !!look.blocked);
            this.glow.style.transform = `translateX(${col * this.pitch}px)`;
        }

        point(r, c) {
            const rect = this.grid.getBoundingClientRect();
            return { x: rect.left + (c + 0.5) * this.pitch, y: rect.top + (r + 0.5) * this.pitch };
        }

        cellFromEvent(ev) {
            const rect = this.grid.getBoundingClientRect();
            const c = Math.floor((ev.clientX - rect.left) / this.pitch);
            const r = Math.floor((ev.clientY - rect.top) / this.pitch);
            return { c: Math.max(0, Math.min(this.cols - 1, c)), r: Math.max(0, Math.min(this.rows - 1, r)) };
        }

        jolt(kind) {
            const m = this.machine;
            m.classList.remove('shake', 'spin', 'flip');
            void m.offsetWidth;
            m.classList.add(kind);
            setTimeout(() => m.classList.remove(kind), 1000);
        }
    }

    /* ==========================================================
       Aplicación
       ========================================================== */
    class App {
        constructor() {
            this.user = api.getCurrentUser();
            if (!this.user) { location.href = 'login.html'; return; }

            window.fx = new Particles($('fx'));
            this.scene = new Scene($('scene'));
            this.view = new BoardView();
            this.settings = this.loadSettings();
            this.score = { red: 0, yellow: 0 };
            this.state = null;
            this.started = false;
            this.busy = false;
            this.armed = null;
            this.hoverCol = null;
            this.starter = 'red';
            this.mp = null;
            this.saved = false;

            this.buildStatic();
            this.bind();
            this.loadUser();
            this.social = new Social(this);

            // tablero de muestra mientras eliges
            this.state = E.createState({ rows: this.settings.rows, cols: this.settings.cols, map: 'classic', events: false });
            this.view.setup(this.state);
            this.view.enter();
            this.updateUI();
            requestAnimationFrame(() => this.openSetup());
        }

        /* ---------- ajustes ---------- */

        loadSettings() {
            const def = { mode: 'ai', level: 'normal', rows: 6, cols: 7, map: 'classic', events: true };
            try { return { ...def, ...JSON.parse(localStorage.getItem('4r-settings') || '{}') }; }
            catch (e) { return def; }
        }
        saveSettings() { localStorage.setItem('4r-settings', JSON.stringify(this.settings)); }

        buildStatic() {
            // mapas
            $('maps').innerHTML = Object.entries(E.MAPS).map(([id, m]) => `
                <label class="map-opt"><input type="radio" name="map" value="${id}"><span><b>${m.name}</b><small>${m.desc}</small></span></label>
            `).join('');
            // poderes en cada placa
            document.querySelectorAll('.plaque').forEach(pl => {
                pl.querySelector('[data-charge]').innerHTML = '<i></i>'.repeat(E.MAX_CHARGE);
                pl.querySelector('[data-powers]').innerHTML = Object.entries(E.POWERS).map(([id, p]) => `
                    <button type="button" class="power" data-power="${id}" title="${p.name}: ${p.desc} Cuesta ${p.cost} cargas.">
                        <span class="p-key">${p.key}</span>
                        <span class="p-icon" aria-hidden="true">${p.icon}</span>
                        <span class="p-name">${p.name}</span>
                        <span class="p-cost" aria-label="${p.cost} cargas">${'<i></i>'.repeat(p.cost)}</span>
                    </button>`).join('');
            });
            // estilos de tablero
            $('skin-list').innerHTML = SKINS.map(sk => `
                <button type="button" class="skin-tile" data-skin-id="${sk.id}" data-skin="${sk.id}" aria-pressed="false">
                    ${miniBoard()}
                    <span><b>${sk.name}</b><small>${sk.desc}</small></span>
                </button>`).join('');
            $('skin-current-preview').innerHTML = miniBoard();
            this.applySkin(localStorage.getItem('4r-skin') || 'clasico', false);
            $('help-powers').innerHTML = Object.values(E.POWERS).map(p => `
                <li><span class="hp-icon">${p.icon}</span><b>${p.name}, ${p.cost} cargas</b><small>${p.desc}</small></li>
            `).join('');
            $('sound-btn').setAttribute('aria-pressed', String(sound.enabled));
        }

        applySkin(id, animate) {
            const sk = SKINS.find(x => x.id === id) || SKINS[0];
            $('machine').dataset.skin = sk.id;
            $('skin-current-preview').dataset.skin = sk.id;
            $('skin-current-name').textContent = sk.name;
            document.querySelectorAll('.skin-tile').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.skinId === sk.id)));
            try { localStorage.setItem('4r-skin', sk.id); } catch (e) { /* sin almacenamiento */ }
            if (animate) {
                sound.play('select');
                $('frame').animate([{ transform: 'scale(.97)', filter: 'brightness(1.6)' }, { transform: 'none', filter: 'none' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
            }
        }

        openSkins() {
            if ($('setup').open) {
                // abre encima de "Nueva partida" y vuelve a ella al cerrar
                $('skins').addEventListener('close', () => { $('setup').open || $('setup').showModal(); }, { once: true });
            }
            $('skins').showModal();
        }

        loadUser() {
            const u = this.user;
            $('user-name').textContent = u.username;
            $('user-initial').textContent = (u.username || '?')[0].toUpperCase();
        }

        /* ---------- eventos del DOM ---------- */

        bind() {
            const grid = $('grid');
            grid.addEventListener('pointermove', ev => {
                if (ev.pointerType === 'touch') return;
                const { c } = this.view.cellFromEvent(ev);
                if (c !== this.hoverCol) { this.hoverCol = c; this.updateGhost(); }
            });
            grid.addEventListener('pointerleave', ev => {
                if (ev.pointerType === 'touch') return;
                this.hoverCol = null; this.updateGhost();
            });
            grid.addEventListener('click', ev => {
                const { c, r } = this.view.cellFromEvent(ev);
                // con teclado (detail === 0) usamos la columna del botón enfocado
                const col = ev.detail === 0 && ev.target.dataset.col ? Number(ev.target.dataset.col) : c;
                this.hoverCol = col;
                this.act(col, ev.detail === 0 ? null : r);
            });
            this.view.hits.addEventListener('focusin', ev => {
                if (ev.target.dataset.col) { this.hoverCol = Number(ev.target.dataset.col); this.updateGhost(); }
            });

            addEventListener('keydown', ev => {
                if (document.querySelector('dialog[open]')) return;
                if (ev.target.matches('input')) return;
                const k = ev.key;
                if (k === 'ArrowLeft' || k === 'ArrowRight') {
                    ev.preventDefault();
                    const d = k === 'ArrowLeft' ? -1 : 1;
                    const base = this.hoverCol ?? Math.floor(this.state.cols / 2);
                    this.hoverCol = (base + d + this.state.cols) % this.state.cols;
                    this.updateGhost();
                    sound.play('hover');
                } else if ((k === ' ' || k === 'Enter' || k === 'ArrowDown') && !ev.target.matches('button:not(.hit)')) {
                    ev.preventDefault();
                    if (this.hoverCol == null) { this.hoverCol = Math.floor(this.state.cols / 2); this.updateGhost(); return; }
                    this.act(this.hoverCol, null);
                } else if (['1', '2', '3', '4'].includes(k)) {
                    const id = Object.keys(E.POWERS).find(p => E.POWERS[p].key === k);
                    this.arm(id, this.humanColor());
                } else if (k === 'Escape' && this.armed) {
                    this.armed = null; this.updateUI();
                }
            });

            document.querySelectorAll('.plaque').forEach(pl => {
                pl.querySelector('[data-powers]').addEventListener('click', ev => {
                    const b = ev.target.closest('.power');
                    if (b) this.arm(b.dataset.power, pl.dataset.color);
                });
                pl.querySelector('[data-powers]').addEventListener('pointerover', ev => {
                    const b = ev.target.closest('.power');
                    this.previewCost(pl.dataset.color, b && !b.disabled ? E.POWERS[b.dataset.power].cost : 0);
                });
                pl.querySelector('[data-powers]').addEventListener('pointerleave', () => this.previewCost(pl.dataset.color, 0));
            });

            let rt;
            addEventListener('resize', () => {
                clearTimeout(rt);
                rt = setTimeout(() => { this.view.layout(); if (this.state.over) this.view.markWin(this.state.winLine); this.updateGhost(); }, 120);
            });

            // botones
            $('settings-btn').onclick = () => this.openSetup();
            $('skin-btn').onclick = () => this.openSkins();
            $('skin-open').onclick = () => this.openSkins();
            $('skin-list').addEventListener('click', ev => {
                const t = ev.target.closest('.skin-tile');
                if (t) this.applySkin(t.dataset.skinId, true);
            });
            $('settings-btn-2').onclick = () => this.openSetup();
            $('rematch-btn').onclick = () => this.rematch();
            $('help-btn').onclick = () => $('help').showModal();
            $('sound-btn').onclick = () => $('sound-btn').setAttribute('aria-pressed', String(sound.toggle()));
            $('profile-btn').onclick = () => this.openProfile();
            $('ranking-btn').onclick = () => this.openRanking();
            $('online-btn').onclick = () => this.openOnline();
            $('logout-btn').onclick = async () => { this.leaveRoom(true); await api.logout(); location.href = 'login.html'; };
            $('save-email-btn').onclick = () => this.saveEmail();
            $('create-room-btn').onclick = () => this.createRoom();
            $('join-room-btn').onclick = () => this.joinRoom();
            $('join-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.joinRoom(); } });
            $('copy-code-btn').onclick = () => this.copyCode();
            $('leave-btn').onclick = () => this.leaveRoom();

            // hoja de ajustes
            const form = $('setup-form');
            form.addEventListener('change', () => this.syncSetupForm());
            $('setup-cancel').onclick = () => $('setup').close('cancel');
            form.addEventListener('submit', ev => {
                ev.preventDefault();
                const fd = new FormData(form);
                const [cols, rows] = fd.get('size').split('x').map(Number);
                this.settings = {
                    mode: fd.get('mode'), level: fd.get('level'),
                    rows, cols, map: fd.get('map'), events: fd.get('events') === 'on',
                };
                this.saveSettings();
                $('setup').close('start');
                if (this.mp) this.leaveRoom(true);
                this.score = { red: 0, yellow: 0 };
                this.starter = 'red';
                this.newGame();
            });
            document.addEventListener('pointerdown', () => sound.ensure(), { once: true });
        }

        sfx(name) { sound.play(name); }

        /* ---------- ayudas de turno ---------- */

        isHuman(color) {
            if (this.mp) return color === this.mp.myColor;
            if (this.settings.mode === 'ai') return color === 'red';
            return true;
        }
        humanColor() {
            if (!this.state) return null;
            if (this.mp) return this.mp.myColor;
            if (this.settings.mode === 'ai') return 'red';
            return this.state.turn;
        }
        canAct() {
            return this.started && !this.busy && !this.state.over && this.isHuman(this.state.turn);
        }
        nameOf(color) {
            if (this.mp) return this.mp.names[color] || E.NAMES[color];
            if (this.settings.mode === 'ai') return color === 'red' ? this.user.username : 'La IA';
            return E.NAMES[color];
        }

        /* ---------- partida ---------- */

        async newGame(fromState = null) {
            const next = fromState || E.createState({ ...this.settings, starter: this.starter });
            $('result').classList.add('hidden');
            const sameSize = this.state && next.rows === this.state.rows && next.cols === this.state.cols;
            if (this.started && this.view.els.size && !reduced) {
                this.busy = true;
                this.view.setGhost(null);
                sound.play('drain');
                await this.view.drain();
            }
            this.state = next;
            this.started = true;
            this.busy = false;
            this.armed = null;
            this.saved = false;
            this.view.setup(this.state);
            if (!sameSize) this.view.enter();
            this.social && this.social.setPlaying(!!this.mp);
            this.updateUI();
            sound.play('select');
            if (this.state.map !== this.settings.map && this.settings.map === 'random' && !this.mp) {
                this.toast(`Mapa sorteado: ${E.MAPS[this.state.map].name}`);
            }
            this.maybeAI();
        }

        rematch() {
            if (this.mp) {
                if (!this.mp.isHost) { this.toast('El anfitrión empieza la revancha'); return; }
                this.starter = E.other(this.starter);
                const s = E.createState({ ...this.mp.settings, starter: this.starter });
                s.seq = this.state.seq + 1;
                this.newGame(s);
                api.resetGame(this.mp.gameId, s).catch(() => this.toast('No se pudo empezar la revancha', true));
                return;
            }
            this.starter = E.other(this.starter);
            this.newGame();
        }

        act(col, row) {
            if (!this.started) { this.openSetup(); return; }
            if (!this.canAct()) {
                if (!this.state.over && !this.busy && this.mp) this.toast('Espera a que juegue tu rival');
                return;
            }
            if (this.armed) this.usePower(this.armed, col, row);
            else this.drop(col);
        }

        async drop(col) {
            const s = this.state;
            if (s.frozen[col] > 0) { this.deny('Esa columna está congelada'); return; }
            if (E.dropRow(s, col) === null) { this.deny('Esa columna está llena'); return; }
            this.busy = true;
            this.view.setGhost(null);
            this.updateUI();
            await this.dropSequence(col);
            this.busy = false;
            this.updateUI();
            this.maybeAI();
        }

        async dropSequence(col) {
            const s = this.state;
            const color = s.turn;
            E.place(s, col, color);
            await this.view.render(s);

            if (s.doubleArmed[color]) {
                s.doubleArmed[color] = false;
                if (E.dropRow(s, col) !== null) {
                    await wait(60);
                    E.place(s, col, color);
                    await this.view.render(s);
                }
            }
            s.moves++;
            if (E.resolve(s)) return this.finish();

            if (E.eventDue(s)) {
                await this.runEvent(s.nextEvent);
                E.scheduleEvent(s);
                if (E.resolve(s)) return this.finish();
            }

            this.nextTurn();
            s.seq++;
            this.push();
        }

        nextTurn() {
            const s = this.state;
            E.endTurn(s);
            let guard = 0;
            while (!E.legalCols(s).length && guard++ < 6) {
                this.toast(`${this.nameOf(s.turn)} no tiene dónde tirar y pasa turno`);
                E.endTurn(s);
            }
            this.view.renderIce(s.frozen, true);
            sound.play('charge');
            const st = $('status');
            st.classList.remove('pulse'); void st.offsetWidth; st.classList.add('pulse');
        }

        async runEvent(id) {
            const ev = E.EVENTS[id];
            await this.showHazard(ev);
            const before = new Set();
            this.state.cells.forEach(row => row.forEach(c => c && before.add(c.id)));
            const info = E.applyEvent(this.state, id);
            await this.playEventEffects(id, info);
        }

        async playEventEffects(id, info) {
            const v = this.view;
            this.scene.storm(id);
            if (id === 'whirlwind') { sound.play('whoosh'); v.jolt('spin'); }
            if (id === 'quake') { sound.play('rumble'); v.jolt('shake'); navigator.vibrate?.([80, 40, 80, 40, 120]); }
            if (id === 'flipAll') { sound.play('whoosh'); v.jolt('flip'); }
            if (id === 'swap') { sound.play('whoosh'); }
            if (id === 'blizzard') { sound.play('freeze'); }
            if (id === 'gift') { sound.play('charge'); }
            if (id === 'meteor') { sound.play('bomb'); v.jolt('shake'); navigator.vibrate?.([120, 40, 60]); }
            const explode = new Set((info.removed || []).map(p => p.id));
            if (id === 'meteor' && info.center) {
                const pt = v.point(info.center[0], info.center[1]);
                window.fx.burst(pt.x, pt.y, ['#ff9d2e', '#ffd166', '#ff4d2e', '#fff'], 50, 1.6);
            }
            await wait(id === 'flipAll' ? 380 : 120);
            await v.render(this.state, { explode });
            await wait(200);
        }

        showHazard(ev) {
            const hz = $('hazard');
            $('hazard-icon').textContent = ev.icon;
            $('hazard-name').textContent = ev.name;
            $('hazard-desc').textContent = ev.desc;
            hz.classList.remove('hidden', 'in');
            void hz.offsetWidth;
            hz.classList.add('in');
            sound.play('alarm');
            setTimeout(() => hz.classList.add('hidden'), reduced ? 900 : 1900);
            return wait(reduced ? 500 : 1150);
        }

        /* ---------- poderes ---------- */

        arm(power, color) {
            if (!power || !this.canAct()) return;
            const s = this.state;
            if (color !== s.turn) { this.deny('No es tu turno'); return; }
            if (this.armed === power) { this.armed = null; this.updateUI(); return; }
            if (s.powerUsedThisTurn) { this.deny('Ya usaste un poder este turno'); return; }
            const p = E.POWERS[power];
            if (s.charges[s.turn] < p.cost) { this.deny(`${p.name} necesita ${p.cost} cargas`); return; }
            if (power === 'double') {
                if (s.doubleArmed[s.turn]) { this.deny('Ya tienes la doble ficha preparada'); return; }
                E.applyPower(s, 'double');
                sound.play('charge');
                this.toast('Doble ficha lista: tu próxima tirada suelta dos');
                this.state.seq++; this.push();
                this.updateUI();
                return;
            }
            this.armed = power;
            sound.play('select');
            this.updateUI();
        }

        async usePower(power, col, row) {
            const s = this.state;
            if (power === 'bomb' && row == null) {
                // con teclado: la ficha rival más alta de la columna
                row = s.cells.findIndex(r => r[col] && !r[col].stone && r[col].color !== s.turn);
                if (row < 0) row = 0;
            }
            const err = E.powerTargetError(s, power, row, col);
            if (err) { this.deny(err); return; }
            this.busy = true;
            this.armed = null;
            this.updateUI();
            await this.applyPowerFx(power, row, col);
            this.busy = false;
            if (E.resolve(s)) { this.finish(); return; }
            s.seq++; this.push();
            this.updateUI();
        }

        async applyPowerFx(power, row, col) {
            const s = this.state;
            const res = E.applyPower(s, power, row, col);
            const v = this.view;
            if (power === 'bomb') {
                sound.play('bomb');
                navigator.vibrate?.([100, 30, 100]);
                v.jolt('shake');
                await v.render(s, { explode: new Set(res.removed.map(p => p.id)) });
            } else if (power === 'flip') {
                sound.play('whoosh');
                await v.render(s);
            } else if (power === 'freeze') {
                sound.play('freeze');
                v.renderIce(s.frozen, true);
                await wait(300);
            }
        }

        /* ---------- IA ---------- */

        async maybeAI() {
            const s = this.state;
            if (this.mp || this.settings.mode !== 'ai' || s.over || this.busy || s.turn !== 'yellow') return;
            this.busy = true;
            this.updateUI();
            await wait(450 + Math.random() * 350);
            let d = E.aiDecide(s, this.settings.level);
            if (d && d.power) {
                this.armed = d.power;
                this.updateUI();
                await this.walkGhost(d.target[1], { power: d.power });
                await wait(350);
                if (d.power === 'double') {
                    E.applyPower(s, 'double');
                    sound.play('charge');
                } else {
                    await this.applyPowerFx(d.power, d.target[0], d.target[1]);
                }
                this.armed = null;
                if (E.resolve(s)) { this.busy = false; this.finish(); return; }
                this.updateUI();
                await wait(350);
                d = d.then != null ? { col: d.then } : E.aiDecide(s, this.settings.level);
            }
            if (!d) { this.busy = false; return; }
            await this.walkGhost(d.col, { color: 'yellow' });
            await wait(120);
            this.view.setGhost(null);
            await this.dropSequence(d.col);
            this.busy = false;
            this.updateUI();
        }

        async walkGhost(target, look) {
            const from = this.hoverCol ?? Math.floor(this.state.cols / 2);
            const step = target > from ? 1 : -1;
            this.view.setGhost(from, look);
            for (let c = from; c !== target; c += step) {
                await wait(reduced ? 20 : 90);
                this.view.setGhost(c + step, look);
            }
            this.hoverCol = target;
            await wait(150);
        }

        /* ---------- fin de partida ---------- */

        finish() {
            const s = this.state;
            s.over = true;
            this.busy = false;
            this.armed = null;
            s.seq++;
            this.push();
            const w = s.winner;
            if (s.result === 'win') this.score[w]++;
            this.view.setGhost(null);
            this.view.markWin(s.winLine);
            this.updateUI();

            let title, sub, discClass;
            if (s.result === 'win') {
                const el = document.querySelector(`#plaque-${w} [data-score]`);
                el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
                const human = this.isHuman(w);
                const twoLocal = !this.mp && this.settings.mode === 'pvp';
                title = this.resultTitle();
                sub = `Cuatro en raya en ${s.moves} tiradas.`;
                discClass = w;
                sound.play(twoLocal || human ? 'win' : 'lose');
                if (twoLocal || human) setTimeout(() => { window.fx.confetti(PALETTE[w].concat(['#f1ebdd'])); this.scene.celebrate(); }, 300);
                navigator.vibrate?.([100, 50, 100, 50, 160]);
            } else if (s.result === 'double') {
                title = 'Empate doble';
                sub = 'El caos dejó cuatro en raya a los dos a la vez.';
                discClass = 'both';
                sound.play('draw');
            } else {
                title = 'Empate';
                sub = 'No queda sitio en el tablero.';
                discClass = 'none';
                sound.play('draw');
            }
            $('result-title').textContent = title;
            $('result-sub').textContent = sub;
            $('result-disc').className = 'result-disc ' + (discClass === 'red' || discClass === 'yellow' ? 'disc ' + discClass : discClass);
            $('rematch-btn').textContent = this.mp && !this.mp.isHost ? 'Esperando revancha' : 'Revancha';
            $('rematch-btn').disabled = !!(this.mp && !this.mp.isHost);
            setTimeout(() => {
                $('result').classList.remove('hidden');
                $('rematch-btn').focus({ preventScroll: true });
            }, 1100);
            this.record();
        }

        resultTitle() {
            const s = this.state;
            if (s.result === 'double') return 'Empate doble';
            if (s.result !== 'win') return 'Empate';
            if (!this.mp && this.settings.mode === 'pvp') return `Gana ${E.NAMES[s.winner]}`;
            if (this.isHuman(s.winner)) return 'Has ganado';
            return this.mp ? `Gana ${this.nameOf(s.winner)}` : 'Gana la IA';
        }

        record() {
            const s = this.state;
            if (this.saved || this.user.guest || !api.online) return;
            const vsAI = !this.mp && this.settings.mode === 'ai';
            if (!vsAI && !this.mp) return; // partidas locales a dos no cuentan para el ranking
            const me = this.mp ? this.mp.myColor : 'red';
            const won = s.result === 'win' && s.winner === me;
            const opponent = this.mp ? this.mp.names[E.other(me)] : `IA ${this.settings.level}`;
            this.saved = true;
            if (won) {
                this.user.total_wins = (this.user.total_wins || 0) + 1;
                this.user.total_points = (this.user.total_points || 0) + 10; // igual que increment_points en la base de datos
                localStorage.setItem('user', JSON.stringify(this.user));
            }
            api.saveGame(this.user.username, s.map, won, opponent).catch(() => {});
        }

        /* ---------- interfaz ---------- */

        deny(msg) {
            sound.play('error');
            this.toast(msg, true);
            const g = this.view.ghost;
            g.animate([{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 220 });
        }

        toast(msg, error = false) {
            const t = $('toast');
            t.textContent = msg;
            t.classList.toggle('error', error);
            t.classList.add('show');
            clearTimeout(this._tt);
            this._tt = setTimeout(() => t.classList.remove('show'), 2200);
        }

        previewCost(color, cost) {
            const s = this.state;
            const bars = document.querySelectorAll(`#plaque-${color} [data-charge] i`);
            const have = s.charges[color];
            bars.forEach((b, i) => b.classList.toggle('cost', cost > 0 && i < have && i >= have - cost));
        }

        updateGhost() {
            const s = this.state;
            if (!this.canAct() || this.hoverCol == null) { if (!this.busy) this.view.setGhost(null); return; }
            const col = this.hoverCol;
            if (this.armed) {
                this.view.setGhost(col, { power: this.armed });
            } else {
                this.view.setGhost(col, { color: s.turn, blocked: !E.canDrop(s, col) });
            }
        }

        updateUI() {
            const s = this.state;
            const m = $('machine');
            m.classList.toggle('locked', !this.canAct());
            m.classList.toggle('targeting', !!this.armed);

            // placas
            for (const color of E.COLORS) {
                const pl = $('plaque-' + color);
                const active = this.started && !s.over && s.turn === color;
                pl.classList.toggle('active', active);
                pl.classList.toggle('is-ai', !this.isHuman(color) || (this.mp && color !== this.mp.myColor));
                pl.querySelector('[data-name]').textContent = this.nameOf(color);
                let role;
                if (this.mp) role = color === this.mp.myColor ? 'Tú' : 'Rival online';
                else if (this.settings.mode === 'ai') role = color === 'red' ? 'Tú' : `Nivel ${({ easy: 'fácil', normal: 'normal', hard: 'difícil' })[this.settings.level]}`;
                else role = color === 'red' ? 'Jugador 1' : 'Jugador 2';
                if (active) role = this.isHuman(color) ? (this.armed ? 'Elige objetivo' : 'Le toca') : 'Pensando…';
                if (active && s.doubleArmed[color]) role = 'Doble ficha lista';
                pl.querySelector('[data-role]').textContent = role;
                pl.querySelector('[data-score]').textContent = this.score[color];

                const bars = pl.querySelectorAll('[data-charge] i');
                bars.forEach((b, i) => {
                    const on = this.started && i < s.charges[color];
                    if (on && !b.classList.contains('on')) { b.classList.add('fresh'); setTimeout(() => b.classList.remove('fresh'), 500); }
                    b.classList.toggle('on', on);
                    b.classList.remove('cost');
                });
                pl.querySelector('[data-charge]').setAttribute('aria-label', `${s.charges[color]} de ${E.MAX_CHARGE} cargas`);

                pl.querySelectorAll('.power').forEach(b => {
                    const id = b.dataset.power;
                    const p = E.POWERS[id];
                    const usable = active && this.isHuman(color) && !this.busy && !s.powerUsedThisTurn && s.charges[color] >= p.cost
                        && !(id === 'double' && s.doubleArmed[color]);
                    b.disabled = !usable && this.armed !== id;
                    b.classList.toggle('armed', active && (this.armed === id || (id === 'double' && s.doubleArmed[color])));
                });
            }

            // estado
            const disc = $('status-disc');
            let text;
            disc.className = 'status-disc';
            if (!this.started) text = 'Elige cómo quieres jugar';
            else if (s.over) text = this.resultTitle();
            else {
                disc.classList.add(s.turn);
                const me = this.isHuman(s.turn);
                if (this.armed === 'bomb') text = 'Toca una ficha rival';
                else if (this.armed === 'flip') text = 'Elige la columna a voltear';
                else if (this.armed === 'freeze') text = 'Elige la columna a congelar';
                else if (this.mp) text = me ? 'Tu turno' : `Turno de ${this.nameOf(s.turn)}`;
                else if (this.settings.mode === 'ai') text = me ? 'Tu turno' : 'La IA está pensando';
                else text = `Turno de ${E.NAMES[s.turn]}`;
            }
            $('status-text').textContent = text;

            // aviso de evento
            const tk = $('ticker');
            const pips = $('ticker-pips');
            if (!this.started || !s.events || !s.nextEvent) {
                tk.classList.add('off'); tk.classList.remove('imminent');
                $('ticker-icon').textContent = '🌙';
                $('ticker-text').textContent = this.started ? 'Eventos de caos desactivados' : 'Cada pocas tiradas ocurre un evento de caos';
                pips.innerHTML = '';
            } else {
                const ev = E.EVENTS[s.nextEvent];
                const left = Math.max(1, s.nextEventAt - s.moves);
                tk.classList.remove('off');
                tk.classList.toggle('imminent', left === 1 && !s.over);
                $('ticker-icon').textContent = ev.icon;
                $('ticker-text').textContent = left === 1 ? `${ev.name} tras la próxima tirada` : `${ev.name} dentro de ${left} tiradas`;
                pips.innerHTML = '<i class="on"></i>'.repeat(Math.min(left, 8)) ;
                tk.title = ev.desc;
            }

            this.scene.mood(!this.started ? null : s.over ? s.winner : s.turn);
            this.view.markTargets(s, this.armed === 'bomb' ? s.turn : null);
            this.updateGhost();
        }

        /* ---------- hojas ---------- */

        openSetup() {
            if (this.mp && !this.mp.isHost) { this.toast('En una sala online, los ajustes los elige el anfitrión'); return; }
            const f = $('setup-form');
            const st = this.settings;
            f.mode.value = st.mode; f.level.value = st.level;
            f.size.value = `${st.cols}x${st.rows}`;
            f.map.value = st.map; f.events.checked = st.events;
            this.syncSetupForm();
            $('setup-cancel').hidden = !this.started;
            $('setup').showModal();
        }

        syncSetupForm() {
            const f = $('setup-form');
            $('level-row').classList.toggle('off', f.mode.value !== 'ai');
        }

        openProfile() {
            const u = this.user;
            $('profile-name').textContent = u.username;
            $('profile-initial').textContent = (u.username || '?')[0].toUpperCase();
            $('profile-email').textContent = u.email || 'Sin email';
            $('profile-wins').textContent = u.total_wins || 0;
            $('profile-points').textContent = u.total_points || 0;
            $('profile-email-input').value = u.email || '';
            $('email-row').hidden = !!u.guest || !!u.google;
            $('guest-note').hidden = !u.guest;
            $('logout-btn').textContent = u.guest ? 'Salir y crear cuenta' : 'Cerrar sesión';
            $('profile').showModal();
        }

        async saveEmail() {
            const email = $('profile-email-input').value.trim();
            if (!email) return;
            try {
                await api.updateEmail(this.user.id, email);
                this.user.email = email;
                $('profile-email').textContent = email;
                this.toast('Email guardado');
            } catch (e) {
                this.toast('No se pudo guardar el email', true);
            }
        }

        async openRanking() {
            const list = $('ranking-list');
            list.innerHTML = '<li class="msg">Cargando ranking…</li>';
            $('ranking').showModal();
            try {
                const rows = await api.getRanking(20);
                list.innerHTML = '';
                if (!rows.length) { list.innerHTML = '<li class="msg">Aún no hay nadie en el ranking. Gana una partida contra la IA para entrar.</li>'; return; }
                rows.forEach(p => {
                    const li = document.createElement('li');
                    if (p.username === this.user.username) li.classList.add('me');
                    const n = document.createElement('span'); n.className = 'rk-name'; n.textContent = p.username;
                    const pts = document.createElement('span'); pts.className = 'rk-pts'; pts.textContent = `${p.total_points} pts`;
                    li.append(n, pts);
                    list.appendChild(li);
                });
            } catch (e) {
                list.innerHTML = '';
                const li = document.createElement('li'); li.className = 'msg';
                li.textContent = 'No se pudo cargar el ranking. Comprueba tu conexión.';
                list.appendChild(li);
            }
        }

        /* ==========================================================
           Online (Supabase)
           ========================================================== */

        openOnline() {
            $('mp-error').textContent = '';
            const inRoom = !!this.mp;
            $('mp-home').hidden = inRoom;
            $('mp-room').hidden = !inRoom;
            if (this.user.guest) {
                $('mp-error').textContent = 'Necesitas una cuenta para jugar online. Sal desde tu perfil y crea una.';
            } else if (!api.online) {
                $('mp-error').textContent = 'No hay conexión con el servidor de partidas.';
            }
            $('online').showModal();
        }

        mpGuard() {
            if (this.user.guest) { $('mp-error').textContent = 'Necesitas una cuenta para jugar online.'; return false; }
            if (!api.online) { $('mp-error').textContent = 'No hay conexión con el servidor de partidas.'; return false; }
            return true;
        }

        setMpStatus(html, ok = false) {
            const el = $('mp-status');
            el.innerHTML = html;
            el.classList.toggle('ok', ok);
        }

        async createRoom() {
            if (!this.mpGuard()) return;
            $('mp-error').textContent = '';
            try {
                const room = await api.createRoom(this.user.id, this.user.username);
                this.mp = {
                    room, isHost: true, myColor: 'red', gameId: null, channels: [],
                    names: { red: this.user.username, yellow: null },
                    settings: { ...this.settings, mode: 'pvp' },
                };
                $('room-code').textContent = room.room_code;
                $('mp-home').hidden = true; $('mp-room').hidden = false;
                this.setMpStatus('Esperando a tu rival<span class="dots"></span>');
                this.mp.channels.push(api.subscribeToRoom(room.room_code, p => this.onRoomUpdate(p.new)));
                $('online-btn').classList.add('live');
                $('online-btn').textContent = 'Sala ' + room.room_code;
            } catch (e) {
                $('mp-error').textContent = e.message || 'No se pudo crear la sala';
            }
        }

        async joinRoom() {
            if (!this.mpGuard()) return;
            const code = $('join-code-input').value.trim().toUpperCase();
            if (code.length !== 6) { $('mp-error').textContent = 'El código tiene 6 caracteres'; return; }
            $('mp-error').textContent = '';
            try {
                const room = await api.joinRoom(code, this.user.id, this.user.username);
                this.mp = {
                    room, isHost: false, myColor: 'yellow', gameId: null, channels: [],
                    names: { red: room.host_name || 'Rojo', yellow: this.user.username },
                };
                $('room-code').textContent = code;
                $('mp-home').hidden = true; $('mp-room').hidden = false;
                this.setMpStatus(`Conectado con ${room.host_name}. Preparando partida<span class="dots"></span>`, true);
                this.mp.channels.push(api.subscribeToRoom(code, p => this.onRoomUpdate(p.new)));
                $('online-btn').classList.add('live');
                $('online-btn').textContent = 'Sala ' + code;

                // espera a que el anfitrión cree la partida
                let game = null;
                for (let i = 0; i < 40 && !game && this.mp; i++) {
                    game = await api.getGame(room.id).catch(() => null);
                    if (!game) await wait(500);
                }
                if (!this.mp) return;
                if (!game) throw new Error('El anfitrión no ha empezado la partida');
                this.mp.gameId = game.id;
                this.mp.channels.push(api.subscribeToGame(game.id, p => this.onGameUpdate(p.new)));
                const st = this.parseState(game.board_state);
                if (!st) throw new Error('La partida del anfitrión usa una versión antigua del juego');
                this.score = { red: 0, yellow: 0 };
                this.newGame(st);
                $('online').close();
                this.toast(`Juegas con amarillas contra ${room.host_name}`);
            } catch (e) {
                $('mp-error').textContent = e.message || 'No se pudo entrar en la sala';
                if (this.mp && !this.mp.gameId) this.leaveRoom(true);
            }
        }

        async onRoomUpdate(room) {
            if (!room || !this.mp) return;
            if (room.status === 'cancelled') {
                this.toast('Tu rival ha salido de la sala', true);
                this.leaveRoom(true, false);
                return;
            }
            if (this.mp.isHost && room.status === 'playing' && room.guest_name && !this.mp.gameId) {
                this.mp.room = room;
                this.mp.names.yellow = room.guest_name;
                this.setMpStatus(`${room.guest_name} ha entrado. ¡A jugar!`, true);
                const s = E.createState({ ...this.mp.settings, starter: 'red' });
                try {
                    const game = await api.createGame(room.id, s);
                    this.mp.gameId = game.id;
                    this.mp.channels.push(api.subscribeToGame(game.id, p => this.onGameUpdate(p.new)));
                    this.score = { red: 0, yellow: 0 };
                    this.starter = 'red';
                    await wait(600);
                    $('online').open && $('online').close();
                    this.newGame(s);
                    this.toast(`Juegas con rojas contra ${room.guest_name}`);
                } catch (e) {
                    $('mp-error').textContent = 'No se pudo crear la partida';
                }
            }
        }

        parseState(raw) {
            try {
                const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (!obj || obj.v !== 2) return null;
                if (obj.nextEventAt == null) obj.nextEventAt = Infinity;
                return obj;
            } catch (e) { return null; }
        }

        async onGameUpdate(game) {
            if (!game || !this.mp) return;
            const st = this.parseState(game.board_state);
            if (!st || st.seq <= this.state.seq) return;
            // cola para no pisar animaciones
            this._remote = (this._remote || Promise.resolve()).then(() => this.applyRemote(st));
        }

        async applyRemote(st) {
            if (st.seq <= this.state.seq) return;
            const prev = this.state;
            const fresh = st.moves === 0 && (prev.over || st.rows !== prev.rows || st.cols !== prev.cols);
            if (fresh) { this.newGame(st); return; }

            this.busy = true;
            const evNew = st.lastEvent && (!prev.lastEvent || st.lastEvent.at > prev.lastEvent.at);
            if (evNew) {
                // primero mostramos la tirada del rival, luego el evento
                const ev = E.EVENTS[st.lastEvent.id];
                if (st.lastMove && (!prev.lastMove || st.moves !== prev.moves)) {
                    const mid = E.clone(prev);
                    const r = E.dropRow(mid, st.lastMove.c);
                    if (r !== null) {
                        mid.cells[r][st.lastMove.c] = { id: st.lastMove.id, color: st.lastMove.color };
                        await this.view.render(mid);
                    }
                }
                await this.showHazard(ev);
                this.state = st;
                await this.playEventEffects(st.lastEvent.id, st.lastEvent.info || {});
            } else {
                const removed = new Set();
                const ids = new Set();
                st.cells.forEach(row => row.forEach(c => c && ids.add(c.id)));
                prev.cells.forEach(row => row.forEach(c => c && !ids.has(c.id) && removed.add(c.id)));
                if (removed.size) { sound.play('bomb'); this.view.jolt('shake'); }
                this.state = st;
                await this.view.render(st, { explode: removed });
            }
            this.busy = false;
            if (st.over) {
                this.state.seq = st.seq - 1; // finish() vuelve a sumar
                this.finish();
                return;
            }
            this.updateUI();
        }

        push() {
            if (!this.mp || !this.mp.gameId) return;
            const s = this.state;
            const p = s.over
                ? api.finishGame(this.mp.gameId, s.winner, s)
                : api.updateGame(this.mp.gameId, s);
            Promise.resolve(p).catch(() => this.toast('Se perdió la conexión con la partida', true));
        }

        copyCode() {
            const code = $('room-code').textContent;
            navigator.clipboard?.writeText(code).then(() => this.toast('Código copiado'), () => this.toast(code));
        }

        async leaveRoom(silent = false, notify = true) {
            if (!this.mp) return;
            if (!silent && this.started && !this.state.over && !confirm('¿Salir de la sala? La partida en curso se cancelará.')) return;
            const mp = this.mp;
            this.mp = null;
            this.social && this.social.setPlaying(false);
            mp.channels.forEach(ch => api.unsubscribe(ch));
            if (notify) api.leaveRoom(mp.room.room_code).catch(() => {});
            $('online-btn').classList.remove('live');
            $('online-btn').textContent = 'Jugar online';
            $('mp-home').hidden = false; $('mp-room').hidden = true;
            $('join-code-input').value = '';
            if ($('online').open) $('online').close();
            if (this.started) { this.score = { red: 0, yellow: 0 }; this.newGame(); }
        }
    }

    const start = () => { window.app = new App(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
