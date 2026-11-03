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
            throw new Error(error.message);
        }
        return data;
    }

    loginAsGuest() {
        const guest = { id: null, username: 'Invitado', email: null, total_wins: 0, total_points: 0, guest: true };
        localStorage.setItem('user', JSON.stringify(guest));
        return guest;
    }

    async updateEmail(userId, email) {
        const { error } = await this.db().from('users').update({ email }).eq('id', userId);
        if (error) throw error;
        const user = this.getCurrentUser();
        user.email = email;
        localStorage.setItem('user', JSON.stringify(user));
    }

    logout() { localStorage.removeItem('user'); }

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
        if (error) throw error;
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

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }
}

const api = new API();
