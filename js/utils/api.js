/* exported api */
/* ==========================================================
   Capa de datos (Supabase). Si Supabase no carga, el juego
   sigue funcionando en local y como invitado.
   ========================================================== */
class API {
    constructor() {
        this.supabase = null;
        try {
            if (window.supabase && window.supabase.createClient) {
                this.supabase = window.supabase.createClient(
                    'https://cyzjihoibpdabhiotjpf.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5emppaG9pYnBkYWJoaW90anBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODcxMjgsImV4cCI6MjA5MDc2MzEyOH0.J-4BMYs4r0-QHYqux5tipnjL9-qmYxY_OSK5g6-R9NQ'
                );
            }
        } catch (e) {
            this.supabase = null;
        }
    }

    get online() { return !!this.supabase; }

    db() {
        if (!this.supabase) throw new Error('No hay conexión con el servidor. Puedes jugar en local.');
        return this.supabase;
    }

    /* ---------- cuenta ---------- */

    async login(emailOrUsername, password) {
        const field = emailOrUsername.includes('@') ? 'email' : 'username';
        const { data, error } = await this.db()
            .from('users')
            .select('id, username, email, total_wins, total_points')
            .eq(field, emailOrUsername)
            .eq('password', password)
            .maybeSingle();

        if (error || !data) throw new Error('Usuario o contraseña incorrectos');
        localStorage.setItem('user', JSON.stringify(data));
        return data;
    }

    async register(username, email, password) {
        const { data, error } = await this.db()
            .from('users')
            .insert([{ username, email, password }])
            .select('id, username, email, total_wins, total_points')
            .single();

        if (error) {
            if (error.code === '23505') throw new Error('Ese usuario o email ya existe');
            throw new Error(API.friendly(error, 'No se pudo crear la cuenta. Inténtalo de nuevo.'));
        }
        return data;
    }

    // Traduce errores de la base de datos a mensajes para la persona
    static friendly(error, fallback) {
        const msg = (error && (error.message || error.hint)) || '';
        if (/rate_limited/.test(msg)) return 'Vas muy rápido. Espera unos minutos y vuelve a intentarlo.';
        if (/users_username_format/.test(msg)) return 'Usa de 3 a 15 letras, números o _ en el nombre de usuario';
        if (/users_email_format/.test(msg)) return 'Ese email no parece válido';
        return fallback;
    }

    /* ---------- Google (Supabase Auth) ---------- */

