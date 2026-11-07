// Doble de Supabase para pruebas: tablas en localStorage y avisos en tiempo real
// entre pestañas con BroadcastChannel. Implementa solo lo que usa js/utils/api.js.
(function () {
  const bc = new BroadcastChannel('fakesb');
  const listeners = [];   // {table, event, filter:[col,val], cb}
  const presenceSubs = [];
  const load = () => JSON.parse(localStorage.getItem('fakedb') || '{}');
  const save = db => localStorage.setItem('fakedb', JSON.stringify(db));
  const uuid = () => crypto.randomUUID();
  const emit = (msg, local = true) => { bc.postMessage(msg); if (local) deliver(msg); };
  function deliver(msg) {
    if (msg.kind === 'change') {
      listeners.forEach(l => {
        if (l.table !== msg.table) return;
        if (l.event !== '*' && l.event !== msg.eventType) return;
        const row = msg.new || msg.old;
        if (l.filter && String(row[l.filter[0]]) !== l.filter[1]) return;
        setTimeout(() => l.cb({ eventType: msg.eventType, new: msg.new, old: msg.old }), 30);
      });
    }
    if (msg.kind === 'presence') presenceSubs.forEach(f => f());
  }
  bc.onmessage = e => deliver(e.data);
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; }
    select() { this.ret = true; return this; }
    insert(rows) { this.op = 'insert'; this.rows = rows; return this; }
    update(v) { this.op = 'update'; this.v = v; return this; }
    upsert(v) { this.op = 'upsert'; this.rows = [v]; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.f.push(r => r[c] === v); return this; }
    neq(c, v) { this.f.push(r => r[c] !== v); return this; }
    in(c, a) { this.f.push(r => a.includes(r[c])); return this; }
    ilike(c, p) { const s = p.replace(/%$/, '').toLowerCase(); this.f.push(r => (r[c] || '').toLowerCase().startsWith(s)); return this; }
    gte(c, v) { this.f.push(r => r[c] >= v); return this; }
    or(str) { const parts = str.split(',').map(x => x.split('.eq.')); this.f.push(r => parts.some(([c, v]) => String(r[c]) === v)); return this; }
    order() { return this; } limit(n) { this.n = n; return this; }
    maybeSingle() { this.one = 'maybe'; return this; } single() { this.one = 'single'; return this; }
    then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
    run() {
      const db = load(); const rows = db[this.t] = db[this.t] || [];
      let out = [];
      const match = r => this.f.every(fn => fn(r));
      if (this.op === 'select') out = rows.filter(match);
      if (this.op === 'insert' || this.op === 'upsert') {
        for (const r0 of this.rows) {
          const r = { id: uuid(), created_at: new Date().toISOString(), status: r0.status || (this.t === 'rooms' ? 'waiting' : this.t === 'games' ? 'playing' : 'pending'), ...r0 };
          if (this.t === 'friendships') {
            const dup = rows.find(x => (x.requester_id === r.requester_id && x.addressee_id === r.addressee_id) || (x.requester_id === r.addressee_id && x.addressee_id === r.requester_id));
            if (dup) return { data: null, error: { code: '23505', message: 'dup' } };
          }
          rows.push(r); out.push(r);
          save(db); emit({ kind: 'change', table: this.t, eventType: 'INSERT', new: r });
        }
      }
      if (this.op === 'update') {
        rows.filter(match).forEach(r => { const old = { ...r }; Object.assign(r, this.v); out.push(r); save(db); emit({ kind: 'change', table: this.t, eventType: 'UPDATE', new: r, old }); });
      }
      if (this.op === 'delete') {
        const keep = []; rows.forEach(r => { if (match(r)) { out.push(r); emit({ kind: 'change', table: this.t, eventType: 'DELETE', new: null, old: r }); } else keep.push(r); });
        db[this.t] = keep; save(db);
      }
      if (this.n) out = out.slice(0, this.n);
      if (this.one) { if (!out.length) return this.one === 'single' ? { data: null, error: { code: 'PGRST116' } } : { data: null, error: null }; return { data: out[0], error: null }; }
      return { data: out, error: null };
    }
  }
  function channel(name, opts) {
    const key = opts && opts.config && opts.config.presence && opts.config.presence.key;
    const ch = {
      on(type, cfg, cb) {
        if (type === 'postgres_changes') { const f = cfg.filter ? cfg.filter.split('=eq.') : null; listeners.push({ table: cfg.table, event: cfg.event, filter: f, cb }); }
        if (type === 'presence') presenceSubs.push(cb);
        return ch;
      },
      subscribe(cb) { setTimeout(() => cb && cb('SUBSCRIBED'), 10); return ch; },
      async track(meta) { const p = JSON.parse(localStorage.getItem('fakepres') || '{}'); p[key] = [meta]; localStorage.setItem('fakepres', JSON.stringify(p)); emit({ kind: 'presence' }); },
      presenceState() { return JSON.parse(localStorage.getItem('fakepres') || '{}'); },
    };
    return ch;
  }
  window.supabase = { createClient: () => ({
    from: t => new Q(t), channel, removeChannel() {},
    rpc: async () => ({ data: null, error: null }),
    auth: { getSession: async () => ({ data: { session: null } }), signOut: async () => ({}), signInWithOAuth: async () => ({}) },
  }) };
})();
