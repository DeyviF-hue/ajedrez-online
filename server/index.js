import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { getLegalMoves, applyMoveSim } from '../src/logic/gameLogic.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Permitir acceso desde Vite (puerto 5173/5174)
        methods: ["GET", "POST"]
    }
});

// Almacén de salas activas
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

// Crea una copia profunda del tablero inicial
function cloneBoard(b) {
    return b.map(row => [...row]);
}

io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado:', socket.id);

    // Crear Sala
    socket.on('createRoom', (data, callback) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        rooms[roomId] = {
            id: roomId,
            players: {
                w: socket.id,
                b: null
            },
            board: cloneBoard(INITIAL_BOARD),
            currentTurn: 'w',
            timeConfig: data.time || '10'
        };

        socket.join(roomId);
        console.log(`Sala creada: ${roomId} por ${socket.id}`);
        callback({ success: true, roomId: roomId, color: 'w' });
    });

    // Unirse a Sala
    socket.on('joinRoom', (roomId, callback) => {
        console.log(`[JOIN] Intento de unión a sala: "${roomId}" desde ${socket.id}`);
        
        if (!roomId) return callback({ success: false, message: 'Código de sala inválido.' });

        roomId = roomId.toUpperCase().trim();
        const room = rooms[roomId];

        if (!room) {
            console.log(`[JOIN ERROR] La sala "${roomId}" no existe en el servidor.`);
            return callback({ success: false, message: 'La sala no existe.' });
        }

        if (room.players.b) {
            return callback({ success: false, message: 'La sala está llena.' });
        }

        // Asignar al jugador B
        room.players.b = socket.id;
        socket.join(roomId);
        console.log(`Usuario ${socket.id} se unió a la sala ${roomId}`);
        
        callback({ success: true, roomId: roomId, color: 'b', board: room.board, currentTurn: room.currentTurn, timeConfig: room.timeConfig });

        // Avisar a la sala que el juego empieza
        io.to(roomId).emit('gameStart', {
            message: 'Oponente conectado. ¡Que empiece el juego!',
            board: room.board,
            currentTurn: room.currentTurn
        });
    });

    // Validar y ejecutar movimiento
    socket.on('movePiece', (data) => {
        const { roomId, from, to } = data;
        const room = rooms[roomId];
        
        if (!room) return;

        // Verificar de quién es el turno
        const isWhitePlayer = room.players.w === socket.id;
        const isBlackPlayer = room.players.b === socket.id;
        
        const playerColor = isWhitePlayer ? 'w' : (isBlackPlayer ? 'b' : null);
        
        // Si no es un jugador de esta sala o no es su turno, rechazar
        if (!playerColor || room.currentTurn !== playerColor) return;

        // Validar si el movimiento es legal usando la copia del tablero del servidor
        const legalMoves = getLegalMoves(from.r, from.c, room.board);
        const isValid = legalMoves.some(m => m.r === to.r && m.c === to.c);

        if (isValid) {
            // Aplicar el movimiento en el servidor para mantener sincronía
            applyMoveSim(room.board, { from, to });
            
            // Cambiar turno
            room.currentTurn = room.currentTurn === 'w' ? 'b' : 'w';

            // Emitir a los DEMÁS en la sala (el oponente)
            socket.to(roomId).emit('opponentMove', { from, to });
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        // Buscar si el usuario estaba en alguna sala
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.players.w === socket.id || room.players.b === socket.id) {
                // Notificar al otro jugador
                io.to(roomId).emit('opponentDisconnected', { message: 'Tu oponente se ha desconectado.' });
                // Limpiar la sala por simplicidad en esta versión
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
