'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { events, GRID_SIZE, generateCard } = require('./lib/card.js');
const { logCSV } = require('./lib/logger.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Track how many users have checked each event
const eventCounts = {};
events.forEach((e) => { eventCounts[e] = 0; });

// Connected users: socketId -> { nick, card, checkedEvents, completedRows }
const users = {};

// Game state
let gameOver = false;
let bingoWinner = null;

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

/**
 * Check each row of user.card for a completed line and test for full-card bingo.
 * Emits 'line' and 'bingo' events via io; appends log entries.
 * @param {object} user - { nick, card, checkedEvents, completedRows }
 * @returns {boolean} true if all visible rows are complete (bingo)
 */
function checkLineAndBingo(user) {
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
  return allRowsDone;
}

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

    // Check rows for completed lines and test for bingo
    if (checkLineAndBingo(user)) {
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

module.exports = { app, server };
