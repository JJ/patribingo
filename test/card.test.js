'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { generateCard, events, GRID_SIZE } = require('../server.js');

describe('generateCard', () => {
  test('returns GRID_SIZE rows', () => {
    const card = generateCard();
    assert.equal(card.length, GRID_SIZE);
  });

  test('each row has GRID_SIZE cells', () => {
    const card = generateCard();
    for (const row of card) {
      assert.equal(row.length, GRID_SIZE);
    }
  });

  test('each row has at least one hidden cell', () => {
    const card = generateCard();
    for (const row of card) {
      const hiddenCount = row.filter((c) => !c.visible).length;
      assert.ok(hiddenCount >= 1, 'row must have at least one hidden cell');
    }
  });

  test('visible cells have non-empty event strings from events.json', () => {
    const card = generateCard();
    const eventSet = new Set(events);
    for (const row of card) {
      for (const cell of row) {
        if (cell.visible) {
          assert.ok(typeof cell.event === 'string' && cell.event.length > 0);
          assert.ok(eventSet.has(cell.event), `unknown event: ${cell.event}`);
        }
      }
    }
  });

  test('no duplicate visible events on the same card', () => {
    const card = generateCard();
    const seen = new Set();
    for (const row of card) {
      for (const cell of row) {
        if (cell.visible) {
          assert.ok(!seen.has(cell.event), `duplicate event: ${cell.event}`);
          seen.add(cell.event);
        }
      }
    }
  });

  test('different calls produce different cards', () => {
    const cards = Array.from({ length: 10 }, generateCard);
    const serialized = cards.map((c) => JSON.stringify(c));
    const unique = new Set(serialized);
    // With random shuffling across 10 cards we expect at least some variety
    assert.ok(unique.size > 1, 'all cards are identical – randomness broken');
  });
});

describe('events.json', () => {
  test('contains an array of strings', () => {
    assert.ok(Array.isArray(events));
    for (const e of events) {
      assert.equal(typeof e, 'string');
      assert.ok(e.length > 0);
    }
  });

  test('count allows a perfect square grid', () => {
    assert.ok(events.length >= GRID_SIZE * GRID_SIZE,
      `events (${events.length}) too few for a ${GRID_SIZE}×${GRID_SIZE} grid`);
  });
});
