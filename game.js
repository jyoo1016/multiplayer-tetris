// Game constants
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
    '#000000', // empty
    '#FF0000', // Z
    '#00FF00', // S
    '#0000FF', // J
    '#FFFF00', // L
    '#FF00FF', // T
    '#00FFFF', // I
    '#FFA500', // O
    '#808080'  // penalty line
];

// Tetromino shapes
const SHAPES = [
    [], // empty
    [[1, 1, 0], [0, 1, 1]], // Z
    [[0, 1, 1], [1, 1, 0]], // S
    [[1, 0, 0], [1, 1, 1]], // J
    [[0, 0, 1], [1, 1, 1]], // L
    [[0, 1, 0], [1, 1, 1]], // T
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]] // O
];

class Tetris {
    constructor(canvas, nextCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nextCanvas = nextCanvas;
        this.nextCtx = nextCanvas.getContext('2d');
        
        // Scale canvases for sharp pixels
        this.ctx.scale(BLOCK_SIZE, BLOCK_SIZE);
        this.nextCtx.scale(BLOCK_SIZE, BLOCK_SIZE);

        // Initialize game state
        this.reset();
    }

    reset() {
        this.grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
        this.score = 0;
        this.lines = 0;
        this.gameOver = false;
        this.piece = this.randomPiece();
        this.nextPiece = this.randomPiece();
        this.dropCounter = 0;
        this.dropInterval = 1000;
    }

    randomPiece() {
        const type = Math.floor(Math.random() * 7) + 1;
        const piece = {
            type: type,
            shape: SHAPES[type],
            pos: {
                x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
                y: 0
            }
        };
        return piece;
    }

    rotate(matrix) {
        const N = matrix.length;
        const result = matrix.map((row, i) => 
            matrix.map(col => col[i]).reverse()
        );
        return result;
    }

    collide(piece, pos) {
        for (let y = 0; y < piece.length; y++) {
            for (let x = 0; x < piece[y].length; x++) {
                if (piece[y][x] !== 0 &&
                    (this.grid[y + pos.y] &&
                    this.grid[y + pos.y][x + pos.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    merge(piece, pos) {
        piece.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.grid[y + pos.y][x + pos.x] = value;
                }
            });
        });
    }

    clearLines() {
        let linesCleared = 0;
        outer: for (let y = this.grid.length - 1; y >= 0; y--) {
            for (let x = 0; x < this.grid[y].length; x++) {
                if (this.grid[y][x] === 0) {
                    continue outer;
                }
            }
            
            const row = this.grid.splice(y, 1)[0].fill(0);
            this.grid.unshift(row);
            linesCleared++;
            y++;
        }
        
        if (linesCleared > 0) {
            this.score += linesCleared * 100;
            this.lines += linesCleared;
            
            // Emit lines cleared event for multiplayer
            if (linesCleared >= 2) {
                socket.emit('lines_cleared', {
                    gameId: gameId,
                    lineCount: Math.floor(linesCleared / 2)
                });
            }
        }
    }

    addPenaltyLines(count) {
        // Remove lines from top
        this.grid.splice(0, count);
        
        // Add penalty lines at bottom
        for (let i = 0; i < count; i++) {
            const penaltyLine = Array(COLS).fill(8); // 8 is penalty line color
            this.grid.push(penaltyLine);
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.grid.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.ctx.fillStyle = COLORS[value];
                    this.ctx.fillRect(x, y, 1, 1);
                }
            });
        });

        // Draw current piece
        this.piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.ctx.fillStyle = COLORS[this.piece.type];
                    this.ctx.fillRect(x + this.piece.pos.x, y + this.piece.pos.y, 1, 1);
                }
            });
        });

        // Draw next piece preview
        this.nextCtx.fillStyle = '#000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        this.nextPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.nextCtx.fillStyle = COLORS[this.nextPiece.type];
                    this.nextCtx.fillRect(x + 1, y + 1, 1, 1);
                }
            });
        });
    }

    move(dir) {
        this.piece.pos.x += dir;
        if (this.collide(this.piece.shape, this.piece.pos)) {
            this.piece.pos.x -= dir;
        }
    }

    drop() {
        this.piece.pos.y++;
        if (this.collide(this.piece.shape, this.piece.pos)) {
            this.piece.pos.y--;
            this.merge(this.piece.shape, this.piece.pos);
            this.clearLines();
            this.piece = this.nextPiece;
            this.nextPiece = this.randomPiece();
            
            // Check for game over
            if (this.collide(this.piece.shape, this.piece.pos)) {
                this.gameOver = true;
                socket.emit('game_over', gameId);
                return false;
            }
        }
        return true;
    }

    rotate() {
        const pos = this.piece.pos;
        let offset = 1;
        const rotated = this.rotate(this.piece.shape);
        this.piece.shape = rotated;
        
        while (this.collide(this.piece.shape, this.piece.pos)) {
            this.piece.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > this.piece.shape[0].length) {
                this.rotate(this.piece.shape);
                this.piece.pos = pos;
                return;
            }
        }
    }

    update(deltaTime) {
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.drop();
            this.dropCounter = 0;
        }
        this.draw();
    }
}

