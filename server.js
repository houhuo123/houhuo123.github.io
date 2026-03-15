const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.static(__dirname));

// 游戏房间管理
const rooms = new Map();

// 游戏状态
class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // socketId -> { playerId, role, socket }
    this.gameState = {
      board: Array(26).fill(null), // 1-25为棋盘位置
      currentPlayer: 'wolf',
      gameStatus: 'waiting', // waiting, playing, ended
      wolfCount: 3,
      sheepCount: 15,
      winner: null
    };
    this.initBoard();
  }

  initBoard() {
    // 初始化棋盘
    this.gameState.board = Array(26).fill(null);
    
    // 放置狼的初始位置（第一行中间三个位置：2, 3, 4）
    this.gameState.board[2] = 'wolf';
    this.gameState.board[3] = 'wolf';
    this.gameState.board[4] = 'wolf';
    
    // 放置羊的初始位置（第三、四、五行：11-25）
    for (let i = 11; i <= 25; i++) {
      this.gameState.board[i] = 'sheep';
    }
  }

  addPlayer(socketId, socket) {
    if (this.players.size >= 2) {
      return false;
    }

    const role = this.players.size === 0 ? 'wolf' : 'sheep';
    this.players.set(socketId, {
      playerId: socketId,
      role: role,
      socket: socket
    });

    if (this.players.size === 2) {
      this.gameState.gameStatus = 'playing';
      this.broadcastGameState();
    }

    return role;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    
    if (this.players.size === 0) {
      rooms.delete(this.roomId);
    } else {
      this.gameState.gameStatus = 'ended';
      this.gameState.winner = this.players.values().next().value.role;
      this.broadcastGameState();
    }
  }

  makeMove(from, to, playerRole) {
    if (this.gameState.gameStatus !== 'playing') {
      return { success: false, message: '游戏未开始' };
    }

    if (playerRole !== this.gameState.currentPlayer) {
      return { success: false, message: '不是你的回合' };
    }

    const piece = this.gameState.board[from];
    if (!piece || piece !== playerRole) {
      return { success: false, message: '请选择自己的棋子' };
    }

    if (!this.isValidMove(from, to)) {
      return { success: false, message: '无效的移动' };
    }

    // 执行移动
    this.gameState.board[from] = null;
    
    // 检查是否是吃羊移动
    if (piece === 'wolf' && this.gameState.board[to] === 'sheep') {
      this.gameState.sheepCount--;
    }
    
    this.gameState.board[to] = piece;
    
    // 检查游戏结束
    if (this.checkGameEnd()) {
      this.gameState.gameStatus = 'ended';
    } else {
      // 切换玩家
      this.gameState.currentPlayer = this.gameState.currentPlayer === 'wolf' ? 'sheep' : 'wolf';
    }

    this.broadcastGameState();
    return { success: true, message: '移动成功' };
  }

  isValidMove(from, to) {
    const piece = this.gameState.board[from];
    
    if (piece === 'wolf') {
      return this.isValidWolfMove(from, to);
    } else if (piece === 'sheep') {
      if (this.gameState.board[to] !== null) return false;
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
    if (distance === 1 && this.gameState.board[to] === null) {
      return true;
    }
    
    // 吃子移动（距离为2，目标位置是羊，中间位置为空）
    if (distance === 2 && this.gameState.board[to] === 'sheep') {
      // 计算中间位置
      const midRow = (fromRow + toRow) / 2;
      const midCol = (fromCol + toCol) / 2;
      const midPosition = (midRow - 1) * 5 + midCol;
      
      // 检查中间位置是否为空
      return this.gameState.board[midPosition] === null;
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

  checkGameEnd() {
    // 检查狼是否吃光了羊
    if (this.gameState.sheepCount === 0) {
      this.gameState.winner = 'wolf';
      return true;
    }
    
    // 检查狼是否被围死
    let wolfCanMove = false;
    for (let i = 1; i <= 25; i++) {
      if (this.gameState.board[i] === 'wolf') {
        if (this.hasValidMoves(i)) {
          wolfCanMove = true;
          break;
        }
      }
    }
    
    if (!wolfCanMove) {
      this.gameState.winner = 'sheep';
      return true;
    }
    
    return false;
  }

  hasValidMoves(position) {
    for (let i = 1; i <= 25; i++) {
      if (this.isValidMove(position, i)) {
        return true;
      }
    }
    return false;
  }

  broadcastGameState() {
    this.players.forEach((player) => {
      player.socket.emit('gameState', this.gameState);
    });
  }

  resetGame() {
    this.gameState = {
      board: Array(26).fill(null),
      currentPlayer: 'wolf',
      gameStatus: 'playing',
      wolfCount: 3,
      sheepCount: 15,
      winner: null
    };
    this.initBoard();
    this.broadcastGameState();
  }
}

// 生成房间ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

// 处理Socket连接
io.on('connection', (socket) => {
  console.log('新连接:', socket.id);

  // 创建房间
  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    const room = new GameRoom(roomId);
    rooms.set(roomId, room);
    
    const role = room.addPlayer(socket.id, socket);
    socket.join(roomId);
    
    socket.emit('roomCreated', { roomId, role });
    console.log(`玩家 ${socket.id} 创建了房间 ${roomId}，角色：${role}`);
  });

  // 加入房间
  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    const role = room.addPlayer(socket.id, socket);
    if (!role) {
      socket.emit('error', { message: '房间已满' });
      return;
    }

    socket.join(roomId);
    socket.emit('roomJoined', { roomId, role });
    console.log(`玩家 ${socket.id} 加入了房间 ${roomId}，角色：${role}`);
  });

  // 移动棋子
  socket.on('makeMove', (data) => {
    const { roomId, from, to } = data;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const result = room.makeMove(from, to, player.role);
    socket.emit('moveResult', result);
  });

  // 重置游戏
  socket.on('resetGame', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.resetGame();
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('连接断开:', socket.id);
    
    // 查找玩家所在的房间
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.removePlayer(socket.id);
        console.log(`玩家 ${socket.id} 离开了房间 ${roomId}`);
        break;
      }
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});