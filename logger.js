import fs from 'fs/promises';
// createWriteStream is no longer needed if we only use appendFile for progeny.log
// import { createWriteStream } from 'fs'; 

const logFile = 'progeny.log';
// const stream = createWriteStream(logFile, { flags: 'a' }); // Removed stream

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

const bestProgramsLogFile = 'best_programs.log';

export async function logBestProgram(programJsonString, consoleLog = false) {
  // We might not need a timestamp for this file, as each line is a distinct program.
  // Or, add a timestamp if knowing *when* it was best is useful.
  // For now, just the program JSON.
  const logMessage = `${programJsonString}\n`;
  try {
    await fs.appendFile(bestProgramsLogFile, logMessage);
    if (consoleLog) { // Defaulting consoleLog to false, but providing the option
      console.log(`Best program logged: ${programJsonString}`);
    }
  } catch (err) {
    // Log error to the main log file or console if appending to best_programs.log fails
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ERROR: Failed to write to ${bestProgramsLogFile}: ${err.message}\n`;
    await fs.appendFile(logFile, errorMessage); // Log to main log
    console.error(errorMessage); // Also to console
  }
}

export function close() {
  // stream.end(); // stream for progeny.log was removed.
  // No other streams to close currently. This function can be a no-op or removed if not called.
  // For now, make it a no-op to avoid breaking existing calls to close().
  if (typeof console !== 'undefined' && console.log && process.env.NODE_ENV !== 'test') { // Avoid logging during tests if any
    // console.log("Logger close() called - no active streams to close.");
  }
}