// Socket.io connection
const socket = io(window.location.origin);

// Add connection debugging
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
});

let gameId = null;
let player = null;
let opponent = null;

// Game instances
let playerGame = null;
let opponentGame = null;

// DOM elements
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const joinButton = document.getElementById('join-btn');
const waitingMessage = document.getElementById('waiting-message');
const waitingRoom = document.getElementById('waiting-room');
const waitingPlayersList = document.getElementById('waiting-players-list');
const player1Name = document.getElementById('player1-name');
const player2Name = document.getElementById('player2-name');
const statusMessage = document.getElementById('game-status');

// Join game button click handler
joinButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        console.log('Attempting to join game with name:', name);
        socket.emit('join_game', name);
        joinButton.disabled = true;
        waitingRoom.style.display = 'block';
        waitingMessage.textContent = 'Joining game...';
    }
});

// Socket event handlers
socket.on('waiting_players_update', (players) => {
    console.log('Received waiting players update:', players);
    waitingPlayersList.innerHTML = '<h3>Players in Waiting List:</h3>';
    if (players.length === 0) {
        waitingPlayersList.innerHTML += '<p>No players waiting</p>';
    } else {
        const ul = document.createElement('ul');
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player;
            ul.appendChild(li);
        });
        waitingPlayersList.appendChild(ul);
    }
});

socket.on('join_error', (message) => {
    alert(message);
    joinButton.disabled = false;
    waitingRoom.style.display = 'none';
});

socket.on('waiting_for_player', () => {
    console.log('Now waiting for another player');
    waitingMessage.textContent = 'Waiting for another player to join...';
});

socket.on('game_start', (data) => {
    console.log('Game starting:', data);
    gameId = data.gameId;
    player = data.player1;
    opponent = data.player2;
    
    // Update UI
    loginScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    player1Name.textContent = player;
    player2Name.textContent = opponent;
    statusMessage.textContent = 'Game in progress...';

    // Initialize games
    playerGame = new Tetris(
        document.getElementById('player1-canvas'),
        document.getElementById('next-piece-canvas')
    );
    opponentGame = new Tetris(
        document.getElementById('player2-canvas'),
        document.getElementById('next-piece-canvas')
    );

    // Start game loop
    let lastTime = 0;
    function update(time = 0) {
        const deltaTime = time - lastTime;
        lastTime = time;

        playerGame.update(deltaTime);
        
        // Send game state to opponent
        socket.emit('game_update', {
            gameId: gameId,
            grid: playerGame.grid,
            score: playerGame.score,
            lines: playerGame.lines
        });

        if (!playerGame.gameOver) {
            requestAnimationFrame(update);
        }
    }
    update();

    // Add keyboard controls
    document.addEventListener('keydown', event => {
        if (playerGame.gameOver) return;

        switch (event.keyCode) {
            case 37: // Left
                playerGame.move(-1);
                break;
            case 39: // Right
                playerGame.move(1);
                break;
            case 40: // Down
                playerGame.drop();
                break;
            case 38: // Up
                playerGame.rotate();
                break;
        }
    });
});

socket.on('opponent_update', (data) => {
    // Update opponent's game state
    opponentGame.grid = data.grid;
    opponentGame.score = data.score;
    opponentGame.lines = data.lines;
    document.getElementById('player2-score').textContent = `Score: ${data.score}`;
    document.getElementById('player2-lines').textContent = `Lines: ${data.lines}`;
});

socket.on('add_penalty_lines', (count) => {
    playerGame.addPenaltyLines(count);
});

socket.on('opponent_lost', () => {
    statusMessage.textContent = 'You won!';
    playerGame.gameOver = true;
});

socket.on('opponent_disconnected', () => {
    statusMessage.textContent = 'Opponent disconnected';
    playerGame.gameOver = true;
}); 