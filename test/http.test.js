'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');

// We need a fresh server instance for HTTP tests (without starting to listen)
// server.js exports { app, server } so we use supertest directly.
let request;
let serverInstance;

before(() => {
  const { app, server } = require('../server.js');
  serverInstance = server;
  request = supertest(app);
});

after((done) => {
  serverInstance.close(done);
});

describe('GET /api/events', () => {
  test('responds 200 with events array and counts object', async () => {
    const res = await request.get('/api/events').expect(200);
    assert.equal(typeof res.body, 'object');
    assert.ok(Array.isArray(res.body.events), 'events should be an array');
    assert.ok(res.body.events.length > 0, 'events should not be empty');
    assert.equal(typeof res.body.counts, 'object', 'counts should be an object');
    // Every event should have an entry in counts
    for (const ev of res.body.events) {
      assert.ok(Object.prototype.hasOwnProperty.call(res.body.counts, ev),
        `counts missing key for event: ${ev}`);
    }
  });
});

describe('GET /admin', () => {
  test('serves admin.html with 200', async () => {
    const res = await request.get('/admin').expect(200);
    assert.ok(res.text.includes('admin'), 'admin page should mention admin');
  });
});

describe('GET /', () => {
  test('serves index.html with 200', async () => {
    const res = await request.get('/').expect(200);
    assert.ok(res.text.includes('Patribingo'), 'index should include Patribingo title');
  });
});
