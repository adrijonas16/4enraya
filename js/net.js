/* ==========================================================
   Online sin servidor propio: salas en tiempo real de la
   página publicada en Claude (capacidad "room").
   Cada jugador publica en su presencia el estado completo de
   la partida con un número de secuencia; gana el más reciente.
   ========================================================== */
(function (global) {
    'use strict';

    const APP = '4r';

    // ---------- estado compacto (la presencia admite 4 KiB) ----------

    function encode(s) {
        const flat = [];
        for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
            const x = s.cells[r][c];
            flat.push(!x ? 0 : x.stone ? 's' + x.id : x.color[0] + x.id);
        }
        const copy = { ...s, cells: flat };
        if (copy.nextEventAt === Infinity) copy.nextEventAt = null;
        if (copy.lastEvent && copy.lastEvent.info) {
            const info = { ...copy.lastEvent.info };
            if (info.removed) info.removed = info.removed.map(p => ({ id: p.id, color: p.color, r: p.r, c: p.c }));
            copy.lastEvent = { ...copy.lastEvent, info };
        }
        return copy;
    }

    function decode(o) {
        const s = { ...o, cells: [] };
        for (let r = 0; r < o.rows; r++) {
            const row = [];
            for (let c = 0; c < o.cols; c++) {
                const v = o.cells[r * o.cols + c];
                if (!v) row.push(null);
                else if (v[0] === 's') row.push({ id: v.slice(1), stone: true });
                else row.push({ id: v.slice(1), color: v[0] === 'r' ? 'red' : 'yellow' });
            }
            s.cells.push(row);
        }
        if (s.nextEventAt == null) s.nextEventAt = Infinity;
        return s;
    }

    class RoomNet {
        constructor() {
            this.cap = null;
            this.lobbyPeers = [];
            this.onLobby = null;
            this.ready = this.init();
        }

        async init() {
            try {
                if (!global.claude || typeof global.claude.use !== 'function') return null;
                this.cap = await global.claude.use('room');
                if (!this.cap) return null;
                this.cap.onPeers(ch => {
                    this.lobbyPeers = ch.peers.filter(p => !p.isMe && p.presence && p.presence.app === APP);
                    this.onLobby && this.onLobby(this.lobbyPeers);
                }, () => { this.cap = null; });
                return this.cap;
            } catch (e) {
                this.cap = null;
                return null;
            }
        }

        get available() { return !!this.cap; }

        lobby(patch) {
            if (!this.cap) return;
            this.cap.presence({ app: APP, ...patch }).catch(() => {});
        }

        // Une a la sala de una partida. handlers: { onPeers(peers), onState(state, peer) }
        async join(code, me, handlers) {
            if (!this.cap) throw new Error('Las salas en tiempo real no están disponibles aquí');
            const room = await this.cap.join('4r-' + code.toLowerCase());
            let lastSeq = -1;
            const look = peers => {
                const others = peers.filter(p => !p.sameTab && p.presence && p.presence.app === APP);
                handlers.onPeers && handlers.onPeers(others);
                for (const p of others) {
                    const pr = p.presence;
                    if (pr.st && typeof pr.seq === 'number' && pr.seq > lastSeq) {
                        try {
                            const st = decode(pr.st);
                            if (st.v === 2) { lastSeq = pr.seq; handlers.onState && handlers.onState(st, p); }
                        } catch (e) { /* estado ilegible: se ignora */ }
                    }
                }
            };
            const unsub = room.onPeers(ch => look(ch.peers), err => handlers.onLost && handlers.onLost(err));
            await room.presence({ app: APP, ...me, seq: -1, st: null });
            return {
                code,
                get myPeer() { const me = room.peers().find(p => p.sameTab); return me ? me.peer : null; },
                async send(state) {
                    lastSeq = Math.max(lastSeq, state.seq);
                    const st = encode(state);
                    await room.presence({ seq: state.seq, st });
                },
                async set(patch) { await room.presence(patch); },
                peers: () => room.peers().filter(p => !p.sameTab && p.presence && p.presence.app === APP),
                async leave() { try { unsub(); } catch (e) { /* */ } try { await room.leave(); } catch (e) { /* */ } },
            };
        }
    }

    global.RoomNet = RoomNet;
    global.NetCodec = { encode, decode };
})(window);
