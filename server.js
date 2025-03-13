const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files
app.use(express.static(__dirname));

// Store waiting players and active games
const waitingPlayers = new Map();
const activeGames = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join_game', (playerName) => {
        console.log(`${playerName} wants to join the game`);
        
        // Check if there are any waiting players
        if (waitingPlayers.size > 0) {
            // Get the first waiting player
            const [waitingSocketId, waitingPlayerName] = waitingPlayers.entries().next().value;
            const waitingSocket = io.sockets.sockets.get(waitingSocketId);
            
            // Create a new game
            const gameId = Date.now().toString();
            activeGames.set(gameId, {
                player1: waitingPlayerName,
                player2: playerName,
                player1Socket: waitingSocketId,
                player2Socket: socket.id
            });

            // Remove waiting player
            waitingPlayers.delete(waitingSocketId);

            // Notify both players that the game is starting
            waitingSocket.emit('game_start', {
                gameId: gameId,
                player1: waitingPlayerName,
                player2: playerName
            });
            socket.emit('game_start', {
                gameId: gameId,
                player1: waitingPlayerName,
                player2: playerName
            });

            // Update waiting players list for everyone
            io.emit('waiting_players_update', Array.from(waitingPlayers.values()));
        } else {
            // Add player to waiting list
            waitingPlayers.set(socket.id, playerName);
            socket.emit('waiting_for_player');
            
            // Update waiting players list for everyone
            io.emit('waiting_players_update', Array.from(waitingPlayers.values()));
        }
    });

    socket.on('game_update', (data) => {
        const game = activeGames.get(data.gameId);
        if (game) {
            const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
            io.to(opponentSocket).emit('opponent_update', {
                grid: data.grid,
                score: data.score,
                lines: data.lines
            });
        }
    });

    socket.on('lines_cleared', (data) => {
        const game = activeGames.get(data.gameId);
        if (game) {
            const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
            io.to(opponentSocket).emit('add_penalty_lines', data.lineCount);
        }
    });

    socket.on('game_over', (gameId) => {
        const game = activeGames.get(gameId);
        if (game) {
            const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
            io.to(opponentSocket).emit('opponent_lost');
            activeGames.delete(gameId);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        
        // Remove from waiting players if they were waiting
        if (waitingPlayers.has(socket.id)) {
            waitingPlayers.delete(socket.id);
            io.emit('waiting_players_update', Array.from(waitingPlayers.values()));
        }

        // Handle disconnection during active game
        for (const [gameId, game] of activeGames.entries()) {
            if (game.player1Socket === socket.id || game.player2Socket === socket.id) {
                const opponentSocket = game.player1Socket === socket.id ? game.player2Socket : game.player1Socket;
                io.to(opponentSocket).emit('opponent_disconnected');
                activeGames.delete(gameId);
                break;
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 