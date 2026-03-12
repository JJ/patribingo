'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const events = JSON.parse(fs.readFileSync(path.join(__dirname, 'events.json'), 'utf8'));
const GRID_SIZE = Math.floor(Math.sqrt(events.length));

// Track how many users have checked each event
const eventCounts = {};
events.forEach((e) => { eventCounts[e] = 0; });

// Connected users: socketId -> { nick, card, checkedEvents, completedRows }
const users = {};

// Game state
let gameOver = false;
let bingoWinner = null;

// ── Logging ──────────────────────────────────────────────────────────────────

const logsDir = process.env.LOG_DIR || path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function getLogFilePath() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return path.join(logsDir, `${y}${m}${d}.log`);
}

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function logCSV(...fields) {
  const timestamp = new Date().toISOString();
  const line = [timestamp, ...fields].map(csvEscape).join(',') + '\n';
  fs.appendFileSync(getLogFilePath(), line);
}

// ── Card generation ───────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle – returns a new shuffled array.
 * @param {Array} arr
 * @returns {Array}
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generates a bingo card as a 2-D array of cells.
 * Each cell: { event: string, visible: boolean }
 * The card is GRID_SIZE × GRID_SIZE.
 * Events are shuffled so every player gets a different arrangement.
 * At least one cell per row is hidden (visible: false) → players get different cards.
 */
function generateCard() {
  // Shuffle and take the first GRID_SIZE² events
  const shuffled = shuffle(events);
  const cardEvents = shuffled.slice(0, GRID_SIZE * GRID_SIZE);

  const rows = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    const row = [];
    for (let j = 0; j < GRID_SIZE; j++) {
      row.push({ event: cardEvents[i * GRID_SIZE + j], visible: true });
    }
    rows.push(row);
  }

  // Hide exactly one random cell per row so every card is unique
  for (let i = 0; i < GRID_SIZE; i++) {
    const hideIdx = Math.floor(Math.random() * GRID_SIZE);
    rows[i][hideIdx].visible = false;
  }

  return rows;
}

// ── HTTP routes ───────────────────────────────────────────────────────────────

const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/admin', adminLimiter, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/events', (_req, res) => {
  res.json({ events, counts: eventCounts });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  // Let a newly connected client know if the game is already over
  if (gameOver) {
    socket.emit('gameOver', bingoWinner);
  }

  // Player joins with a chosen nick
  socket.on('join', (nick) => {
    if (typeof nick !== 'string' || !nick.trim()) return;
    const safenick = nick.trim().slice(0, 40);
    const card = generateCard();
    users[socket.id] = {
      nick: safenick,
      card,
      checkedEvents: new Set(),
      completedRows: new Set()
    };
    socket.emit('card', card);
    logCSV('join', safenick);
  });

  // Player checks an event
  socket.on('checkEvent', (event) => {
    if (gameOver) return;
    const user = users[socket.id];
    if (!user || typeof event !== 'string') return;

    // Guard: the event must actually be on their visible card
    const allVisible = user.card.flat().filter((c) => c.visible).map((c) => c.event);
    if (!allVisible.includes(event)) return;

    if (user.checkedEvents.has(event)) return; // already checked
    user.checkedEvents.add(event);

    if (Object.prototype.hasOwnProperty.call(eventCounts, event)) {
      eventCounts[event]++;
    }

    logCSV('check', user.nick, event);

    // Broadcast updated counts to admin viewers
    io.emit('countsUpdate', { event, count: eventCounts[event] });

    // Check each row for a completed line
    let allRowsDone = true;
    for (let i = 0; i < user.card.length; i++) {
      const visibleCells = user.card[i].filter((c) => c.visible);
      if (visibleCells.length === 0) continue; // fully hidden row – skip

      const rowComplete = visibleCells.every((c) => user.checkedEvents.has(c.event));

      if (rowComplete) {
        if (!user.completedRows.has(i)) {
          user.completedRows.add(i);
          io.emit('line', user.nick);
          logCSV('line', user.nick);
        }
      } else {
        allRowsDone = false;
      }
    }

    // Check for bingo (all visible events on the whole card checked)
    if (allRowsDone) {
      gameOver = true;
      bingoWinner = user.nick;
      io.emit('bingo', user.nick);
      logCSV('bingo', user.nick);
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Patribingo running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server, generateCard, events, GRID_SIZE, logCSV, getLogFilePath };
