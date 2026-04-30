import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { getLegalMoves, applyMoveSim } from '../src/logic/gameLogic.js';
import { buildInitialBoard3, getLegalMoves3, applyMoveSim3, getAIMove3, getNextActivePlayer, isInCheck3 } from '../src/logic/gameLogic3.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const rooms = {};

const INITIAL_BOARD = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

function cloneBoard(b) {
    return b.map(row => [...row]);
}

// Lógica de avance de turno y AI para 3 jugadores
function advanceTurn3(room) {
    let attempts = 0;
    const total = room.activePlayers.length;
    let idx = room.activePlayers.indexOf(room.currentTurn);
    do {
        idx = (idx + 1) % total;
        attempts++;
    } while (room.eliminated.includes(room.activePlayers[idx]) && attempts < total + 1);
    
    room.currentTurn = room.activePlayers[idx];
}

function handleNextTurn3(roomId) {
    const room = rooms[roomId];
    if (!room || room.isOver) return;

    // Check win condition
    const active = room.activePlayers.filter(p => !room.eliminated.includes(p));
    if (active.length <= 1) {
        room.isOver = true;
        io.to(roomId).emit('gameOver3', { winner: active[0] });
        return;
    }

    const color = room.currentTurn;
    const playerId = room.players[color];

    if (playerId === 'ai') {
        // Schedule AI move
        setTimeout(() => {
            if (!rooms[roomId] || rooms[roomId].isOver) return;
            const r = rooms[roomId];
            
            const aiMove = getAIMove3(color, r.board, r.activePlayers, r.eliminated, r.moveHistory);
            
            if (aiMove) {
                const { from, to } = aiMove;
                const target = r.board[to.r][to.c];
                const isCapture = target !== null;
                
                // Ejecutar
                applyMoveSim3(r.board, from, to);
                
                // Registrar historial
                const piece = r.board[to.r][to.c];
                const notation = `AI_MOVE`; // Simplificado para el server
                r.moveHistory.push({ color, notation, hash: JSON.stringify(r.board) });

                if (isCapture && target[1] === 'k') {
                    if (!r.eliminated.includes(target[0])) r.eliminated.push(target[0]);
                }

                // Emitir movimiento a todos los clientes
                io.to(roomId).emit('opponentMove3', { from, to, piece, isCapture });

                advanceTurn3(r);
                io.to(roomId).emit('nextTurn3', { currentTurn: r.currentTurn, eliminated: r.eliminated });

                // Loop
                handleNextTurn3(roomId);
            } else {
                // Ahogado
                advanceTurn3(r);
                io.to(roomId).emit('nextTurn3', { currentTurn: r.currentTurn, eliminated: r.eliminated });
                handleNextTurn3(roomId);
            }
        }, 500 + Math.random() * 500); // 500-1000ms delay para simular "pensar"
    }
}

