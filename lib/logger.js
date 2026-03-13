'use strict';

const fs = require('fs');
const path = require('path');

const logsDir = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
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

module.exports = { logCSV, getLogFilePath };
