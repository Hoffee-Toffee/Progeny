// Browser-safe logger for Progeny GUI (TypeScript)

export async function log(message: string, consoleLog = false) {
  const timestamp = new Date().toISOString()
  if (consoleLog) {
    console.log(`[${timestamp}] ${message}`)
  }
}

export async function warn(message: string, consoleLog = false) {
  const timestamp = new Date().toISOString()
  if (consoleLog) {
    console.warn(`[${timestamp}] WARN: ${message}`)
  }
}

export async function error(message: string, consoleLog = false) {
  const timestamp = new Date().toISOString()
  if (consoleLog) {
    console.error(`[${timestamp}] ERROR: ${message}`)
  }
}

export async function logBestProgram(
  programJsonString: string,
  consoleLog = false,
) {
  if (consoleLog) {
    console.log(`[BEST PROGRAM] ${programJsonString}`)
  }
}