io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado:', socket.id);

    // ==========================================
    // MODO 2 JUGADORES
    // ==========================================
    socket.on('createRoom', (data, callback) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = {
            id: roomId,
            type: '2p',
            players: { w: socket.id, b: null },
            board: cloneBoard(INITIAL_BOARD),
            currentTurn: 'w',
            timeConfig: data.time || '10'
        };
        socket.join(roomId);
        callback({ success: true, roomId: roomId, color: 'w' });
    });

    socket.on('joinRoom', (roomId, callback) => {
        if (!roomId) return callback({ success: false, message: 'Código inválido.' });
        roomId = roomId.toUpperCase().trim();
        const room = rooms[roomId];
        if (!room || room.type !== '2p') return callback({ success: false, message: 'La sala no existe o es de otro modo.' });
        if (room.players.b) return callback({ success: false, message: 'La sala está llena.' });

        room.players.b = socket.id;
        socket.join(roomId);
        callback({ success: true, roomId: roomId, color: 'b', board: room.board, currentTurn: room.currentTurn, timeConfig: room.timeConfig });

        io.to(roomId).emit('gameStart', { message: 'Oponente conectado.', board: room.board, currentTurn: room.currentTurn });
    });

    socket.on('movePiece', (data) => {
        const { roomId, from, to } = data;
        const room = rooms[roomId];
        if (!room || room.type !== '2p') return;

        const isWhitePlayer = room.players.w === socket.id;
        const isBlackPlayer = room.players.b === socket.id;
        const playerColor = isWhitePlayer ? 'w' : (isBlackPlayer ? 'b' : null);
        
        if (!playerColor || room.currentTurn !== playerColor) return;

        const legalMoves = getLegalMoves(from.r, from.c, room.board);
        const isValid = legalMoves.some(m => m.r === to.r && m.c === to.c);

        if (isValid) {
            applyMoveSim(room.board, { from, to });
            room.currentTurn = room.currentTurn === 'w' ? 'b' : 'w';
            socket.to(roomId).emit('opponentMove', { from, to });
        }
    });

    // ==========================================
    // MODO 3 JUGADORES
    // ==========================================
    socket.on('createRoom3', (data, callback) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        // Por defecto, los otros asientos se llenan con 'ai'
        rooms[roomId] = {
            id: roomId,
            type: '3p',
            players: { w: socket.id, b: 'ai', r: 'ai' },
            activePlayers: ['w', 'b', 'r'],
            eliminated: [],
            board: buildInitialBoard3(['w','b','r']),
            currentTurn: 'w',
            timeConfig: data.time || '10',
            moveHistory: [],
            isOver: false
        };
        socket.join(roomId);
        callback({ success: true, roomId: roomId, color: 'w' });
    });

    socket.on('joinRoom3', (roomId, callback) => {
        if (!roomId) return callback({ success: false, message: 'Código inválido.' });
        roomId = roomId.toUpperCase().trim();
        const room = rooms[roomId];
        if (!room || room.type !== '3p') return callback({ success: false, message: 'La sala no existe o es de otro modo.' });
        
        let assignedColor = null;
        if (room.players.b === 'ai') {
            room.players.b = socket.id;
            assignedColor = 'b';
        } else if (room.players.r === 'ai') {
            room.players.r = socket.id;
            assignedColor = 'r';
        }

        if (!assignedColor) return callback({ success: false, message: 'La sala está llena.' });

        socket.join(roomId);
        callback({ 
            success: true, 
            roomId: roomId, 
            color: assignedColor, 
            board: room.board, 
            currentTurn: room.currentTurn, 
            timeConfig: room.timeConfig,
            players: room.players // Mandamos quién es quién para la UI
        });

        // Avisar a la sala que alguien entró y reemplazar a una IA
        io.to(roomId).emit('playerJoined3', { players: room.players });
    });

    socket.on('startGame3', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.type !== '3p') return;
        if (room.players.w !== socket.id) return; // Solo el creador puede iniciar

        io.to(roomId).emit('gameStart3', { board: room.board, currentTurn: room.currentTurn, players: room.players });
        
        // Si el primer turno es de la IA (raro, pero posible si w es IA), iniciarlo.
        handleNextTurn3(roomId);
    });

    socket.on('movePiece3', (data) => {
        const { roomId, from, to } = data;
        const room = rooms[roomId];
        if (!room || room.type !== '3p' || room.isOver) return;

        // Identificar color del jugador
        const color = Object.keys(room.players).find(key => room.players[key] === socket.id);
        
        if (!color || room.currentTurn !== color || room.eliminated.includes(color)) return;

        // Validar
        const legalMoves = getLegalMoves3(from.r, from.c, room.board, room.eliminated);
        const isValid = legalMoves.some(m => m.r === to.r && m.c === to.c);

        if (isValid) {
            const target = room.board[to.r][to.c];
            const isCapture = target !== null;

            applyMoveSim3(room.board, { from, to });
            room.moveHistory.push({ color, notation: 'HUMAN_MOVE', hash: JSON.stringify(room.board) });

            if (isCapture && target[1] === 'k') {
                if (!room.eliminated.includes(target[0])) room.eliminated.push(target[0]);
            }

            // Emitir
            io.to(roomId).emit('opponentMove3', { from, to, isCapture });

            advanceTurn3(room);
            io.to(roomId).emit('nextTurn3', { currentTurn: room.currentTurn, eliminated: room.eliminated });

            // Disparar ciclo (que procesará si el siguiente es IA)
            handleNextTurn3(roomId);
        }
    });

    // ==========================================
    // GENERALES
    // ==========================================
    socket.on('sendMessage', (data) => {
        const { roomId, message, sender } = data;
        if (!roomId || !message) return;
        const cleanMessage = message.trim().substring(0, 150);
        if (cleanMessage.length === 0) return;
        io.to(roomId).emit('receiveMessage', {
            message: cleanMessage,
            sender: sender,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (Object.values(room.players).includes(socket.id)) {
                io.to(roomId).emit('opponentDisconnected', { message: 'Alguien se ha desconectado.' });
                delete rooms[roomId];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Servidor de Ajedrez Online escuchando en el puerto ${PORT}`);
});
