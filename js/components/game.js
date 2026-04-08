const CONNECT = 4;
const PLAYERS = ['red', 'yellow'];
const PLAYER_NAMES = { red: 'Rojo', yellow: 'Amarillo' };

const POWER_POINTS = { bomb: 0, columnShift: 2, freeze: 4, doubleDrop: 6 };

const EVENT_POOL = [
    { id: 'whirlwind', name: '🌪 Remolino', warning: 'En 3 segundos pasará un remolino.' },
    { id: 'earthquake', name: '🌋 Terremoto', warning: 'En 3 segundos habrá un terremoto.' },
    { id: 'gravityFlip', name: '🧲 Gravedad caótica', warning: 'En 3 segundos cambiará la gravedad.' },
    { id: 'autoBomb', name: '💣 Bomba', warning: 'En 3 segundos una bomba destruirá una ficha.' },
    { id: 'autoShift', name: '🌊 Ola', warning: 'En 3 segundos una ola moverá una columna.' },
    { id: 'autoFreeze', name: '❄️ Hielo', warning: 'En 3 segundos una columna se congelará.' },
    { id: 'bonusPiece', name: '⚡ Bonus', warning: 'En 3 segundos aparecerá una ficha extra.' },
];

const MAPS = {
    classic: { name: 'Clásico', setup: () => {} },
    obstacles: {
        name: '🧱 Obstáculos',
        setup: () => placeRandomBlockedCells(8)
    },
    chaos: {
        name: '🌪 Caos',
        setup: () => { eventFrequency = [2, 4]; }
    },
    frozen: {
        name: '❄️ Congelado',
        setup: () => {
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.3) frozenColumns[c] = 3;
            }
        }
    },
    random: {
        name: '🎲 Aleatorio',
        setup: () => {
            const keys = Object.keys(MAPS).filter(k => k !== 'random');
            MAPS[keys[Math.floor(Math.random() * keys.length)]].setup();
        }
    },
};

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
            this.enabled = false;
        }
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    play(type) {
        if (!this.enabled) return;
        this.resume();
        
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        
        switch(type) {
            case 'drop':
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'win':
                osc.frequency.setValueAtTime(523, now);
                osc.frequency.setValueAtTime(659, now + 0.15);
                osc.frequency.setValueAtTime(784, now + 0.3);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
            case 'bomb':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'whirlwind':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(800, now + 0.5);
                osc.frequency.linearRampToValueAtTime(200, now + 1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 1);
                osc.start(now);
                osc.stop(now + 1);
                break;
            case 'earthquake':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(80, now);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
            case 'freeze':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'power':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.setValueAtTime(800, now + 0.05);
                osc.frequency.setValueAtTime(600, now + 0.1);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            case 'bonus':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.setValueAtTime(600, now + 0.1);
                osc.frequency.setValueAtTime(800, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
        }
    }
}

const sound = new SoundManager();

class Game {
    constructor() {
        this.user = api.getCurrentUser();
        this.isMultiplayer = false;
        this.room = null;
        this.gameId = null;
        this.isHost = false;
        this.myColor = null;
        this.subscriptions = [];
        this.gameStarted = false;
        this.isInitialized = false;
        this.playerNames = {};
        this.gameSubscribed = false;

        this.init();
    }

    init() {
        if (!this.user) {
            window.location.href = '../html/login.html';
            return;
        }

        this.loadUserInfo();
        this.bindEvents();
        this.bindGameControls();
        this.bindMultiplayer();
        this.createEmptyBoard();
        this.renderBoard();
        this.isInitialized = true;
    }

    loadUserInfo() {
        document.getElementById('user-name').textContent = this.user.username;
        document.getElementById('user-points').textContent = (this.user.total_points || 0) + ' pts';
        document.getElementById('playerPoints').textContent = (this.user.total_points || 0) + ' pts';
    }

