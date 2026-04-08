class API {
    constructor() {
        console.log('API constructor called');
        this.supabase = window.supabase.createClient(
            'https://cyzjihoibpdabhiotjpf.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5emppaG9pYnBkYWJoaW90anBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODcxMjgsImV4cCI6MjA5MDc2MzEyOH0.J-4BMYs4r0-QHYqux5tipnjL9-qmYxY_OSK5g6-R9NQ'
        );
        console.log('API initialized with Supabase');
    }

    async login(emailOrUsername, password) {
        const { data, error } = await this.supabase
            .from('users')
            .select('id, username, email, total_wins, total_points')
            .eq('password', password)
            .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
            .single();
        
        if (error || !data) {
            throw new Error('Usuario o contraseña incorrectos');
        }
        
        localStorage.setItem('user', JSON.stringify(data));
        return data;
    }

    async register(username, email, password) {
        const { data, error } = await this.supabase
            .from('users')
            .insert([{ username, email, password }])
            .select('id, username, email, total_wins, total_points')
            .single();
        
        if (error) {
            if (error.code === '23505') throw new Error('El usuario ya existe');
            throw new Error(error.message);
        }
        
        return data;
    }

    async updateEmail(userId, email) {
        const { error } = await this.supabase
            .from('users')
            .update({ email })
            .eq('id', userId);
        
        if (error) throw error;
        
        const user = this.getCurrentUser();
        user.email = email;
        localStorage.setItem('user', JSON.stringify(user));
    }

    logout() {
        localStorage.removeItem('user');
    }

    getCurrentUser() {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    }

    async getRanking(limit = 20) {
        const { data } = await this.supabase
            .from('rankings')
            .select('*')
            .order('total_points', { ascending: false })
            .limit(limit);
        return data || [];
    }

    async updateRanking() {
        const user = this.getCurrentUser();
        if (!user) return;

        const { data: history } = await this.supabase
            .from('game_history')
            .select('id')
            .eq('player_name', user.username);

        const gamesPlayed = history?.length || 0;
        const winRate = gamesPlayed > 0 ? Math.round((user.total_wins / gamesPlayed) * 100) : 0;

        await this.supabase.from('rankings').upsert({
            user_id: user.id,
            username: user.username,
            total_wins: user.total_wins || 0,
            total_points: user.total_points || 0,
            games_played: gamesPlayed,
            win_rate: winRate
        }, { onConflict: 'user_id' });
    }

    async saveGame(playerName, mapType, won, opponent = null) {
        await this.supabase.from('game_history').insert([{
            player_name: playerName,
            map_type: mapType,
            won,
            opponent
        }]);
        
        if (won) {
            const { data: user } = await this.supabase
                .from('users')
                .select('id')
                .eq('username', playerName)
                .single();
            
            if (user) {
                await this.supabase.rpc('increment_wins', { username: playerName });
                await this.supabase.rpc('increment_points', { username: playerName });
                await this.updateRanking();
            }
        }
    }

    async getHistory(playerName) {
        const { data } = await this.supabase
            .from('game_history')
            .select('*')
            .eq('player_name', playerName)
            .order('played_at', { ascending: false })
            .limit(50);
        return data || [];
    }

    async createRoom(hostId, hostName) {
        const code = this.generateRoomCode();
        const { data: room, error } = await this.supabase
            .from('rooms')
            .insert([{ room_code: code, host_id: hostId, host_name: hostName, status: 'waiting' }])
            .select()
            .single();
        
        if (error) throw error;
        return room;
    }

    async joinRoom(roomCode, guestId, guestName) {
        const { data: room, error } = await this.supabase
            .from('rooms')
            .update({ guest_id: guestId, guest_name: guestName, status: 'playing' })
            .eq('room_code', roomCode)
            .eq('status', 'waiting')
            .select()
            .single();
        
        if (error || !room) throw new Error('Sala no disponible');
        return room;
    }

    async getGame(roomId) {
        const { data, error } = await this.supabase
            .from('games')
            .select('*')
            .eq('room_id', roomId)
            .eq('status', 'playing')
            .single();
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        return data;
    }

    async createGame(roomId) {
        const emptyBoard = Array.from({ length: 8 }, () => 
            Array.from({ length: 9 }, () => ({ piece: null, blocked: false }))
        );
        
        const { data: game, error } = await this.supabase
            .from('games')
            .insert([{
                room_id: roomId,
                board_state: JSON.stringify(emptyBoard),
                current_turn: 'red',
                status: 'playing'
            }])
            .select()
            .single();
        if (error) throw error;
        return game;
    }

    async updateGame(gameId, boardState, currentTurn) {
        await this.supabase.from('games').update({
            board_state: JSON.stringify(boardState),
            current_turn: currentTurn
        }).eq('id', gameId);
    }

    async finishGame(gameId, winner, boardState) {
        await this.supabase.from('games').update({
            status: 'finished',
            winner,
            board_state: JSON.stringify(boardState)
        }).eq('id', gameId);
    }

    subscribeToGame(gameId, callback) {
        const channel = this.supabase
            .channel('game:' + gameId)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${gameId}`
            }, callback)
            .subscribe((status) => {
                console.log('Game subscription status:', status);
            });
        
        return channel;
    }

    subscribeToRoom(roomCode, callback) {
        return this.supabase
            .channel('room:' + roomCode)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rooms',
                filter: `room_code=eq.${roomCode}`
            }, callback)
            .subscribe();
    }

    async leaveRoom(roomCode, userId) {
        await this.supabase.from('rooms').update({ status: 'cancelled' })
            .eq('room_code', roomCode)
            .or(`host_id.eq.${userId},guest_id.eq.${userId}`);
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }
}

const api = new API();
console.log('API instance created:', typeof api);
