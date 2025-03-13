const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

const waitingPlayers = new Map();
const activeGames = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join_game', (playerName) => {
        console.log(`Player ${playerName} trying to join`);
        // Check if there's a waiting player
        let opponent = null;
        for (const [waitingSocket, name] of waitingPlayers) {
            if (waitingSocket !== socket) {
                opponent = waitingSocket;
                break;
            }
        }

        if (opponent) {
            // Start a game with the waiting player
            const gameId = `game_${Date.now()}`;
            const opponentName = waitingPlayers.get(opponent);
            waitingPlayers.delete(opponent);

            // Create game room
            socket.join(gameId);
            opponent.join(gameId);

            // Store game information
            activeGames.set(gameId, {
                player1: { socket: opponent, name: opponentName },
                player2: { socket: socket, name: playerName }
            });

            console.log(`Game ${gameId} started between ${opponentName} and ${playerName}`);

            // Notify both players that game is starting
            io.to(gameId).emit('game_start', {
                player1: opponentName,
                player2: playerName,
                gameId: gameId
            });
        } else {
            // Add player to waiting list
            waitingPlayers.set(socket, playerName);
            console.log(`Player ${playerName} added to waiting list`);
            socket.emit('waiting_for_player');
        }
    });

    socket.on('game_update', (data) => {
        // Forward game updates to opponent
        socket.to(data.gameId).emit('opponent_update', data);
    });

    socket.on('lines_cleared', (data) => {
        // When a player clears lines, send penalty to opponent
        socket.to(data.gameId).emit('add_penalty_lines', data.lineCount);
    });

    socket.on('game_over', (gameId) => {
        // Notify opponent of win
        socket.to(gameId).emit('opponent_lost');
        
        // Clean up game
        if (activeGames.has(gameId)) {
            const game = activeGames.get(gameId);
            game.player1.socket.leave(gameId);
            game.player2.socket.leave(gameId);
            activeGames.delete(gameId);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        
        // Remove from waiting players if present
        waitingPlayers.delete(socket);

        // Handle disconnection in active games
        for (const [gameId, game] of activeGames) {
            if (game.player1.socket === socket || game.player2.socket === socket) {
                io.to(gameId).emit('opponent_disconnected');
                activeGames.delete(gameId);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}); 