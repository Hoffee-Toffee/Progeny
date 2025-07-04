import fs from 'fs/promises';
import { createWriteStream } from 'fs';

const logFile = 'progeny.log';
const stream = createWriteStream(logFile, { flags: 'a' });

export async function log(message, consoleLog = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  await fs.appendFile(logFile, logMessage);
  if (consoleLog) {
    console.log(`[${timestamp}] ${message}`);
  }
}

export async function warn(message, consoleLog = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] WARN: ${message}\n`;
  await fs.appendFile(logFile, logMessage);
  if (consoleLog) {
    console.warn(`[${timestamp}] WARN: ${message}`);
  }
}

export async function error(message, consoleLog = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ERROR: ${message}\n`;
  await fs.appendFile(logFile, logMessage);
  if (consoleLog) {
    console.error(`[${timestamp}] ERROR: ${message}`);
  }
}

export function close() {
  stream.end();
}