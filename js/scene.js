/* ==========================================================
   Fondo animado: auroras, fichas flotando con profundidad,
   luz de turno y destellos de tormenta en los eventos.
   ========================================================== */
(function (global) {
    'use strict';

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // pinta una ficha en un canvas aparte (con desenfoque) para reutilizarla
    function sprite(color, blur) {
        const size = 160, pad = 40;
        const c = document.createElement('canvas');
        c.width = c.height = size + pad * 2;
        const x = c.getContext('2d');
        if (blur) x.filter = `blur(${blur}px)`;
        const cx = pad + size / 2, r = size / 2;
        const tones = {
            red: ['#ff9a86', '#e5342a', '#7d120d'],
            yellow: ['#ffe9a0', '#f5b915', '#8f5d00'],
            blue: ['#7fa2ff', '#2a56e0', '#0f2a8a'],
            ice: ['#ffffff', '#bfe6ff', '#4f8fb8'],
        }[color];
        const g = x.createRadialGradient(cx - r * .32, cx - r * .38, r * .05, cx, cx, r);
        g.addColorStop(0, tones[0]); g.addColorStop(.45, tones[1]); g.addColorStop(1, tones[2]);
        x.fillStyle = g;
        x.beginPath(); x.arc(cx, cx, r, 0, Math.PI * 2); x.fill();
        // aro en relieve
        x.lineWidth = r * .07;
        x.strokeStyle = 'rgba(0,0,0,.18)';
        x.beginPath(); x.arc(cx, cx, r * .6, 0, Math.PI * 2); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.22)';
        x.beginPath(); x.arc(cx, cx, r * .66, 0, Math.PI * 2); x.stroke();
        // brillo
        x.fillStyle = 'rgba(255,255,255,.35)';
        x.beginPath(); x.ellipse(cx - r * .3, cx - r * .45, r * .32, r * .14, -0.5, 0, Math.PI * 2); x.fill();
        return c;
    }

    class Scene {
        constructor(root) {
            this.root = root;
            this.canvas = root.querySelector('canvas');
            this.ctx = this.canvas.getContext('2d');
            this.flashEl = root.querySelector('.flash');
            this.mx = 0; this.my = 0; this.tx = 0; this.ty = 0;
            this.swirl = 0;
            this.sprites = {};
            ['red', 'yellow', 'blue', 'ice'].forEach(col => {
                this.sprites[col] = [sprite(col, 7), sprite(col, 3), sprite(col, 0)];
            });
            this.resize();
            this.seed();
            addEventListener('resize', () => { this.resize(); this.seed(); });
            addEventListener('pointermove', e => {
                this.tx = (e.clientX / innerWidth - .5);
                this.ty = (e.clientY / innerHeight - .5);
            }, { passive: true });
            document.addEventListener('visibilitychange', () => { if (!document.hidden) this.loop(); });
            this.last = 0;
            this.loop = this.loop.bind(this);
            if (reduced) this.draw(0); else requestAnimationFrame(this.loop);
        }

        resize() {
            const dpr = Math.min(1.5, devicePixelRatio || 1);
            this.w = innerWidth; this.h = innerHeight;
            this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        seed() {
            const n = Math.round(Math.min(26, Math.max(12, this.w * this.h / 60000)));
            const cols = ['red', 'yellow', 'red', 'yellow', 'blue'];
            this.discs = Array.from({ length: n }, (_, i) => {
                const depth = Math.random();              // 0 lejos, 1 cerca
                return {
                    x: Math.random() * this.w,
                    y: Math.random() * this.h,
                    z: depth,
                    size: 14 + depth * depth * 70,
                    vy: -(4 + depth * 14),                 // px/s hacia arriba
                    vx: (Math.random() - .5) * 6,
                    rot: Math.random() * Math.PI * 2,
                    vr: (Math.random() - .5) * .4,
                    wob: Math.random() * Math.PI * 2,
                    color: cols[i % cols.length],
                    alpha: .12 + depth * .38,
                };
            }).sort((a, b) => a.z - b.z);
        }

        loop(t = 0) {
            if (document.hidden) return;
            const dt = Math.min(.05, (t - this.last) / 1000 || 0);
            this.last = t;
            this.draw(dt);
            requestAnimationFrame(this.loop);
        }

        draw(dt) {
            const ctx = this.ctx;
            this.mx += (this.tx - this.mx) * .04;
            this.my += (this.ty - this.my) * .04;
            this.swirl *= .985;
            ctx.clearRect(0, 0, this.w, this.h);
            const cx = this.w / 2, cy = this.h / 2;
            for (const d of this.discs) {
                d.wob += dt * (.6 + d.z);
                d.y += d.vy * dt * (1 + this.swirl * 4);
                d.x += (d.vx + Math.sin(d.wob) * 6) * dt;
                if (this.swirl > .02) {
                    // remolino: giran alrededor del centro
                    const ang = Math.atan2(d.y - cy, d.x - cx) + this.swirl * dt * 2.4 * (0.5 + d.z);
                    const rad = Math.hypot(d.x - cx, d.y - cy);
                    d.x = cx + Math.cos(ang) * rad; d.y = cy + Math.sin(ang) * rad;
                }
                d.rot += d.vr * dt;
                const m = d.size + 60;
                if (d.y < -m) { d.y = this.h + m; d.x = Math.random() * this.w; }
                if (d.y > this.h + m) d.y = -m;
                if (d.x < -m) d.x = this.w + m;
                if (d.x > this.w + m) d.x = -m;

                const px = d.x - this.mx * 60 * (d.z + .2);
                const py = d.y - this.my * 40 * (d.z + .2);
                const level = d.z < .35 ? 0 : d.z < .7 ? 1 : 2;
                const img = this.sprites[d.color][level];
                const s = d.size * (img.width / 160);
                ctx.globalAlpha = d.alpha;
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(d.rot);
                ctx.scale(1, .55 + .45 * Math.abs(Math.cos(d.wob * .5))); // giro en 3D
                ctx.drawImage(img, -s / 2, -s / 2, s, s);
                ctx.restore();
            }
            ctx.globalAlpha = 1;
        }

        mood(color) {
            document.documentElement.dataset.mood = color || 'none';
        }

        flash(kind = 'white') {
            const el = this.flashEl;
            el.className = 'flash ' + kind;
            void el.offsetWidth;
            el.classList.add('go');
        }

        storm(id) {
            this.flash(id === 'blizzard' ? 'ice' : id === 'meteor' ? 'fire' : 'white');
            if (id === 'whirlwind' || id === 'flipAll') this.swirl = 1;
            if (id === 'quake' || id === 'meteor') {
                this.root.animate([
                    { transform: 'translate(0,0)' }, { transform: 'translate(-10px,4px)' },
                    { transform: 'translate(9px,-5px)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(0,0)' },
                ], { duration: 600 });
            }
            if (id === 'blizzard') {
                this.discs.forEach(d => { d.orig = d.orig || d.color; if (Math.random() < .6) d.color = 'ice'; });
                setTimeout(() => this.discs.forEach(d => { if (d.orig) d.color = d.orig; }), 6000);
            }
            if (id === 'gift' || id === 'swap') this.swirl = .4;
        }

        celebrate() { this.swirl = .6; this.discs.forEach(d => (d.vy *= 3)); setTimeout(() => this.discs.forEach(d => (d.vy /= 3)), 2500); }
    }

    global.Scene = Scene;
})(window);
