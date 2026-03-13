'use strict';

const fs = require('fs');
const path = require('path');

const events = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'events.json'), 'utf8'));
const GRID_SIZE = Math.floor(Math.sqrt(events.length));

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

module.exports = { events, GRID_SIZE, shuffle, generateCard };
