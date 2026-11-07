/* ==========================================================
   Amigos: búsqueda, solicitudes, presencia y retos
   ========================================================== */
(function (global) {
    'use strict';
    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    };

    class Social {
        constructor(app) {
            this.app = app;
            this.user = app.user;
            this.data = { friends: [], incoming: [], outgoing: [] };
            this.online = {};
            this.h2h = {};
            this.invites = [];
            this.enabled = !this.user.guest && !!this.user.id && api.online;
            this.bind();
            if (this.enabled) this.start();
            else this.updateBadge();
        }

        async start() {
            try {
                this.channel = api.subscribeSocial(this.user.id,
                    (p, dir) => this.onFriendship(p, dir),
                    inv => this.onInvite(inv));
                this.presence = api.joinPresence(this.user, map => { this.online = map; this.renderFriends(); });
            } catch (e) { /* sin tiempo real: se sigue pudiendo usar al abrir la lista */ }
            await this.refresh();
            const pending = await api.pendingInvites(this.user.id).catch(() => []);
            pending.forEach(inv => this.onInvite(inv));
        }

        bind() {
            $('friends-btn').onclick = () => this.open();
            let t;
            $('friend-search').addEventListener('input', () => {
                clearTimeout(t);
                t = setTimeout(() => this.search(), 250);
            });
            $('friend-search').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
        }

        async refresh() {
            if (!this.enabled) return;
            try {
                this.data = await api.getFriends(this.user.id);
                this.h2h = await api.headToHead(this.user.username, this.data.friends.map(f => f.username)).catch(() => ({}));
            } catch (e) { /* se mostrará vacío */ }
            this.renderFriends();
            this.updateBadge();
            if ($('friends').open && $('friend-search').value.trim().length >= 2) this.search();
        }

        updateBadge() {
            const n = this.data.incoming.length + this.invites.length;
            const b = $('friends-badge');
            b.textContent = n;
            b.hidden = n === 0;
        }

        setPlaying(playing) {
            if (this.presence) this.presence.track({ username: this.user.username, playing }).catch(() => {});
        }

        /* ---------- hoja de amigos ---------- */

        open() {
            const blocked = $('friends-blocked');
            const body = $('friends-body');
            if (!this.enabled) {
                blocked.hidden = false; body.hidden = true;
                blocked.textContent = this.user.guest
                    ? 'Para tener amigos necesitas una cuenta. Sal desde tu perfil y entra con Google o crea un usuario.'
                    : 'No hay conexión con el servidor. Inténtalo más tarde.';
            } else {
                blocked.hidden = true; body.hidden = false;
                this.refresh();
            }
            $('friends').showModal();
        }

        async search() {
            const q = $('friend-search').value.trim();
            const list = $('friend-results');
            list.innerHTML = '';
            if (q.length < 2) return;
            try {
                const people = await api.searchUsers(q, this.user.id);
                if (!people.length) { list.appendChild(el('li', 'msg', `Nadie se llama «${q}». Revisa cómo lo escribió.`)); return; }
                const known = new Map();
                this.data.friends.forEach(f => known.set(f.id, 'Ya es tu amigo'));
                this.data.outgoing.forEach(f => known.set(f.id, 'Solicitud enviada'));
                this.data.incoming.forEach(f => known.set(f.id, 'Te ha enviado una solicitud'));
                people.forEach(p => {
                    const li = this.row(p, known.get(p.id) || `${p.total_wins || 0} victoria${(p.total_wins || 0) === 1 ? '' : 's'}`);
                    if (!known.has(p.id) || known.get(p.id) === 'Te ha enviado una solicitud') {
                        const btn = el('button', 'btn btn-primary btn-small', known.has(p.id) ? 'Aceptar' : 'Añadir');
                        btn.type = 'button';
                        btn.onclick = async () => {
                            btn.disabled = true;
                            try {
                                const r = await api.sendFriendRequest(this.user.id, p.id);
                                this.app.toast(r === 'accepted' ? `Ahora eres amigo de ${p.username}` : `Solicitud enviada a ${p.username}`);
                                btn.textContent = r === 'accepted' ? 'Amigos' : 'Enviada';
                                this.refresh();
                            } catch (e) {
                                this.app.toast(e.message, true);
                                btn.disabled = false;
                            }
                        };
                        li.appendChild(btn);
                    }
                    list.appendChild(li);
                });
            } catch (e) {
                list.appendChild(el('li', 'msg', 'No se pudo buscar. Comprueba tu conexión.'));
            }
        }

        row(person, subtitle, online) {
            const li = el('li', 'person');
            const av = el('span', 'avatar', (person.username || '?')[0].toUpperCase());
            if (online) { const dot = el('i', 'presence ' + online); av.appendChild(dot); }
            const info = el('span', 'person-info');
            info.appendChild(el('b', null, person.username));
            info.appendChild(el('small', null, subtitle));
            li.append(av, info);
            return li;
        }

        renderFriends() {
            if (!$('friends-body')) return;
            const { friends, incoming, outgoing } = this.data;

            // solicitudes recibidas
            const inc = $('friend-incoming');
            inc.innerHTML = '';
            $('incoming-section').hidden = !incoming.length;
            incoming.forEach(p => {
                const li = this.row(p, 'Quiere ser tu amigo');
                const yes = el('button', 'btn btn-primary btn-small', 'Aceptar');
                const no = el('button', 'btn btn-ghost btn-small', 'Rechazar');
                yes.type = no.type = 'button';
                yes.onclick = async () => { await api.respondFriend(p.friendshipId, true).catch(() => {}); this.app.toast(`Ahora eres amigo de ${p.username}`); this.refresh(); };
                no.onclick = async () => { await api.respondFriend(p.friendshipId, false).catch(() => {}); this.refresh(); };
                const acts = el('span', 'person-actions'); acts.append(yes, no);
                li.appendChild(acts);
                inc.appendChild(li);
            });

            // amigos: primero los conectados
            const list = $('friend-list');
            list.innerHTML = '';
            $('friends-count').textContent = friends.length ? `(${friends.length})` : '';
            if (!friends.length) {
                list.appendChild(el('li', 'msg', 'Aún no tienes amigos. Busca su nombre de usuario arriba y envíale una solicitud.'));
            }
            const sorted = [...friends].sort((a, b) => (!!this.online[b.id] - !!this.online[a.id]) || a.username.localeCompare(b.username));
            sorted.forEach(p => {
                const pres = this.online[p.id];
                const state = pres ? (pres.playing ? 'playing' : 'online') : 'offline';
                const rec = this.h2h[p.username];
                let sub = state === 'online' ? 'Conectado' : state === 'playing' ? 'Jugando online' : 'Desconectado';
                if (rec) sub += `, ustedes van ${rec.won}–${rec.lost}`;
                const li = this.row(p, sub, state);
                const acts = el('span', 'person-actions');
                const dare = el('button', 'btn btn-primary btn-small', 'Retar');
                dare.type = 'button';
                dare.disabled = state !== 'online' || !!this.app.mp;
                dare.title = state === 'online' ? `Crear sala y retar a ${p.username}` : 'Solo puedes retar a amigos conectados y libres';
                dare.onclick = () => this.challenge(p);
                const rm = el('button', 'icon-btn icon-small', '×');
                rm.type = 'button';
                rm.title = `Quitar a ${p.username} de tus amigos`;
                rm.setAttribute('aria-label', rm.title);
                // primer toque pide confirmación en el propio botón; el segundo quita
                rm.onclick = async () => {
                    if (!rm.classList.contains('confirm')) {
                        rm.classList.add('confirm');
                        rm.textContent = '¿Quitar?';
                        setTimeout(() => { rm.classList.remove('confirm'); rm.textContent = '×'; }, 3000);
                        return;
                    }
                    await api.removeFriend(p.friendshipId).catch(() => {});
                    this.refresh();
                };
                acts.append(dare, rm);
                li.appendChild(acts);
                list.appendChild(li);
            });

            // solicitudes enviadas
            const out = $('friend-outgoing');
            out.innerHTML = '';
            $('outgoing-section').hidden = !outgoing.length;
            outgoing.forEach(p => {
                const li = this.row(p, 'Esperando respuesta');
                const cancel = el('button', 'btn btn-ghost btn-small', 'Cancelar');
                cancel.type = 'button';
                cancel.onclick = async () => { await api.removeFriend(p.friendshipId).catch(() => {}); this.refresh(); };
                li.appendChild(cancel);
                out.appendChild(li);
            });
        }

        /* ---------- retos ---------- */

        async challenge(friend) {
            $('friends').close();
            await this.app.createRoom();
            if (!this.app.mp) { this.app.openOnline(); return; }
            try {
                await api.sendInvite(this.user.id, this.user.username, friend.id, this.app.mp.room.room_code);
                this.app.setMpStatus(`Reto enviado a ${friend.username}. Esperando a que acepte<span class="dots"></span>`);
                this.app.openOnline();
            } catch (e) {
                this.app.toast('No se pudo enviar el reto', true);
            }
        }

        onInvite(inv) {
            if (!inv || inv.status !== 'pending' || this.invites.some(i => i.id === inv.id)) return;
            this.invites.push(inv);
            this.updateBadge();
            this.app.sfx('alarm');
            this.renderInvites();
            // caduca a los 10 minutos
            const age = Date.now() - new Date(inv.created_at).getTime();
            setTimeout(() => this.dropInvite(inv.id), Math.max(1000, 10 * 60 * 1000 - age));
        }

        dropInvite(id) {
            this.invites = this.invites.filter(i => i.id !== id);
            this.updateBadge();
            this.renderInvites();
        }

        renderInvites() {
            const box = $('invites');
            box.innerHTML = '';
            this.invites.slice(0, 3).forEach(inv => {
                const card = el('div', 'invite');
                card.appendChild(el('span', 'invite-icon', '⚔️'));
                const txt = el('div', 'invite-text');
                txt.appendChild(el('b', null, `${inv.from_name} te reta`));
                txt.appendChild(el('small', null, `Sala ${inv.room_code}`));
                const yes = el('button', 'btn btn-primary btn-small', 'Jugar');
                const no = el('button', 'btn btn-ghost btn-small', 'Ahora no');
                yes.type = no.type = 'button';
                yes.onclick = async () => {
                    this.dropInvite(inv.id);
                    if (this.app.mp) { this.app.toast('Sal de tu sala actual antes de aceptar un reto', true); return; }
                    api.respondInvite(inv.id, 'accepted').catch(() => {});
                    $('join-code-input').value = inv.room_code;
                    this.app.openOnline();
                    await this.app.joinRoom();
                };
                no.onclick = () => { this.dropInvite(inv.id); api.respondInvite(inv.id, 'declined').catch(() => {}); };
                const acts = el('div', 'invite-actions'); acts.append(yes, no);
                card.append(txt, acts);
                box.appendChild(card);
            });
        }

        onFriendship(payload, dir) {
            const row = payload.new;
            if (payload.eventType === 'INSERT' && dir === 'in') {
                this.app.sfx('charge');
                this.refresh().then(() => {
                    const p = this.data.incoming.find(x => x.friendshipId === row.id);
                    if (p) this.app.toast(`${p.username} quiere ser tu amigo`);
                });
                return;
            }
            if (payload.eventType === 'UPDATE' && dir === 'out' && row.status === 'accepted') {
                this.refresh().then(() => {
                    const p = this.data.friends.find(x => x.friendshipId === row.id);
                    if (p) this.app.toast(`${p.username} aceptó tu solicitud`);
                });
                return;
            }
            this.refresh();
        }
    }

    global.Social = Social;
})(window);