    vibrate(pattern = [50, 30, 50]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    bindEvents() {
        document.getElementById('profile-btn').addEventListener('click', () => this.showProfile());
        document.getElementById('save-email-btn').addEventListener('click', () => this.saveEmail());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('ranking-btn').addEventListener('click', () => this.showRanking());
        document.getElementById('multiplayer-btn').addEventListener('click', () => this.showMultiplayer());

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
                btn.closest('.modal').classList.add('hidden');
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    modal.classList.add('hidden');
                }
            });
        });
    }

    bindGameControls() {
        document.getElementById('modeSelect').addEventListener('change', () => this.updateBoardState());
        document.getElementById('rowsSelect').addEventListener('change', () => this.updateBoardState());
        document.getElementById('colsSelect').addEventListener('change', () => this.updateBoardState());

        document.getElementById('newGameBtn').addEventListener('click', () => this.startGame());

        document.querySelectorAll('.power-btn').forEach(btn => {
            btn.addEventListener('click', () => this.togglePower(btn.dataset.power));
        });
    }

    bindMultiplayer() {
        document.getElementById('create-room-btn')?.addEventListener('click', () => this.createRoom());
        document.getElementById('join-room-btn')?.addEventListener('click', () => this.joinRoom());
        document.getElementById('copy-code-btn')?.addEventListener('click', () => this.copyRoomCode());
        document.getElementById('leave-btn')?.addEventListener('click', () => this.leaveRoom());
    }

    updateBoardState() {
        const mode = document.getElementById('modeSelect').value;
        const hasMode = mode !== '';
        const boardEl = document.getElementById('board');
        const hint = document.getElementById('mode-hint');

        if (!this.gameStarted) {
            boardEl.classList.add('disabled');
            if (hint) hint.classList.remove('hidden');
        } else if (hasMode) {
            boardEl.classList.remove('disabled');
            if (hint) hint.classList.add('hidden');
            
            if (this.isMultiplayer && currentPlayer !== this.myColor) {
                boardEl.classList.add('disabled');
            }
        } else {
            boardEl.classList.add('disabled');
            if (hint) hint.classList.remove('hidden');
        }
    }

    startGame() {
        const mode = document.getElementById('modeSelect').value;
        if (!mode) {
            this.showAnnouncement('Selecciona un modo primero');
            return;
        }

        this.gameStarted = true;
        this.isMultiplayer = false;
        this.myColor = null;
        this.room = null;
        
        document.getElementById('mp-info').classList.add('hidden');
        
        this.resetState();
        this.updateBoardState();
        sound.play('power');
    }

    resetState() {
        rows = Number(document.getElementById('rowsSelect').value);
        cols = Number(document.getElementById('colsSelect').value);
        mode = document.getElementById('modeSelect').value;
        currentMap = document.getElementById('mapSelect').value;

        board = this.createEmptyBoardData();
        currentPlayer = 'red';
        gameOver = false;
        isBusy = false;
        selectedPower = null;
        turnCount = 0;
        frozenColumns = {};
        pendingDoubleDrop = false;
        eventScheduled = false;
        eventFrequency = [4, 8];
        powerUsage = {
            red: { bomb: false, columnShift: false, freeze: false, doubleDrop: false },
            yellow: { bomb: false, columnShift: false, freeze: false, doubleDrop: false },
        };

        MAPS[currentMap].setup();
        this.scheduleNextEvent();
        this.renderBoard();
        this.refreshHud();
        this.refreshPowers();
    }

    createEmptyBoard() {
        rows = 8;
        cols = 9;
        board = this.createEmptyBoardData();
    }

    createEmptyBoardData() {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => ({ piece: null, blocked: false }))
        );
    }

    scheduleNextEvent() {
        const min = eventFrequency[0];
        const max = eventFrequency[1];
        nextEventTurn = turnCount + randomInt(min, max);
        upcomingEvent = EVENT_POOL[randomInt(0, EVENT_POOL.length - 1)];
    }

    renderBoard(animatedDrop = null) {
        const boardEl = document.getElementById('board');
        boardEl.innerHTML = '';
        boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellData = board[r][c] || { piece: null, blocked: false };
                const cell = document.createElement('div');
                cell.className = 'cell';

                if (this.gameStarted && !gameOver && !isBusy) {
                    cell.classList.add('clickable');
                }

                if (cellData.blocked) cell.classList.add('blocked');
                if (frozenColumns[c] > 0) cell.classList.add('frozen');

                cell.addEventListener('click', () => this.onCellClick(c, r));
                boardEl.appendChild(cell);

                if (cellData.piece) {
                    const piece = document.createElement('div');
                    piece.className = `piece ${cellData.piece}`;

                    if (animatedDrop && animatedDrop.row === r && animatedDrop.col === c) {
                        piece.classList.add('drop');
                        piece.style.setProperty('--drop-from', `${animatedDrop.dropFrom}px`);
                    }

                    cell.appendChild(piece);
                }
            }
        }
    }

    onCellClick(col, row) {
        if (!this.gameStarted || gameOver || isBusy) return;

        if (selectedPower) {
            this.usePower(selectedPower, col, row);
            return;
        }

        if (mode === 'ai' && currentPlayer === 'yellow') return;

        if (this.isMultiplayer) {
            this.makeMove(col);
        } else {
            this.normalDrop(col);
        }
    }

    normalDrop(col) {
        if (frozenColumns[col] > 0) {
            this.showAnnouncement(`❄️ La columna ${col + 1} está congelada`);
            return;
        }

        const placed = this.dropPieceInColumn(col, currentPlayer);
        if (!placed) return;

        sound.play('drop');
        this.afterSuccessfulMove(placed.row, placed.col, currentPlayer);

        if (!gameOver && pendingDoubleDrop) {
            pendingDoubleDrop = false;
            const second = this.dropPieceInColumn(col, currentPlayer);
            if (second) {
                this.afterSuccessfulMove(second.row, second.col, currentPlayer, true);
            }
        }
    }

    dropPieceInColumn(col, player) {
        for (let r = rows - 1; r >= 0; r--) {
            if (board[r][col].blocked) continue;
            if (!board[r][col].piece) {
                board[r][col].piece = player;
                const dropDistance = (r + 1) * 90;
                this.renderBoard({ row: r, col, dropFrom: -dropDistance });
                return { row: r, col };
            }
        }
        return null;
    }

    afterSuccessfulMove(row, col, player, isExtraDrop = false) {
        if (!isExtraDrop) turnCount++;

        this.consumeFrozenColumns();
        this.refreshHud();

        const winCells = this.checkWinner(player);
        if (winCells.length) {
            this.markWinningCells(winCells);
            gameOver = true;
            playerPoints[player] += 1;
            this.savePlayerPoints();
            this.showAnnouncement(`🏆 Gana ${PLAYER_NAMES[player]}! +1 pt`);
            sound.play('win');
            this.vibrate([100, 50, 100, 50, 100]);
            this.onWin(player);
            return;
        }

        if (this.isBoardFull()) {
            gameOver = true;
            this.showAnnouncement('🤝 Empate caótico');
            return;
        }

        if (turnCount >= nextEventTurn && !isExtraDrop) {
            this.triggerRandomEventCountdown();
            return;
        }

        this.switchTurn();

        if (mode === 'ai' && currentPlayer === 'yellow' && !gameOver) {
            isBusy = true;
            setTimeout(() => this.aiMove(), 700);
        }
    }

    switchTurn() {
        currentPlayer = currentPlayer === 'red' ? 'yellow' : 'red';
        this.refreshHud();
        this.refreshPowers();
        this.updateTurnDisplay();
    }

    updateTurnDisplay() {
        const turnText = document.getElementById('turnText');
        
        if (this.isMultiplayer && this.playerNames) {
            const playerName = this.playerNames[currentPlayer] || PLAYER_NAMES[currentPlayer];
            const esMiTurno = currentPlayer === this.myColor;
            turnText.innerHTML = `
                Turno: <strong style="color: ${currentPlayer === 'red' ? 'var(--red1)' : 'var(--yellow1)'}">${playerName}</strong>
                ${esMiTurno ? '<span style="color: var(--success); margin-left: 8px">(Tu turno)</span>' : ''}
            `;
        } else {
            turnText.textContent = `Turno: ${PLAYER_NAMES[currentPlayer]}`;
        }
        turnText.style.color = currentPlayer === 'red' ? '#ff8b8b' : '#ffe46b';
    }

    consumeFrozenColumns() {
        Object.keys(frozenColumns).forEach(k => {
            frozenColumns[k]--;
            if (frozenColumns[k] <= 0) delete frozenColumns[k];
        });
    }

    checkWinner(player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].piece !== player) continue;

                for (const [dr, dc] of directions) {
                    const cells = [{ r, c }];
                    for (let i = 1; i < CONNECT; i++) {
                        const nr = r + dr * i;
                        const nc = c + dc * i;
                        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc].piece !== player) break;
                        cells.push({ r: nr, c: nc });
                    }
                    if (cells.length >= CONNECT) return cells;
                }
            }
        }
        return [];
    }

    markWinningCells(cells) {
        this.renderBoard();
        cells.forEach(({ r, c }) => {
            const index = r * cols + c;
            const cell = document.getElementById('board').children[index];
            const piece = cell?.querySelector('.piece');
            if (piece) piece.classList.add('win');
        });
    }

    isBoardFull() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!board[r][c].blocked && !board[r][c].piece) return false;
            }
        }
        return true;
    }

    refreshHud() {
        if (gameOver) return;
        const turnText = document.getElementById('turnText');
        turnText.textContent = `Turno: ${PLAYER_NAMES[currentPlayer]}`;
        turnText.style.color = currentPlayer === 'red' ? '#ff8b8b' : '#ffe46b';
        document.getElementById('connectCount').textContent = CONNECT;
    }

    refreshPowers() {
        document.getElementById('playerPoints').textContent = `${playerPoints[currentPlayer]} pts`;

        document.querySelectorAll('.power-btn').forEach(btn => {
            const power = btn.dataset.power;
            const hasPoints = playerPoints[currentPlayer] >= POWER_POINTS[power];
            btn.classList.remove('active', 'used', 'locked');
            if (!hasPoints) btn.classList.add('locked');
            if (selectedPower === power) btn.classList.add('active');
            if (powerUsage[currentPlayer][power]) btn.classList.add('used');
        });
    }

    togglePower(power) {
        if (gameOver || isBusy) return;
        const required = POWER_POINTS[power];

        if (playerPoints[currentPlayer] < required) {
            this.showAnnouncement(`Necesitas ${required} pts`);
            return;
        }

        if (powerUsage[currentPlayer][power]) {
            this.showAnnouncement('Ese poder ya fue usado');
            return;
        }

        selectedPower = selectedPower === power ? null : power;
        this.refreshPowers();
        sound.play('power');

        if (selectedPower) {
            const btn = document.querySelector(`[data-power="${power}"]`);
            this.showAnnouncement(`Poder: ${btn?.textContent.trim()}`);
        }
    }

    usePower(power, col, row) {
        if (power === 'bomb') {
            if (board[row][col].piece && board[row][col].piece !== currentPlayer) {
                this.createExplosion(col, row);
                board[row][col].piece = null;
                this.compactAllColumnsDown();
                powerUsage[currentPlayer][power] = true;
                selectedPower = null;
                sound.play('bomb');
                this.vibrate([100, 30, 100]);
                this.renderBoard();
                this.showAnnouncement(`💣 Bomba lanzada`);
                this.checkWinAfterPower();
            } else {
                this.showAnnouncement('Toca una ficha enemiga');
            }
        }

        if (power === 'columnShift') {
            if (frozenColumns[col] > 0) {
                this.showAnnouncement('Columna congelada');
                return;
            }
            this.moveColumnDown(col);
            powerUsage[currentPlayer][power] = true;
            selectedPower = null;
            this.renderBoard();
            sound.play('whirlwind');
            this.showAnnouncement('🌊 Columna agitada');
            this.checkWinAfterPower();
        }

        if (power === 'freeze') {
            frozenColumns[col] = 2;
            powerUsage[currentPlayer][power] = true;
            selectedPower = null;
            this.renderBoard();
            sound.play('freeze');
            this.showAnnouncement(`❄️ Columna ${col + 1} congelada`);
            this.switchTurn();
        }

        if (power === 'doubleDrop') {
            if (frozenColumns[col] > 0) {
                this.showAnnouncement('Columna congelada');
                return;
            }
            powerUsage[currentPlayer][power] = true;
            selectedPower = null;
            pendingDoubleDrop = true;
            this.normalDrop(col);
            sound.play('bonus');
            this.showAnnouncement('⚡ Doble ficha activada');
        }

        this.refreshPowers();
    }

    checkWinAfterPower() {
        const winCells = this.checkWinner(currentPlayer);
        if (winCells.length) {
            gameOver = true;
            this.markWinningCells(winCells);
            sound.play('win');
            this.vibrate([100, 50, 100, 50, 100]);
            this.showAnnouncement(`🏆 Gana ${PLAYER_NAMES[currentPlayer]}`);
            
            if (this.isMultiplayer && this.gameId) {
                api.finishGame(this.gameId, currentPlayer, board);
            }
        } else {
            this.switchTurn();
            if (this.isMultiplayer && this.gameId) {
                api.updateGame(this.gameId, board, currentPlayer);
            }
        }
    }

    moveColumnDown(col) {
        const bottom = board[rows - 1][col].piece;
        for (let r = rows - 1; r > 0; r--) {
            if (!board[r][col].blocked) {
                board[r][col].piece = board[r - 1][col].blocked ? null : board[r - 1][col].piece;
            }
        }
        if (!board[0][col].blocked) board[0][col].piece = bottom;
        this.compactAllColumnsDown();
    }

    compactAllColumnsDown() {
        for (let c = 0; c < cols; c++) {
            const pieces = [];
            const blockedRows = new Set();
            for (let r = rows - 1; r >= 0; r--) {
                if (board[r][c].blocked) blockedRows.add(r);
                if (board[r][c].piece) pieces.push(board[r][c].piece);
                board[r][c].piece = null;
            }
            for (let r = rows - 1; r >= 0; r--) {
                if (blockedRows.has(r)) continue;
                if (pieces.length) board[r][c].piece = pieces.shift();
            }
        }
    }

    aiMove() {
        if (gameOver) return;
        let move = this.findWinningMove('yellow');
        if (move == null) move = this.findWinningMove('red');
        if (move == null) move = this.findPreferredMove();
        if (move == null) move = this.findAnyValidMove();
        isBusy = false;
        if (move != null) this.normalDrop(move);
    }

    findWinningMove(player) {
        for (let c = 0; c < cols; c++) {
            if (frozenColumns[c] > 0) continue;
            const r = this.getDropRow(c);
            if (r == null) continue;
            board[r][c].piece = player;
            const win = this.checkWinner(player).length > 0;
            board[r][c].piece = null;
            if (win) return c;
        }
        return null;
    }

    findPreferredMove() {
        const center = Math.floor(cols / 2);
        const order = [];
        for (let i = 0; i < cols; i++) {
            const left = center - i;
            const right = center + i;
            if (left >= 0) order.push(left);
            if (right < cols && right !== left) order.push(right);
        }
        for (const c of order) {
            if (frozenColumns[c] > 0) continue;
            if (this.getDropRow(c) != null) return c;
        }
        return null;
    }

    findAnyValidMove() {
        const valid = [];
        for (let c = 0; c < cols; c++) {
            if (frozenColumns[c] > 0) continue;
            if (this.getDropRow(c) != null) valid.push(c);
        }
        return valid.length ? valid[randomInt(0, valid.length - 1)] : null;
    }

    getDropRow(col) {
        for (let r = rows - 1; r >= 0; r--) {
            if (board[r][col].blocked) continue;
            if (!board[r][col].piece) return r;
        }
        return null;
    }

    placeRandomBlockedCells(count) {
        let placed = 0;
        while (placed < count) {
            const r = randomInt(1, rows - 2);
            const c = randomInt(0, cols - 1);
            if (!board[r][c].blocked && !board[r][c].piece) {
                board[r][c].blocked = true;
                placed++;
            }
        }
    }

    triggerRandomEventCountdown() {
        if (eventScheduled) return;
        eventScheduled = true;
        let remaining = 3;
        const warning = upcomingEvent.warning;

        const showCountdown = () => {
            this.showAnnouncement(`${warning} (${remaining})`);
            remaining--;
            if (remaining > 0) {
                setTimeout(showCountdown, 1000);
            } else {
                this.showAnnouncement(`${upcomingEvent.name} en acción`);
                const eventId = upcomingEvent.id;
                setTimeout(async () => {
                    this[eventId]();
                    if (!gameOver) {
                        this.checkEventWin();
                        this.scheduleNextEvent();
                        this.switchTurn();
                        this.renderBoard();
                        
                        if (this.isMultiplayer && this.gameId) {
                            await api.updateGame(this.gameId, board, currentPlayer);
                        }
                        
                        if (mode === 'ai' && currentPlayer === 'yellow' && !gameOver) {
                            isBusy = true;
                            setTimeout(() => this.aiMove(), 700);
                        }
                    }
                    eventScheduled = false;
                }, 600);
            }
        };

        showCountdown();
    }

    checkEventWin() {
        const redWin = this.checkWinner('red');
        const yellowWin = this.checkWinner('yellow');
        if (redWin.length) {
            gameOver = true;
            this.markWinningCells(redWin);
            playerPoints['red'] += 1;
            this.savePlayerPoints();
            sound.play('win');
            this.vibrate([100, 50, 100, 50, 100]);
            this.showAnnouncement('🏆 Gana Rojo tras el caos!');
            
            if (this.isMultiplayer && this.gameId) {
                api.finishGame(this.gameId, 'red', board);
            }
        } else if (yellowWin.length) {
            gameOver = true;
            this.markWinningCells(yellowWin);
            playerPoints['yellow'] += 1;
            this.savePlayerPoints();
            sound.play('win');
            this.vibrate([100, 50, 100, 50, 100]);
            this.showAnnouncement('🏆 Gana Amarillo tras el caos!');
            
            if (this.isMultiplayer && this.gameId) {
                api.finishGame(this.gameId, 'yellow', board);
            }
        } else if (this.isBoardFull()) {
            gameOver = true;
            this.showAnnouncement('🤝 Empate caótico');
            
            if (this.isMultiplayer && this.gameId) {
                api.finishGame(this.gameId, null, board);
            }
        }
    }

    createExplosion(col, row) {
        const boardEl = document.getElementById('board');
        const colors = ['#ff6b35', '#ff0000', '#ffaa00', '#ff4500', '#ffcc00', '#ff0044'];
        const cellSize = 56;
        const gap = 6;
        const padding = 12;
        const centerX = padding + col * (cellSize + gap) + cellSize / 2;
        const centerY = padding + row * (cellSize + gap) + cellSize / 2;

        for (let i = 0; i < 16; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const angle = (i / 16) * Math.PI * 2;
            const distance = 30 + Math.random() * 50;
            const size = 6 + Math.random() * 10;
            
            particle.style.cssText = `
                position: absolute;
                left: ${centerX}px;
                top: ${centerY}px;
                width: ${size}px;
                height: ${size}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: 50%;
                --tx: ${Math.cos(angle) * distance}px;
                --ty: ${Math.sin(angle) * distance}px;
                animation: particle-explode 0.6s ease-out forwards;
                pointer-events: none;
                z-index: 1000;
            `;
            
            boardEl.appendChild(particle);
            setTimeout(() => particle.remove(), 600);
        }
    }

    whirlwind() {
        const boardEl = document.getElementById('board');
        boardEl.classList.add('swirl');
        sound.play('whirlwind');
        this.vibrate([50, 30, 50, 30, 50]);

        const pieces = [];
        const blocked = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].blocked) blocked.push({ r, c });
                if (board[r][c].piece) pieces.push(board[r][c].piece);
                board[r][c].piece = null;
            }
        }
        const empty = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!board[r][c].blocked) empty.push({ r, c });
            }
        }
        shuffle(empty);
        pieces.forEach((piece, i) => {
            if (i < empty.length) board[empty[i].r][empty[i].c].piece = piece;
        });

        setTimeout(() => boardEl.classList.remove('swirl'), 1000);
        this.showAnnouncement('🌪 Remolino');
    }

    earthquake() {
        const boardEl = document.getElementById('board');
        boardEl.classList.add('shake');
        sound.play('earthquake');
        this.vibrate([100, 50, 100, 50, 100, 50, 100]);

        const pieces = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].piece) pieces.push(board[r][c].piece);
                board[r][c].piece = null;
            }
        }
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
        shuffle(pieces);
        shuffle(dirs);
        pieces.forEach((piece, i) => {
            let placed = false;
            for (let d = 0; d < dirs.length; d++) {
                const [dr, dc] = dirs[d];
                const nr = Math.floor(i / cols) + dr;
                const nc = (i % cols) + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc].blocked && !board[nr][nc].piece) {
                    board[nr][nc].piece = piece;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                const r = Math.floor(i / cols);
                const c = i % cols;
                if (!board[r]?.[c]?.blocked) board[r][c].piece = piece;
            }
        });
        setTimeout(() => boardEl.classList.remove('shake'), 700);
        this.showAnnouncement('🌋 Terremoto');
    }

    gravityFlip() {
        const boardEl = document.getElementById('board');
        boardEl.classList.add('shake');
        sound.play('whirlwind');
        this.vibrate([50, 30, 50, 30, 50]);

        const pieces = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].piece) pieces.push(board[r][c].piece);
                board[r][c].piece = null;
            }
        }
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
        shuffle(pieces);
        pieces.forEach((piece, i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const shuffledDirs = [...dirs];
            shuffle(shuffledDirs);
            let placed = false;
            for (const [dr, dc] of shuffledDirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc].blocked && !board[nr][nc].piece) {
                    board[nr][nc].piece = piece;
                    placed = true;
                    break;
                }
            }
            if (!placed && board[r]?.[c]) board[r][c].piece = piece;
        });
        setTimeout(() => boardEl.classList.remove('shake'), 700);
        this.showAnnouncement('🧲 Gravedad caótica');
    }

    autoBomb() {
        const targets = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].piece) targets.push({ r, c });
            }
        }
        if (targets.length) {
            const t = targets[randomInt(0, targets.length - 1)];
            this.createExplosion(t.c, t.r);
            sound.play('bomb');
            this.vibrate([100, 30, 100]);
            board[t.r][t.c].piece = null;
            this.compactAllColumnsDown();
            this.showAnnouncement('💣 Bomba automática');
        }
    }

    autoShift() {
        const shift = Math.random() < 0.5 ? 1 : -1;
        const col = randomInt(0, cols - 1);
        const newCol = (col + shift + cols) % cols;
        if (!frozenColumns[col] && !frozenColumns[newCol]) {
            for (let r = 0; r < rows; r++) {
                const temp = board[r][col].piece;
                board[r][col].piece = board[r][newCol].piece;
                board[r][newCol].piece = temp;
            }
            const boardEl = document.getElementById('board');
            boardEl.classList.add('wave');
            sound.play('whirlwind');
            this.vibrate([50, 30, 50]);
            setTimeout(() => boardEl.classList.remove('wave'), 600);
            this.showAnnouncement('🌊 Ola automática');
        }
    }

    autoFreeze() {
        const available = [];
        for (let c = 0; c < cols; c++) {
            if (!frozenColumns[c]) available.push(c);
        }
        if (available.length) {
            frozenColumns[available[randomInt(0, available.length - 1)]] = 2;
            sound.play('freeze');
            this.vibrate([30, 20, 30]);
            this.showAnnouncement('❄️ Hielo automático');
        }
    }

    bonusPiece() {
        const empty = [];
        for (let c = 0; c < cols; c++) {
            if (!frozenColumns[c] && this.getDropRow(c) !== null) empty.push(c);
        }
        if (empty.length) {
            const col = empty[randomInt(0, empty.length - 1)];
            const row = this.getDropRow(col);
            board[row][col].piece = Math.random() < 0.5 ? 'red' : 'yellow';
            sound.play('bonus');
            this.vibrate([30, 20, 30]);
            this.showAnnouncement('⚡ Ficha extra');
        }
    }

    showAnnouncement(message, duration = 2000) {
        const el = document.getElementById('announcement');
        el.textContent = message;
        el.classList.remove('hidden');
        clearTimeout(this._announcementTimer);
        this._announcementTimer = setTimeout(() => el.classList.add('hidden'), duration);
    }

    loadPlayerPoints() {
        const saved = localStorage.getItem('4enRayaPlayerPoints');
        return saved ? JSON.parse(saved) : { red: 0, yellow: 0 };
    }

    savePlayerPoints() {
        localStorage.setItem('4enRayaPlayerPoints', JSON.stringify(playerPoints));
    }

    onWin(winner) {
        if (winner === 'red') {
            this.user.total_points = (this.user.total_points || 0) + 1;
            this.user.total_wins = (this.user.total_wins || 0) + 1;
            localStorage.setItem('user', JSON.stringify(this.user));
            document.getElementById('user-points').textContent = this.user.total_points + ' pts';
            api.saveGame(this.user.username, currentMap, true);
        }
    }

    showProfile() {
        document.getElementById('profile-name').textContent = this.user.username;
        document.getElementById('profile-email').textContent = this.user.email || 'Sin email';
        document.getElementById('profile-wins').textContent = this.user.total_wins || 0;
        document.getElementById('profile-points').textContent = this.user.total_points || 0;
        document.getElementById('profile-email-input').value = this.user.email || '';
        document.getElementById('profile-modal').classList.add('active');
        document.getElementById('profile-modal').classList.remove('hidden');
    }

    async saveEmail() {
        const email = document.getElementById('profile-email-input').value.trim();
        if (!email) return;
        try {
            await api.updateEmail(this.user.id, email);
            this.user.email = email;
            localStorage.setItem('user', JSON.stringify(this.user));
            document.getElementById('profile-email').textContent = email;
            this.showAnnouncement('Email guardado');
        } catch (err) {
            this.showAnnouncement('Error al guardar');
        }
    }

    logout() {
        api.logout();
        window.location.href = '../html/login.html';
    }

    async showRanking() {
        const modal = document.getElementById('ranking-modal');
        const list = document.getElementById('ranking-list');
        modal.classList.add('active');
        modal.classList.remove('hidden');
        list.innerHTML = '<p class="ranking-loading">Cargando...</p>';

        try {
            const ranking = await api.getRanking(20);
            if (!ranking.length) {
                list.innerHTML = '<p class="ranking-empty">No hay jugadores aún</p>';
            } else {
                list.innerHTML = ranking.map((p, i) => `
                    <div class="ranking-item ${i < 3 ? 'top-' + (i + 1) : ''}">
                        <span class="rank">#${i + 1}</span>
                        <span class="username">${p.username}</span>
                        <span class="points">${p.total_points} pts</span>
                    </div>
                `).join('');
            }
        } catch (err) {
            list.innerHTML = '<p class="ranking-empty">Error cargando</p>';
        }
    }

    showMultiplayer() {
        document.getElementById('multiplayer-modal').classList.add('active');
        document.getElementById('multiplayer-modal').classList.remove('hidden');
        document.getElementById('mp-home').classList.remove('hidden');
        document.getElementById('mp-room').classList.add('hidden');
        document.getElementById('mp-error').textContent = '';
    }

    async createRoom() {
        try {
            const room = await api.createRoom(this.user.id, this.user.username);
            this.room = room;
            this.isHost = true;
            this.myColor = 'red';
            this.playerNames = { red: this.user.username, yellow: null };
            
            document.getElementById('room-code').textContent = room.room_code;
            document.getElementById('mp-home').classList.add('hidden');
            document.getElementById('mp-room').classList.remove('hidden');
            document.getElementById('mp-status').innerHTML = `
                <div>🎨 Tú: <strong style="color: var(--red1)">Rojo</strong></div>
                <div style="margin-top: 8px; color: var(--yellow1)">Esperando a jugador amarillo...</div>
            `;
            document.getElementById('mp-status').className = 'mp-status waiting';
            
            this.listenToRoom(room.room_code);
        } catch (err) {
            document.getElementById('mp-error').textContent = err.message;
        }
    }

    async joinRoom() {
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();
        if (!code || code.length !== 6) {
            document.getElementById('mp-error').textContent = 'Código inválido (6 caracteres)';
            return;
        }

        try {
            document.getElementById('room-code').textContent = code;
            document.getElementById('mp-home').classList.add('hidden');
            document.getElementById('mp-room').classList.remove('hidden');
            document.getElementById('mp-status').innerHTML = 'Conectando...';
            document.getElementById('mp-status').className = 'mp-status waiting';
            
            this.listenToRoom(code);
            
            const room = await api.joinRoom(code, this.user.id, this.user.username);
            this.room = room;
            this.isHost = false;
            this.myColor = 'yellow';
            this.playerNames = { red: room.host_name || 'Jugador Rojo', yellow: this.user.username };
            
            document.getElementById('mp-status').innerHTML = `
                <div>🎨 Tú: <strong style="color: var(--yellow1)">Amarillo</strong></div>
                <div style="margin-top: 8px; color: var(--red1)">Esperando al rojo...</div>
            `;
            document.getElementById('mp-status').className = 'mp-status connected';
            document.getElementById('mp-status').innerHTML = `
                <div>🎨 Tú: <strong style="color: var(--yellow1)">Amarillo</strong></div>
                <div style="margin-top: 8px; color: var(--muted)">Esperando inicio...</div>
            `;
            
            setTimeout(async () => {
                await this.startMultiplayerGame();
                this.closeMultiplayerModal();
            }, 1000);
        } catch (err) {
            document.getElementById('mp-error').textContent = err.message;
            document.getElementById('mp-status').innerHTML = 'Error al conectar';
        }
    }

    async listenToRoom(roomCode) {
        const subscription = api.subscribeToRoom(roomCode, async (payload) => {
            const room = payload.new;
            console.log('Room update:', room);
            
            if (room.status === 'playing' && room.guest_name) {
                this.room = room;
                this.playerNames = { 
                    red: room.host_name || 'Jugador Rojo', 
                    yellow: room.guest_name || 'Jugador Amarillo' 
                };
                
                if (this.isHost) {
                    document.getElementById('mp-status').innerHTML = `
                        <div>🎨 Tú: <strong style="color: var(--red1)">Rojo</strong></div>
                        <div style="margin-top: 8px; color: var(--yellow1)">${room.guest_name} se unió como Amarillo!</div>
                    `;
                    document.getElementById('mp-status').className = 'mp-status connected';
                    
                    setTimeout(() => {
                        this.closeMultiplayerModal();
                        this.startMultiplayerGame();
                    }, 2000);
                } else {
                    this.playerNames = { 
                        red: room.host_name || 'Jugador Rojo', 
                        yellow: room.guest_name || 'Jugador Amarillo' 
                    };
                }
            }
        });
        
        this.subscriptions.push(subscription);
    }

    closeMultiplayerModal() {
        const modal = document.getElementById('multiplayer-modal');
        modal.classList.remove('active');
        modal.classList.add('hidden');
    }

    async startMultiplayerGame() {
        this.isMultiplayer = true;
        this.gameStarted = true;
        currentPlayer = 'red';
        
        document.getElementById('modeSelect').value = 'pvp';
        this.resetState();
        this.updateBoardState();
        
        document.getElementById('mp-info').classList.remove('hidden');
        document.getElementById('player-red-name').textContent = this.playerNames.red || 'Rojo';
        document.getElementById('player-yellow-name').textContent = this.playerNames.yellow || 'Amarillo';
        
        const miColor = this.myColor === 'red' ? 'Rojo' : 'Amarillo';
        this.showAnnouncement(`🎮 ¡Eres ${miColor}!`, 3000);
        
        this.updateTurnDisplay();
        
        if (this.isHost) {
            try {
                const game = await api.createGame(this.room.id);
                this.gameId = game.id;
                console.log('Game created with id:', this.gameId);
            } catch (e) {
                console.error('Error creating game:', e);
            }
        } else {
            try {
                await this.waitForGame();
            } catch (e) {
                console.error('Error waiting for game:', e);
            }
        }
        
        console.log('Starting game listener, gameId:', this.gameId);
        this.listenToGame();
    }

    async waitForGame() {
        console.log('waitForGame started, room.id:', this.room?.id);
        
        while (!this.gameId) {
            try {
                const game = await api.getGame(this.room.id);
                if (game && game.id) {
                    this.gameId = game.id;
                    console.log('Game found with id:', this.gameId);
                    
                    if (game.board_state) {
                        let boardData = game.board_state;
                        if (typeof boardData === 'string') {
                            boardData = JSON.parse(boardData);
                        }
                        if (boardData) {
                            this.syncBoard(boardData);
                        }
                    }
                    console.log('waitForGame returning');
                    return;
                }
            } catch (e) {
                console.log('getGame error:', e);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('waitForGame done, gameId:', this.gameId);
    }

    async listenToGame() {
        console.log('listenToGame called, gameId:', this.gameId, 'roomId:', this.room?.id);
        
        if (this.gameSubscribed) {
            console.log('Already subscribed to game');
            return;
        }
        
        if (!this.gameId && !this.room?.id) {
            console.log('listenToGame: no gameId or roomId, returning');
            return;
        }
        
        this.gameSubscribed = true;
        const gameId = this.gameId || this.room.id;
        console.log('Subscribing to game:', gameId);
        
        const subscription = api.subscribeToGame(gameId, (payload) => {
            console.log('Game update received:', payload);
            const game = payload.new;
            
            if (!game) {
                console.log('No game data in payload');
                return;
            }
            
            if (this.isHost && game.id && !this.gameId) {
                this.gameId = game.id;
            }
            
            if (game.board_state) {
                let newBoard;
                if (typeof game.board_state === 'string') {
                    try {
                        newBoard = JSON.parse(game.board_state);
                    } catch (e) {
                        console.error('Error parsing board:', e);
                        return;
                    }
                } else {
                    newBoard = game.board_state;
                }
                
                if (newBoard) {
                    this.syncBoard(newBoard);
                }
            }
            
            if (game.current_turn && game.current_turn !== currentPlayer) {
                currentPlayer = game.current_turn;
                this.updateTurnDisplay();
                this.updateBoardState();
            }
            
            if (game.status === 'finished' && game.winner) {
                gameOver = true;
                const winCells = this.checkWinner(game.winner);
                if (winCells.length) {
                    this.markWinningCells(winCells);
                }
                this.showAnnouncement(`🏆 ¡${this.playerNames[game.winner]} gana!`);
                sound.play('win');
            }
        });
        
        this.subscriptions.push(subscription);
    }

    syncBoard(newBoard) {
        if (!newBoard || !Array.isArray(newBoard)) {
            console.error('Invalid board data:', newBoard);
            return;
        }
        
        let hasChanges = false;
        
        for (let r = 0; r < Math.min(newBoard.length, rows); r++) {
            for (let c = 0; c < Math.min(newBoard[r].length, cols); c++) {
                const cellData = newBoard[r][c];
                const newPiece = cellData?.piece;
                const oldPiece = board[r]?.[c]?.piece;
                
                if (oldPiece !== newPiece) {
                    hasChanges = true;
                    if (board[r]) {
                        board[r][c] = {
                            piece: newPiece || null,
                            blocked: cellData?.blocked || false
                        };
                    }
                }
            }
        }
        
        if (hasChanges) {
            console.log('Board synced:', board);
            sound.play('drop');
            this.renderBoard();
            this.refreshHud();
        }
    }

    async makeMove(col) {
        if (this.isMultiplayer && currentPlayer !== this.myColor) {
            this.showAnnouncement('Espera tu turno');
            return;
        }
        
        if (frozenColumns[col] > 0) {
            this.showAnnouncement('Columna congelada');
            return;
        }
        
        const placed = this.dropPieceInColumn(col, currentPlayer);
        if (!placed) return;
        
        turnCount++;
        sound.play('drop');
        
        const winCells = this.checkWinner(currentPlayer);
        if (winCells.length) {
            gameOver = true;
            this.markWinningCells(winCells);
            playerPoints[currentPlayer] += 1;
            this.savePlayerPoints();
            sound.play('win');
            this.showAnnouncement(`🏆 ¡${this.playerNames[currentPlayer]} gana!`);
            
            if (this.gameId) {
                await api.finishGame(this.gameId, currentPlayer, board);
            }
            
            this.onWin(currentPlayer);
            return;
        }
        
        if (this.isBoardFull()) {
            gameOver = true;
            this.showAnnouncement('🤝 Empate');
            if (this.gameId) {
                await api.finishGame(this.gameId, null, board);
            }
            return;
        }
        
        if (turnCount >= nextEventTurn) {
            this.triggerRandomEventCountdown();
        } else {
            this.switchTurn();
        }
        
        if (this.isMultiplayer && this.gameId) {
            console.log('Sending move, gameId:', this.gameId);
            await api.updateGame(this.gameId, board, currentPlayer);
        }
    }

    copyRoomCode() {
        const code = document.getElementById('room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            this.showAnnouncement('¡Código copiado!', 1500);
        });
    }

    async leaveRoom() {
        if (this.isMultiplayer) {
            const confirmar = confirm('¿Seguro que quieres salir de la partida? Perderás el progreso.');
            if (!confirmar) return;
        }
        
        if (this.room) {
            try {
                await api.leaveRoom(this.room.room_code, this.user.id);
            } catch (e) {}
        }
        
        this.subscriptions.forEach(s => {
            try { s.unsubscribe(); } catch(e) {}
        });
        this.subscriptions = [];
        
        this.room = null;
        this.gameId = null;
        this.isHost = false;
        this.isMultiplayer = false;
        this.myColor = null;
        this.playerNames = {};
        this.gameSubscribed = false;
        
        document.getElementById('mp-home').classList.remove('hidden');
        document.getElementById('mp-room').classList.add('hidden');
        document.getElementById('join-code-input').value = '';
        this.closeMultiplayerModal();
        
        this.gameStarted = false;
        this.createEmptyBoard();
        this.renderBoard();
        this.updateBoardState();
    }
}

let playerPoints;
let board, rows, cols, currentPlayer, gameOver, isBusy, mode, currentMap;
let selectedPower = null;
let turnCount = 0;
let frozenColumns = {};
let nextEventTurn = 0;
let upcomingEvent = null;
let pendingDoubleDrop = false;
let eventScheduled = false;
let powerUsage;
let eventFrequency;

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    playerPoints = game.loadPlayerPoints();
});

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
