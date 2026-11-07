// Doble de la capacidad "room" de las páginas de Claude: comparte presencia entre
// pestañas del mismo navegador con BroadcastChannel. Solo para pruebas.
(function () {
  const bc = new BroadcastChannel('fakeroom');
  const me = 'peer-' + Math.random().toString(36).slice(2, 8);
  const rooms = {}; // name -> { peers: {peer: presence}, subs: [] }
  const R = n => (rooms[n] = rooms[n] || { peers: {}, subs: [], joined: false });
  const fire = n => {
    const r = R(n);
    const peers = Object.entries(r.peers).map(([peer, presence]) => Object.freeze({ peer, presence, isMe: peer === me, sameTab: peer === me, kind: 'viewer', guest: false, by: null, updatedAt: Date.now() }));
    r.subs.forEach(fn => setTimeout(() => fn({ peers, joined: [], left: [], updated: [] }), 20));
  };
  bc.onmessage = e => {
    const m = e.data; const r = R(m.room);
    if (!r.joined) return;
    if (m.type === 'presence') { r.peers[m.peer] = m.presence; fire(m.room); }
    if (m.type === 'leave') { delete r.peers[m.peer]; fire(m.room); }
    if (m.type === 'hello' && r.peers[me]) bc.postMessage({ type: 'presence', room: m.room, peer: me, presence: r.peers[me] });
  };
  const make = name => ({
    name,
    async presence(patch) { const r = R(name); r.peers[me] = { ...(r.peers[me] || {}), ...patch }; bc.postMessage({ type: 'presence', room: name, peer: me, presence: r.peers[me] }); fire(name); if (JSON.stringify(r.peers[me]).length > 4096) throw new Error('presence too big'); },
    onPeers(fn) { R(name).subs.push(fn); fire(name); return () => { const r = R(name); r.subs = r.subs.filter(f => f !== fn); }; },
    peers() { const r = R(name); return Object.entries(r.peers).map(([peer, presence]) => ({ peer, presence, isMe: peer === me, sameTab: peer === me })); },
    async emit() {}, on() { return () => {}; }, connected: () => true,
    async leave() { const r = R(name); delete r.peers[me]; r.joined = false; r.subs = []; bc.postMessage({ type: 'leave', room: name, peer: me }); },
  });
  const lobby = make('lobby'); R('lobby').joined = true; bc.postMessage({ type: 'hello', room: 'lobby' });
  lobby.join = async n => { R(n).joined = true; bc.postMessage({ type: 'hello', room: n }); return make(n); };
  window.claude = { use: async n => (n === 'room' ? new Promise(res => setTimeout(() => res(lobby), 50)) : null) };
})();
