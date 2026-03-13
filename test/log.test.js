'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Point logs to an isolated temp directory *before* loading server.js so that
// the module picks up the override (each test file runs in its own process).
const tmpDir = path.join(os.tmpdir(), `patribingo-log-test-${process.pid}`);
process.env.LOG_DIR = tmpDir;

const { logCSV, getLogFilePath } = require('../lib/logger.js');

describe('CSV logging', () => {
  before(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getLogFilePath is inside LOG_DIR with YYYYMMDD.log format', () => {
    const logPath = getLogFilePath();
    assert.ok(logPath.startsWith(tmpDir),
      `expected path inside ${tmpDir}, got ${logPath}`);
    assert.match(path.basename(logPath), /^\d{8}\.log$/);
  });

  test('logCSV writes a properly-formatted CSV line for a join event', () => {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

    logCSV('join', 'TestUser');

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 1);

    const [timestamp, action, nick] = lines[0].split(',');
    assert.match(timestamp, /^"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.equal(action, '"join"');
    assert.equal(nick, '"TestUser"');
  });

  test('logCSV logs a check event with nick and event name', () => {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

    logCSV('check', 'María', 'Alguien bosteza');

    const content = fs.readFileSync(logPath, 'utf8');
    const line = content.trim();
    assert.ok(line.includes('"check"'));
    assert.ok(line.includes('"María"'));
    assert.ok(line.includes('"Alguien bosteza"'));
  });

  test('logCSV escapes double quotes per RFC 4180', () => {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

    logCSV('check', 'User "Nickname"', 'Event with "quotes"');

    const content = fs.readFileSync(logPath, 'utf8');
    assert.ok(content.includes('"User ""Nickname"""'));
    assert.ok(content.includes('"Event with ""quotes"""'));
  });

  test('multiple calls append multiple lines in order', () => {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

    logCSV('join', 'Alice');
    logCSV('check', 'Alice', 'Alguien llega tarde');
    logCSV('line', 'Alice');
    logCSV('bingo', 'Alice');

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 4);
    assert.ok(lines[0].includes('"join"'));
    assert.ok(lines[1].includes('"check"'));
    assert.ok(lines[2].includes('"line"'));
    assert.ok(lines[3].includes('"bingo"'));
  });
});
