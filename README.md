# Multiplayer Tetris

A real-time multiplayer Tetris game where players can compete against each other. When a player clears two lines, it adds a penalty line to their opponent's board.

## Features

- Real-time multiplayer gameplay
- Competitive mechanics with penalty lines
- Next piece preview
- Score tracking
- Live opponent board view

## Setup

1. Clone the repository:
```bash
git clone [your-repository-url]
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open `http://localhost:3000` in your browser to play

## How to Play

- Use arrow keys to control your piece:
  - Left/Right: Move piece
  - Up: Rotate piece
  - Down: Drop piece faster
- Clear two or more lines to send penalty lines to your opponent
- First player to reach the top loses

## Technologies Used

- Node.js
- Express
- Socket.IO
- HTML5 Canvas 