    async loginWithGoogle() {
        const redirectTo = new URL('login.html', location.href).href;
        const { error } = await this.db().auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo, queryParams: { prompt: 'select_account' } },
        });
        if (error) throw new Error('No se pudo abrir el inicio de sesión de Google');
    }

    // Al volver de Google: crea o recupera el jugador enlazado a esa cuenta
    async finishOAuth() {
        if (!this.supabase) return null;
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) return null;
        const { data, error } = await this.supabase.rpc('login_with_auth');
        if (error || !data || !data.length) throw new Error(API.friendly(error, 'No se pudo entrar con Google'));
        const user = { ...data[0], google: true };
        localStorage.setItem('user', JSON.stringify(user));
        return user;
    }

    loginAsGuest() {
        const guest = { id: null, username: 'Invitado', email: null, total_wins: 0, total_points: 0, guest: true };
        localStorage.setItem('user', JSON.stringify(guest));
        return guest;
    }

    async updateEmail(userId, email) {
        const { error } = await this.db().from('users').update({ email }).eq('id', userId);
        if (error) throw new Error(error.code === '23505' ? 'Ese email ya está en uso' : API.friendly(error, 'No se pudo guardar el email'));
        const user = this.getCurrentUser();
        user.email = email;
        localStorage.setItem('user', JSON.stringify(user));
    }

    async logout() {
        localStorage.removeItem('user');
        try { if (this.supabase) await this.supabase.auth.signOut(); } catch (e) { /* nada */ }
    }

    getCurrentUser() {
        try { return JSON.parse(localStorage.getItem('user')); }
        catch (e) { return null; }
    }

    /* ---------- ranking e historial ---------- */

    async getRanking(limit = 20) {
        const { data, error } = await this.db()
            .from('rankings')
            .select('*')
            .order('total_points', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    }

    async updateRanking() {
        const user = this.getCurrentUser();
        if (!user || user.guest) return;
        const { data: history } = await this.db()
            .from('game_history').select('id').eq('player_name', user.username);
        const gamesPlayed = history?.length || 0;
        const winRate = gamesPlayed > 0 ? Math.round((user.total_wins / gamesPlayed) * 100) : 0;
        await this.db().from('rankings').upsert({
            user_id: user.id,
            username: user.username,
            total_wins: user.total_wins || 0,
            total_points: user.total_points || 0,
            games_played: gamesPlayed,
            win_rate: winRate,
        }, { onConflict: 'user_id' });
    }

    async saveGame(playerName, mapType, won, opponent = null) {
        await this.db().from('game_history').insert([{ player_name: playerName, map_type: mapType, won, opponent }]);
        if (won) {
            await this.db().rpc('increment_wins', { username: playerName });
            await this.db().rpc('increment_points', { username: playerName });
        }
        await this.updateRanking();
    }

    /* ---------- salas online ---------- */

    async createRoom(hostId, hostName) {
        const code = this.generateRoomCode();
        const { data: room, error } = await this.db()
            .from('rooms')
            .insert([{ room_code: code, host_id: hostId, host_name: hostName, status: 'waiting' }])
            .select().single();
        if (error) throw new Error(API.friendly(error, 'No se pudo crear la sala'));
        return room;
    }

    async joinRoom(roomCode, guestId, guestName) {
        const { data: room, error } = await this.db()
            .from('rooms')
            .update({ guest_id: guestId, guest_name: guestName, status: 'playing' })
            .eq('room_code', roomCode)
            .eq('status', 'waiting')
            .select().single();
        if (error || !room) throw new Error('Esa sala no existe o ya está llena');
        return room;
    }

    async getGame(roomId) {
        const { data, error } = await this.db()
            .from('games').select('*')
            .eq('room_id', roomId).eq('status', 'playing')
            .limit(1).maybeSingle();
        if (error) throw error;
        return data;
    }

    async createGame(roomId, state) {
        const { data: game, error } = await this.db()
            .from('games')
            .insert([{ room_id: roomId, board_state: JSON.stringify(state), current_turn: state.turn, status: 'playing' }])
            .select().single();
        if (error) throw error;
        return game;
    }

    async updateGame(gameId, state) {
        const { error } = await this.db().from('games').update({
            board_state: JSON.stringify(state),
            current_turn: state.turn,
        }).eq('id', gameId);
        if (error) throw error;
    }

    // reutiliza la misma fila para la revancha
    async resetGame(gameId, state) {
        const { error } = await this.db().from('games').update({
            status: 'playing', winner: null,
            board_state: JSON.stringify(state), current_turn: state.turn,
        }).eq('id', gameId);
        if (error) throw error;
    }

    async finishGame(gameId, winner, state) {
        await this.db().from('games').update({
            status: 'finished',
            winner,
            board_state: JSON.stringify(state),
            current_turn: state.turn,
        }).eq('id', gameId);
    }

    subscribeToGame(gameId, callback) {
        return this.db()
            .channel('game:' + gameId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, callback)
            .subscribe();
    }

    subscribeToRoom(roomCode, callback) {
        return this.db()
            .channel('room:' + roomCode)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `room_code=eq.${roomCode}` }, callback)
            .subscribe();
    }

    async leaveRoom(roomCode) {
        await this.db().from('rooms').update({ status: 'cancelled' }).eq('room_code', roomCode);
    }

    unsubscribe(channel) {
        try { this.supabase && this.supabase.removeChannel(channel); } catch (e) { /* nada */ }
    }

    /* ---------- amigos ---------- */

    async searchUsers(query, myId) {
        const q = query.replace(/[%_,()]/g, '').trim();
        if (q.length < 2) return [];
        const { data, error } = await this.db()
            .from('users').select('id, username, total_wins, total_points')
            .ilike('username', q + '%').neq('id', myId).limit(8);
        if (error) throw error;
        return data || [];
    }

    async getFriends(myId) {
        const { data: rows, error } = await this.db()
            .from('friendships').select('*')
            .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
        if (error) throw error;
        const otherIds = [...new Set((rows || []).map(r => (r.requester_id === myId ? r.addressee_id : r.requester_id)))];
        let people = [];
        if (otherIds.length) {
            const { data } = await this.db().from('users')
                .select('id, username, total_wins, total_points').in('id', otherIds);
            people = data || [];
        }
        const byId = Object.fromEntries(people.map(p => [p.id, p]));
        const out = { friends: [], incoming: [], outgoing: [] };
        (rows || []).forEach(r => {
            const otherId = r.requester_id === myId ? r.addressee_id : r.requester_id;
            const person = byId[otherId];
            if (!person) return;
            const item = { ...person, friendshipId: r.id, since: r.responded_at || r.created_at };
            if (r.status === 'accepted') out.friends.push(item);
            else if (r.addressee_id === myId) out.incoming.push(item);
            else out.outgoing.push(item);
        });
        out.friends.sort((a, b) => a.username.localeCompare(b.username));
        return out;
    }

    async sendFriendRequest(myId, otherId) {
        // si el otro ya me la había enviado, se acepta directamente
        const { data: reverse } = await this.db().from('friendships').select('id, status')
            .eq('requester_id', otherId).eq('addressee_id', myId).maybeSingle();
        if (reverse) {
            if (reverse.status === 'pending') await this.respondFriend(reverse.id, true);
            return 'accepted';
        }
        const { error } = await this.db().from('friendships')
            .insert([{ requester_id: myId, addressee_id: otherId }]);
        if (error) {
            if (error.code === '23505') throw new Error('Ya son amigos o hay una solicitud pendiente');
            throw new Error(API.friendly(error, 'No se pudo enviar la solicitud. Inténtalo de nuevo.'));
        }
        return 'sent';
    }

    async respondFriend(friendshipId, accept) {
        const q = accept
            ? this.db().from('friendships').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', friendshipId)
            : this.db().from('friendships').delete().eq('id', friendshipId);
        const { error } = await q;
        if (error) throw error;
    }

    async removeFriend(friendshipId) {
        const { error } = await this.db().from('friendships').delete().eq('id', friendshipId);
        if (error) throw error;
    }

    // victorias y derrotas de un jugador contra cada uno de los nombres dados
    async headToHead(myName, names) {
        if (!names.length) return {};
        const { data } = await this.db().from('game_history')
            .select('opponent, won').eq('player_name', myName).in('opponent', names);
        const out = {};
        (data || []).forEach(g => {
            const r = out[g.opponent] || (out[g.opponent] = { won: 0, lost: 0 });
            g.won ? r.won++ : r.lost++;
        });
        return out;
    }

    /* ---------- retos ---------- */

    async sendInvite(fromId, fromName, toId, roomCode) {
        // cancela retos anteriores sin responder a la misma persona
        await this.db().from('game_invites').update({ status: 'expired' })
            .eq('from_id', fromId).eq('to_id', toId).eq('status', 'pending');
        const { error } = await this.db().from('game_invites')
            .insert([{ from_id: fromId, from_name: fromName, to_id: toId, room_code: roomCode }]);
        if (error) throw new Error(API.friendly(error, 'No se pudo enviar el reto'));
    }

    async pendingInvites(myId) {
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data } = await this.db().from('game_invites').select('*')
            .eq('to_id', myId).eq('status', 'pending').gte('created_at', since)
            .order('created_at', { ascending: false });
        return data || [];
    }

    async respondInvite(inviteId, status) {
        await this.db().from('game_invites').update({ status }).eq('id', inviteId);
    }

    /* ---------- avisos en tiempo real y presencia ---------- */

    subscribeSocial(myId, onFriendship, onInvite) {
        return this.db()
            .channel('social:' + myId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${myId}` }, p => onFriendship(p, 'in'))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${myId}` }, p => onFriendship(p, 'out'))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_invites', filter: `to_id=eq.${myId}` }, p => onInvite(p.new))
            .subscribe();
    }

    joinPresence(user, onChange) {
        const ch = this.db().channel('lobby', { config: { presence: { key: user.id } } });
        ch.on('presence', { event: 'sync' }, () => {
            const state = ch.presenceState();
            const map = {};
            Object.entries(state).forEach(([id, metas]) => { map[id] = metas[metas.length - 1] || {}; });
            onChange(map);
        }).subscribe(async status => {
            if (status === 'SUBSCRIBED') await ch.track({ username: user.username, playing: false });
        });
        return ch;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }
}

const api = new API();
