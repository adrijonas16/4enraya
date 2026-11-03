/* ==========================================================
   Sonido sintetizado (WebAudio) y partículas (canvas)
   ========================================================== */
(function (global) {
    'use strict';

    class Sound {
        constructor() {
            this.ctx = null;
            this.enabled = localStorage.getItem('4r-sound') !== 'off';
        }
        ensure() {
            if (!this.ctx) {
                try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
                catch (e) { this.enabled = false; }
            }
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
            return this.ctx;
        }
        toggle() {
            this.enabled = !this.enabled;
            localStorage.setItem('4r-sound', this.enabled ? 'on' : 'off');
            return this.enabled;
        }
        tone(freq, dur, { type = 'sine', vol = 0.12, slide = null, delay = 0 } = {}) {
            const ctx = this.ensure(); if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g).connect(ctx.destination);
            o.start(t); o.stop(t + dur + 0.02);
        }
        noise(dur, { vol = 0.2, freq = 1200, q = 0.8, delay = 0, type = 'bandpass', sweep = null } = {}) {
            const ctx = this.ensure(); if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const len = Math.floor(ctx.sampleRate * dur);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
            const src = ctx.createBufferSource(); src.buffer = buf;
            const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
            if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
            const g = ctx.createGain(); g.gain.value = vol;
            src.connect(f).connect(g).connect(ctx.destination);
            src.start(t);
        }
        play(name, opt = {}) {
            if (!this.enabled) return;
            switch (name) {
                case 'clack': { // ficha que golpea el fondo
                    const depth = opt.depth || 0.5;
                    this.noise(0.07, { vol: 0.35, freq: 1800 - depth * 900, q: 3 });
                    this.tone(220 - depth * 60, 0.09, { type: 'triangle', vol: 0.12, slide: 120 });
                    this.noise(0.04, { vol: 0.12, freq: 2600, q: 4, delay: 0.07 });
                    break;
                }
                case 'hover': this.tone(880, 0.03, { type: 'triangle', vol: 0.025 }); break;
                case 'select': this.tone(520, 0.06, { type: 'square', vol: 0.04 }); this.tone(780, 0.08, { type: 'square', vol: 0.04, delay: 0.05 }); break;
                case 'error': this.tone(180, 0.15, { type: 'square', vol: 0.05, slide: 120 }); break;
                case 'bomb':
                    this.noise(0.6, { vol: 0.6, freq: 900, q: 0.6, type: 'lowpass', sweep: 80 });
                    this.tone(110, 0.5, { type: 'sawtooth', vol: 0.15, slide: 35 });
                    break;
                case 'freeze':
                    [1760, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.25, { vol: 0.04, delay: i * 0.05 }));
                    this.noise(0.4, { vol: 0.08, freq: 6000, q: 1, type: 'highpass' });
                    break;
                case 'whoosh': this.noise(0.9, { vol: 0.25, freq: 300, q: 1.2, sweep: 3000 }); break;
                case 'rumble':
                    this.noise(1.0, { vol: 0.5, freq: 160, q: 0.7, type: 'lowpass' });
                    this.tone(55, 0.9, { type: 'sawtooth', vol: 0.1, slide: 40 });
                    break;
                case 'alarm':
                    [0, 0.22].forEach(d => { this.tone(660, 0.16, { type: 'square', vol: 0.05, delay: d }); this.tone(495, 0.16, { type: 'square', vol: 0.05, delay: d + 0.11 }); });
                    break;
                case 'charge': this.tone(660, 0.12, { type: 'triangle', vol: 0.06, slide: 1320 }); break;
                case 'win':
                    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.1, delay: i * 0.11 }));
                    this.tone(1568, 0.6, { vol: 0.05, delay: 0.45 });
                    break;
                case 'lose':
                    [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.08, delay: i * 0.16 }));
                    break;
                case 'drain':
                    for (let i = 0; i < 14; i++) this.noise(0.05, { vol: 0.18, freq: 1400 + Math.random() * 1400, q: 4, delay: i * 0.045 + Math.random() * 0.02 });
                    this.tone(140, 0.25, { type: 'triangle', vol: 0.1, slide: 70 });
                    break;
                case 'draw': this.tone(440, 0.25, { type: 'triangle', vol: 0.08 }); this.tone(440, 0.3, { type: 'triangle', vol: 0.08, delay: 0.2 }); break;
            }
        }
    }

    class Particles {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.items = [];
            this.running = false;
            this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.resize();
            addEventListener('resize', () => this.resize());
        }
        resize() {
            const dpr = Math.min(2, devicePixelRatio || 1);
            this.canvas.width = innerWidth * dpr;
            this.canvas.height = innerHeight * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        burst(x, y, palette, n = 26, power = 1) {
            if (this.reduced) n = Math.ceil(n / 4);
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = (2 + Math.random() * 6) * power;
                this.items.push({
                    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
                    r: 2 + Math.random() * 5, life: 1, decay: 0.015 + Math.random() * 0.02,
                    color: palette[i % palette.length], g: 0.25, shape: 'circle',
                });
            }
            this.start();
        }
        shards(x, y, n = 18) {
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
                this.items.push({
                    x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    r: 2 + Math.random() * 4, life: 1, decay: 0.02, color: i % 2 ? '#dff4ff' : '#9fd8ff',
                    g: 0.05, shape: 'shard', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
                });
            }
            this.start();
        }
        ring(x, y, color, size = 40) {
            this.items.push({ x, y, vx: 0, vy: 0, r: size * .36, grow: size * .025, life: 1, decay: .07, color, g: 0, shape: 'ring' });
            for (let i = 0; i < 8; i++) {
                const a = Math.PI + (i / 7) * Math.PI;
                this.items.push({
                    x: x + Math.cos(a) * size * .4, y: y + size * .35, vx: Math.cos(a) * 1.6, vy: -Math.random() * 1.6,
                    r: 1.5 + Math.random() * 1.5, life: 1, decay: .05, color: 'rgba(255,255,255,.8)', g: .08, shape: 'circle',
                });
            }
            this.start();
        }
        confetti(palette) {
            const n = this.reduced ? 40 : 160;
            for (let i = 0; i < n; i++) {
                this.items.push({
                    x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5,
                    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3,
                    r: 4 + Math.random() * 5, life: 1, decay: 0.004 + Math.random() * 0.004,
                    color: palette[i % palette.length], g: 0.04, shape: 'rect',
                    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25, drag: 0.99,
                });
            }
            this.start();
        }
        start() {
            if (this.running) return;
            this.running = true;
            const tick = () => {
                const ctx = this.ctx;
                ctx.clearRect(0, 0, innerWidth, innerHeight);
                this.items = this.items.filter(p => p.life > 0 && p.y < innerHeight + 40);
                for (const p of this.items) {
                    p.vy += p.g; if (p.drag) p.vx *= p.drag;
                    p.x += p.vx; p.y += p.vy; p.life -= p.decay;
                    if (p.vr) p.rot += p.vr;
                    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
                    ctx.fillStyle = p.color;
                    if (p.shape === 'ring') {
                        p.r += p.grow;
                        ctx.strokeStyle = p.color; ctx.lineWidth = 3 * p.life;
                        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
                    } else if (p.shape === 'circle') {
                        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                    } else {
                        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                        if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
                        else { ctx.beginPath(); ctx.moveTo(0, -p.r * 1.6); ctx.lineTo(p.r * 0.6, 0); ctx.lineTo(0, p.r * 1.6); ctx.lineTo(-p.r * 0.6, 0); ctx.fill(); }
                        ctx.restore();
                    }
                }
                ctx.globalAlpha = 1;
                if (this.items.length) requestAnimationFrame(tick);
                else { this.running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
            };
            requestAnimationFrame(tick);
        }
    }

    global.Sound = Sound;
    global.Particles = Particles;
})(window);
