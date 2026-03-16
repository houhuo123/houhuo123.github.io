class WolfEatSheepGame {
    constructor() {
        this.board = Array(26).fill(null); // 1-25为棋盘位置
        this.currentPlayer = 'wolf';
        this.gameStatus = 'ready';
        this.selectedPiece = null;
        this.wolfCount = 3;
        this.sheepCount = 15;
        this.socket = null;
        this.roomId = null;
        this.playerRole = null;
        this.isOnline = false;
        
        // 棋盘交叉点坐标映射（5x5网格）
        this.positionMap = {
            1: { x: 80, y: 80 },
            2: { x: 160, y: 80 },
            3: { x: 240, y: 80 },
            4: { x: 320, y: 80 },
            5: { x: 400, y: 80 },
            6: { x: 80, y: 160 },
            7: { x: 160, y: 160 },
            8: { x: 240, y: 160 },
            9: { x: 320, y: 160 },
            10: { x: 400, y: 160 },
            11: { x: 80, y: 240 },
            12: { x: 160, y: 240 },
            13: { x: 240, y: 240 },
            14: { x: 320, y: 240 },
            15: { x: 400, y: 240 },
            16: { x: 80, y: 320 },
            17: { x: 160, y: 320 },
            18: { x: 240, y: 320 },
            19: { x: 320, y: 320 },
            20: { x: 400, y: 320 },
            21: { x: 80, y: 400 },
            22: { x: 160, y: 400 },
            23: { x: 240, y: 400 },
            24: { x: 320, y: 400 },
            25: { x: 400, y: 400 }
        };
        
        // 初始化DOM元素
        this.boardElement = document.getElementById('board');
        this.currentPlayerElement = document.getElementById('current-player');
        this.gameStatusElement = document.getElementById('game-status');
        this.wolfCountElement = document.getElementById('wolf-count');
        this.sheepCountElement = document.getElementById('sheep-count');
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.surrenderBtn = document.getElementById('surrender-btn');
        this.messageBox = document.getElementById('message-box');
        this.messageTitle = document.getElementById('message-title');
        this.messageText = document.getElementById('message-text');
        this.messageBtn = document.getElementById('message-btn');
        
        this.init();
    }
    
    init() {
        this.createBoard();
        this.bindEvents();
        this.resetGame();
        this.showOnlinePrompt();
    }
    
    createBoard() {
        this.boardElement.innerHTML = '';
        
        // 创建棋盘线条
        this.createBoardLines();
        
        // 创建交叉点
        for (let i = 1; i <= 25; i++) {
            const pos = this.positionMap[i];
            const intersection = document.createElement('div');
            intersection.classList.add('intersection');
            intersection.dataset.position = i;
            intersection.style.left = `${pos.x - 15}px`;
            intersection.style.top = `${pos.y - 15}px`;
            
            // 添加阿拉伯数字
            const number = document.createElement('div');
            number.classList.add('intersection-number');
            number.textContent = i.toString();
            intersection.appendChild(number);
            
            intersection.addEventListener('click', () => this.handleIntersectionClick(i));
            this.boardElement.appendChild(intersection);
        }
    }
    
    createBoardLines() {
        // 创建水平线
        for (let y = 0; y <= 4; y++) {
            const line = document.createElement('div');
            line.classList.add('board-line', 'horizontal');
            line.style.top = `${y * 80 + 80}px`;
            this.boardElement.appendChild(line);
        }
        
        // 创建垂直线
        for (let x = 0; x <= 4; x++) {
            const line = document.createElement('div');
            line.classList.add('board-line', 'vertical');
            line.style.left = `${x * 80 + 80}px`;
            this.boardElement.appendChild(line);
        }
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.stopBtn.addEventListener('click', () => this.stopGame());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.surrenderBtn.addEventListener('click', () => this.surrender());
        this.messageBtn.addEventListener('click', () => this.hideMessage());
    }
    
    showOnlinePrompt() {
        const promptBox = document.createElement('div');
        promptBox.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000;">
                <div style="background-color: white; padding: 30px; border-radius: 10px; text-align: center; max-width: 400px;">
                    <h2 style="color: #8B4513; margin-bottom: 20px;">联网对战</h2>
                    <p style="margin-bottom: 20px;">请选择游戏模式：</p>
                    <button id="create-room-btn" style="padding: 10px 20px; margin: 5px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">创建房间</button>
                    <button id="join-room-btn" style="padding: 10px 20px; margin: 5px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">加入房间</button>
                    <button id="local-game-btn" style="padding: 10px 20px; margin: 5px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer;">本地游戏</button>
                </div>
            </div>
        `;
        document.body.appendChild(promptBox);
        
        document.getElementById('create-room-btn').addEventListener('click', () => {
            promptBox.remove();
            this.createRoom();
        });
        
        document.getElementById('join-room-btn').addEventListener('click', () => {
            const roomId = prompt('请输入房间ID：');
            if (roomId) {
                promptBox.remove();
                this.joinRoom(roomId);
            }
        });
        
        document.getElementById('local-game-btn').addEventListener('click', () => {
            promptBox.remove();
            this.isOnline = false;
            this.showMessage('游戏开始', '本地游戏模式，狼先手，请开始游戏！');
        });
    }
    
    createRoom() {
        this.socket = io('http://localhost:3000');
        this.isOnline = true;
        
        this.socket.on('connect', () => {
            console.log('连接成功');
            this.socket.emit('createRoom');
        });
        
        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomId;
            this.playerRole = data.role;
            this.showMessage('房间创建成功', `房间ID：${this.roomId}\n您的角色：${this.playerRole === 'wolf' ? '狼' : '羊'}\n等待其他玩家加入...`);
            this.updateGameInfo();
        });
        
        this.socket.on('gameState', (gameState) => {
            this.updateGameState(gameState);
        });
        
        this.socket.on('moveResult', (result) => {
            if (!result.success) {
                this.showMessage('移动失败', result.message);
            }
        });
        
        this.socket.on('error', (error) => {
            this.showMessage('错误', error.message);
        });
    }
    
    joinRoom(roomId) {
        this.socket = io('http://localhost:3000');
        this.isOnline = true;
        
        this.socket.on('connect', () => {
            console.log('连接成功');
            this.socket.emit('joinRoom', roomId);
        });
        
        this.socket.on('roomJoined', (data) => {
            this.roomId = data.roomId;
            this.playerRole = data.role;
            this.showMessage('加入成功', `您的角色：${this.playerRole === 'wolf' ? '狼' : '羊'}\n游戏开始！`);
            this.updateGameInfo();
        });
        
        this.socket.on('gameState', (gameState) => {
            this.updateGameState(gameState);
        });
        
        this.socket.on('moveResult', (result) => {
            if (!result.success) {
                this.showMessage('移动失败', result.message);
            }
        });
        
        this.socket.on('error', (error) => {
            this.showMessage('错误', error.message);
        });
    }
    
    updateGameState(gameState) {
        this.board = gameState.board;
        this.currentPlayer = gameState.currentPlayer;
        this.gameStatus = gameState.gameStatus;
        this.wolfCount = gameState.wolfCount;
        this.sheepCount = gameState.sheepCount;
        
        this.renderBoard();
        this.updateGameInfo();
        
        if (gameState.winner) {
            this.showMessage('游戏结束', `${gameState.winner === 'wolf' ? '狼' : '羊'}胜利！`);
        }
    }
    
    startGame() {
        if (this.isOnline) {
            // 联网模式下由服务器控制游戏开始
            return;
        }
        
        this.gameStatus = 'playing';
        this.updateGameInfo();
        this.showMessage('游戏开始', '狼先手，请开始游戏！');
    }
    
    stopGame() {
        if (this.isOnline) {
            this.showMessage('提示', '联网模式下无法暂停游戏');
            return;
        }
        
        this.gameStatus = 'paused';
        this.updateGameInfo();
        this.showMessage('游戏暂停', '游戏已暂停，点击开始游戏继续。');
    }
    
    resetGame() {
        if (this.isOnline && this.socket) {
            this.socket.emit('resetGame', this.roomId);
            return;
        }
        
        this.gameStatus = 'ready';
        this.currentPlayer = 'wolf';
        this.selectedPiece = null;
        this.wolfCount = 3;
        this.sheepCount = 15;
        
        // 初始化棋盘
        this.board = Array(26).fill(null);
        
        // 放置狼的初始位置（第一行中间三个位置：2, 3, 4）
        this.board[2] = 'wolf';
        this.board[3] = 'wolf';
        this.board[4] = 'wolf';
        
        // 放置羊的初始位置（第三、四、五行：11-25）
        for (let i = 11; i <= 25; i++) {
            this.board[i] = 'sheep';
        }
        
        this.renderBoard();
        this.updateGameInfo();
        this.showMessage('游戏重置', '棋盘已重置，狼先手，请开始游戏！');
    }
    
    surrender() {
        if (this.isOnline) {
            this.showMessage('提示', '联网模式下请等待对手');
            return;
        }
        
        const winner = this.currentPlayer === 'wolf' ? '羊' : '狼';
        this.gameStatus = 'ended';
        this.updateGameInfo();
        this.showMessage('游戏结束', `${this.currentPlayer === 'wolf' ? '狼' : '羊'}认输，${winner}胜利！`);
    }
    
    handleIntersectionClick(position) {
        if (this.gameStatus !== 'playing') return;
        
        if (this.isOnline) {
            // 联网模式下，只有当前玩家是自己的角色时才能操作
            if (this.currentPlayer !== this.playerRole) {
                this.showMessage('提示', '等待对方玩家行动');
                return;
            }
        }
        
        const piece = this.board[position];
        
        if (this.selectedPiece === null) {
            // 选择棋子
            if (piece && piece === (this.isOnline ? this.playerRole : this.currentPlayer)) {
                this.selectedPiece = position;
                this.highlightValidMoves(position);
            }
        } else {
            // 移动棋子
            if (this.isValidMove(this.selectedPiece, position)) {
                if (this.isOnline) {
                    // 联网模式下发送移动请求
                    this.socket.emit('makeMove', {
                        roomId: this.roomId,
                        from: this.selectedPiece,
                        to: position
                    });
                } else {
                    // 本地模式下直接移动
                    this.makeMove(this.selectedPiece, position);
                    this.checkGameEnd();
                    this.switchPlayer();
                }
            }
            this.selectedPiece = null;
            this.renderBoard();
        }
    }
    
    isValidMove(from, to) {
        const piece = this.board[from];
        
        if (piece === 'wolf') {
            // 狼可以移动到空位或羊的位置（吃羊）
            return this.isValidWolfMove(from, to);
        } else if (piece === 'sheep') {
            // 羊只能移动到空位
            if (this.board[to] !== null) return false;
            return this.isValidSheepMove(from, to);
        }
        
        return false;
    }
    
    isValidWolfMove(from, to) {
        // 计算位置差
        const fromRow = Math.ceil(from / 5);
        const fromCol = (from - 1) % 5 + 1;
        const toRow = Math.ceil(to / 5);
        const toCol = (to - 1) % 5 + 1;
        
        // 检查是否是直线移动
        if (fromRow !== toRow && fromCol !== toCol) {
            return false;
        }
        
        // 计算距离
        const distance = Math.max(Math.abs(fromRow - toRow), Math.abs(fromCol - toCol));
        
        // 普通移动（距离为1，目标位置为空）
        if (distance === 1 && this.board[to] === null) {
            return true;
        }
        
        // 吃子移动（距离为2，目标位置是羊，中间位置为空）
        if (distance === 2 && this.board[to] === 'sheep') {
            // 计算中间位置
            const midRow = (fromRow + toRow) / 2;
            const midCol = (fromCol + toCol) / 2;
            const midPosition = (midRow - 1) * 5 + midCol;
            
            // 检查中间位置是否为空
            return this.board[midPosition] === null;
        }
        
        return false;
    }
    
    isValidSheepMove(from, to) {
        // 计算位置差
        const fromRow = Math.ceil(from / 5);
        const fromCol = (from - 1) % 5 + 1;
        const toRow = Math.ceil(to / 5);
        const toCol = (to - 1) % 5 + 1;
        
        // 检查是否是直线移动
        if (fromRow !== toRow && fromCol !== toCol) {
            return false;
        }
        
        // 计算距离
        const distance = Math.max(Math.abs(fromRow - toRow), Math.abs(fromCol - toCol));
        
        // 羊只能移动一格
        return distance === 1;
    }
    
    makeMove(from, to) {
        const piece = this.board[from];
        this.board[from] = null;
        
        // 检查是否是吃羊移动
        if (piece === 'wolf' && this.board[to] === 'sheep') {
            // 吃掉羊
            this.sheepCount--;
            this.sheepCountElement.textContent = this.sheepCount;
        }
        
        // 移动棋子到目标位置
        this.board[to] = piece;
        this.playMoveSound();
        this.renderBoard();
    }
    
    playMoveSound() {
        // 简单的落子声音效果
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // 忽略音频错误
        }
    }
    
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'wolf' ? 'sheep' : 'wolf';
        this.updateGameInfo();
    }
    
    checkGameEnd() {
        // 检查狼是否吃光了羊
        if (this.sheepCount === 0) {
            this.gameStatus = 'ended';
            this.updateGameInfo();
            this.showMessage('游戏结束', '狼吃光了所有羊，狼胜利！');
            return;
        }
        
        // 检查狼是否被围死
        let wolfCanMove = false;
        for (let i = 1; i <= 25; i++) {
            if (this.board[i] === 'wolf') {
                if (this.hasValidMoves(i)) {
                    wolfCanMove = true;
                    break;
                }
            }
        }
        
        if (!wolfCanMove) {
            this.gameStatus = 'ended';
            this.updateGameInfo();
            this.showMessage('游戏结束', '狼被围死无法移动，羊胜利！');
        }
    }
    
    hasValidMoves(position) {
        for (let i = 1; i <= 25; i++) {
            if (this.isValidMove(position, i)) {
                return true;
            }
        }
        return false;
    }
    
    highlightValidMoves(position) {
        this.renderBoard();
        
        for (let i = 1; i <= 25; i++) {
            if (this.isValidMove(position, i)) {
                const pos = this.positionMap[i];
                const validMove = document.createElement('div');
                validMove.classList.add('valid-move');
                validMove.style.left = `${pos.x - 20}px`;
                validMove.style.top = `${pos.y - 20}px`;
                validMove.addEventListener('click', () => this.handleIntersectionClick(i));
                this.boardElement.appendChild(validMove);
            }
        }
    }
    
    renderBoard() {
        // 清除所有高亮和棋子
        const validMoves = document.querySelectorAll('.valid-move');
        validMoves.forEach(move => move.remove());
        
        const pieces = document.querySelectorAll('.piece');
        pieces.forEach(piece => piece.remove());
        
        // 渲染棋子
        for (let i = 1; i <= 25; i++) {
            const piece = this.board[i];
            if (piece) {
                const pos = this.positionMap[i];
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece', piece);
                pieceElement.textContent = piece === 'wolf' ? '狼' : '羊';
                pieceElement.style.left = `${pos.x - 25}px`;
                pieceElement.style.top = `${pos.y - 25}px`;
                pieceElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleIntersectionClick(i);
                });
                this.boardElement.appendChild(pieceElement);
            }
        }
    }
    
    updateGameInfo() {
        let playerText = `当前玩家: ${this.currentPlayer === 'wolf' ? '狼' : '羊'}`;
        if (this.isOnline) {
            playerText += ` (您是: ${this.playerRole === 'wolf' ? '狼' : '羊'})`;
        }
        this.currentPlayerElement.textContent = playerText;
        
        let statusText = '';
        switch (this.gameStatus) {
            case 'ready': statusText = '准备开始'; break;
            case 'waiting': statusText = '等待玩家'; break;
            case 'playing': statusText = '游戏进行中'; break;
            case 'paused': statusText = '游戏暂停'; break;
            case 'ended': statusText = '游戏结束'; break;
        }
        if (this.isOnline && this.roomId) {
            statusText += ` (房间: ${this.roomId})`;
        }
        this.gameStatusElement.textContent = `游戏状态: ${statusText}`;
        
        this.wolfCountElement.textContent = this.wolfCount;
        this.sheepCountElement.textContent = this.sheepCount;
    }
    
    showMessage(title, text) {
        this.messageTitle.textContent = title;
        this.messageText.textContent = text;
        this.messageBox.classList.add('show');
    }
    
    hideMessage() {
        this.messageBox.classList.remove('show');
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    new WolfEatSheepGame();
});